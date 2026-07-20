"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

// A background texture layer that drifts vertically at a fraction of scroll
// speed relative to its section, giving the section real depth instead of a
// flat color block. Purely decorative — aria-hidden.
export default function ParallaxLayer({
  pattern = "dots",
  color = "rgba(200,162,74,0.15)",
  size = 26,
  speed = 40,
  opacity = 0.35,
  mask,
  className = "",
}) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [-speed, speed]);

  const backgroundImage =
    pattern === "grid"
      ? `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`
      : pattern === "lines"
      ? `repeating-linear-gradient(115deg, ${color} 0px, ${color} 1px, transparent 1px, transparent ${size}px)`
      : `radial-gradient(${color} 1px, transparent 1px)`;

  const backgroundSize =
    pattern === "grid" ? `${size}px ${size}px` : pattern === "lines" ? "auto" : `${size}px ${size}px`;

  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <motion.div
        style={{
          backgroundImage,
          backgroundSize,
          maskImage: mask,
          WebkitMaskImage: mask,
          y: reduceMotion ? 0 : y,
          position: "absolute",
          inset: "-80px 0",
        }}
        className="h-[calc(100%+160px)] w-full"
      />
    </motion.div>
  );
}
