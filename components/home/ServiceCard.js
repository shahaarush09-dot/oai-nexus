"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import NodeGlyph from "./NodeGlyph";

const cardVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 20 },
  visible: (delay) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: (delay || 0) / 1000 },
  }),
};

const glowVariants = {
  hidden: { opacity: 0 },
  visible: (delay) => ({
    opacity: [0, 0.55, 0],
    transition: { duration: 1.1, delay: (delay || 0) / 1000 + 0.15, times: [0, 0.35, 1] },
  }),
};

export default function ServiceCard({ module: m, delay = 0 }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      custom={delay}
      variants={cardVariants}
      className="relative"
    >
      <motion.div
        aria-hidden="true"
        variants={glowVariants}
        className="pointer-events-none absolute -inset-1 rounded-xl blur-xl"
        style={{ backgroundColor: m.glow }}
      />
      <Link
        href={m.href}
        className={`group relative flex flex-col justify-between rounded-lg border border-navy-600 bg-navy-900/60 p-5 transition-colors duration-300 ${m.border}`}
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
