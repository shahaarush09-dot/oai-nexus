"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import SplitType from "split-type";
import { gsap, ScrollTrigger } from "@/lib/gsapSetup";
import { useLenisRef } from "@/components/SmoothScrollProvider";
import { useHeroReveal, useParticleNetworkRef } from "@/components/home/ParticleNetworkContext";
import { getInitialQualityTier } from "@/lib/deviceCapability";
import DormantLab from "./scenes/DormantLab";
import PowerOn from "./scenes/PowerOn";
import SystemsActivating from "./scenes/SystemsActivating";

const SESSION_KEY = "nexus-intro-seen";

// Full eventual sequence (all 5 scenes) targets 4000px of scroll on
// high-tier devices, 2400px on low-tier.
const FULL_DISTANCE = { high: 4000, low: 2400 };
const SKIP_DELAY_MS = 1500;
const SKIP_SCROLL_S = 1;

// Scattered starting offsets for piece-assembly pieces, cycled by index —
// a fixed, deterministic pattern rather than per-piece bespoke math, reused
// across all three Scene 3 modules.
const SCATTER = [
  { dx: -60, dy: -40, r: -25 },
  { dx: 55, dy: -35, r: 20 },
  { dx: -50, dy: 45, r: 15 },
  { dx: 60, dy: 40, r: -20 },
  { dx: -70, dy: 5, r: 30 },
  { dx: 65, dy: -10, r: -30 },
  { dx: -30, dy: -60, r: 10 },
  { dx: 35, dy: 60, r: -15 },
];

function scatterSet(pieces) {
  if (!pieces || !pieces.length) return;
  gsap.set(pieces, {
    x: (i) => SCATTER[i % SCATTER.length].dx,
    y: (i) => SCATTER[i % SCATTER.length].dy,
    rotation: (i) => SCATTER[i % SCATTER.length].r,
    opacity: 0,
  });
}

export default function CinematicIntro() {
  const [shouldRender, setShouldRender] = useState(null);
  const [showSkip, setShowSkip] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const containerRef = useRef(null);
  const elementsRef = useRef({});
  const tierRef = useRef("high");
  const stRef = useRef(null);
  const tlRef = useRef(null);
  const finishedRef = useRef(false);
  const scene45AddedRef = useRef(false);
  const lenisRef = useLenisRef();
  const networkRef = useParticleNetworkRef();
  const { setHeroReady } = useHeroReveal();

  function registerRef(key, el) {
    elementsRef.current[key] = el;
  }
  function registerArrayRef(key, index, el) {
    if (!elementsRef.current[key]) elementsRef.current[key] = [];
    elementsRef.current[key][index] = el;
  }

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      // sessionStorage unavailable (private mode etc.) — treat as not seen
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    tierRef.current = getInitialQualityTier();

    if (alreadySeen || reduceMotion) {
      // No pinned scroll space is reserved at all on repeat visits or with
      // reduced motion — the homepage starts directly at the resolved hero,
      // rather than forcing an empty scroll-through.
      setHeroReady(true);
      setShouldRender(false);
      return;
    }
    setShouldRender(true);
  }, []);

  useLayoutEffect(() => {
    if (shouldRender !== true || !containerRef.current) return;

    const els = elementsRef.current;
    const lowTier = tierRef.current !== "high";
    const endPx = FULL_DISTANCE[lowTier ? "low" : "high"];

    const split = els.wordmark
      ? new SplitType(els.wordmark, { types: "chars" })
      : null;
    if (split) {
      gsap.set(split.chars, { opacity: 0, y: 14, scaleY: 1.4 });
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: `+=${endPx}`,
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
          onLeave: finish,
        },
      });
      stRef.current = tl.scrollTrigger;
      tlRef.current = tl;

      // Scene 1 — Dormant Lab (0 - 0.15): the glow point stirs awake.
      tl.to(els.glow, { opacity: 0.55, duration: 0.15 }, 0);
      tl.to(els.dormantLabel, { opacity: 0.4, duration: 0.15 }, 0);

      // Scene 2 — Power On (0.15 - 0.35): light travels the circuits, HUD
      // brackets/readouts snap in, wordmark reveals letter by letter.
      tl.to(els.glow, { opacity: 1, scale: 2.2, duration: 0.08 }, 0.15);
      tl.to(els.dormantLabel, { opacity: 0, duration: 0.05 }, 0.15);
      tl.to(
        els.circuits,
        { strokeDashoffset: 0, duration: 0.15, stagger: 0.02 },
        0.16
      );
      tl.to(
        els.brackets,
        { opacity: 1, duration: 0.06, stagger: 0.02 },
        0.18
      );
      tl.to(
        els.readouts,
        { opacity: 1, duration: 0.05, stagger: 0.02 },
        0.22
      );
      if (split) {
        tl.to(
          split.chars,
          { opacity: 1, y: 0, scaleY: 1, duration: 0.015, stagger: 0.008 },
          0.27
        );
      }
      tl.to(els.glow, { opacity: 0.3, scale: 1.4, duration: 0.05 }, 0.33);
      if (split) {
        tl.to(split.chars, { opacity: 0.35, duration: 0.04 }, 0.35);
      }

      // Scene 3 — Three Systems Activating (0.35 - 0.75): Patient, Clinical,
      // and Diligence each assemble from scattered pieces in turn, using the
      // same bracket/circuit-draw language as Scene 2. Each stays visible,
      // dimmed, once its beat ends — by the close of this scene all three
      // read as machines standing activated together.
      const moduleBeats = [
        { key: "patient", start: 0.35, duration: 0.15 },
        { key: "clinical", start: 0.5, duration: 0.15 },
        { key: "diligence", start: 0.65, duration: 0.1 },
      ];

      moduleBeats.forEach(({ key, start, duration }) => {
        const brackets = els[`${key}Brackets`];
        const glow = els[`${key}Glow`];
        const label = els[`${key}Label`];

        tl.call(() => scatterSet(brackets), null, start);
        tl.to(
          brackets,
          { x: 0, y: 0, rotation: 0, opacity: 1, duration: duration * 0.35, stagger: duration * 0.02 },
          start
        );
        tl.to(glow, { opacity: 0.35, duration: duration * 0.25 }, start + duration * 0.05);
        tl.to(glow, { opacity: 0.12, duration: duration * 0.25 }, start + duration * 0.35);

        if (key === "patient") {
          tl.to(els.patientPath, { strokeDashoffset: 0, duration: duration * 0.5 }, start + duration * 0.15);
        } else if (key === "clinical") {
          tl.to(
            els.clinicalPaths,
            { strokeDashoffset: 0, duration: duration * 0.5, stagger: duration * 0.08 },
            start + duration * 0.15
          );
          const rungs = els.clinicalRungs;
          tl.call(() => scatterSet(rungs), null, start + duration * 0.3);
          tl.to(
            rungs,
            { x: 0, y: 0, rotation: 0, opacity: 1, duration: duration * 0.25, stagger: duration * 0.04 },
            start + duration * 0.3
          );
        } else if (key === "diligence") {
          const bars = els.diligenceBars;
          tl.call(() => gsap.set(bars, { y: 45, opacity: 0 }), null, start);
          tl.to(
            bars,
            { y: 0, opacity: 1, duration: duration * 0.5, stagger: duration * 0.08 },
            start + duration * 0.15
          );
        }

        tl.to(label, { opacity: 1, duration: duration * 0.2 }, start + duration * 0.7);
      });
    }, containerRef);

    const skipTimer = setTimeout(() => setShowSkip(true), SKIP_DELAY_MS);

    return () => {
      clearTimeout(skipTimer);
      ctx.revert();
      split?.revert();
    };
  }, [shouldRender]);

  // Scene 4-5 need the shared particle control object, which may not be
  // populated yet when the timeline above is first built (ParticleBackdrop
  // mounts its Canvas lazily, same handshake as the rest of this codebase).
  // Poll for it independently and append Scene 4-5 to the existing timeline
  // once it's ready, rather than delaying Scene 1-3 on it.
  useEffect(() => {
    if (shouldRender !== true) return;
    let cancelled = false;

    function waitForNetwork() {
      if (cancelled || scene45AddedRef.current) return;
      const control = networkRef.current?.control;
      if (!control) {
        setTimeout(waitForNetwork, 16);
        return;
      }
      const tl = tlRef.current;
      if (!tl) {
        setTimeout(waitForNetwork, 16);
        return;
      }
      scene45AddedRef.current = true;

      // Hidden/dormant starting state — particles collapsed to the center,
      // not yet drifting, camera pulled slightly back. Set as soon as the
      // network is ready (not deferred to Scene 4) so a fast scroller never
      // catches the network in its fully-resolved default state early.
      control.burstProgress = 0;
      control.coalesceShape = null;
      control.coalesceProgress = 0;
      control.restingDrift = false;
      control.pulseFlash = 0;
      control.cameraZ = 15;

      const els = elementsRef.current;

      // Scene 4 — Systems Online (0.75 - 0.9): the three constructs flash,
      // then the lab/HUD layer and the particle network crossfade over the
      // exact same window so neither a gap nor a double-exposure moment is
      // possible — whichever is fading out and fading in are always summing
      // back toward ~1 combined opacity. A brief pulseFlash is centered
      // precisely at the crossfade's midpoint to mask the handoff.
      const glows = ["patientGlow", "clinicalGlow", "diligenceGlow"]
        .map((k) => els[k])
        .filter(Boolean);
      tl.to(glows, { opacity: 0.7, duration: 0.02, stagger: 0.01 }, 0.75);
      tl.to(glows, { opacity: 0.15, duration: 0.03, stagger: 0.01 }, 0.77);

      const crossfadeStart = 0.78;
      const crossfadeDuration = 0.1;
      tl.to(
        els.labScene,
        { opacity: 0, duration: crossfadeDuration, ease: "power1.inOut" },
        crossfadeStart
      );
      tl.to(
        els.bgLayer,
        { opacity: 0, duration: crossfadeDuration, ease: "power1.inOut" },
        crossfadeStart
      );
      tl.to(
        control,
        { burstProgress: 1, cameraZ: 12, duration: crossfadeDuration, ease: "power1.inOut" },
        crossfadeStart
      );
      const flashCenter = crossfadeStart + crossfadeDuration / 2;
      tl.to(control, { pulseFlash: 0.85, duration: 0.025 }, flashCenter - 0.015);
      tl.to(control, { pulseFlash: 0, duration: 0.035 }, flashCenter + 0.01);

      // Scene 5 — Arrival (0.9 - 1.0): hand off to resting drift and reveal
      // the hero content just ahead of the pin actually releasing, so the
      // handoff feels immediate rather than waiting on the unpin event.
      tl.call(() => {
        control.restingDrift = true;
      }, null, 0.9);
      tl.call(finish, null, 0.98);

      // Defensive: scrub maps scroll-fraction directly to timeline-progress
      // continuously, so this isn't strictly required for the newly-added
      // content to be reachable — but a refresh here costs nothing and
      // rules out any stale cached measurement as a source of drift.
      ScrollTrigger.refresh();
    }

    waitForNetwork();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // ignore — worst case the intro replays next load
    }
    setHeroReady(true);
    setIntroDone(true);
  }

  function handleSkip() {
    if (!stRef.current || !lenisRef.current) return;
    // ScrollTrigger.end can still be unset the first time a user clicks
    // Skip (its own refresh cycle hasn't necessarily run yet) — force it so
    // the jump target is never undefined.
    ScrollTrigger.refresh();
    lenisRef.current.scrollTo(stRef.current.end, { duration: SKIP_SCROLL_S });
  }

  if (shouldRender !== true) return null;

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden"
    >
      <div ref={(el) => registerRef("bgLayer", el)} className="absolute inset-0 bg-navy-950" />
      <div
        ref={(el) => registerRef("labScene", el)}
        style={{ perspective: "900px" }}
        className="absolute inset-0"
      >
        <DormantLab registerRef={registerRef} />
        <PowerOn registerRef={registerRef} registerArrayRef={registerArrayRef} />
        <SystemsActivating registerRef={registerRef} registerArrayRef={registerArrayRef} />
      </div>

      {showSkip && !introDone && (
        <button
          type="button"
          onClick={handleSkip}
          className="absolute bottom-8 right-8 z-10 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 transition-colors hover:text-teal"
        >
          Skip Intro
        </button>
      )}
    </div>
  );
}
