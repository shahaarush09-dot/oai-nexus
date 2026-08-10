// Session-scoped "has this tool's entrance video already played" check,
// pulled out of VideoEntranceOverlay as plain functions so it's testable
// without a DOM (this repo's test/ suite runs under node:test, not a
// browser/jsdom harness). `storage` is injectable — defaults to the real
// sessionStorage in the browser, swapped for a mock in tests — and both
// functions swallow storage errors (private-browsing mode can throw on
// access) by treating that the same as "not seen".
export function hasSeenVideo(storageKey, storage = globalThis.sessionStorage) {
  try {
    return storage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

export function markVideoSeen(storageKey, storage = globalThis.sessionStorage) {
  try {
    storage.setItem(storageKey, "true");
  } catch {
    // ignore — worst case the video replays next load
  }
}
