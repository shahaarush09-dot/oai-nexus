"use client";

import { motion } from "framer-motion";
import MolecularField from "./MolecularField";
import ServiceCard from "./ServiceCard";
import HeroVideo from "./HeroVideo";
import MiniPlayer from "./MiniPlayer";
import { VideoPlayerProvider } from "./VideoPlayerProvider";

export default function Hero({ modules = [] }) {
  return (
    <VideoPlayerProvider>
      <MiniPlayer />

      {/* min-h-screen is the vh fallback; the inline 100dvh (where
          supported) accounts for iOS Safari's collapsing address bar so
          this always reserves one full viewport — the mechanism that keeps
          the module cards below off screen on first load, on any device. */}
      <section
        className="relative flex min-h-screen flex-col overflow-hidden"
        style={{ minHeight: "100dvh" }}
      >
        <div className="absolute inset-0 opacity-40" aria-hidden="true">
          <MolecularField />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 15%, rgba(8,11,21,0) 10%, rgba(8,11,21,0.85) 65%, rgba(8,11,21,1) 100%)",
          }}
        />

        <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
          <h1 className="flex flex-col text-center sm:text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
              Rare Disease Intelligence Platform
            </span>
            <span className="mt-4 font-serif text-[2.8rem] font-medium leading-[0.95] tracking-tight sm:text-[3.6rem] lg:text-[4.2rem]">
              Nexus
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center font-serif text-base leading-relaxed text-slate-200 sm:mx-0 sm:text-left sm:text-lg">
            A rare disease intelligence platform connecting education,
            clinical research, and orphan drug innovation.
          </p>
          <div className="mx-auto mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-light sm:mx-0">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            The first AI platform built for rare disease
          </div>

          <HeroVideo />

          <ScrollCue />
        </div>
      </section>

      {modules.length > 0 && (
        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 pb-16 pt-4 sm:grid-cols-3">
          {modules.map((m, i) => (
            <ServiceCard key={m.href} module={m} delay={i * 120} />
          ))}
        </div>
      )}
    </VideoPlayerProvider>
  );
}

function ScrollCue() {
  return (
    <motion.div
      className="mx-auto mt-10 flex flex-col items-center gap-2 text-slate-500"
      animate={{ y: [0, 6, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">
        Scroll to explore Nexus
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}
