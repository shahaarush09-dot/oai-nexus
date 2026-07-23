"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Not tied to real backend progress (the API call is a single request/
// response, no streaming) — a client-side cycle through the report's own
// section structure, just to signal that something is actively happening
// during what can be a multi-minute generation.
const THINKING_STEPS = [
  "Researching disease epidemiology and current treatment landscape...",
  "Assessing target validity and mechanism of action...",
  "Analyzing the regulatory pathway to approval...",
  "Sizing the addressable patient population...",
  "Mapping the competitive landscape...",
  "Building the commercialization and payer strategy...",
  "Modeling BEAR, BASE, and BULL financial scenarios...",
  "Stress-testing the key assumptions...",
  "Weighing the investment case...",
  "Benchmarking against comparable assets...",
  "Finalizing the report...",
];

export default function ReportGeneratingStatus() {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((i) => (i + 1) % THINKING_STEPS.length);
    }, 4500);
    const clock = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(stepTimer);
      clearInterval(clock);
    };
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="flex gap-1.5">
        <span className="h-3 w-3 animate-pulseDot rounded-full bg-gold [animation-delay:-0.32s]" />
        <span className="h-3 w-3 animate-pulseDot rounded-full bg-gold [animation-delay:-0.16s]" />
        <span className="h-3 w-3 animate-pulseDot rounded-full bg-gold" />
      </div>

      <div className="min-h-[3.5rem]">
        <p className="text-sm font-medium text-slate-700">
          Generating Orphan Drug Intelligence Report
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="mt-2 max-w-sm text-xs text-slate-500"
          >
            {THINKING_STEPS[stepIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <p className="text-xs text-slate-400">
        This usually takes a few minutes — {minutes > 0 ? `${minutes}m ` : ""}
        {seconds}s elapsed
      </p>
    </div>
  );
}
