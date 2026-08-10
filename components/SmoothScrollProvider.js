"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsapSetup";

const LenisContext = createContext(null);

// Wires Lenis's smoothed scroll through GSAP's own ticker (instead of a
// separate raw rAF loop) and forwards every Lenis scroll event to
// ScrollTrigger.update(). Without this, ScrollTrigger reads native
// window.scrollY while the page visually scrolls at Lenis's smoothed
// position, so any scroll-scrubbed animation (the cinematic intro) lags
// behind what's actually on screen. lagSmoothing(0) stops GSAP from
// skipping ticks after a long task, which otherwise shows up as a stutter
// in the scrub. The Lenis instance is exposed via context so scroll-jump
// actions (the intro's skip button) can drive it directly rather than
// fighting it with a second, uncoordinated scroll mechanism.
export default function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    function update(time) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
  );
}

export function useLenisRef() {
  const ctx = useContext(LenisContext);
  if (!ctx) {
    throw new Error("useLenisRef must be used within SmoothScrollProvider");
  }
  return ctx;
}
