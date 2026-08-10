// The station state machine, deliberately free of DOM, React and timers:
// it takes normalized scroll deltas plus an explicit `now`, and calls out.
// Everything about input (wheel deltaMode normalization, touch scaling,
// keyboard, preventDefault) lives in useStationNavigator.js on top of this.
//
// Split out this way for one concrete reason: the interesting failure mode
// here is a TIMING one — momentum scrolling chaining a single flick through
// several stations — and timing is the one thing that is miserable to
// verify by hand in a browser. With `now` injected, the whole momentum
// scenario is a deterministic unit test (see test/stationMachine.test.mjs).

// No events for this long ends the current gesture. Trackpad momentum
// emits continuously at ~8-16ms intervals, so this comfortably keeps a
// flick and its tail as one gesture while treating a genuine second swipe
// as new.
export const GESTURE_END_MS = 140;
export const TRANSITION_MS = 700;

export function createStationMachine({ stations, onArrive, onProgress, onFinish }) {
  const state = {
    index: 0,
    progress: 0,
    transitionUntil: 0,
    gestureStart: 0,
    lastDeltaAt: -Infinity,
    // Timestamp at which the current station reached progress 1 (forward)
    // or 0 (backward). null means "not saturated in that direction".
    saturatedFwd: null,
    saturatedBack: null,
    blockedGesture: null,
    finished: false,
  };

  function setProgress(p) {
    state.progress = p;
    onProgress?.(state.index, p);
  }

  function goTo(nextIndex, direction, now) {
    state.index = nextIndex;
    // Input is refused for the camera move PLUS the arriving station's
    // dwell. The dwell is what lets a station play a short build-in of its
    // own without the user having to scroll through it: they arrive, the
    // room assembles itself, and the next gesture takes them onward. It
    // replaces the old model where assembly was scrubbed directly from
    // scroll delta — which needed ~26 wheel events to get through a single
    // station and felt like fighting the page rather than pacing it.
    const dwell = stations[nextIndex]?.dwellMs || 0;
    state.transitionUntil = now + TRANSITION_MS + dwell;
    // Arriving forward starts a fresh build; arriving backward shows the
    // station already complete, so reversing back out of the tour doesn't
    // force re-watching every construction in reverse.
    state.saturatedFwd = direction > 0 ? null : now;
    state.saturatedBack = direction > 0 ? now : null;
    setProgress(direction > 0 ? 0 : 1);
    onArrive?.(nextIndex, direction);
  }

  function pushDelta(delta, now) {
    if (state.finished || delta === 0) return;

    // --- gesture segmentation -----------------------------------------
    if (now - state.lastDeltaAt > GESTURE_END_MS) state.gestureStart = now;
    state.lastDeltaAt = now;

    // A gesture that has already been rejected stays rejected for its whole
    // life, momentum tail included — otherwise the tail of the flick that
    // triggered a station change would immediately start filling the next
    // station's budget, and one swipe would run the entire tour.
    if (state.blockedGesture === state.gestureStart) return;

    if (now < state.transitionUntil) {
      state.blockedGesture = state.gestureStart;
      return;
    }

    const station = stations[state.index];
    const budget = station.budget;

    // Zero-build stations (entry, and the exit until its lights-down
    // sequence exists) advance on the FIRST gesture rather than the second.
    // The two-gesture pattern everywhere else is "watch it build, then move
    // on", which is correct pacing when there is something to watch — but
    // at a station with no construction the first gesture appears to do
    // nothing at all, and reads as the scroll being broken rather than as
    // deliberate pacing. Friction belongs only where it buys something.
    if (budget <= 0) {
      if (delta > 0 && state.index >= stations.length - 1) {
        state.finished = true;
        onFinish?.();
        return;
      }
      const next = state.index + (delta > 0 ? 1 : -1);
      if (next < 0) return;
      state.blockedGesture = state.gestureStart;
      goTo(next, delta > 0 ? 1 : -1, now);
      return;
    }

    if (delta > 0) {
      if (state.progress < 1) {
        const next = Math.min(1, state.progress + delta / budget);
        setProgress(next);
        if (next >= 1) state.saturatedFwd = now;
        return;
      }
      // Saturated: only a gesture that BEGAN after saturation may advance.
      if (state.saturatedFwd !== null && state.gestureStart <= state.saturatedFwd) return;
      if (state.index >= stations.length - 1) {
        state.finished = true;
        onFinish?.();
        return;
      }
      state.blockedGesture = state.gestureStart;
      goTo(state.index + 1, 1, now);
      return;
    }

    // --- backward: symmetric ------------------------------------------
    if (state.progress > 0) {
      const next = Math.max(0, state.progress + delta / budget);
      setProgress(next);
      if (next <= 0) state.saturatedBack = now;
      return;
    }
    if (state.saturatedBack !== null && state.gestureStart <= state.saturatedBack) return;
    if (state.index <= 0) return;
    state.blockedGesture = state.gestureStart;
    goTo(state.index - 1, -1, now);
  }

  // Touch and keyboard both produce unambiguously discrete gestures (a
  // finger lifting, a key press) regardless of how close together they
  // land, so they say so explicitly rather than relying on the idle-gap
  // heuristic that wheel input needs.
  function endGesture() {
    state.lastDeltaAt = -Infinity;
  }

  return { pushDelta, endGesture, state };
}
