"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsapSetup";
import { useLenisRef } from "@/components/SmoothScrollProvider";
import {
  useHeroReveal,
  useLabActive,
  useParticleNetworkRef,
} from "@/components/home/ParticleNetworkContext";
import { getInitialQualityTier } from "@/lib/deviceCapability";
import { STATIONS } from "@/lib/labStations";
import useStationNavigator, { TRANSITION_MS } from "./useStationNavigator";

const SESSION_KEY = "nexus-lab-complete";
const SKIP_DELAY_MS = 2000;
// Subtle handheld drift while parked at a station, so a stopped camera
// still reads as alive rather than as a frozen render. Applied in
// ParticleNetwork's lab camera branch as an offset on top of control.cam,
// and dropped to 0 during transitions so it can't fight the tween.
const IDLE_AMPLITUDE = 0.14;

// "The Lab" — a hard gate, not a page section. On first visit this mounts
// as a fixed, full-viewport overlay above everything (including Header) and
// takes over input entirely. On completion the whole overlay unmounts —
// not hidden, gone — normal body scroll is restored, and there is no scroll
// position that brings it back this session.
//
// Navigation is discrete stations, not a scrubbed timeline: see
// useStationNavigator.js for the full rationale on why this reads raw input
// rather than using an isolated scroll container or CSS scroll-snap. The
// gate SHELL below (sessionStorage, reduced-motion bypass, Lenis stop/start,
// overflow locking, skip button, finish() teardown, heroReady handoff) is
// carried over from the previous scrub-based gate essentially unchanged —
// that part was reliable and only the internal navigation model moved.
export default function LabGate() {
  const [shouldRender, setShouldRender] = useState(null);
  const [ready, setReady] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [hud, setHud] = useState({ index: 0, complete: false });

  const fillRef = useRef(null);
  const controlRef = useRef(null);
  const camTweenRef = useRef(null);
  const finishedRef = useRef(false);
  const tierRef = useRef("high");
  const skipTimerRef = useRef(null);
  const scrollLockHandlerRef = useRef(null);
  const hudRafRef = useRef(null);

  const lenisRef = useLenisRef();
  const networkRef = useParticleNetworkRef();
  const { setHeroReady } = useHeroReveal();
  const { setLabActive } = useLabActive();

  useEffect(() => {
    let alreadyDone = false;
    try {
      alreadyDone = sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      // sessionStorage unavailable (private mode etc.) — treat as not done
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    tierRef.current = getInitialQualityTier();

    if (alreadyDone || reduceMotion) {
      // Never mounts — no overlay, no captured input, nothing to skip. The
      // page behaves as a completely normal page from the first paint.
      setHeroReady(true);
      setShouldRender(false);
      return;
    }

    lenisRef.current?.stop();
    // Locking body alone isn't sufficient in standards mode — <html> is the
    // actual scrolling element in most browsers. Kept from the previous
    // gate: the navigator now preventDefaults wheel/touch itself, so this
    // is defence in depth rather than the primary mechanism, but the cost
    // is nil and the failure mode it prevents (real page content peeking
    // out from behind the fixed overlay) was observed live.
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    function lockScrollPosition() {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    }
    scrollLockHandlerRef.current = lockScrollPosition;
    window.addEventListener("scroll", lockScrollPosition, { passive: true });
    setShouldRender(true);
  }, []);

  // The shared particle Canvas mounts asynchronously (next/dynamic, ssr
  // false), so its control object doesn't exist on this component's first
  // render. Poll for it, then flip `ready` — which is what actually enables
  // the navigator's input listeners. Without this gate the opening
  // onArrive(0) would fire against a null control and the camera would
  // never be placed.
  useEffect(() => {
    if (shouldRender !== true) return;
    let cancelled = false;
    let timer;

    function wait() {
      if (cancelled) return;
      const control = networkRef.current?.control;
      if (!control) {
        timer = setTimeout(wait, 16);
        return;
      }
      controlRef.current = control;
      setLabActive(true);
      control.labActive = true;
      control.restingDrift = false;
      control.burstProgress = 0;
      control.stationIndex = 0;
      control.stationTarget = 0;
      control.stationDisplay = 0;
      control.idleAmp = 0;
      control.cam = { ...STATIONS[0].cam };
      setReady(true);
      skipTimerRef.current = setTimeout(() => setShowSkip(true), SKIP_DELAY_MS);
    }
    wait();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(skipTimerRef.current);
    };
  }, [shouldRender, networkRef, setLabActive]);

  // Station arrival: a fixed-duration eased camera move to the next
  // station's pose. This is the single biggest departure from the scrubbed
  // gate — the motion is a tween with its own timing, so it plays
  // identically every time and cannot be jittered, stalled halfway, or
  // dragged backwards by noisy input mid-move. power2.inOut over 0.7s reads
  // as walking to the next exhibit: it commits immediately and settles
  // rather than drifting.
  function handleArrive(index) {
    const control = controlRef.current;
    if (!control) return;
    const target = STATIONS[index].cam;
    control.stationIndex = index;
    control.idleAmp = 0;

    camTweenRef.current?.kill();
    camTweenRef.current = gsap.to(control.cam, {
      ...target,
      duration: TRANSITION_MS / 1000,
      // power3 rather than power2: with the softer curve the move spends
      // its first ~150ms barely leaving, which reads as hesitation — the
      // camera looks like it is being dragged rather than walking. power3
      // commits harder out of the gate and still settles without a bump,
      // which is the "confident and clean" half of the brief.
      ease: "power3.inOut",
      overwrite: true,
      onComplete: () => {
        control.idleAmp = IDLE_AMPLITUDE;
      },
    });
  }

  function handleProgress(index, progress) {
    const control = controlRef.current;
    if (!control) return;
    control.stationTarget = progress;
  }

  useStationNavigator({
    enabled: shouldRender === true && ready,
    stations: STATIONS,
    onArrive: handleArrive,
    onProgress: handleProgress,
    onFinish: finish,
  });

  // HUD sampling. The progress bar's width is written STRAIGHT TO THE DOM
  // rather than through React state: progress changes every single frame
  // while the user is scrolling, and routing that through setState was
  // re-rendering this whole component (five indicator spans, captions,
  // inline styles) at up to 60Hz — main-thread work competing with the
  // exact camera tween it is meant to be reporting on. React state is now
  // reserved for the two things that genuinely change rarely: which
  // station is current, and whether it has finished building.
  useEffect(() => {
    if (!ready) return;
    let last = { index: -1, complete: null };
    function tick() {
      const control = controlRef.current;
      if (control) {
        const index = control.stationIndex ?? 0;
        const progress = control.stationDisplay ?? 0;

        if (fillRef.current) {
          fillRef.current.style.transform = `scaleX(${Math.min(1, progress)})`;
        }

        const complete = progress >= 0.995;
        if (index !== last.index || complete !== last.complete) {
          last = { index, complete };
          setHud({ index, complete });
        }
      }
      hudRafRef.current = requestAnimationFrame(tick);
    }
    hudRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(hudRafRef.current);
  }, [ready]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // ignore — worst case the lab replays next load
    }

    clearTimeout(skipTimerRef.current);
    cancelAnimationFrame(hudRafRef.current);
    camTweenRef.current?.kill();

    const control = networkRef.current?.control;
    if (control) {
      control.labActive = false;
      control.coalesceShape = null;
      control.coalesceProgress = 0;
      control.burstProgress = 1;
      control.restingDrift = true;
      control.pulseFlash = 0;
      control.cameraZ = 12;
      control.idleAmp = 0;
    }

    setLabActive(false);
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    if (scrollLockHandlerRef.current) {
      window.removeEventListener("scroll", scrollLockHandlerRef.current);
      scrollLockHandlerRef.current = null;
    }
    lenisRef.current?.start();
    window.scrollTo(0, 0);
    setHeroReady(true);
    setShouldRender(false);
  }

  if (shouldRender !== true) return null;

  const station = STATIONS[hud.index] ?? STATIONS[0];
  const complete = hud.complete;
  const hasBuild = (station.budget ?? 0) > 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] font-plex">
      {/* Station caption — bottom left, out of the way of the bay the
          camera is facing. Reads as exhibit signage rather than UI chrome. */}
      <div className="absolute bottom-10 left-8 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">
          {station.caption}
        </span>
        <span className="text-sm font-medium tracking-[0.12em] text-slate-700">
          {station.sub}
        </span>
      </div>

      {/* Station indicator — a dot per station with the current one showing
          a fill for build progress. This is the affordance that makes a
          discrete-jump gate legible: without it there is no way to know how
          many stops remain or that scrolling is doing anything while
          parked. */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-3">
        {STATIONS.map((s, i) => {
          const isCurrent = i === hud.index;
          const isPast = i < hud.index;
          return (
            <span
              key={s.id}
              className="relative block h-[3px] w-8 overflow-hidden rounded-full"
              style={{
                backgroundColor:
                  isCurrent && !hasBuild
                    ? "#2a9d8f"
                    : isPast
                      ? "#94a3b8"
                      : "#cbd5e1",
              }}
            >
              {isCurrent && hasBuild && (
                // scaleX rather than width: a transform is composited and
                // costs no layout, so writing it every frame from the rAF
                // loop above stays off the main thread's layout path.
                <span
                  ref={fillRef}
                  className="absolute inset-y-0 left-0 block w-full origin-left rounded-full bg-teal"
                  style={{ transform: "scaleX(0)" }}
                />
              )}
            </span>
          );
        })}
      </div>

      {/* Prompt flips between "keep going, the build is advancing" and
          "this one's done, next gesture moves you on" — the two states of
          the mechanic, made explicit so the input model is discoverable
          without instructions. */}
      <div className="absolute bottom-[4.6rem] left-1/2 -translate-x-1/2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400">
          {!hasBuild
            ? hud.index === 0
              ? "Scroll to enter"
              : "Scroll to continue"
            : complete
              ? "Scroll for next station"
              : "Keep scrolling"}
        </span>
      </div>

      {showSkip && (
        <button
          type="button"
          onClick={finish}
          className="pointer-events-auto absolute bottom-8 right-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 transition-colors hover:text-teal"
        >
          Skip
        </button>
      )}
    </div>
  );
}
