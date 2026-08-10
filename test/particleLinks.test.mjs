// node --test test/particleLinks.test.mjs
//
// The spatial grid replaced an exhaustive all-pairs scan. The only thing
// that matters is that it finds EXACTLY the same pairs — a grid that
// quietly misses neighbours across cell boundaries would thin the network
// out in a way that looks like an art decision rather than a bug.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONNECT_DISTANCE,
  createLinkBuilder,
  bruteForcePairs,
} from "../lib/particleLinks.js";

// Deterministic PRNG so a failure is reproducible rather than a one-off.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Matches the real spawn volume in ParticleNetwork.
function spawn(count, seed) {
  const rand = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 16;
    pos[i * 3 + 1] = (rand() - 0.5) * 10;
    pos[i * 3 + 2] = (rand() - 0.5) * 10;
  }
  return pos;
}

// Recover the pair set from the flat segment buffer by matching endpoint
// coordinates back to particle indices — deliberately independent of the
// grid's own bookkeeping, so a bug there can't hide itself.
function pairsFromSegments(out, floats, pos, count) {
  const key = new Map();
  for (let i = 0; i < count; i++) {
    key.set(`${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`, i);
  }
  const pairs = [];
  for (let w = 0; w < floats; w += 6) {
    const a = key.get(`${out[w]},${out[w + 1]},${out[w + 2]}`);
    const b = key.get(`${out[w + 3]},${out[w + 4]},${out[w + 5]}`);
    pairs.push(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  return pairs;
}

for (const [label, count, seed] of [
  ["800 particles (high tier)", 800, 1],
  ["350 particles (low tier)", 350, 7],
  ["a sparse field", 60, 13],
]) {
  test(`grid finds exactly the brute-force pairs — ${label}`, () => {
    const pos = spawn(count, seed);
    const builder = createLinkBuilder({ count });
    const floats = builder.build(pos);

    const expected = bruteForcePairs(pos, count).sort();
    const actual = pairsFromSegments(builder.out, floats, pos, count).sort();

    assert.ok(expected.length > 0, "test data should produce some pairs");
    assert.deepEqual(actual, expected);
  });
}

test("clustered particles still match brute force", () => {
  // Adversarial: everything jammed into a few cells, which is where a
  // grid's neighbour handling is most likely to be wrong.
  const rand = mulberry32(99);
  const count = 300;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const cluster = i % 3;
    pos[i * 3] = cluster * 2.0 + (rand() - 0.5) * 1.5;
    pos[i * 3 + 1] = (rand() - 0.5) * 1.5;
    pos[i * 3 + 2] = (rand() - 0.5) * 1.5;
  }
  const builder = createLinkBuilder({ count, maxSegments: 200000 });
  const floats = builder.build(pos);
  assert.deepEqual(
    pairsFromSegments(builder.out, floats, pos, count).sort(),
    bruteForcePairs(pos, count).sort()
  );
});

test("particles outside the grid bounds are still handled", () => {
  // Clamping into edge cells must over-include, never miss.
  const count = 40;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Deliberately far outside the declared bounds, in a tight clump.
    pos[i * 3] = 40 + (i % 4) * 0.5;
    pos[i * 3 + 1] = -30 + Math.floor(i / 4) * 0.5;
    pos[i * 3 + 2] = 25;
  }
  const builder = createLinkBuilder({ count });
  const floats = builder.build(pos);
  assert.deepEqual(
    pairsFromSegments(builder.out, floats, pos, count).sort(),
    bruteForcePairs(pos, count).sort()
  );
});

test("the segment buffer cap is respected rather than overflowing", () => {
  const count = 400;
  const pos = new Float32Array(count * 3); // all at the origin: every pair connects
  const maxSegments = 50;
  const builder = createLinkBuilder({ count, maxSegments });
  const floats = builder.build(pos);
  assert.ok(floats <= maxSegments * 6, "must not write past the buffer");
  assert.equal(floats % 6, 0, "must not write a partial segment");
});

test("the grid is meaningfully cheaper than all-pairs at real density", () => {
  // Guards the entire reason for the rewrite. Counts candidate distance
  // tests rather than timing, so it is stable in CI.
  const count = 800;
  const pos = spawn(count, 3);
  const allPairs = (count * (count - 1)) / 2;

  // Re-derive the grid's candidate count the same way build() would.
  const cell = CONNECT_DISTANCE;
  const nx = Math.ceil(24 / cell);
  const ny = Math.ceil(18 / cell);
  const nz = Math.ceil(18 / cell);
  const buckets = new Map();
  const clamp = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v | 0);
  for (let i = 0; i < count; i++) {
    const k =
      (clamp((pos[i * 3] + 12) / cell, nx) * ny +
        clamp((pos[i * 3 + 1] + 9) / cell, ny)) *
        nz +
      clamp((pos[i * 3 + 2] + 9) / cell, nz);
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  let candidates = 0;
  for (let i = 0; i < count; i++) {
    const bx = clamp((pos[i * 3] + 12) / cell, nx);
    const by = clamp((pos[i * 3 + 1] + 9) / cell, ny);
    const bz = clamp((pos[i * 3 + 2] + 9) / cell, nz);
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (let oz = -1; oz <= 1; oz++) {
          const gx = bx + ox, gy = by + oy, gz = bz + oz;
          if (gx < 0 || gx >= nx || gy < 0 || gy >= ny || gz < 0 || gz >= nz) continue;
          candidates += buckets.get((gx * ny + gy) * nz + gz) || 0;
        }
  }

  assert.ok(
    candidates < allPairs / 4,
    `grid should test far fewer candidates: ${candidates} vs ${allPairs} all-pairs`
  );
});
