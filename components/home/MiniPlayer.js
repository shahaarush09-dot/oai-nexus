"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "./VideoPlayerProvider";
import { PlayIcon, PauseIcon, MuteIcon } from "./icons";
import {
  MINI_BAR_HEIGHT,
  MINI_THUMB_LEFT,
  MINI_THUMB_SIZE,
} from "@/lib/miniPlayerLayout";

// The condensed Spotify-style top bar. Height is set to fully cover the
// site's existing sticky nav header once docked (see miniPlayerLayout.js),
// so this replaces it at the top of the viewport rather than the two
// stacking or overlapping awkwardly.
export default function MiniPlayer() {
  const {
    isDocked,
    playing,
    togglePlay,
    muted,
    toggleMute,
    progress,
    reduceMotion,
    hasError,
  } = useVideoPlayer();

  if (hasError) return null;

  return (
    <AnimatePresence>
      {isDocked && (
        <motion.div
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { y: -MINI_BAR_HEIGHT, opacity: 0 }
          }
          animate={{ y: 0, opacity: 1 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { y: -MINI_BAR_HEIGHT, opacity: 0 }
          }
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 320, damping: 34 }
          }
          className="fixed inset-x-0 top-0 z-50 border-b border-navy-600/60 bg-navy-900/95 backdrop-blur"
          style={{ height: MINI_BAR_HEIGHT }}
        >
          <div
            className="flex h-full items-center gap-3 pr-2 sm:pr-3"
            style={{ paddingLeft: MINI_THUMB_LEFT + MINI_THUMB_SIZE + 10 }}
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-teal" />
            </span>
            <span className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 sm:inline">
              OAI Nexus &mdash; Watch the film
            </span>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute video" : "Mute video"}
                className="flex h-11 w-11 items-center justify-center rounded-full text-teal transition-colors hover:bg-navy-800"
              >
                <MuteIcon muted={muted} />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause video" : "Play video"}
                className="flex h-11 w-11 items-center justify-center rounded-full text-teal transition-colors hover:bg-navy-800"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-navy-700/60">
            <div
              className="h-full bg-teal shadow-[0_0_8px_1px_rgba(42,157,143,0.7)] transition-[width] duration-150 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
