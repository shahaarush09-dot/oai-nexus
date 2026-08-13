// Memoized fetch of the Intelligence dataset's headline stats. Both the
// intro sequence and the persistent header strip need these numbers, and
// they mount at the same moment — sharing one in-flight promise means the
// second caller never fires a second request. A rejected fetch clears the
// cache so a later caller can retry rather than inheriting a permanently
// broken promise.
let cached = null;

export function loadIntelligenceMetadata() {
  if (!cached) {
    cached = fetch("/data/metadata.json")
      .then((res) => {
        if (!res.ok) throw new Error(`metadata.json responded ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}
