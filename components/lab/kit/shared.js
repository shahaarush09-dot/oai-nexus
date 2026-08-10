"use client";

import * as THREE from "three";

// Module-level singletons for geometry and materials reused across every
// station. Three furnished scenes with figures would otherwise allocate
// hundreds of near-identical BufferGeometries and materials — each one its
// own GPU upload and, for materials, its own shader program compile. One
// capsule shared by every limb of every figure costs a single upload.
//
// Created lazily on first access rather than at import time so nothing is
// constructed during SSR, and disposed by nobody on purpose: these live
// for the page's lifetime by design, which is precisely why they are
// shared.

function lazy(factory) {
  let value;
  return () => (value === undefined ? (value = factory()) : value);
}

// Total unscaled height of the shared capsule (2 caps of radius 0.5 plus a
// 4-unit shaft). Anything scaling that geometry must divide by this to get
// a limb of a known length — scaling Y by the length directly yields a
// limb of DOUBLE the intended size, which is exactly the bug that first
// shipped here and left the figures' legs through the floor.
//
// The shaft is 4 rather than 1 for a specific reason: the end caps scale
// with Y too, so a short shaft makes them badly elongated spheroids at
// limb proportions. With a shaft of 4, a limb of length L gets caps of
// vertical radius L/10 — and real limb proportions put the radius at
// roughly L/10 anyway, so the caps come out very nearly round for free.
export const CAPSULE_TOTAL = 5;

// --- geometry ---------------------------------------------------------
export const geo = {
  box: lazy(() => new THREE.BoxGeometry(1, 1, 1)),
  plane: lazy(() => new THREE.PlaneGeometry(1, 1)),
  // Shared limb capsule. Radius 0.5 with a 4-unit shaft, so the total
  // height is CAPSULE_TOTAL (5) — see the note there for why the shaft is
  // long rather than the more obvious 1.
  capsule: lazy(() => new THREE.CapsuleGeometry(0.5, 4, 4, 12)),
  sphere: lazy(() => new THREE.SphereGeometry(0.5, 16, 12)),
  cylinder: lazy(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 16)),
  cylinderLow: lazy(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 10)),
  cone: lazy(() => new THREE.ConeGeometry(0.5, 1, 16)),
  torus: lazy(() => new THREE.TorusGeometry(0.5, 0.12, 8, 24)),
};

// --- materials --------------------------------------------------------
// Surface classes, not per-object materials. Each is a real physical
// description — the difference between painted metal at roughness 0.45 and
// polished steel at 0.18 is most of what makes a room read as furnished
// with different things rather than modelled out of one substance.
//
// A note on glass: none of these use `transmission`. It forces an extra
// full-scene render pass every frame, which on the integrated GPU this is
// budgeted against costs roughly as much as the entire SSAO chain. High
// clearcoat with low roughness and a faint tint reads convincingly as
// glass at this scale for none of that cost.
function physical(props) {
  return lazy(() => new THREE.MeshPhysicalMaterial(props));
}
function standard(props) {
  return lazy(() => new THREE.MeshStandardMaterial(props));
}

export const mat = {
  // Painted equipment housings — slightly rough, faintly metallic.
  equipment: physical({
    color: "#eef1f5",
    roughness: 0.42,
    metalness: 0.18,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
  }),
  equipmentDark: physical({
    color: "#5a6472",
    roughness: 0.5,
    metalness: 0.35,
    clearcoat: 0.2,
  }),
  // Brushed stainless — chair frames, table legs, instrument arms.
  steel: physical({
    color: "#c2c9d2",
    roughness: 0.28,
    metalness: 0.85,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
  }),
  steelDark: physical({
    color: "#8b939f",
    roughness: 0.34,
    metalness: 0.8,
  }),
  // Upholstery / exam-table padding. High roughness, zero metalness —
  // the total absence of specular is what makes fabric read as fabric.
  padding: standard({
    color: "#9fc3d4",
    roughness: 0.92,
    metalness: 0,
  }),
  // Clothing for figures. These values are deliberately a step or two
  // DARKER than the obvious choice — a literally-white lab coat against a
  // literally-white wall in a bright room is invisible, which is exactly
  // what happened on the first pass: the doctor rendered correctly and
  // could not be seen at all. Figures have to hold their own value against
  // the room or the staging fails no matter how good the pose is.
  coat: standard({ color: "#dce4ee", roughness: 0.85, metalness: 0 }),
  scrubs: standard({ color: "#4e8ba3", roughness: 0.88, metalness: 0 }),
  gownLight: standard({ color: "#b9c9d6", roughness: 0.9, metalness: 0 }),
  suit: standard({ color: "#3b4250", roughness: 0.82, metalness: 0 }),
  suitAlt: standard({ color: "#59616f", roughness: 0.82, metalness: 0 }),
  // Skin: deliberately a neutral desaturated tone rather than an attempt
  // at a real complexion. These are entourage figures — a literal skin
  // colour on an abstract form is what tips them into uncanny.
  skin: standard({ color: "#c9b6a8", roughness: 0.75, metalness: 0 }),
  skinAlt: standard({ color: "#a8907f", roughness: 0.75, metalness: 0 }),
  // Glass — see note above: clearcoat, not transmission.
  glass: physical({
    color: "#dcebf2",
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.34,
  }),
  // Screen bodies. Near-black so an emissive readout laid over them has
  // somewhere dark to read against in an otherwise very bright room.
  screen: lazy(
    () => new THREE.MeshBasicMaterial({ color: "#0e1a26", toneMapped: false })
  ),
  // Wood — the boardroom's one warm material, and the main thing that
  // separates it tonally from the two clinical spaces.
  wood: physical({
    color: "#6b5744",
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
  }),
  paper: standard({ color: "#fafbfd", roughness: 0.95, metalness: 0 }),
  // Brushed-aluminium plaque face — light enough for dark engraved text to
  // read against, with enough specular to catch the room light so it looks
  // mounted rather than printed on.
  plaque: physical({
    color: "#c8d0da",
    roughness: 0.3,
    metalness: 0.65,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  }),
};

/** Emissive accent material, cached per colour. */
const emissiveCache = new Map();
export function emissive(color, intensity = 1.4) {
  const key = `${color}|${intensity}`;
  let m = emissiveCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      toneMapped: false,
    });
    emissiveCache.set(key, m);
  }
  return m;
}
