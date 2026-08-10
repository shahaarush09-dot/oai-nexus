// node --test test/videoSeen.test.mjs
//
// hasSeenVideo/markVideoSeen are the one piece of VideoEntranceOverlay's
// logic that's plain functions rather than React effects/refs — pulled
// out specifically so the "does a tool's video only ever play once per
// session, and does a broken storage backend fail safe rather than crash"
// contract has a real test, without needing a DOM/React test harness this
// repo doesn't otherwise have.

import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSeenVideo, markVideoSeen } from "../lib/videoSeen.js";

function makeMockStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

function makeThrowingStorage() {
  return {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
  };
}

test("hasSeenVideo is false for a key that was never set", () => {
  const storage = makeMockStorage();
  assert.equal(hasSeenVideo("tool-patient-video-seen", storage), false);
});

test("markVideoSeen makes a subsequent hasSeenVideo check true", () => {
  const storage = makeMockStorage();
  markVideoSeen("tool-patient-video-seen", storage);
  assert.equal(hasSeenVideo("tool-patient-video-seen", storage), true);
});

test("each tool's storage key is independent", () => {
  const storage = makeMockStorage();
  markVideoSeen("tool-patient-video-seen", storage);
  assert.equal(hasSeenVideo("tool-clinical-video-seen", storage), false);
  assert.equal(hasSeenVideo("tool-diligence-video-seen", storage), false);
});

test("hasSeenVideo treats a throwing storage (e.g. private browsing) as unseen, not a crash", () => {
  const storage = makeThrowingStorage();
  assert.equal(hasSeenVideo("tool-patient-video-seen", storage), false);
});

test("markVideoSeen on a throwing storage does not throw", () => {
  const storage = makeThrowingStorage();
  assert.doesNotThrow(() => markVideoSeen("tool-patient-video-seen", storage));
});
