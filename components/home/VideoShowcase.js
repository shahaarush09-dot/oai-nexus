"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  REVEAL_GRID_COLS,
  REVEAL_GRID_ROWS,
  CELL_DISSOLVE_DURATION,
  TOTAL_REVEAL_MS,
  EXIT_FLASH_DURATION_MS,
  MOBILE_REVEAL_MS,
  radialDelay,
} from "@/lib/videoTransition";

const MUTE_PREF_KEY = "nexus-video-muted";

// "The Aperture Reveal" — a grid of cells covers the video and dissolves
// outward from the click origin in a staggered wave, like cells
// deactivating, rather than a literal 3D camera transition through the
// molecular field. Simpler to build reliably and still reads as a custom,
// premium reveal rather than a video dropped in a box.
export default function VideoShowcase() {
  const videoRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const [status, setStatus] = useState("idle"); // idle | revealing | playing | exiting
  const [hasTriggered, setHasTriggered] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showMuteButton, setShowMuteButton] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [origin, setOrigin] = useState({
    row: Math.floor(REVEAL_GRID_ROWS / 2),
    col: Math.floor(REVEAL_GRID_COLS / 2),
  });
  const [isMobile, setIsMobile] = useState(false);

  const revealMs = isMobile ? MOBILE_REVEAL_MS : TOTAL_REVEAL_MS;

  useEffect(() => {
    const stored = window.sessionStorage.getItem(MUTE_PREF_KEY);
    if (stored !== null) setMuted(stored === "1");

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    setShowMuteButton(false);
    const t = setTimeout(() => setShowMuteButton(true), 2000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status !== "revealing") return;
    const delay = reduceMotion ? 0 : revealMs;
    const t = setTimeout(() => {
      setStatus("playing");
      videoRef.current?.play().catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, [status, reduceMotion, revealMs]);

  useEffect(() => {
    if (status !== "playing") return;
    function onKeyDown(e) {
      if (e.key === "Escape") handleExit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleTrigger(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const col = Math.round(
      ((rect.left + rect.width / 2) / vw) * (REVEAL_GRID_COLS - 1)
    );
    const row = Math.round(
      ((rect.top + rect.height / 2) / vh) * (REVEAL_GRID_ROWS - 1)
    );
    setOrigin({
      row: Math.min(Math.max(row, 0), REVEAL_GRID_ROWS - 1),
      col: Math.min(Math.max(col, 0), REVEAL_GRID_COLS - 1),
    });
    setBuffering(true);
    setHasTriggered(true);
    setStatus("revealing");
  }

  function handleExit() {
    setStatus((prev) => (prev === "playing" ? "exiting" : prev));
    videoRef.current?.pause();
    const delay = reduceMotion ? 0 : revealMs + EXIT_FLASH_DURATION_MS;
    setTimeout(() => setStatus("idle"), delay);
  }

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      window.sessionStorage.setItem(MUTE_PREF_KEY, next ? "1" : "0");
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }

  const active = status !== "idle";
  const showCells = !isMobile && (status === "revealing" || status === "exiting");
  const showMobileFade = isMobile && (status === "revealing" || status === "exiting");
  const cellsCovering = status === "exiting";

  const cells = [];
  if (showCells) {
    for (let row = 0; row < REVEAL_GRID_ROWS; row++) {
      for (let col = 0; col < REVEAL_GRID_COLS; col++) {
        cells.push({
          row,
          col,
          delay: radialDelay(
            row,
            col,
            origin.row,
            origin.col,
            REVEAL_GRID_ROWS,
            REVEAL_GRID_COLS
          ),
        });
      }
    }
  }

  return (
    <>
      <AnimatePresence>
        {status === "idle" && (
          <motion.button
            type="button"
            onClick={handleTrigger}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="group absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            aria-label="Watch the Nexus film"
          >
            <span
              className="absolute inset-0 -m-3 rounded-full bg-teal/20 blur-xl animate-pulseGlow"
              aria-hidden="true"
            />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-teal/50 bg-navy-900/70 backdrop-blur transition-transform duration-300 group-hover:scale-105">
              <span className="h-2.5 w-2.5 rounded-full bg-teal shadow-[0_0_12px_4px_rgba(42,157,143,0.6)]" />
            </span>
            <span className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.28em] text-teal/80">
              Watch the Film
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {active && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-navy-950">
          {hasTriggered && (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              poster="/videos/promo-poster.jpg"
              muted={muted}
              playsInline
              preload="auto"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(v.currentTime / v.duration);
              }}
              onCanPlay={() => setBuffering(false)}
              onWaiting={() => setBuffering(true)}
              onEnded={handleExit}
            >
              <source src="/videos/oai-nexus-promo.webm" type="video/webm" />
              <source src="/videos/oai-nexus-promo.mp4" type="video/mp4" />
            </video>
          )}

          {/* Color grading overlay ties the footage back to the site palette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,15,30,0.15) 0%, rgba(42,157,143,0.05) 100%)",
              mixBlendMode: "overlay",
            }}
            aria-hidden="true"
          />

          {/* Ambient vignette glow */}
          <div
            className="pointer-events-none absolute inset-0 animate-ambientGlow"
            style={{
              boxShadow:
                "inset 0 0 140px 40px rgba(42,157,143,0.18), inset 0 0 240px 100px rgba(200,162,74,0.08)",
            }}
            aria-hidden="true"
          />

          {/* Brief scanline flicker during the transition only */}
          {(status === "revealing" || status === "exiting") && !reduceMotion && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(226,195,131,0.5) 0px, rgba(226,195,131,0.5) 1px, transparent 1px, transparent 3px)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.06, 0] }}
              transition={{ duration: (revealMs / 1000) * 0.6, ease: "easeOut" }}
              aria-hidden="true"
            />
          )}

          {status === "playing" && buffering && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 animate-pulseDot rounded-full bg-teal [animation-delay:-0.32s]" />
                <span className="h-2.5 w-2.5 animate-pulseDot rounded-full bg-teal [animation-delay:-0.16s]" />
                <span className="h-2.5 w-2.5 animate-pulseDot rounded-full bg-teal" />
              </div>
            </div>
          )}

          {showCells && (
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${REVEAL_GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${REVEAL_GRID_ROWS}, 1fr)`,
              }}
              aria-hidden="true"
            >
              {cells.map(({ row, col, delay }) => (
                <motion.div
                  key={`${row}-${col}`}
                  className="border border-navy-700/40 bg-navy-950"
                  initial={{
                    opacity: cellsCovering ? 0 : 1,
                    scale: cellsCovering ? 0.4 : 1,
                  }}
                  animate={{
                    opacity: cellsCovering ? 1 : 0,
                    scale: cellsCovering ? 1 : 0.4,
                  }}
                  transition={{
                    duration: CELL_DISSOLVE_DURATION,
                    delay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ))}
            </div>
          )}

          {showMobileFade && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-navy-950"
              initial={{ opacity: cellsCovering ? 0 : 1 }}
              animate={{ opacity: cellsCovering ? 1 : 0 }}
              transition={{ duration: revealMs / 1000, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            />
          )}

          {status === "exiting" && !reduceMotion && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gold"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.35, 0] }}
              transition={{
                duration: EXIT_FLASH_DURATION_MS / 1000,
                delay: revealMs / 1000,
                times: [0, 0.4, 1],
              }}
              aria-hidden="true"
            />
          )}

          {status === "playing" && (
            <>
              <button
                type="button"
                onClick={handleExit}
                className="absolute right-4 top-4 z-10 flex items-center gap-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300 transition-colors hover:text-gold sm:right-5 sm:top-5"
              >
                Exit
                <span className="text-sm leading-none">&times;</span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className={`absolute bottom-5 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-teal/40 bg-navy-900/60 text-teal backdrop-blur transition-opacity duration-500 hover:border-teal hover:shadow-[0_0_14px_2px_rgba(42,157,143,0.4)] sm:bottom-6 sm:right-5 sm:h-9 sm:w-9 ${
                  showMuteButton ? "opacity-100" : "opacity-0"
                }`}
                aria-label={muted ? "Unmute video" : "Mute video"}
              >
                {muted ? <IconMuted /> : <IconUnmuted />}
              </button>

              <div className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-navy-700/60">
                <div
                  className="h-full bg-teal shadow-[0_0_8px_1px_rgba(42,157,143,0.7)] transition-[width] duration-150 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function IconMuted() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      <path d="M17 8l4 8M21 8l-4 8" strokeLinecap="round" />
    </svg>
  );
}

function IconUnmuted() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      <path d="M16 8.5a4 4 0 010 7M18.5 6a7.5 7.5 0 010 12" strokeLinecap="round" />
    </svg>
  );
}
