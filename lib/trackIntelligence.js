"use client";

import { getAskSessionId } from "@/lib/askNexus";

// Fire-and-forget analytics for Nexus Intelligence.
//
// Every call is deliberately unawaited and failure-swallowing: analytics is
// the least important thing on the page, and a slow or down endpoint must
// never delay a filter pass or surface an error to someone browsing.
//
// Reuses the Ask Nexus session id rather than minting a second one, so a
// visitor's events and their Ask Nexus rate-limit bucket describe the same
// session instead of two overlapping ones.
export function track(event, metadata) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    event,
    sessionId: getAskSessionId(),
    metadata: metadata || {},
  });

  try {
    // sendBeacon survives the page being closed mid-flight, which matters
    // for the events that happen right before someone navigates away.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through to fetch
  }

  fetch("/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

// Guards events that should fire once per page load no matter how many
// times a component remounts or an effect re-runs — page_view and
// explore_open both sit in effects that React can legitimately run twice
// (StrictMode in dev, and any future remount).
const fired = new Set();

export function trackOnce(event, metadata) {
  if (fired.has(event)) return;
  fired.add(event);
  track(event, metadata);
}
