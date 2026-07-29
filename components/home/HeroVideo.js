"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useVideoPlayer } from "./VideoPlayerProvider";
import { PlayIcon, PauseIcon, MuteIcon } from "./icons";
import {
  MINI_THUMB_SIZE,
  MINI_THUMB_LEFT,
  MINI_THUMB_TOP,
} from "@/lib/miniPlayerLayout";

// Renders the single, persistent <video> element. Docking is a pure CSS
// state flip on one motion.div — Framer Motion's `layout` prop measures the
// before/after rect (in-flow hero box vs. fixed mini-bar thumbnail) and
// animates a GPU-composited transform between them, so the same video node
// never unmounts and playback is never interrupted.
export default function HeroVideo() {
  const {
    videoRef,
    heroSlotRef,
    isDocked,
    play,
    playing,
    setPlaying,
    setProgress,
    setDuration,
    hasError,
    setHasError,
    muted,
    reduceMotion,
    autoplayBlocked,
    togglePlay,
    toggleMute,
  } = useVideoPlayer();

  useEffect(() => {
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dockedStyle = {
    position: "fixed",
    top: MINI_THUMB_TOP,
    left: MINI_THUMB_LEFT,
    width: MINI_THUMB_SIZE,
    height: MINI_THUMB_SIZE,
    borderRadius: 8,
  };

  const heroStyle = {
    position: "relative",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: 16,
  };

  return (
    <div
      ref={heroSlotRef}
      className="relative mx-auto mt-8 aspect-video w-full max-w-[880px] sm:mt-10"
    >
      <motion.div
        layout={!reduceMotion}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 32 }
        }
        style={isDocked ? dockedStyle : heroStyle}
        className="z-40 overflow-hidden border border-navy-600 bg-navy-950 shadow-2xl"
      >
        {hasError ? (
          <VideoFallback />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster="/videos/promo-poster.jpg"
            muted={muted}
            autoPlay
            playsInline
            // legacy iOS attribute name; harmless on browsers that only
            // recognize the camelCase React prop above
            webkit-playsinline="true"
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              setProgress(v.duration ? v.currentTime / v.duration : 0);
            }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onError={() => setHasError(true)}
          >
            <source
              src="/videos/oai-nexus-promo-mobile.webm"
              type="video/webm"
              media="(max-width: 767px)"
            />
            <source
              src="/videos/oai-nexus-promo-mobile.mp4"
              type="video/mp4"
              media="(max-width: 767px)"
            />
            <source src="/videos/oai-nexus-promo.webm" type="video/webm" />
            <source src="/videos/oai-nexus-promo.mp4" type="video/mp4" />
          </video>
        )}

        {!isDocked && !hasError && (
          <>
            {/* Small, persistent, always visible — so it's never ambiguous
                that the video can be paused, independent of the big
                autoplay-blocked overlay below which only appears once. */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause video" : "Play video"}
              className="absolute bottom-3 left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-teal/40 bg-navy-900/70 text-teal backdrop-blur transition-colors hover:border-teal"
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute video" : "Mute video"}
              className="absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-teal/40 bg-navy-900/70 text-teal backdrop-blur transition-colors hover:border-teal"
            >
              <MuteIcon muted={muted} />
            </button>

            {autoplayBlocked && !playing && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play video"
                className="absolute inset-0 z-10 flex items-center justify-center bg-navy-950/40"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-teal/50 bg-navy-900/80">
                  <PlayIcon className="h-6 w-6 text-teal" />
                </span>
              </button>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function VideoFallback() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-cover bg-center text-center"
      style={{ backgroundImage: "url(/videos/promo-poster.jpg)" }}
    >
      <div className="rounded-md bg-navy-950/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
        Video unavailable
      </div>
    </div>
  );
}
