"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import SplitType from "split-type";
import { gsap } from "@/lib/gsapSetup";
import { useHeroReveal } from "./ParticleNetworkContext";

// The text/badge/CTA layer that sits above ParticleNetwork's canvas. Since
// the intro overlay is transparent (same particle field shows through both),
// this content can no longer reveal itself unconditionally on mount — it
// would visually collide with the intro's own choreography. Instead it waits
// for `heroReady`, which IntroSequence flips at Beat 4 (or immediately, if
// the intro is skipped/absent).
export default function HeroContent() {
  const reduceMotion = useReducedMotion();
  const headlineRef = useRef(null);
  const { heroReady } = useHeroReveal();

  // useLayoutEffect (not useEffect) so the split-and-hide happens before the
  // browser paints — otherwise the raw, unsplit "Nexus" text is visible for
  // one frame the moment the parent's opacity flips on, since the intro
  // overlay is transparent and no longer masks this like it used to.
  useLayoutEffect(() => {
    if (!headlineRef.current) return;
    if (reduceMotion) return;
    if (!heroReady) return;

    const split = new SplitType(headlineRef.current, { types: "chars" });
    gsap.set(split.chars, { opacity: 0, filter: "blur(8px)", rotateX: -30, y: 10 });
    gsap.to(split.chars, {
      opacity: 1,
      filter: "blur(0px)",
      rotateX: 0,
      y: 0,
      duration: 0.6,
      stagger: 0.025,
      ease: "power3.out",
      delay: 0.3,
    });
    return () => split.revert();
  }, [reduceMotion, heroReady]);

  return (
    <div style={{ perspective: "600px" }}>
      <Reveal delay={0} ready={heroReady}>
        <AnimatedBadgeBorder reduceMotion={reduceMotion}>
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          The first AI platform built for rare disease
        </AnimatedBadgeBorder>
      </Reveal>

      <h1
        className="mt-5 flex flex-col transition-opacity duration-300"
        style={{ opacity: reduceMotion || heroReady ? 1 : 0 }}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
          Rare Disease Intelligence Platform
        </span>
        <span
          ref={headlineRef}
          className="mt-5 font-serif text-[3.4rem] font-medium leading-[0.95] tracking-tight sm:text-[4.6rem] lg:text-[5.6rem]"
        >
          Nexus
        </span>
      </h1>

      <Reveal delay={450} ready={heroReady}>
        <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-slate-200 sm:text-xl">
          A rare disease intelligence platform connecting education,
          clinical research, and orphan drug innovation.
        </p>
      </Reveal>

      <Reveal delay={600} ready={heroReady}>
        <div className="mt-8">
          <MagneticCTA reduceMotion={reduceMotion} />
        </div>
      </Reveal>
    </div>
  );
}

function Reveal({ delay, ready, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// A conic-gradient div rotating slowly behind a 1px-padded inner pill —
// the classic animated-gradient-border technique, CSS-only.
function AnimatedBadgeBorder({ children, reduceMotion }) {
  return (
    <div className="relative inline-flex w-fit overflow-hidden rounded-full p-px">
      {!reduceMotion && (
        <div
          className="absolute inset-[-150%] animate-spinSlow"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, rgba(200,162,74,0.9) 12%, transparent 28%)",
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-light">
        {children}
      </div>
    </div>
  );
}

const MAGNET_RADIUS = 70;
const MAGNET_STRENGTH = 0.35;

function MagneticCTA({ reduceMotion }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18 });
  const springY = useSpring(y, { stiffness: 200, damping: 18 });
  const [ripples, setRipples] = useState([]);

  useEffect(() => {
    if (reduceMotion) return;
    function onMove(e) {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < MAGNET_RADIUS + rect.width / 2) {
        x.set(dx * MAGNET_STRENGTH);
        y.set(dy * MAGNET_STRENGTH);
      } else {
        x.set(0);
        y.set(0);
      }
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduceMotion, x, y]);

  function handleClick(e) {
    const rect = ref.current.getBoundingClientRect();
    const id = Date.now();
    setRipples((prev) => [
      ...prev,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  }

  return (
    <motion.a
      ref={ref}
      href="https://www.orphanaccessinitiative.org/"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      style={reduceMotion ? undefined : { x: springX, y: springY }}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      className="group relative inline-flex w-fit items-center gap-2 overflow-hidden rounded-full border border-teal px-6 py-3 text-sm font-semibold text-white"
    >
      <span
        className="absolute inset-0 origin-left scale-x-0 bg-teal transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:scale-x-100"
        style={{ clipPath: "polygon(0 0, 100% 0, 82% 100%, 0% 100%)" }}
        aria-hidden="true"
      />
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-white/40"
          style={{ left: r.x, top: r.y, x: "-50%", y: "-50%" }}
          initial={{ width: 0, height: 0, opacity: 0.5 }}
          animate={{ width: 160, height: 160, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-hidden="true"
        />
      ))}
      <span className="relative z-10">Visit OAI Home Page</span>
    </motion.a>
  );
}
