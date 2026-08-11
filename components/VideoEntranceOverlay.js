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
// Diagnostic logging (mount, loadstart, canplay, play, playing, waiting,
// stalled — timestamped relative to mount) confirmed this needed to move:
// across every test run, `canplay` never fired before the old 500ms cap,
// so that "rare backstop" was actually the trigger path 100% of the time —
// forcing play() before any real buffer existed, which produces an
// immediate 'waiting' stall. 4s gives canplay a real chance to fire
// naturally (curl confirms the file itself serves in ~20ms, so a healthy
// connection has no reason to need anywhere near this long) while still
// backstopping a slow one well short of the 12s give-up below.
const CANPLAY_FORCE_TIMEOUT_MS = 4000;
// If playback starts and then stalls ('waiting' with no recovering
// 'playing'), don't leave the frozen frame up for the remaining span of
// the 12s give-up timer — bail to chat within a few seconds of the stall
// instead.
const STALL_BAILOUT_MS = 4000;

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
  const stallTimeoutRef = useRef(null);
  const exitStartedRef = useRef(false);

  // The single funnel for every exit path — natural end, load error, the
  // 12s stall fallback, and the stall-recovery bailout all route through
  // here, so "seen" only needs to be recorded in one place. Missing this
  // on the timeout path was a real bug caught in earlier testing: a video
  // that never loads would otherwise never mark itself seen, and a user
  // stuck behind a broken/slow video would re-eat the full stall on every
  // single page visit.
  const triggerExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    clearTimeout(timeoutRef.current);
    clearTimeout(stallTimeoutRef.current);
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

  // Playback start is driven explicitly rather than left to the bare
  // `autoplay` attribute. A direct URL load (or a reload) has the video
  // file competing on the network with the page's own JS/CSS/document —
  // very different from a client-side route change, where those are
  // already cached and the video gets the connection to itself. Bare
  // autoplay lets the browser start as soon as it clears its own minimal
  // internal threshold, which under that contention can be just enough to
  // start and then stall once the initial buffer drains faster than it
  // refills. Waiting for `canplay` (real signal: enough buffered to
  // start) fixes that; CANPLAY_FORCE_TIMEOUT_MS is only a "don't leave
  // the screen blank forever" backstop, not the primary path.
  const attemptPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch((err) => {
      console.error(`[VideoEntranceOverlay] play() rejected for ${videoFileName}`, err);
    });
  }, [videoFileName]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(attemptPlay, CANPLAY_FORCE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [visible, attemptPlay]);

  function handleCanPlay() {
    attemptPlay();
  }

  // A stall that never recovers is exactly the freeze this was built to
  // catch: 'waiting' starts a bailout timer, and only 'playing' (real
  // frames rendering again) cancels it. If playback resumes on its own
  // within STALL_BAILOUT_MS, the video continues normally toward 'ended'.
  function handleWaiting() {
    clearTimeout(stallTimeoutRef.current);
    stallTimeoutRef.current = setTimeout(triggerExit, STALL_BAILOUT_MS);
  }

  // Unmuting used to be tied to the entrance animation finishing (a fixed
  // 600ms timer) rather than to playback actually being real — meaning a
  // stalled/frozen video could get unmuted anyway just because the timer
  // elapsed. Tying it to 'playing' instead means audio only ever starts
  // once frames are genuinely rendering, whether that happens quickly or
  // only after the canplay/stall fallbacks above kick in.
  function handlePlaying() {
    clearTimeout(stallTimeoutRef.current);
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    rampVolume(el, 0, 1, UNMUTE_FADE_MS);
  }

  function handleEnded() {
    triggerExit();
  }

  function handleError(e) {
    console.error(`[VideoEntranceOverlay] failed to load ${videoFileName}`, e);
    setTimeout(triggerExit, ERROR_FALLBACK_DELAY_MS);
  }

  if (!ready) return null;

  return (
    <AnimatePresence onExitComplete={() => onExitComplete?.({ skipped: false })}>
      {visible && (
        <motion.div
          key="video"
          className="fixed inset-0 z-[1000] overflow-hidden bg-black"
          style={{ willChange: "transform, opacity" }}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: ANIM_DURATION, ease: POP_EASE }}
        >
          <video
            ref={videoRef}
            className="pointer-events-none h-full w-full object-cover"
            src={`/videos/nexus-tools/${videoFileName}`}
            aria-label={ariaLabel || `${videoFileName} entrance video`}
            muted
            playsInline
            disablePictureInPicture
            controlsList="nofullscreen noremoteplayback"
            preload="auto"
            onCanPlay={handleCanPlay}
            onPlaying={handlePlaying}
            onWaiting={handleWaiting}
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
          key="skip"
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
