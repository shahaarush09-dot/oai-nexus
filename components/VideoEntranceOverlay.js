"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { rampVolume } from "@/lib/audioFade";
import { hasSeenVideo, markVideoSeen } from "@/lib/videoSeen";

const ANIM_DURATION = 0.6;
const POP_EASE = [0.34, 1.56, 0.64, 1];
const UNMUTE_FADE_MS = 200;
const EXIT_AUDIO_FADE_MS = 300;
const EXIT_AUDIO_FADE_DELAY_MS = (ANIM_DURATION * 1000) - EXIT_AUDIO_FADE_MS;
const FALLBACK_TIMEOUT_MS = 12000;
const ERROR_FALLBACK_DELAY_MS = 1000;
const SKIP_BUTTON_DELAY_MS = 3000;

// Full-screen video entrance/exit gate for the tool pages. Owns its own
// lifecycle end to end (session-seen check, playback, fade out) and tells
// the page exactly once, via onExitComplete, when it's safe to reveal the
// chat/tool beneath it — either immediately (already seen this session) or
// after the exit animation finishes playing.
export default function VideoEntranceOverlay({
  videoFileName,
  storageKey,
  onExitComplete,
  ariaLabel,
}) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const exitStartedRef = useRef(false);

  // The single funnel for every exit path — natural end, load error, and
  // the 12s stall fallback all route through here, so "seen" only needs
  // to be recorded in one place. Missing this on the timeout path was a
  // real bug caught in testing: a video that never loads would otherwise
  // never mark itself seen, and a user stuck behind a broken/slow video
  // would re-eat the full 12s stall on every single page visit.
  const triggerExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    clearTimeout(timeoutRef.current);
    markVideoSeen(storageKey);
    const el = videoRef.current;
    if (el) {
      setTimeout(() => rampVolume(el, el.volume, 0, EXIT_AUDIO_FADE_MS), EXIT_AUDIO_FADE_DELAY_MS);
    }
    setVisible(false);
  }, [storageKey]);

  useEffect(() => {
    if (hasSeenVideo(storageKey)) {
      // Skipped entirely — the caller should reveal instantly, not run
      // the same 600ms fade a real post-video reveal gets.
      onExitComplete?.({ skipped: true });
    } else {
      setVisible(true);
      timeoutRef.current = setTimeout(triggerExit, FALLBACK_TIMEOUT_MS);
    }
    setReady(true);
    return () => clearTimeout(timeoutRef.current);
    // Intentionally only runs once on mount — storageKey/onExitComplete
    // aren't expected to change under a single mounted overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip button only makes sense once the entrance animation has settled
  // and the video's actually playing — appearing instantly alongside the
  // video would invite a reflex click before anyone's seen anything. Never
  // starts at all when the video was skipped via sessionStorage, since
  // `visible` never goes true on that path.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setShowSkip(true), SKIP_BUTTON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  function handleEnded() {
    triggerExit();
  }

  function handleError(e) {
    console.error(`[VideoEntranceOverlay] failed to load ${videoFileName}`, e);
    setTimeout(triggerExit, ERROR_FALLBACK_DELAY_MS);
  }

  // Audio stays muted through the entrance animation so unmuting never
  // collides with the scale/opacity pop — this fires once, when that
  // animation's `animate` (not `exit`) transition resolves.
  function handleEntranceComplete() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    rampVolume(el, 0, 1, UNMUTE_FADE_MS);
  }

  if (!ready) return null;

  return (
    <AnimatePresence onExitComplete={() => onExitComplete?.({ skipped: false })}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[1000] overflow-hidden bg-black"
          style={{ willChange: "transform, opacity" }}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: ANIM_DURATION, ease: POP_EASE }}
          onAnimationComplete={handleEntranceComplete}
        >
          <video
            ref={videoRef}
            className="pointer-events-none h-full w-full object-cover"
            src={`/videos/nexus-tools/${videoFileName}`}
            aria-label={ariaLabel || `${videoFileName} entrance video`}
            autoPlay
            muted
            playsInline
            disablePictureInPicture
            controlsList="nofullscreen noremoteplayback"
            preload="auto"
            onEnded={handleEnded}
            onError={handleError}
          />
        </motion.div>
      )}
      {visible && showSkip && (
        // Sibling of the fading video container, not a child of it — gated
        // on `visible` directly rather than mirroring the video's own
        // opacity, so it vanishes instantly the moment any exit path
        // fires (natural end, error, timeout, or this button itself)
        // instead of trailing along with the video's 600ms fade.
        <button
          type="button"
          onClick={triggerExit}
          aria-label="Skip video"
          className="fixed bottom-8 right-8 z-[1001] hidden select-none text-xs font-light tracking-[0.5px] text-white opacity-30 transition-opacity duration-200 hover:opacity-80 md:block"
        >
          Skip
        </button>
      )}
    </AnimatePresence>
  );
}
