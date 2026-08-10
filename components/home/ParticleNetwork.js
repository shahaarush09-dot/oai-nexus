"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  SMAA,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { MODULE_SHAPES } from "@/lib/particleShapes";
import { useLabActive } from "./ParticleNetworkContext";
import LabScene from "@/components/lab/LabScene";

const CONNECT_DISTANCE = 2.2;
const CONNECT_THROTTLE_FRAMES = 6;
const SHAPE_PARTICLE_COUNT = 60;

// --- spatial grid for the connection pass -----------------------------
// Cell size is exactly CONNECT_DISTANCE, so any pair close enough to be
// connected must fall in the same cell or an adjacent one. Bounds cover
// the particle spawn volume (x +/-8, y +/-5, z +/-5) plus drift amplitude,
// with a generous margin; anything outside is clamped into the edge cells,
// which stays correct because clamping can only ever over-include.
const GRID_CELL = CONNECT_DISTANCE;
const GRID_INV = 1 / GRID_CELL;
const GRID_MIN_X = -12;
const GRID_MIN_Y = -9;
const GRID_MIN_Z = -9;
const GRID_NX = Math.ceil(24 / GRID_CELL);
const GRID_NY = Math.ceil(18 / GRID_CELL);
const GRID_NZ = Math.ceil(18 / GRID_CELL);
const GRID_CELLS = GRID_NX * GRID_NY * GRID_NZ;
// Hard ceiling on drawn segments, bounding the preallocated buffer.
//
// Sized from measurement, not guessed: the resting field at count=800
// produces ~7,200 connections, so the first value tried here (6,000)
// silently discarded roughly a sixth of the network — a visible thinning
// that would have read as a style choice rather than a bug. The headroom
// above that covers the Station-4 burst, where particles start clustered
// at the origin and the pair count spikes far higher; truncation there is
// invisible because the frame is saturated with lines anyway.
const MAX_SEGMENTS = 16000;

const clampCell = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v | 0);

// Single source of truth for every scene-level property that differs
// between "resting Hero background" (small scale, camera ~12 units out)
// and "lab mode" (much larger scale, camera starts ~40 units out). Any
// new lab-specific tuning (bloom, chromatic aberration, exposure, fog,
// FOV, ...) belongs here as a same-shaped pair rather than as a one-off
// inline ternary at its use site — this is the pattern the fog fix
// established and is meant to generalize to.
const SCENE_SETTINGS = {
  resting: {
    fog: ["#05070d", 8, 22],
    background: "#05070d",
    fov: 50,
    bloomIntensity: 0.6,
    bloomThreshold: 0.25,
    bloomSmoothing: 0.9,
    chromaticOffset: 0.0006,
  },
  lab: {
    // Bright lab: atmospheric haze rather than darkness closing in.
    //
    // The fog COLOUR is doing the "far end blows out to pure white" work,
    // not the exposure — at a near-white #eef1f6 the far end of a 108-unit
    // hall sits at ~57% fog blend, which is most of the way to paper white
    // with no detail left in it. A mid-light cool grey instead means
    // distance recedes into soft grey the way real aerial perspective
    // does, while everything within 30 units of the camera — which is all
    // the user ever actually looks at — stays exactly as bright as before.
    // Near is pulled in slightly so the falloff has more room to be a
    // gradient rather than a switch.
    // Deep slate-blue: the hall is now a dark environment with lit rooms
    // opening off it, so fog recedes into depth rather than into paper.
    fog: ["#0e141f", 22, 108],
    background: "#0e141f",
    // Eye-level FOV for a room you're standing in. The old 36 was tuned
    // for a telephoto dolly down a corridor and makes an actual room feel
    // cramped and flat.
    fov: 50,
    // Retuned again for the dark hall. At the white-room threshold of 0.88
    // essentially nothing qualified; now that the environment sits well
    // below mid-grey, the emissive light lines, ceiling fixtures, screens
    // and accent trim are the only things above the line — which is
    // exactly what should glow.
    bloomIntensity: 0.62,
    bloomThreshold: 0.52,
    bloomSmoothing: 0.65,
    chromaticOffset: 0.0002,
  },
};

// The single, shared particle system — used both as the intro's choreographed
// centerpiece and as the hero's resting background. Exposes a plain mutable
// `control` object via ref (not React state) so a GSAP timeline can tween
// its properties directly with onUpdate-free `.to()` calls; useFrame reads
// the same object every frame. This is the layer that makes "the intro's
// particle field IS the hero's particle field" literally true — one Canvas,
// one BufferGeometry, never remounted between the two.
//
// Default control state is the fully-resolved resting state (network
// formed, drifting normally) — if the intro is skipped or never wires up
// for any reason, the hero still renders correctly rather than stuck empty.
//
// `externalRef` is populated via a plain effect rather than forwardRef +
// useImperativeHandle: this component is loaded through next/dynamic, whose
// loadable wrapper does not forward refs, so passing `ref` through it warns
// ("Function components cannot be given refs") and IntroSequence would never
// actually see the control object. A normal prop sidesteps that entirely.
function ParticleNetwork({ count, postprocessing, externalRef }) {
  const { labActive } = useLabActive();
  const scene = labActive ? SCENE_SETTINGS.lab : SCENE_SETTINGS.resting;
  const controlRef = useRef({
    burstProgress: 1,
    coalesceShape: null,
    coalesceProgress: 0,
    restingDrift: true,
    pulseFlash: 0,
    cameraZ: 12,
    // Lab-phase camera: while `labActive` (below) is true, useFrame applies
    // these directly (position + explicit lookAt) every frame instead of
    // the resting lerped-cameraZ-only behavior — GSAP's own tween easing is
    // the sole source of smoothing here, so nothing else should also lerp
    // these values or the two would fight and produce mush.
    labActive: false,
    cam: { x: 0, y: 0, z: 40, lookAtX: 0, lookAtY: 0, lookAtZ: 0 },
  });

  useEffect(() => {
    if (!externalRef) return;
    externalRef.current = { control: controlRef.current };
    return () => {
      externalRef.current = null;
    };
  }, [externalRef]);

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        // dpr is the single largest fill-rate lever, and the lab is
        // fill-bound. At [1, 1.5] a high-DPI display renders the lab at up
        // to ~2.25x the pixels of a 1x screen — the same code that holds
        // 60fps on a modest GPU at 1080p can miss it badly on a 4K panel
        // purely from pixel count, which is exactly the kind of gap that
        // makes one machine's measurements say nothing about another's.
        // The lab pins to 1 and lets SMAA handle edges; the resting field
        // is cheap enough to keep the sharper buffer.
        dpr={labActive ? 1 : [1, 1.5]}
        // AA matters far more than it did for the old scene. The resting
        // field is round points and thin lines, which hide aliasing; the
        // lab is a room full of long straight edges against near-white
        // surfaces, where stair-stepping crawls visibly as the camera
        // moves and reads as "cheap" no matter how good the lighting is.
        // antialias is FALSE deliberately. Every tier that mounts this
        // component now runs the EffectComposer, and the composer renders
        // the scene into its own targets — the canvas framebuffer only
        // ever receives a final fullscreen blit with no geometric edges to
        // resolve. Asking for MSAA here therefore allocates a multisampled
        // backbuffer that antialiases nothing, costing VRAM and a resolve
        // every frame; on a high-DPI panel that is a meaningful amount of
        // both. SMAA inside the chain is what actually antialiases the lab.
        gl={{ antialias: false, alpha: true }}
        // Explicit rather than bare `shadows`: R3F's default is
        // PCFSoftShadowMap, which three r185 has deprecated and silently
        // downgrades to PCFShadowMap anyway (with a console warning on
        // every context). Asking for PCF directly and getting the softness
        // back via the light's shadow-radius is the same result without
        // relying on a deprecation fallback.
        shadows={{ type: THREE.PCFShadowMap }}
      >
        <color attach="background" args={[scene.background]} />
        {/* See SCENE_SETTINGS above — every property on this branch is
            deliberately re-tuned for the lab's bright, room-scale look
            rather than assumed to carry over from the resting one. */}
        <fog attach="fog" args={scene.fog} />
        {labActive && <LabScene controlRef={controlRef} />}
        <ParticleFieldInner
          key={count}
          count={count}
          controlRef={controlRef}
          targetFov={scene.fov}
        />
        {postprocessing && (
          // AA note: the composer renders to its own target, so the
          // canvas-level `antialias` flag never reaches it — SMAA inside
          // the chain is what actually antialiases the lab.
          //
          // SSAO was here and has been REMOVED. It is a stochastic effect:
          // at the sample counts affordable in real time it resolves as
          // visible grain over flat surfaces, which in a bright room full
          // of large flat surfaces is the worst possible case. It also
          // required a normal pass — an entire extra scene render. Real
          // shadows plus the enclosed room geometry now carry the contact
          // and depth cues AO was there for, at none of the cost and with
          // none of the noise.
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom
              intensity={scene.bloomIntensity}
              luminanceThreshold={scene.bloomThreshold}
              luminanceSmoothing={scene.bloomSmoothing}
              mipmapBlur
            />
            {/* Chromatic aberration is a full extra screen pass for an
                effect that is invisible at the lab's near-zero offset
                against light surfaces — it only ever earned its cost on
                the dark resting field. */}
            {!labActive && (
              <ChromaticAberration
                offset={[scene.chromaticOffset, scene.chromaticOffset]}
              />
            )}
            {labActive && <SMAA />}
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}

export default ParticleNetwork;

function ParticleFieldInner({ count, controlRef, targetFov }) {
  const pointsRef = useRef();
  const linesRef = useRef();
  const groupRef = useRef();
  const { mouse, camera } = useThree();

  // FOV is a discrete mode property (lab vs. resting), not something GSAP
  // scrubs per frame, so it's set once on transition rather than every
  // frame — updateProjectionMatrix() is not free and the value doesn't
  // change within a phase.
  useEffect(() => {
    if (camera.fov === targetFov) return;
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }, [camera, targetFov]);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count * 3);
    const freqs = new Float32Array(count * 3);
    const amps = new Float32Array(count);

    const goldColor = new THREE.Color("#c8a24a");
    const tealColor = new THREE.Color("#2a9d8f");
    const baseColor = new THREE.Color("#8892a8");

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const x = (Math.random() - 0.5) * 16;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 10;
      basePositions[ix] = x;
      basePositions[ix + 1] = y;
      basePositions[ix + 2] = z;
      positions[ix] = x;
      positions[ix + 1] = y;
      positions[ix + 2] = z;

      phases[ix] = Math.random() * Math.PI * 2;
      phases[ix + 1] = Math.random() * Math.PI * 2;
      phases[ix + 2] = Math.random() * Math.PI * 2;
      freqs[ix] = 0.05 + Math.random() * 0.08;
      freqs[ix + 1] = 0.04 + Math.random() * 0.07;
      freqs[ix + 2] = 0.05 + Math.random() * 0.06;
      amps[i] = 0.15 + Math.random() * 0.35;

      const roll = Math.random();
      const c = roll < 0.6 ? baseColor : roll < 0.85 ? goldColor : tealColor;
      colors[ix] = c.r;
      colors[ix + 1] = c.g;
      colors[ix + 2] = c.b;
    }

    return { positions, basePositions, colors, phases, freqs, amps };
  }, [count]);

  // Precomputed shape target coordinates for the module-coalesce beats —
  // only the first SHAPE_PARTICLE_COUNT particles ever participate, reused
  // across all three modules (one shape active at a time).
  const shapeTargets = useMemo(() => {
    const n = Math.min(SHAPE_PARTICLE_COUNT, count);
    const out = {};
    for (const [key, { generator }] of Object.entries(MODULE_SHAPES)) {
      out[key] = generator(n);
    }
    return out;
  }, [count]);

  // Grid scratch + the reusable line buffer. Sized once from `count` and
  // never reallocated, so the connection pass allocates nothing per frame.
  const grid = useMemo(
    () => ({
      cellStart: new Int32Array(GRID_CELLS + 1),
      cellCount: new Int32Array(GRID_CELLS),
      cellItems: new Int32Array(count),
    }),
    [count]
  );
  const lineBuffer = useMemo(() => new Float32Array(MAX_SEGMENTS * 6), []);
  const cellIndexOf = useMemo(
    () => (pos, ix) => {
      const cx = clampCell((pos[ix] - GRID_MIN_X) * GRID_INV, GRID_NX);
      const cy = clampCell((pos[ix + 1] - GRID_MIN_Y) * GRID_INV, GRID_NY);
      const cz = clampCell((pos[ix + 2] - GRID_MIN_Z) * GRID_INV, GRID_NZ);
      return (cx * GRID_NY + cy) * GRID_NZ + cz;
    },
    []
  );

  const connectFrame = useRef(0);
  const clock = useRef(0);
  const ambientPulse = useRef({ index: -1, start: 0 });
  const nextAmbientPulseAt = useRef(3 + Math.random() * 3);

  useFrame((_, delta) => {
    const ctrl = controlRef.current;
    clock.current += delta;
    const t = clock.current;

    // --- camera ---------------------------------------------------------
    // Driven before the early-out below, since the lab needs the camera
    // updated every frame even when the particle field is skipped entirely.
    if (ctrl.labActive) {
      // GSAP drives ctrl.cam directly — its own tween easing is the sole
      // smoothing here, applied as-is every frame, not lerped again on top.
      // The idle offset rides on top as a pure additive term: LabGate holds
      // idleAmp at 0 for the duration of a station transition and only
      // raises it once the tween lands, so the two never compete for the
      // same value mid-move.
      const amp = ctrl.idleAmp || 0;
      camera.position.set(
        ctrl.cam.x + Math.sin(t * 0.31) * amp,
        ctrl.cam.y + Math.sin(t * 0.47) * amp * 0.55,
        ctrl.cam.z + Math.cos(t * 0.23) * amp * 0.7
      );
      camera.lookAt(ctrl.cam.lookAtX, ctrl.cam.lookAtY, ctrl.cam.lookAtZ);
    } else {
      camera.position.z += (ctrl.cameraZ - camera.position.z) * 0.05;
      camera.lookAt(0, 0, 0);
    }

    // --- lab early-out --------------------------------------------------
    // While the lab owns the frame the particle field is invisible: with
    // burstProgress at 0 every point collapses to the origin, which against
    // the old dark scene was unnoticeable and against a white room is a
    // smudge of dark specks in the middle of the hall.
    //
    // Hiding it is not enough. This simulation is by far the most expensive
    // thing in the frame — a full position rewrite plus, every
    // CONNECT_THROTTLE_FRAMES, an O(n^2) neighbour search (at count=800
    // that is ~320,000 distance tests) which then allocates a fresh
    // Float32Array and BufferAttribute. Left running behind the lab that
    // fires a large main-thread burst plus GC churn roughly ten times a
    // second, on top of whatever the lab itself is doing. It is the single
    // biggest cause of the camera transitions reading as stuttery, and
    // none of its output is visible until the Station 4 handoff raises
    // burstProgress. So it is skipped outright until then.
    const labHidden = ctrl.labActive && ctrl.burstProgress <= 0.01;
    if (groupRef.current) groupRef.current.visible = !labHidden;
    if (labHidden) return;

    const pos = pointsRef.current.geometry.attributes.position.array;
    const shapePts = ctrl.coalesceShape ? shapeTargets[ctrl.coalesceShape] : null;
    const shapeN = shapePts ? shapePts.length : 0;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;

      let targetX = particles.basePositions[ix];
      let targetY = particles.basePositions[ix + 1];
      let targetZ = particles.basePositions[ix + 2];

      if (ctrl.restingDrift) {
        targetX += Math.sin(t * particles.freqs[ix] * 10 + particles.phases[ix]) * particles.amps[i];
        targetY += Math.cos(t * particles.freqs[ix + 1] * 10 + particles.phases[ix + 1]) * particles.amps[i];
        targetZ += Math.sin(t * particles.freqs[ix + 2] * 10 + particles.phases[ix + 2]) * particles.amps[i] * 0.6;
      }

      // Burst-in: blend from the center point out to the network position.
      let x = targetX * ctrl.burstProgress;
      let y = targetY * ctrl.burstProgress;
      let z = targetZ * ctrl.burstProgress;

      // Module coalesce: a subset of particles additionally blends toward
      // the active shape's target position, on top of their network spot.
      if (shapePts && i < shapeN) {
        const [sx, sy, sz] = shapePts[i];
        x += (sx - x) * ctrl.coalesceProgress;
        y += (sy - y) * ctrl.coalesceProgress;
        z += (sz - z) * ctrl.coalesceProgress;
      }

      pos[ix] = x;
      pos[ix + 1] = y;
      pos[ix + 2] = z;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    // Color: base per-particle color, boosted toward white by the global
    // pulseFlash (Beat 4's "systems nominal" flash) and, independently, by
    // the rare ambient single-particle firing pulse used at rest.
    const colorAttr = pointsRef.current.geometry.attributes.color;
    if (ctrl.pulseFlash > 0.001) {
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        colorAttr.array[ix] = particles.colors[ix] + (1 - particles.colors[ix]) * ctrl.pulseFlash;
        colorAttr.array[ix + 1] = particles.colors[ix + 1] + (1 - particles.colors[ix + 1]) * ctrl.pulseFlash;
        colorAttr.array[ix + 2] = particles.colors[ix + 2] + (1 - particles.colors[ix + 2]) * ctrl.pulseFlash;
      }
      colorAttr.needsUpdate = true;
    } else if (ctrl.restingDrift) {
      if (t > nextAmbientPulseAt.current && ambientPulse.current.index === -1) {
        ambientPulse.current = { index: Math.floor(Math.random() * count), start: t };
      }
      if (ambientPulse.current.index !== -1) {
        const elapsed = t - ambientPulse.current.start;
        const duration = 0.7;
        const idx = ambientPulse.current.index * 3;
        if (elapsed > duration) {
          colorAttr.array[idx] = particles.colors[idx];
          colorAttr.array[idx + 1] = particles.colors[idx + 1];
          colorAttr.array[idx + 2] = particles.colors[idx + 2];
          ambientPulse.current.index = -1;
          nextAmbientPulseAt.current = t + 3 + Math.random() * 4;
        } else {
          const k = Math.sin((elapsed / duration) * Math.PI);
          colorAttr.array[idx] = particles.colors[idx] + (1 - particles.colors[idx]) * k;
          colorAttr.array[idx + 1] = particles.colors[idx + 1] + (1 - particles.colors[idx + 1]) * k;
          colorAttr.array[idx + 2] = particles.colors[idx + 2] + (1 - particles.colors[idx + 2]) * k;
        }
        colorAttr.needsUpdate = true;
      }
    }

    // Cursor parallax — only once settled (would fight the intro's own
    // camera choreography otherwise).
    if (groupRef.current && ctrl.restingDrift) {
      groupRef.current.rotation.y += (mouse.x * 0.15 - groupRef.current.rotation.y) * 0.02;
      groupRef.current.rotation.x += (-mouse.y * 0.1 - groupRef.current.rotation.x) * 0.02;
    }

    // Connection recompute, throttled to ~10Hz regardless of phase —
    // during burst-in/coalesce this also produces the "connections forming
    // as particles spread out" look for free, no separate bespoke code.
    //
    // This used to be an exhaustive all-pairs scan: at count=800 that is
    // 319,600 distance tests, landing in ONE frame every sixth frame, plus
    // a freshly allocated Float32Array and BufferAttribute each time. And
    // unlike the lab, this runs for the entire time a visitor is on the
    // homepage — it is the single largest ongoing cost on the site and the
    // clearest example of something that looks fine on a fast machine and
    // is quietly punishing on a slow one.
    //
    // Replaced with a uniform spatial grid. Connections only exist within
    // CONNECT_DISTANCE, so bucketing by a cell of exactly that size means
    // each particle need only test its own cell and the 26 around it.
    // Cheaper by roughly an order of magnitude at this density, and with
    // the counting-sort build plus the preallocated line buffer below, the
    // whole pass now allocates nothing at all per frame.
    connectFrame.current++;
    if (connectFrame.current % CONNECT_THROTTLE_FRAMES === 0 && linesRef.current) {
      const maxDistSq = CONNECT_DISTANCE * CONNECT_DISTANCE;
      const { cellStart, cellItems, cellCount } = grid;
      const linePositions = lineBuffer;
      let w = 0;

      // --- bucket particles into cells (counting sort, allocation-free)
      cellCount.fill(0);
      for (let i = 0; i < count; i++) {
        cellCount[cellIndexOf(pos, i * 3)]++;
      }
      let running = 0;
      for (let c = 0; c < cellCount.length; c++) {
        cellStart[c] = running;
        running += cellCount[c];
        cellCount[c] = cellStart[c]; // reuse as a write cursor
      }
      cellStart[cellCount.length] = running;
      for (let i = 0; i < count; i++) {
        cellItems[cellCount[cellIndexOf(pos, i * 3)]++] = i;
      }

      // --- test each particle against its own cell and its neighbours
      outer: for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const cx = clampCell((pos[ix] - GRID_MIN_X) * GRID_INV, GRID_NX);
        const cy = clampCell((pos[ix + 1] - GRID_MIN_Y) * GRID_INV, GRID_NY);
        const cz = clampCell((pos[ix + 2] - GRID_MIN_Z) * GRID_INV, GRID_NZ);

        for (let ox = -1; ox <= 1; ox++) {
          const nx = cx + ox;
          if (nx < 0 || nx >= GRID_NX) continue;
          for (let oy = -1; oy <= 1; oy++) {
            const ny = cy + oy;
            if (ny < 0 || ny >= GRID_NY) continue;
            for (let oz = -1; oz <= 1; oz++) {
              const nz = cz + oz;
              if (nz < 0 || nz >= GRID_NZ) continue;
              const cell = (nx * GRID_NY + ny) * GRID_NZ + nz;
              const from = cellStart[cell];
              const to = cellStart[cell + 1];
              for (let k = from; k < to; k++) {
                const j = cellItems[k];
                // j > i only: each pair is considered exactly once, which
                // also removes the need to dedupe across neighbour cells.
                if (j <= i) continue;
                const jx = j * 3;
                const dx = pos[ix] - pos[jx];
                const dy = pos[ix + 1] - pos[jx + 1];
                const dz = pos[ix + 2] - pos[jx + 2];
                if (dx * dx + dy * dy + dz * dz >= maxDistSq) continue;
                if (w + 6 > linePositions.length) break outer; // buffer full
                linePositions[w++] = pos[ix];
                linePositions[w++] = pos[ix + 1];
                linePositions[w++] = pos[ix + 2];
                linePositions[w++] = pos[jx];
                linePositions[w++] = pos[jx + 1];
                linePositions[w++] = pos[jx + 2];
              }
            }
          }
        }
      }

      // The attribute wraps a buffer allocated once and reused; only the
      // draw range changes, so no per-frame allocation and no GC churn.
      let attr = linesRef.current.geometry.getAttribute("position");
      if (!attr || attr.array !== linePositions) {
        attr = new THREE.BufferAttribute(linePositions, 3);
        attr.setUsage(THREE.DynamicDrawUsage);
        linesRef.current.geometry.setAttribute("position", attr);
      }
      attr.needsUpdate = true;
      linesRef.current.geometry.setDrawRange(0, w / 3);
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={particles.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={count}
            array={particles.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          vertexColors
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#c8a24a" transparent opacity={0.12} />
      </lineSegments>
    </group>
  );
}
