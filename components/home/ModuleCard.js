"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import NodeGlyph from "./NodeGlyph";
import { useHeroReveal } from "./ParticleNetworkContext";

const cardVariants = {
  hidden: { opacity: 0, y: 30, rotateX: -16 },
  visible: (delay) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: (delay || 0) / 1000 },
  }),
};

const glowVariants = {
  hidden: { opacity: 0 },
  visible: (delay) => ({
    opacity: [0, 0.55, 0],
    transition: { duration: 1.1, delay: (delay || 0) / 1000 + 0.15, times: [0, 0.35, 1] },
  }),
};

const TILT_DEGREES = 8;

// Upgrade over the previous ServiceCard: settles in with a slight 3D
// tilt rather than a flat scale-up, and follows the cursor with a subtle
// tilt while hovered — a physically-responsive "tilt card," not just a
// color change. Bespoke animated per-module icons are flagged for a later
// phase; this keeps the existing NodeGlyph.
export default function ModuleCard({ module: m, delay = 0 }) {
  const reduceMotion = useReducedMotion();
  const cardRef = useRef(null);
  const { heroReady } = useHeroReveal();
  const [inView, setInView] = useState(false);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 250, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 250, damping: 20 });

  function handlePointerMove(e) {
    if (reduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * TILT_DEGREES);
    rotateX.set(-py * TILT_DEGREES);
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={cardRef}
      initial="hidden"
      animate={heroReady && inView ? "visible" : "hidden"}
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true, amount: 0.3 }}
      custom={delay}
      variants={cardVariants}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        transformPerspective: 800,
        rotateX: reduceMotion ? 0 : springRotateX,
        rotateY: reduceMotion ? 0 : springRotateY,
      }}
      className="relative"
    >
      <motion.div
        aria-hidden="true"
        variants={glowVariants}
        className="pointer-events-none absolute -inset-1 rounded-xl blur-xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ backgroundColor: m.glow }}
      />
      <Link
        href={m.href}
        className={`group relative flex flex-col justify-between rounded-lg border border-navy-600 bg-navy-900/60 p-5 transition-colors duration-300 hover:shadow-[0_0_30px_-8px_var(--glow-color)] ${m.border}`}
        style={{ "--glow-color": m.glow }}
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${m.text}`}
              >
                {m.name}
              </span>
            </div>
            <NodeGlyph className={m.text} size={26} delay={delay + 150} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {m.short}
          </p>
        </div>
        <span
          className={`mt-5 inline-flex items-center gap-1.5 text-xs font-medium ${m.text}`}
        >
          Enter
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            &rarr;
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
