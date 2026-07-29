"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import MolecularField from "./MolecularField";
import ServiceCard from "./ServiceCard";
import VideoShowcase from "./VideoShowcase";

export default function Hero({ modules = [] }) {
  const sectionRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.22]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 1], [0.95, 0.1]);
  const fieldBlur = useTransform(scrollYProgress, [0, 1], [0, 10]);
  const fieldFilter = useTransform(fieldBlur, (b) => `blur(${b}px)`);

  const contentY = useTransform(scrollYProgress, [0, 1], [0, -48]);
  const contentOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const fieldStyle = reduceMotion
    ? {}
    : { scale: fieldScale, opacity: fieldOpacity, filter: fieldFilter };
  const contentStyle = reduceMotion
    ? {}
    : { y: contentY, opacity: contentOpacity };

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <motion.div className="absolute inset-0" style={fieldStyle}>
        <MolecularField />
      </motion.div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 72% 40%, rgba(8,11,21,0) 20%, rgba(8,11,21,0.92) 72%, rgba(8,11,21,1) 100%)",
        }}
      />

      <VideoShowcase />

      <motion.div
        style={contentStyle}
        className="relative mx-auto flex min-h-[85vh] max-w-6xl flex-col justify-center px-6 py-16 lg:py-20"
      >
        <h1 className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
            Rare Disease Intelligence Platform
          </span>
          <span className="mt-5 font-serif text-[3.4rem] font-medium leading-[0.95] tracking-tight sm:text-[4.6rem] lg:text-[5.6rem]">
            Nexus
          </span>
        </h1>
        <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-slate-200 sm:text-xl">
          A rare disease intelligence platform connecting education,
          clinical research, and orphan drug innovation.
        </p>
        <div className="mt-7 inline-flex w-fit items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-light">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          The first AI platform built for rare disease
        </div>

        <div className="mt-8">
          <a
            href="https://www.orphanaccessinitiative.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.03] hover:brightness-110"
          >
            Visit OAI Home Page
          </a>
        </div>

        {modules.length > 0 && (
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {modules.map((m, i) => (
              <ServiceCard key={m.href} module={m} delay={i * 120} />
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}
