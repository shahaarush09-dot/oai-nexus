// Neighbour-pair search for the particle network's connecting lines.
//
// Extracted from the render loop for the same reason the station machine
// was: this is a real algorithm with a correctness property that is
// tedious to eyeball (does the grid find exactly the pairs brute force
// would?) and trivial to assert. See test/particleLinks.test.mjs, which
// checks equivalence against the naive all-pairs version it replaced.
//
// Why a grid at all: the previous implementation was an exhaustive
// all-pairs scan. At 800 particles that is 319,600 distance tests landing
// in a single frame every sixth frame, plus a freshly allocated
// Float32Array and BufferAttribute each time. It ran for the entire time a
// visitor was on the homepage, not just during the lab, which made it the
// largest ongoing cost on the site — and a textbook case of something that
// looks fine on a development machine and is quietly punishing elsewhere.
//
// Connections only exist within CONNECT_DISTANCE, so bucketing into cells
// of exactly that size means each particle need only test its own cell and
// the 26 surrounding it. The bucket build is a counting sort into
// preallocated typed arrays, so a full pass allocates nothing.

export const CONNECT_DISTANCE = 2.2;

// Bounds cover the spawn volume (x +/-8, y +/-5, z +/-5) plus drift, with
// margin. Anything outside is clamped into the edge cells — safe, because
// clamping can only over-include candidates, never miss a true neighbour.
const GRID_MIN = [-12, -9, -9];
const GRID_SPAN = [24, 18, 18];

export function createLinkBuilder({ count, cellSize = CONNECT_DISTANCE, maxSegments = 16000 }) {
  const inv = 1 / cellSize;
  const nx = Math.ceil(GRID_SPAN[0] / cellSize);
  const ny = Math.ceil(GRID_SPAN[1] / cellSize);
  const nz = Math.ceil(GRID_SPAN[2] / cellSize);
  const cells = nx * ny * nz;

  const cellStart = new Int32Array(cells + 1);
  const cellCursor = new Int32Array(cells);
  const cellItems = new Int32Array(count);
  const out = new Float32Array(maxSegments * 6);
  const maxDistSq = cellSize * cellSize;

  const clamp = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v | 0);
  const cx = (pos, ix) => clamp((pos[ix] - GRID_MIN[0]) * inv, nx);
  const cy = (pos, ix) => clamp((pos[ix + 1] - GRID_MIN[1]) * inv, ny);
  const cz = (pos, ix) => clamp((pos[ix + 2] - GRID_MIN[2]) * inv, nz);

  /**
   * @param pos flat xyz positions, length count*3
   * @returns number of floats written to `out` (segments * 6)
   */
  function build(pos) {
    cellCursor.fill(0);
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      cellCursor[(cx(pos, ix) * ny + cy(pos, ix)) * nz + cz(pos, ix)]++;
    }
    let running = 0;
    for (let c = 0; c < cells; c++) {
      cellStart[c] = running;
      running += cellCursor[c];
      cellCursor[c] = cellStart[c]; // reuse as a write cursor
    }
    cellStart[cells] = running;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const cell = (cx(pos, ix) * ny + cy(pos, ix)) * nz + cz(pos, ix);
      cellItems[cellCursor[cell]++] = i;
    }

    let w = 0;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const bx = cx(pos, ix);
      const by = cy(pos, ix);
      const bz = cz(pos, ix);

      for (let ox = -1; ox <= 1; ox++) {
        const gx = bx + ox;
        if (gx < 0 || gx >= nx) continue;
        for (let oy = -1; oy <= 1; oy++) {
          const gy = by + oy;
          if (gy < 0 || gy >= ny) continue;
          for (let oz = -1; oz <= 1; oz++) {
            const gz = bz + oz;
            if (gz < 0 || gz >= nz) continue;
            const cell = (gx * ny + gy) * nz + gz;
            const to = cellStart[cell + 1];
            for (let k = cellStart[cell]; k < to; k++) {
              const j = cellItems[k];
              // j > i only: every pair is considered exactly once, which
              // also removes any need to dedupe across neighbour cells.
              if (j <= i) continue;
              const jx = j * 3;
              const dx = pos[ix] - pos[jx];
              const dy = pos[ix + 1] - pos[jx + 1];
              const dz = pos[ix + 2] - pos[jx + 2];
              if (dx * dx + dy * dy + dz * dz >= maxDistSq) continue;
              if (w + 6 > out.length) return w; // buffer full
              out[w++] = pos[ix];
              out[w++] = pos[ix + 1];
              out[w++] = pos[ix + 2];
              out[w++] = pos[jx];
              out[w++] = pos[jx + 1];
              out[w++] = pos[jx + 2];
            }
          }
        }
      }
    }
    return w;
  }

  return { build, out };
}

/** The naive all-pairs version this replaced. Kept for the equivalence test. */
export function bruteForcePairs(pos, count, cellSize = CONNECT_DISTANCE) {
  const maxDistSq = cellSize * cellSize;
  const pairs = [];
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    for (let j = i + 1; j < count; j++) {
      const jx = j * 3;
      const dx = pos[ix] - pos[jx];
      const dy = pos[ix + 1] - pos[jx + 1];
      const dz = pos[ix + 2] - pos[jx + 2];
      if (dx * dx + dy * dy + dz * dz < maxDistSq) pairs.push(`${i}-${j}`);
    }
  }
  return pairs;
}
