"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";

const VideoPlayerContext = createContext(null);

// How far (px) past the hero video's slot the page must scroll before the
// mini player takes over. A little slack (rather than 0) keeps the
// dock/undock from flip-flopping right at the boundary.
const DOCK_OFFSET_PX = 80;

export function VideoPlayerProvider({ children }) {
  const videoRef = useRef(null);
  const heroSlotRef = useRef(null);
  const slotAbsoluteTopRef = useRef(0);

  const [isDocked, setIsDocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Starts muted so the initial autoplay attempt actually succeeds —
  // browsers only guarantee autoplay when muted; an unmuted attempt is
  // frequently blocked outright, which is what left the video sitting
  // paused on load. The mute button (and the corner play/pause button)
  // stay prominent so turning sound on is a one-tap action.
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();

  useEffect(() => {
    function measure() {
      const slot = heroSlotRef.current;
      if (!slot) return;
      slotAbsoluteTopRef.current =
        slot.getBoundingClientRect().top + window.scrollY;
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
    };
  }, []);

  // Cheap comparison against a value cached on mount/resize, not a
  // getBoundingClientRect() read on every scroll tick — keeps the scroll
  // handler itself free of forced layout.
  useMotionValueEvent(scrollY, "change", (latest) => {
    const next = latest > slotAbsoluteTopRef.current + DOCK_OFFSET_PX;
    setIsDocked((prev) => (prev === next ? prev : next));
  });

  // play/pause set `playing` optimistically rather than waiting solely on
  // the video's own play/pause DOM events. pause() is synchronous per the
  // HTML spec so this is always accurate; play() corrects itself in the
  // catch if the browser actually blocks it. This is what fixes the
  // mismatched icon — relying only on the DOM events left a window where a
  // rapid toggle (or an autoplay attempt racing a user click) could leave
  // React state one step behind the real video state. The onPlay/onPause
  // handlers on the <video> element stay wired up too, as a harmless
  // backstop for state changes that don't go through these functions.
  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.paused) return;
    setPlaying(true);
    v.play()
      .then(() => setAutoplayBlocked(false))
      .catch(() => {
        setAutoplayBlocked(true);
        setPlaying(false);
      });
  }, []);

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.paused) return;
    v.pause();
    setPlaying(false);
  }, []);

  const replay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    play();
  }, [play]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.ended) replay();
    else if (v.paused) play();
    else pause();
  }, [play, pause, replay]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) pause();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  // Autoplay only ever starts muted (see above) — true unmuted autoplay is
  // blocked by every major browser with no exception, confirmed against
  // both a fresh incognito profile and a normal one, so no attempt tied to
  // page load or to playback starting can ever work. The one thing that
  // reliably does: unmuting on the user's first genuine interaction
  // anywhere on the page, not necessarily the video itself — a click, a
  // tap, a key press. Browsers count that as valid activation for audio.
  // Skips clicks that land on our own control buttons so their own
  // mute/pause handlers stay authoritative instead of racing this.
  useEffect(() => {
    let done = false;
    function onFirstInteraction(e) {
      if (done || (e.target.closest && e.target.closest("button"))) return;
      done = true;
      cleanup();
      const v = videoRef.current;
      if (v && v.muted) {
        v.muted = false;
        setMuted(false);
      }
    }
    function cleanup() {
      window.removeEventListener("click", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    }
    window.addEventListener("click", onFirstInteraction);
    window.addEventListener("keydown", onFirstInteraction);
    return cleanup;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  const value = {
    videoRef,
    heroSlotRef,
    isDocked,
    playing,
    setPlaying,
    muted,
    toggleMute,
    progress,
    setProgress,
    duration,
    setDuration,
    hasError,
    setHasError,
    autoplayBlocked,
    play,
    pause,
    togglePlay,
    replay,
    reduceMotion,
  };

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer() {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) {
    throw new Error("useVideoPlayer must be used within a VideoPlayerProvider");
  }
  return ctx;
}
