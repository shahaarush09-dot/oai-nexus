// Scrub-driven piece-by-piece assembly.
//
// Deliberately NOT GSAP. A GSAP timeline is the right tool when animation
// owns its own clock, but here the single source of truth is a scroll
// progress value the user can push forward AND backward at any speed, and
// which can jump if a frame is dropped. Expressed as a pure function of
// that value, assembly is exactly correct at every progress — perfectly
// scrubbable, reversible, and impossible to desync — where a timeline
// being seeked every frame has to be kept in step and can drift.
//
// Each piece declares a [start, end] window inside the station's 0..1
// build progress, plus where it flies in from. Everything else falls out.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Smooth acceleration out of the staging position.
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
// A small overshoot as a piece seats, so placement reads as a deliberate
// mechanical action rather than a slide to a stop.
function easeOutBack(t) {
  const c = 1.70158;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
}

export function createAssembly() {
  // Keyed rather than an array: React re-runs ref callbacks on every
  // render, and an array would accumulate a duplicate entry per piece per
  // render until the loop below is walking thousands of dead nodes.
  const pieces = new Map();

  // Home transforms are captured ONCE per key and never recaptured, in a
  // map deliberately separate from `pieces`.
  //
  // This is load-bearing. React calls a changed ref callback with null
  // before calling the new one with the node, and `reg()` produces a fresh
  // callback every render — so every re-render detaches and reattaches
  // every piece. If the home transform were recaptured on reattach it
  // would be read from the object AS APPLY LEFT IT, so each render would
  // fold the current animation factor into the baseline. Scale compounds
  // multiplicatively that way: the furniture shrank toward zero over a few
  // renders and the room rendered empty, with no error anywhere.
  const homes = new Map();
  const homeOf = (key) => {
    const h = homes.get(key);
    return { home: h.position, homeRot: h.rotation, homeScale: h.scale };
  };

  return {
    /**
     * @param key    stable id for this piece
     * @param obj    the Object3D (null on unmount — removes the entry)
     * @param cfg    { start, end, from:[x,y,z], rotFrom:[x,y,z], spin }
     */
    set(key, obj, cfg) {
      // A null means React is detaching before reattaching the same node.
      // Deliberately ignored rather than treated as a removal — see the
      // note on `homes`. The whole assembly is owned by one station
      // component and discarded with it, so nothing leaks.
      if (!obj) return;

      if (!homes.has(key)) {
        homes.set(key, {
          // Captured from whatever the JSX declared as the final resting
          // transform, so a piece's authored position IS its assembled
          // position and nothing has to be written twice.
          position: obj.position.clone(),
          rotation: obj.rotation.clone(),
          // Scale is captured too: apply() used to call scale.setScalar(t),
          // which silently DESTROYED any non-uniform scale the JSX
          // declared — a floor pad authored as [5, 7.2, 1] ended up 1x1
          // once assembled.
          scale: obj.scale.clone(),
        });
      }
      pieces.set(key, { obj, cfg, ...homeOf(key) });
    },

    /** Drive every registered piece from one progress value. */
    apply(built) {
      for (const { obj, cfg, home, homeRot, homeScale } of pieces.values()) {
        const { start = 0, end = 1, from, rotFrom, spin = 0 } = cfg;
        const span = end - start || 1e-6;
        const t = clamp01((built - start) / span);

        // Not yet placed: parked at zero scale so it is genuinely absent
        // rather than a tiny visible speck sitting in mid-air.
        if (t <= 0) {
          obj.scale.set(0, 0, 0);
          obj.visible = false;
          continue;
        }
        obj.visible = true;

        const move = easeOutCubic(t);
        const seat = easeOutBack(t);

        if (from) {
          obj.position.set(
            home.x + from[0] * (1 - move),
            home.y + from[1] * (1 - move),
            home.z + from[2] * (1 - move)
          );
        }
        if (rotFrom) {
          obj.rotation.set(
            homeRot.x + rotFrom[0] * (1 - move),
            homeRot.y + rotFrom[1] * (1 - move) + spin * (1 - move),
            homeRot.z + rotFrom[2] * (1 - move)
          );
        } else if (spin) {
          obj.rotation.y = homeRot.y + spin * (1 - move);
        }

        // Scale is the piece "materialising", applied as a multiplier on
        // the authored scale so non-uniform pieces keep their shape.
        // Clamped to exactly 1x at the end so the overshoot never leaves
        // anything permanently oversized.
        const k = t >= 1 ? 1 : Math.max(0.001, seat);
        obj.scale.set(homeScale.x * k, homeScale.y * k, homeScale.z * k);
      }
    },

    clear() {
      pieces.clear();
      homes.clear();
    },

    get size() {
      return pieces.size;
    },
  };
}

/**
 * Evenly divides a station's build progress into N sequential windows with
 * a configurable overlap, so pieces flow into one another instead of
 * landing in discrete, visibly separated ticks.
 */
export function stagger(count, { from = 0, to = 1, overlap = 0.45 } = {}) {
  if (count <= 0) return [];
  const span = to - from;
  if (count === 1) return [{ start: from, end: to }];
  // Solve for a window width w such that the last window ends exactly at
  // `to`:  from + (count-1)·w·(1-overlap) + w = to
  const width = span / ((count - 1) * (1 - overlap) + 1);
  const step = width * (1 - overlap);
  return Array.from({ length: count }, (_, i) => {
    const start = from + i * step;
    return { start, end: Math.min(to, start + width) };
  });
}
