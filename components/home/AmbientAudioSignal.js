"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { rampVolume } from "@/lib/audioFade";

const FADE_MS = 1500;

// A small corner signal, not a media player: no scrubber, no visible
// play/pause chrome by default — just an icon that breathes at rest and
// plays the narrated product overview once through on tap. The audio track
// is full spoken narration (confirmed by transcription before building
// this), so it deliberately does not loop — it's a "listen to overview"
// moment, not ambient background sound.
export default function AmbientAudioSignal() {
  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const pendingPlayRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipTimeoutRef = useRef(null);

  useEffect(() => {
    flashTooltip(3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopFade();
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  function stopFade() {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }

  function showTooltipNow() {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowTooltip(true);
  }

  function hideTooltipNow() {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowTooltip(false);
  }

  // Shows the tooltip briefly, then auto-hides — used for the first-load
  // discoverability flash and for confirming the new state right after a
  // tap, since touch devices have no hover to reveal the label otherwise.
  function flashTooltip(duration = 2000) {
    showTooltipNow();
    tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), duration);
  }

  function handleEnded() {
    stopFade();
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
    }
  }

  function handleToggle() {
    const audio = audioRef.current;
    // Ignore re-clicks while the initial play() promise is still resolving
    // — without this, a fast double-click could fire two overlapping
    // volume ramps and produce an audible dip-and-recover glitch.
    if (!audio || pendingPlayRef.current) return;
    stopFade();
    // Confirms the resulting action to touch users, who have no hover to
    // reveal it otherwise. The label itself reads live `playing` state on
    // every render, so if this fires before an async play() resolves, it
    // still ends up correct the moment state catches up.
    flashTooltip(2000);

    if (playing) {
      setPlaying(false);
      fadeIntervalRef.current = rampVolume(audio, audio.volume, 0, FADE_MS, () => {
        audio.pause();
        audio.currentTime = 0;
      });
      return;
    }

    audio.volume = 0;
    pendingPlayRef.current = true;
    audio
      .play()
      .then(() => {
        pendingPlayRef.current = false;
        setPlaying(true);
        fadeIntervalRef.current = rampVolume(audio, 0, 1, FADE_MS);
      })
      .catch(() => {
        pendingPlayRef.current = false;
        setPlaying(false);
      });
  }

  return (
    <div
      className="fixed z-40"
      style={{
        bottom: "max(24px, env(safe-area-inset-bottom))",
        right: "max(24px, env(safe-area-inset-right))",
      }}
    >
      <audio ref={audioRef} preload="none" onEnded={handleEnded}>
        <source src="/audio/oai-nexus-ambient.m4a" type="audio/mp4" />
        <source src="/audio/oai-nexus-ambient.mp3" type="audio/mpeg" />
      </audio>

      <div className="relative flex flex-col items-end">
        <AnimatePresence>
          {showTooltip && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.25 }}
              // Anchored to the icon's right edge (which is already inset
              // from the viewport edge by the outer fixed container) and
              // grows leftward — the previous version had no horizontal
              // anchor at all, so on narrow viewports the browser's default
              // static-position guess pushed it off the left edge.
              className="absolute bottom-full right-0 mb-2 max-w-[calc(100vw-48px)] whitespace-nowrap rounded-full border border-teal/30 bg-navy-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal/80 backdrop-blur"
            >
              {playing ? "Pause" : "Listen to overview"}
            </motion.span>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={handleToggle}
          onMouseEnter={showTooltipNow}
          onMouseLeave={hideTooltipNow}
          onFocus={showTooltipNow}
          onBlur={hideTooltipNow}
          aria-label={playing ? "Pause overview narration" : "Listen to overview"}
          className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full border border-teal/30 bg-navy-900/70 backdrop-blur transition-transform duration-300 hover:scale-110"
          animate={
            playing
              ? { scale: [1, 1.06, 1] }
              : { scale: [1, 1.05, 1], opacity: [0.65, 1, 0.65] }
          }
          transition={{
            duration: playing ? 1.6 : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            boxShadow: playing
              ? "0 0 18px 4px rgba(42,157,143,0.35)"
              : "0 0 10px 1px rgba(42,157,143,0.15)",
          }}
        >
          <SoundwaveIcon playing={playing} />
        </motion.button>
      </div>
    </div>
  );
}

// The bars double as icon and "waveform" — animated via CSS while playing
// (staggered per-bar delay), static at rest. This is the CSS-based fallback
// explicitly allowed in place of Web Audio API amplitude analysis: it isn't
// audio-reactive, just a looping animation gated on `playing`.
function SoundwaveIcon({ playing }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={3 + i * 5}
          y="9"
          width="2.4"
          height="6"
          rx="1.2"
          fill="rgb(42,157,143)"
          className={playing ? "animate-soundbar" : ""}
          style={{
            transformOrigin: "center",
            animationDelay: playing ? `${i * 0.15}s` : undefined,
          }}
        />
      ))}
    </svg>
  );
}
