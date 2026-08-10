// node --test test/assembly.test.mjs
//
// The assembly harness animates pieces relative to a "home" transform read
// off the object once. The subtle failure mode is re-registration: React
// hands a changed ref callback null and then the node again on EVERY
// re-render, and `reg()` produces a fresh callback each time. If the home
// transform is recaptured on reattach it gets read back mid-animation, so
// each render folds the current animation factor into the baseline —
// scale compounds multiplicatively and the furniture silently shrinks to
// nothing. That shipped once and rendered an empty room with no error.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAssembly, stagger } from "../components/lab/kit/assembly.js";

// Minimal Object3D stand-in — only what the harness touches.
class V3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() {
    return new V3(this.x, this.y, this.z);
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}
const node = ({ pos = [0, 0, 0], scale = [1, 1, 1] } = {}) => ({
  position: new V3(...pos),
  rotation: new V3(),
  scale: new V3(...scale),
  visible: true,
});

test("REGRESSION: re-registration does not shrink a piece", () => {
  const asm = createAssembly();
  const obj = node({ pos: [1, 2, 3], scale: [5, 7.2, 1] });
  const cfg = { start: 0, end: 1, from: [0, 4, 0] };

  asm.set("pad", obj, cfg);
  asm.apply(1);
  assert.deepEqual([obj.scale.x, obj.scale.y, obj.scale.z], [5, 7.2, 1]);

  // Simulate ten React re-renders: detach (null) then reattach the SAME
  // node, with apply() running in between as it would each frame.
  for (let i = 0; i < 10; i++) {
    asm.set("pad", null, cfg);
    asm.set("pad", obj, cfg);
    asm.apply(0.5);
    asm.apply(1);
  }

  assert.deepEqual(
    [obj.scale.x, obj.scale.y, obj.scale.z],
    [5, 7.2, 1],
    "authored scale must survive any number of re-registrations"
  );
  assert.deepEqual([obj.position.x, obj.position.y, obj.position.z], [1, 2, 3]);
});

test("non-uniform authored scale is preserved through assembly", () => {
  const asm = createAssembly();
  const obj = node({ scale: [5, 7.2, 1] });
  asm.set("pad", obj, { start: 0, end: 1 });

  asm.apply(0.5);
  // Mid-build the piece is scaled DOWN proportionally, never made uniform.
  const ratio = obj.scale.x / obj.scale.y;
  assert.ok(Math.abs(ratio - 5 / 7.2) < 1e-6, "aspect must be preserved mid-build");

  asm.apply(1);
  assert.deepEqual([obj.scale.x, obj.scale.y, obj.scale.z], [5, 7.2, 1]);
});

test("a piece is absent before its window and exact at the end", () => {
  const asm = createAssembly();
  const obj = node({ pos: [0, 1, 0], scale: [2, 2, 2] });
  asm.set("p", obj, { start: 0.4, end: 0.8, from: [0, 3, 0] });

  asm.apply(0.2);
  assert.equal(obj.visible, false);
  assert.equal(obj.scale.x, 0);

  asm.apply(0.8);
  assert.equal(obj.visible, true);
  assert.deepEqual([obj.scale.x, obj.scale.y, obj.scale.z], [2, 2, 2]);
  assert.deepEqual(
    [obj.position.x, obj.position.y, obj.position.z],
    [0, 1, 0],
    "must land exactly on the authored position"
  );
});

test("assembly is fully reversible — scrubbing back and forth is stable", () => {
  const asm = createAssembly();
  const obj = node({ pos: [2, 0, 0], scale: [1, 3, 1] });
  asm.set("p", obj, { start: 0, end: 1, from: [0, 5, 0] });

  for (const p of [0, 0.3, 0.9, 0.1, 1, 0.5, 1]) asm.apply(p);
  asm.apply(1);
  assert.deepEqual([obj.scale.x, obj.scale.y, obj.scale.z], [1, 3, 1]);
  assert.deepEqual([obj.position.x, obj.position.y, obj.position.z], [2, 0, 0]);
});

test("stagger windows tile the range and end exactly at `to`", () => {
  const w = stagger(12, { from: 0.04, to: 0.94, overlap: 0.5 });
  assert.equal(w.length, 12);
  assert.ok(Math.abs(w[0].start - 0.04) < 1e-9);
  assert.ok(Math.abs(w[11].end - 0.94) < 1e-9, "last piece must finish at `to`");
  for (let i = 1; i < w.length; i++) {
    assert.ok(w[i].start > w[i - 1].start, "windows must advance");
    assert.ok(w[i].start < w[i - 1].end, "windows must overlap, not gap");
  }
});
