"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import VideoEntranceOverlay from "@/components/VideoEntranceOverlay";

// Page-level coordinator: the video overlay and the tool it gates
// (ChatInterface, BioPageClient, ...) are siblings, not parent/child, so
// something needs to own the shared "has the video finished (or been
// skipped) yet" boolean and hand it to both. Kept separate from
// VideoEntranceOverlay itself so that component stays a pure, reusable
// video lifecycle — this file is the only part that's tool-page-specific.
export default function ToolVideoGate({ videoFileName, storageKey, ariaLabel, children }) {
  const [revealed, setRevealed] = useState(false);
  // Skipping (already seen this session) must reveal at full opacity with
  // no fade — only a reveal that follows real video playback gets the
  // 600ms fade. Tracked as a ref, not state: it's read once inside the
  // same handler that flips `revealed`, so it never needs to trigger a
  // render on its own.
  const skippedRef = useRef(true);
  const reveal = useCallback(({ skipped }) => {
    skippedRef.current = skipped;
    setRevealed(true);
  }, []);

  return (
    <>
      <VideoEntranceOverlay
        videoFileName={videoFileName}
        storageKey={storageKey}
        ariaLabel={ariaLabel}
        onExitComplete={reveal}
      />
      <motion.div
        initial={false}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: skippedRef.current ? 0 : 0.6 }}
        aria-hidden={!revealed}
        inert={!revealed ? "" : undefined}
      >
        {children}
      </motion.div>
    </>
  );
}
