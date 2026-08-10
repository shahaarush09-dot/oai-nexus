"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SplitType from "split-type";
import { gsap } from "@/lib/gsapSetup";
import { useParticleNetworkRef, useHeroReveal } from "@/components/home/ParticleNetworkContext";
import { getInitialQualityTier } from "@/lib/deviceCapability";
import { MODULE_SHAPES } from "@/lib/particleShapes";

const MODULE_ORDER = ["patient", "clinical", "diligence"];
const SESSION_KEY = "nexus-intro-seen";
const SKIP_DELAY_MS = 1000;
const EXIT_MS = 350;

// "JARVIS Protocol" — a GSAP timeline that drives the SAME particle field
// Hero.js mounts (via the shared control object from ParticleNetworkContext),
// not a second scene. This component only renders the transparent HUD layer
// on top: boot lines, status text, module labels, and the intro's own
// wordmark moment. Silent by default — no audio wired in here.
export default function IntroSequence({ onComplete }) {
  const networkRef = useParticleNetworkRef();
  const { setHeroReady } = useHeroReveal();

  const [shouldRender, setShouldRender] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [bootActive, setBootActive] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeLabel, setActiveLabel] = useState("");
  const [showWordmark, setShowWordmark] = useState(false);

  const wordmarkRef = useRef(null);
  const timelineRef = useRef(null);
  const finishedRef = useRef(false);
  const tierRef = useRef("high");

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
      finish(true);
      return;
    }

    setShouldRender(true);
    setBootActive(true);

    let cancelled = false;
    function waitForNetwork() {
      if (cancelled) return;
      // ParticleNetwork mounts lazily inside Hero.js (after its own tier
      // effect resolves), so the ref may not be populated yet on the frame
      // this effect first runs — poll briefly rather than assume it's ready.
      // setTimeout, not requestAnimationFrame: this handshake shouldn't be
      // at the mercy of rAF throttling on a backgrounded/minimized tab.
      if (networkRef.current?.control) {
        startTimeline();
      } else {
        setTimeout(waitForNetwork, 16);
      }
    }
    waitForNetwork();

    const skipTimer = setTimeout(() => setShowSkip(true), SKIP_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(skipTimer);
      timelineRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wordmark reveal — same blur-to-sharp technique as the hero headline,
  // fired only once Beat 4 actually shows the wordmark. useLayoutEffect so
  // the raw text never paints for a frame before SplitType hides it.
  useLayoutEffect(() => {
    if (!showWordmark || !wordmarkRef.current) return;
    const split = new SplitType(wordmarkRef.current, { types: "chars" });
    gsap.set(split.chars, { opacity: 0, filter: "blur(10px)", rotateX: -40, y: 14 });
    gsap.to(split.chars, {
      opacity: 1,
      filter: "blur(0px)",
      rotateX: 0,
      y: 0,
      duration: 0.55,
      stagger: 0.035,
      ease: "power3.out",
    });
    return () => split.revert();
  }, [showWordmark]);

  // Scroll-to-accelerate: nudges the timeline forward proportional to wheel
  // distance, letting an impatient user scrub straight through the sequence.
  useEffect(() => {
    if (!shouldRender) return;
    function onWheel(e) {
      const tl = timelineRef.current;
      if (!tl || finishedRef.current) return;
      const delta = Math.abs(e.deltaY) / 4000;
      tl.progress(Math.min(1, tl.progress() + delta));
    }
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [shouldRender]);

  function startTimeline() {
    const control = networkRef.current.control;
    const lowTier = tierRef.current !== "high";

    control.burstProgress = 0;
    control.coalesceShape = null;
    control.coalesceProgress = 0;
    control.restingDrift = false;
    control.pulseFlash = 0;
    control.cameraZ = 15;

    const tl = gsap.timeline({ onComplete: () => finish(false) });
    timelineRef.current = tl;

    // Beat 1 — System Boot (0 - 0.8s): central point + radiating HUD lines.
    tl.call(() => setStatusText("OAI NEXUS // INITIALIZING"), null, 0);
    tl.call(() => setBootActive(false), null, 0.75);

    // Beat 2 — Network Formation (0.8 - 2.0s): particles burst out from the
    // center point into the network layout, camera pushes in slightly.
    tl.to(control, { burstProgress: 1, cameraZ: 12, duration: 1.2, ease: "power2.out" }, 0.8);

    // Beat 3 — Module Activation (2.0 - 3.5s): three ~0.5s beats where a
    // subset of particles coalesces into each module's abstract shape.
    // Clear the boot status text first — statusText otherwise wins the
    // `statusText || activeLabel` display priority and the module labels
    // never actually show.
    const beat3Start = 2.0;
    const perModule = 0.5;
    tl.call(() => setStatusText(""), null, beat3Start);
    MODULE_ORDER.forEach((key, i) => {
      const t0 = beat3Start + i * perModule;
      const label = MODULE_SHAPES[key].label;

      if (lowTier) {
        // Low tier: skip shape-coalescing entirely — label flash + a global
        // brightness pulse reads as "activation" without the extra geometry.
        tl.call(() => setActiveLabel(label), null, t0);
        tl.to(control, { pulseFlash: 0.45, duration: 0.15, ease: "power1.out" }, t0);
        tl.to(control, { pulseFlash: 0, duration: 0.2, ease: "power2.in" }, t0 + 0.15);
      } else {
        tl.call(() => {
          control.coalesceShape = key;
          setActiveLabel(label);
        }, null, t0);
        tl.to(control, { coalesceProgress: 1, duration: 0.22, ease: "back.out(2.2)" }, t0);
        tl.to(control, { coalesceProgress: 0, duration: 0.2, ease: "power2.in" }, t0 + 0.28);
      }
      tl.call(() => setActiveLabel(""), null, t0 + perModule - 0.05);
    });
    tl.call(() => {
      control.coalesceShape = null;
    }, null, beat3Start + MODULE_ORDER.length * perModule);

    // Beat 4 — Resolve (3.5 - 4.5s): full-network pulse, status text, hand
    // off to resting drift, wordmark materializes, hero content follows.
    const resolveStart = 3.6;
    tl.call(() => setStatusText("ALL SYSTEMS ONLINE"), null, resolveStart);
    tl.to(control, { pulseFlash: 0.8, duration: 0.15, ease: "power1.out" }, resolveStart);
    tl.to(control, { pulseFlash: 0, duration: 0.4, ease: "power2.in" }, resolveStart + 0.15);
    tl.call(() => {
      control.restingDrift = true;
    }, null, resolveStart + 0.2);
    tl.call(() => {
      setStatusText("");
      setShowWordmark(true);
      setHeroReady(true);
    }, null, resolveStart + 0.5);
    tl.to({}, { duration: 0.4 }, resolveStart + 0.5);
  }

  function finish(instant) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    timelineRef.current?.kill();
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // ignore — worst case the intro replays next load
    }

    const control = networkRef.current?.control;
    if (control) {
      control.burstProgress = 1;
      control.coalesceShape = null;
      control.coalesceProgress = 0;
      control.restingDrift = true;
      control.pulseFlash = 0;
      control.cameraZ = 12;
    }
    setBootActive(false);
    setStatusText("");
    setActiveLabel("");
    setHeroReady(true);

    if (instant) {
      setShouldRender(false);
      onComplete?.();
      return;
    }

    setShowWordmark(false);
    setExiting(true);
    setTimeout(() => {
      setShouldRender(false);
      onComplete?.();
    }, EXIT_MS);
  }

  if (!shouldRender) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ perspective: "800px" }}
      animate={exiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeOut" }}
      onClick={() => finish(false)}
    >
      <div className="pointer-events-auto absolute inset-0" />

      <BootHUD active={bootActive} />

      {showWordmark && (
        <h1
          ref={wordmarkRef}
          className="relative font-serif text-4xl font-medium tracking-tight text-white sm:text-5xl"
        >
          OAI Nexus
        </h1>
      )}

      <div className="absolute inset-x-0 bottom-24 flex justify-center">
        <AnimatePresence mode="wait">
          {(statusText || activeLabel) && (
            <motion.p
              key={statusText || activeLabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.25em] text-teal"
            >
              {statusText || activeLabel}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {showSkip && (
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            finish(false);
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-auto absolute bottom-8 right-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 transition-colors hover:text-teal"
        >
          Skip
        </motion.button>
      )}
    </motion.div>
  );
}

const BOOT_LINE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function BootHUD({ active }) {
  const angles = useMemo(() => BOOT_LINE_ANGLES, []);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.span
            className="absolute h-2 w-2 rounded-full bg-teal"
            style={{ boxShadow: "0 0 14px 4px rgba(42,157,143,0.7)" }}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1] }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
          {angles.map((deg) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 h-px w-28 origin-left"
              style={{ transform: `rotate(${deg}deg)` }}
            >
              <motion.span
                className="block h-full origin-left bg-gradient-to-r from-teal/80 to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
