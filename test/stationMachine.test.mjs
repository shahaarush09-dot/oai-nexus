// node --test test/stationMachine.test.mjs
//
// The station machine's risky behaviour is all timing-dependent — momentum
// tails, gesture segmentation, the transition lockout — which is exactly
// what is impractical to verify by hand in a browser. `now` is injected, so
// every one of those scenarios is deterministic here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createStationMachine, TRANSITION_MS } from "../lib/stationMachine.js";

const STATIONS = [
  { id: "entry", budget: 700 },
  { id: "s1", budget: 2600 },
  { id: "s2", budget: 2600 },
  { id: "s3", budget: 2600 },
  { id: "exit", budget: 700 },
];

// Mirrors the shipped config, where entry/exit have nothing to watch.
const ZERO_BUILD_STATIONS = [
  { id: "entry", budget: 0 },
  { id: "s1", budget: 2600 },
  { id: "exit", budget: 0 },
];

function setup(stations = STATIONS) {
  const arrivals = [];
  let finished = 0;
  const m = createStationMachine({
    stations,
    onArrive: (i, dir) => arrivals.push([i, dir]),
    onProgress: () => {},
    onFinish: () => { finished++; },
  });
  return { m, arrivals, finished: () => finished };
}

// Emit `count` wheel events `stepMs` apart starting at `t`, as one
// continuous gesture. Returns the timestamp after the last event.
function flick(m, { at, count, stepMs = 8, delta = 100 }) {
  let t = at;
  for (let i = 0; i < count; i++) {
    m.pushDelta(delta, t);
    t += stepMs;
  }
  return t;
}

test("a single flick fills the station budget but never advances", () => {
  const { m, arrivals } = setup();
  // 40 events x 100 = 4000 delta, ~5.7x the entry station's 700 budget.
  flick(m, { at: 1000, count: 40 });
  assert.equal(m.state.progress, 1, "budget should be full");
  assert.equal(m.state.index, 0, "must NOT have advanced on the same gesture");
  assert.equal(arrivals.length, 0);
});

test("a second gesture after the flick advances exactly one station", () => {
  const { m, arrivals } = setup();
  const end = flick(m, { at: 1000, count: 40 });
  // New gesture: > GESTURE_END_MS of silence, then input.
  m.pushDelta(100, end + 300);
  assert.equal(m.state.index, 1);
  assert.deepEqual(arrivals, [[1, 1]]);
  assert.equal(m.state.progress, 0, "new station starts unbuilt");
});

test("REGRESSION: one long momentum flick cannot chain through stations", () => {
  // The core failure this machine exists to prevent. macOS momentum emits
  // wheel events for well over a second after the fingers lift; naively
  // accumulated, that single flick fills entry, advances, fills station 1,
  // advances, and runs the whole tour. 400 events x 100 delta = 40000,
  // ~4.6x the budget of the ENTIRE tour combined.
  const { m, arrivals } = setup();
  flick(m, { at: 1000, count: 400, stepMs: 8 });
  assert.equal(m.state.index, 0, "one gesture must never move a station");
  assert.equal(arrivals.length, 0);
});

test("input during a station transition is ignored, tail included", () => {
  const { m, arrivals } = setup();
  const end = flick(m, { at: 1000, count: 40 });
  m.pushDelta(100, end + 300); // advance to station 1
  const tAdvance = end + 300;
  assert.equal(m.state.index, 1);

  // Momentum tail continuing through the whole 700ms transition window.
  let t = tAdvance + 8;
  while (t < tAdvance + TRANSITION_MS) {
    m.pushDelta(100, t);
    t += 8;
  }
  assert.equal(m.state.progress, 0, "transition input must not build");
  assert.equal(m.state.index, 1);
  assert.equal(arrivals.length, 1);
});

test("the tail of an advancing gesture cannot build the next station", () => {
  // Subtler than the lockout above: even AFTER the 700ms transition has
  // elapsed, a still-running gesture must stay rejected.
  const { m } = setup();
  const end = flick(m, { at: 1000, count: 40 });
  const tAdvance = end + 300;
  m.pushDelta(100, tAdvance);
  assert.equal(m.state.index, 1);

  let t = tAdvance + 8;
  const until = tAdvance + TRANSITION_MS + 600; // well past the lockout
  while (t < until) {
    m.pushDelta(100, t);
    t += 8;
  }
  assert.equal(m.state.progress, 0, "same gesture must stay dead after lockout");
});

test("walking the full tour takes exactly two gestures per station", () => {
  const { m, arrivals, finished } = setup();
  let t = 1000;
  for (let s = 0; s < STATIONS.length; s++) {
    t = flick(m, { at: t, count: 40 }) + 300;   // gesture A: fill
    m.pushDelta(100, t);                         // gesture B: advance
    t += TRANSITION_MS + 300;
  }
  assert.deepEqual(arrivals, [[1, 1], [2, 1], [3, 1], [4, 1]]);
  assert.equal(finished(), 1, "advancing past the last station finishes");
});

test("reverse rewinds the build, then steps back a station already complete", () => {
  const { m, arrivals } = setup();
  let t = flick(m, { at: 1000, count: 40 }) + 300;
  m.pushDelta(100, t);            // -> station 1
  t += TRANSITION_MS + 300;
  flick(m, { at: t, count: 20 }); // partially build station 1 (2000/2600)
  t += 20 * 8 + 300;
  assert.ok(m.state.progress > 0 && m.state.progress < 1);

  flick(m, { at: t, count: 40, delta: -100 }); // rewind to 0
  t += 40 * 8 + 300;
  assert.equal(m.state.progress, 0);
  assert.equal(m.state.index, 1, "rewinding the build must not step back yet");

  m.pushDelta(-100, t);           // new gesture -> back to entry
  assert.equal(m.state.index, 0);
  assert.deepEqual(arrivals.at(-1), [0, -1]);
  assert.equal(m.state.progress, 1, "arriving backward shows it complete");
});

test("reverse at the first station is a no-op", () => {
  const { m, arrivals } = setup();
  for (let i = 0; i < 20; i++) m.pushDelta(-100, 1000 + i * 300);
  assert.equal(m.state.index, 0);
  assert.equal(arrivals.length, 0);
});

test("endGesture makes back-to-back discrete input count separately", () => {
  // Two key presses 1ms apart are two gestures, not one — the idle-gap
  // heuristic alone would merge them.
  const { m } = setup();
  m.endGesture();
  m.pushDelta(1e6, 1000);         // fills entry
  assert.equal(m.state.progress, 1);
  m.endGesture();
  m.pushDelta(1e6, 1001);         // advances despite being 1ms later
  assert.equal(m.state.index, 1);
});

test("a zero-build station advances on the FIRST gesture", () => {
  const { m, arrivals } = setup(ZERO_BUILD_STATIONS);
  m.pushDelta(100, 1000);
  assert.equal(m.state.index, 1, "entry should move immediately");
  assert.deepEqual(arrivals, [[1, 1]]);
});

test("a zero-build station still cannot be chained past by one flick", () => {
  // The first-gesture shortcut must not reopen the momentum-chaining hole:
  // the same flick that leaves entry must not then build station 1.
  const { m, arrivals } = setup(ZERO_BUILD_STATIONS);
  flick(m, { at: 1000, count: 400, stepMs: 8 });
  assert.equal(m.state.index, 1, "exactly one station, not the whole tour");
  assert.equal(m.state.progress, 0, "the tail must not build the next station");
  assert.equal(arrivals.length, 1);
});

test("a zero-build exit station finishes on the first gesture", () => {
  const { m, finished } = setup(ZERO_BUILD_STATIONS);
  let t = 1000;
  m.pushDelta(100, t);                       // entry -> s1
  t += TRANSITION_MS + 300;
  t = flick(m, { at: t, count: 30 }) + 300;  // build s1 (3000 > 2600)
  m.pushDelta(100, t);                       // s1 -> exit
  t += TRANSITION_MS + 300;
  assert.equal(m.state.index, 2);
  m.pushDelta(100, t);                       // exit -> done
  assert.equal(finished(), 1);
});

test("reverse out of a zero-build station steps back on the first gesture", () => {
  const { m, arrivals } = setup(ZERO_BUILD_STATIONS);
  m.pushDelta(100, 1000);
  const t = 1000 + TRANSITION_MS + 300;
  // Build s1 fully, advance to the zero-build exit, then reverse.
  const t2 = flick(m, { at: t, count: 30 }) + 300;
  m.pushDelta(100, t2);
  const t3 = t2 + TRANSITION_MS + 300;
  assert.equal(m.state.index, 2);
  m.pushDelta(-100, t3);
  assert.equal(m.state.index, 1);
  assert.deepEqual(arrivals.at(-1), [1, -1]);
});

// --- the shipped pacing model: one gesture per station, plus a dwell ---
// while the arriving station plays its own build-in.
const DWELL_STATIONS = [
  { id: "entry", budget: 0, dwellMs: 0 },
  { id: "s1", budget: 0, dwellMs: 900 },
  { id: "s2", budget: 0, dwellMs: 900 },
  { id: "exit", budget: 0, dwellMs: 0 },
];

test("SHIPPED MODEL: one gesture per station, start to finish", () => {
  const { m, arrivals, finished } = setup(DWELL_STATIONS);
  let t = 1000;
  const step = TRANSITION_MS + 900 + 200; // transition + dwell + a beat
  m.pushDelta(100, t); t += step;   // entry -> s1
  m.pushDelta(100, t); t += step;   // s1 -> s2
  m.pushDelta(100, t); t += step;   // s2 -> exit
  m.pushDelta(100, t);              // exit -> done
  assert.deepEqual(arrivals, [[1, 1], [2, 1], [3, 1]]);
  assert.equal(finished(), 1);
});

test("REGRESSION: a station is never more than one gesture from the next", () => {
  // The failure this model exists to fix: the previous scroll-budget
  // version needed ~26 wheel notches per station. A single notch must now
  // always be enough, including for a notched mouse whose events are far
  // coarser than a trackpad's.
  const { m, arrivals } = setup(DWELL_STATIONS);
  const t = 1000 + TRANSITION_MS + 900 + 200;
  m.pushDelta(120, 1000);  // one notch
  assert.equal(m.state.index, 1, "one notch must move a whole station");
  m.pushDelta(120, t);     // one more notch
  assert.equal(m.state.index, 2);
  assert.equal(arrivals.length, 2);
});

test("the dwell refuses input until the arriving station has built in", () => {
  const { m, arrivals } = setup(DWELL_STATIONS);
  m.pushDelta(100, 1000);                       // entry -> s1
  assert.equal(m.state.index, 1);
  // Everything inside the transition+dwell window must be ignored, so the
  // build-in can't be skipped past before it has played.
  for (let t = 1100; t < 1000 + TRANSITION_MS + 900; t += 50) {
    m.pushDelta(100, t);
  }
  assert.equal(m.state.index, 1, "must not advance during the dwell");
  assert.equal(arrivals.length, 1);
  // And a gesture after it is accepted normally.
  m.pushDelta(100, 1000 + TRANSITION_MS + 900 + 200);
  assert.equal(m.state.index, 2);
});

test("a zero-dwell station has no lockout beyond the camera move", () => {
  const { m } = setup(DWELL_STATIONS);
  // entry has dwellMs 0, so only TRANSITION_MS applies leaving it.
  m.pushDelta(100, 1000);
  assert.equal(m.state.index, 1);
  m.pushDelta(100, 1000 + TRANSITION_MS + 900 + 100);
  assert.equal(m.state.index, 2);
});

test("a line-mode wheel and a pixel-mode wheel need comparable gesture counts", () => {
  // Guards the deltaMode normalization contract the input layer relies on:
  // 3 lines x 16px = 48px, so ~15 events fill the 700 entry budget, the
  // same order as 7 events of 100px. Without normalization a line-mode
  // mouse would need 234 clicks.
  const { m } = setup();
  flick(m, { at: 1000, count: 15, delta: 3 * 16 });
  assert.equal(m.state.progress, 1);
});
