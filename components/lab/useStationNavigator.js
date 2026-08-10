"use client";

import { useEffect, useRef } from "react";
import { createStationMachine, TRANSITION_MS } from "@/lib/stationMachine";

export { TRANSITION_MS };

// Input layer for the lab's discrete station navigation. All decision
// logic lives in lib/stationMachine.js (DOM-free and unit-tested); this
// file only turns wheel/touch/key events into normalized deltas and feeds
// them in.
//
// WHY NOT CSS scroll-snap (the obvious first choice, rejected deliberately):
//   1. `scroll-snap-type: y mandatory` resolves a trackpad fling to the
//      NEAREST snap point after the fling completes, not the next one — a
//      single hard swipe skips two or three stations. That is precisely the
//      behaviour discrete stations exist to prevent.
//   2. Mandatory snap means no stable intermediate scroll position exists
//      at all, so "keep scrolling at a station to advance the build" is not
//      expressible in it. It forces the auto-play fallback.
//
// So there is no scrollable element here — the gate overlay is a plain
// fixed div and this hook reads input directly. That also removes, rather
// than works around, the entire bug class the previous scroll-container
// gate had to defend against (Lenis eating wheel events, overscroll
// chaining to <html>, the real page drifting behind the overlay): with
// nothing scrollable in play there is nothing to chain to and nothing to
// fight over. Lenis is still .stop()'d by the caller, and its own
// preventDefault does not stop propagation, so our listener still receives
// every wheel event.

// Wheel deltas arrive in three different units depending on OS/browser
// (deltaMode 0 = pixels, 1 = lines, 2 = pages). Normalizing to pixels is
// what stops a Firefox/Windows line-mode mouse wheel behaving completely
// differently to a Chrome/macOS trackpad.
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;
// No single event should consume a meaningful slice of a station's budget
// on its own — some mice report enormous one-shot deltas.
const MAX_EVENT_DELTA = 100;
// Touch drags cover far less raw delta than a wheel for the same intent.
const TOUCH_SCALE = 2.4;
// One key press fills the current station, the next advances it —
// predictable, and it makes the whole tour completable from the keyboard.
const KEY_DELTA = 1e6;

const FORWARD_KEYS = new Set(["ArrowDown", "PageDown", " ", "Spacebar", "Enter"]);
const BACKWARD_KEYS = new Set(["ArrowUp", "PageUp"]);

const clamp = (v) => Math.max(-MAX_EVENT_DELTA, Math.min(MAX_EVENT_DELTA, v));

export default function useStationNavigator({
  enabled,
  stations,
  onArrive,
  onProgress,
  onFinish,
}) {
  // Callbacks are stashed in a ref so the listener effect doesn't need them
  // in its dependency array — re-running it would tear down and re-attach
  // the listeners mid-gesture and lose the machine's accumulated state.
  const cbRef = useRef({ onArrive, onProgress, onFinish });
  cbRef.current = { onArrive, onProgress, onFinish };

  useEffect(() => {
    if (!enabled) return;

    const machine = createStationMachine({
      stations,
      onArrive: (...a) => cbRef.current.onArrive?.(...a),
      onProgress: (...a) => cbRef.current.onProgress?.(...a),
      onFinish: (...a) => cbRef.current.onFinish?.(...a),
    });

    function onWheel(e) {
      // passive:false + preventDefault: nothing on the page should scroll
      // while the gate owns the viewport. On some browsers an unprevented
      // wheel still nudges the document even with overflow hidden — the
      // previous gate hit exactly this and needed a scroll-position
      // snap-back listener to paper over it.
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= WHEEL_LINE_PX;
      else if (e.deltaMode === 2) dy *= WHEEL_PAGE_PX;
      machine.pushDelta(clamp(dy), performance.now());
    }

    let touchY = null;
    function onTouchStart(e) {
      touchY = e.touches[0]?.clientY ?? null;
      machine.endGesture();
    }
    function onTouchMove(e) {
      if (touchY === null) return;
      e.preventDefault();
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      const dy = (touchY - y) * TOUCH_SCALE;
      touchY = y;
      machine.pushDelta(clamp(dy), performance.now());
    }
    function onTouchEnd() {
      touchY = null;
      machine.endGesture();
    }

    function onKeyDown(e) {
      const forward = FORWARD_KEYS.has(e.key);
      const backward = BACKWARD_KEYS.has(e.key);
      if (!forward && !backward) return;
      e.preventDefault();
      machine.endGesture();
      machine.pushDelta(forward ? KEY_DELTA : -KEY_DELTA, performance.now());
    }

    const opts = { passive: false };
    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown, opts);

    // Fire the opening station's arrival so the camera is placed and the
    // caller's first side effects run without needing a special case.
    cbRef.current.onArrive?.(0, 1);
    cbRef.current.onProgress?.(0, 0);

    return () => {
      window.removeEventListener("wheel", onWheel, opts);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove, opts);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown, opts);
    };
  }, [enabled, stations]);
}
