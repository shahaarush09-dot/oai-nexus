"use client";

import { motion } from "framer-motion";

const POINTS = [
  [6, 6],
  [26, 8],
  [8, 26],
];

// A tiny node network that assembles itself when scrolled into view: the
// center node appears, connectors trace outward, then the outer nodes snap
// in. Reinforces "this is a system," not a static bullet icon.
export default function NodeGlyph({ className = "text-gold", size = 30, delay = 0 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {POINTS.map(([x, y], i) => (
        <motion.line
          key={`line-${i}`}
          x1={16}
          y1={16}
          x2={x}
          y2={y}
          stroke="currentColor"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.6 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, delay: (delay + 120) / 1000 + i * 0.06 }}
        />
      ))}
      <motion.circle
        cx={16}
        cy={16}
        r={3}
        fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.3, delay: delay / 1000 }}
      />
      {POINTS.map(([x, y], i) => (
        <motion.circle
          key={`node-${i}`}
          cx={x}
          cy={y}
          r={2}
          fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.85 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.25, delay: (delay + 420 + i * 70) / 1000 }}
        />
      ))}
    </svg>
  );
}
