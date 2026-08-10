"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useLabEnvironmentRef } from "./ParticleNetworkContext";
import { heartbeatShape, MODULE_SHAPES } from "@/lib/particleShapes";
import { getInitialQualityTier } from "@/lib/deviceCapability";

// Low-tier simplification philosophy (device tier comes from the same
// getInitialQualityTier() heuristic LabGate already uses for scroll
// distance — cores/pointer-type/viewport, a one-time synchronous read at
// mount, not reactively rebuilt): reduce COUNT and GEOMETRY RESOLUTION
// (fewer pillars/panels, fewer tube segments, fewer rungs/nodes) rather
// than cutting whole wings or zones — every zone still delivers its beat
// on low-tier, just with less density. The one exception is Wing 3's
// glass shell: MeshPhysicalMaterial transmission forces an extra
// render-to-texture pass every frame regardless of geometry complexity,
// which is a genuinely different order of cost than "more triangles" —
// that's the one construct where a real material fallback (plain
// semi-transparent, no refraction) is the right call rather than trying
// to force it onto weak GPUs.
//
// Zone 1 "Entry": a corridor of structural conduit pillars receding into
// the dark, each carrying a thin light-line that activates (GSAP-driven,
// scroll-progress-scrubbed) as the camera approaches. Structural bodies
// are always faintly present (real geometry, not fog-hidden) — only the
// light-lines are dark at rest, which is what makes "activation" legible
// as the camera passes rather than the whole pillar popping into being.
const PILLAR_PAIRS = [
  { z: -12, height: 8, offsetX: 6.5, tone: "teal" },
  { z: -20, height: 9, offsetX: 6.1, tone: "gold" },
  { z: -28, height: 10, offsetX: 6.8, tone: "teal" },
  { z: -36, height: 11, offsetX: 6.3, tone: "gold" },
  { z: -44, height: 12, offsetX: 7.1, tone: "teal" },
];

const TONE_COLOR = { teal: "#3fd6c4", gold: "#e0b563" };

// Zone 2 "The Core Awakens": holographic readout panels flanking the
// approach, flickering to life as the camera nears/passes each one.
const PANELS = [
  { pos: [-8.2, 1.6, -19], rotY: 0.35, text: "SYS.PATIENT\n[INIT]" },
  { pos: [8.4, 2.1, -27], rotY: -0.35, text: "SYS.CLINICAL\n[INIT]" },
  { pos: [-7.6, -1.2, -34], rotY: 0.3, text: "SYS.DILIGENCE\n[INIT]" },
  { pos: [7.9, 0.4, -41], rotY: -0.3, text: "CORE.LINK\n[SYNC]" },
];

const CORE_POSITION = [0, 0, -52];
const WORDMARK_Z = -49.4;

// Zone 3, Wing 1 "Patient": the first per-module construct — a pulse-line
// built from real TubeGeometry along a CatmullRomCurve3, reusing the same
// heartbeat silhouette generator the old particle-coalesce beats used
// (lib/particleShapes.js) so the motif stays consistent, extruded into a
// tube and given a bit of Z wobble so it reads as genuinely 3D rather than
// a flat card facing the camera. This is the template Wings 2-3 (Clinical,
// Diligence) will follow: a construct group positioned off the main
// corridor axis, an emissive material GSAP ramps up as the camera's
// per-wing drift brings it close, and a small status label beside it.
const WING1_ORIGIN = [-6.5, 1, -38];
const WING1_COLOR = "#3fd6c4";
// Deterministic (not Math.random — this is a "use client" component and a
// random value would remount-flicker) off-construct start offsets each
// piece flies in from, alternating side/height so the assembly doesn't
// read as everything converging from one direction.
const WING1_PIECE_OFFSETS = [
  [2.2, 2.8, 1.4],
  [-2.4, 3.2, -1],
  [2.6, -2.2, 1.6],
  [-2.2, -2.6, -1.4],
  [1.8, 3.4, -1.8],
  [-1.6, -3, 1.8],
];

// Zone 3, Wing 2 "Clinical": a research/data space, not a recolored pulse-
// line. Two continuous strand curves form a real double helix (rung
// cross-links between them, like a DNA ladder) rather than one line —
// structured and symmetric where Wing 1 was a single organic sweep. Sits
// dead-center on the corridor axis (the camera's "straight-through
// centered" pass reinforces this — no drift, no swooping) and small nodes
// travel the strand in a steady formation rather than one lone pulse,
// reading as data moving through a system rather than a heartbeat.
const WING2_ORIGIN = [0, 0.5, -68];
const WING2_COLOR = "#5c8ef0"; // brightened glow variant of brand clinicalblue (#3b6fd6)
const WING2_TURNS = 2.5;
const WING2_POINTS = 40;
const WING2_RADIUS = 1.6;
const WING2_HALF_HEIGHT = 3.75;
const WING2_RUNG_INDICES = [4, 9, 14, 19, 24, 29, 34];

function clinicalStrandPoints(phaseOffset) {
  const pts = [];
  for (let i = 0; i < WING2_POINTS; i++) {
    const t = i / (WING2_POINTS - 1);
    const angle = t * Math.PI * 2 * WING2_TURNS + phaseOffset;
    pts.push(
      new THREE.Vector3(
        Math.cos(angle) * WING2_RADIUS,
        (t - 0.5) * WING2_HALF_HEIGHT * 2,
        Math.sin(angle) * WING2_RADIUS
      )
    );
  }
  return pts;
}

// Zone 3, Wing 3 "Diligence": an analysis/valuation space — weightier and
// more monumental than the other two. A real glass shell (MeshPhysicalMaterial
// transmission) rather than an emissive solid: the crystal is always
// physically present but dark/inert until the ascending-bar "engine" inside
// it (the same growth-bars motif Diligence has used since the coalesce
// beats) spins up and gives it something to refract. The camera never
// approaches as closely as it does for Wings 1-2 — it passes at a
// respectful distance, which is the "wider berth" the weight comes from.
const WING3_ORIGIN = [7, 0.5, -100];
const WING3_RADIUS = 3.2;
const WING3_BARS = [
  { x: -1.6, height: 1.2 },
  { x: -0.8, height: 1.8 },
  { x: 0, height: 2.4 },
  { x: 0.8, height: 3.0 },
  { x: 1.6, height: 3.6 },
];
const WING3_BAR_COLOR = "#e0b563";

// Zone 4 "Convergence": two tubes literally linking Wing 1 -> 2 -> 3,
// arcing upward at their midpoint so they read as deliberate conduits
// rather than straight utility lines. Activating these alongside a
// synchronized brightness pulse across all three wings (in LabGate) is
// what turns "three constructs happen to be near each other" into "these
// are one system" — the connective tissue is the whole point.
function connectorPoints(from, to) {
  const mid = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 5, (from[2] + to[2]) / 2];
  return [new THREE.Vector3(...from), new THREE.Vector3(...mid), new THREE.Vector3(...to)];
}
const CONNECTOR_COLOR = "#e8ecf5";

export default function LabEnvironment() {
  const labEnvRef = useLabEnvironmentRef();

  // One-time, synchronous — same heuristic and same "decide once at mount"
  // pattern LabGate already uses for TOTAL_SCROLL_PX, not re-evaluated
  // reactively if the async FPS-sample downgrade fires later (that
  // downgrade exists for the resting particle field's ongoing frame cost,
  // not a one-time geometry-count decision like this one).
  const isLow = getInitialQualityTier() !== "high";

  const pillarPairs = isLow ? PILLAR_PAIRS.slice(0, 3) : PILLAR_PAIRS;
  const panels = isLow ? PANELS.slice(0, 2) : PANELS;
  const wing2RungIndices = isLow ? [4, 14, 24, 34] : WING2_RUNG_INDICES;
  const wing2NodeCount = isLow ? 2 : 4;

  const pillarGeo = useMemo(
    () => new THREE.CylinderGeometry(0.35, 0.4, 1, isLow ? 8 : 10),
    [isLow]
  );
  const strandGeo = useMemo(
    () => new THREE.CylinderGeometry(0.07, 0.07, 1, isLow ? 6 : 8),
    [isLow]
  );
  const panelGeo = useMemo(() => new THREE.PlaneGeometry(2.6, 1.05), []);
  const outerCoreGeo = useMemo(() => new THREE.IcosahedronGeometry(4, 1), []);
  const innerCoreGeo = useMemo(() => new THREE.IcosahedronGeometry(2.15, 0), []);
  const ringGeo = useMemo(
    () => new THREE.TorusGeometry(3.35, 0.045, 8, isLow ? 36 : 72),
    [isLow]
  );

  const wing1Points = useMemo(
    () =>
      heartbeatShape(28).map(
        ([x, y, z], i) => new THREE.Vector3(x, y, z + Math.sin(i * 0.6) * 0.45)
      ),
    []
  );
  const wing1Curve = useMemo(() => new THREE.CatmullRomCurve3(wing1Points), [wing1Points]);
  const wing1PulseGeo = useMemo(() => new THREE.SphereGeometry(0.26, 12, 12), []);

  // The pulse-line is no longer one continuous mesh — it's built piece by
  // piece as the robotic arm places each segment. Each piece is a slice of
  // the same 28-point curve (1-point overlap between neighbors so there's
  // no visible seam once assembled) turned into its own short TubeGeometry,
  // wrapped in a group whose position animates in from
  // WING1_PIECE_OFFSETS[i] to (0,0,0) — the geometry itself already sits
  // at its correct final local coordinates, so only the group needs to
  // travel. Fewer, longer pieces on low-tier per Part 4.4 ("fewer pieces"
  // rather than the same count at lower resolution).
  const wing1PieceCount = isLow ? 4 : 6;
  const wing1PieceSlices = useMemo(() => {
    const total = wing1Points.length;
    const n = wing1PieceCount;
    const slices = [];
    for (let i = 0; i < n; i++) {
      const startIdx = Math.max(0, Math.floor((i / n) * (total - 1)) - (i > 0 ? 1 : 0));
      const endIdx = Math.min(total - 1, Math.ceil(((i + 1) / n) * (total - 1)) + (i < n - 1 ? 1 : 0));
      slices.push(wing1Points.slice(startIdx, endIdx + 1));
    }
    return slices;
  }, [wing1Points, wing1PieceCount]);
  // wing1PieceSlices always yields >=2 points per slice for these piece
  // counts (28 source points / 4-6 pieces) — no filter needed, which
  // keeps this array's indices aligned 1:1 with wing1PieceOffsets and
  // wing1SparkPositions below (all three are derived from the same
  // wing1PieceSlices, in the same order).
  const wing1PieceGeos = useMemo(
    () =>
      wing1PieceSlices.map(
        (slice) =>
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(slice),
            isLow ? 15 : 24,
            0.12,
            isLow ? 6 : 8,
            false
          )
      ),
    [wing1PieceSlices, isLow]
  );
  const wing1PieceOffsets = useMemo(
    () => wing1PieceSlices.map((_, i) => WING1_PIECE_OFFSETS[i % WING1_PIECE_OFFSETS.length]),
    [wing1PieceSlices]
  );
  const wing1SparkGeo = useMemo(() => new THREE.SphereGeometry(0.14, 8, 8), []);
  const wing1SparkPositions = useMemo(
    () =>
      wing1PieceSlices.map((slice) => {
        const mid = slice[Math.floor(slice.length / 2)] || slice[0];
        return [mid.x, mid.y, mid.z];
      }),
    [wing1PieceSlices]
  );

  // A translucent housing that seals in around the finished line during
  // Completion — a few partial-arc ribs rather than a full enclosed tube,
  // reading as protective without hiding the construct inside it.
  const wing1ShellRibGeo = useMemo(
    () => new THREE.TorusGeometry(0.55, 0.035, 8, 20, Math.PI * 1.3),
    []
  );
  const wing1ShellRibTransforms = useMemo(() => {
    const fractions = [0.28, 0.5, 0.72];
    const lastIdx = wing1Points.length - 2;
    return fractions.map((f) => {
      const idx = Math.min(lastIdx, Math.max(0, Math.round(f * (wing1Points.length - 1))));
      const p = wing1Points[idx];
      const pNext = wing1Points[idx + 1];
      const dir = new THREE.Vector3().subVectors(pNext, p).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      return { pos: [p.x, p.y, p.z], quat };
    });
  }, [wing1Points]);

  // Simple 2-segment articulated arm (base -> shoulder -> elbow ->
  // effector), hand-keyframed via GSAP-driven parent-child rotation in
  // LabGate rather than IK — the brief for the whole Part 4 build.
  const wing1ArmBaseGeo = useMemo(() => new THREE.BoxGeometry(0.42, 0.32, 0.42), []);
  const wing1UpperArmGeo = useMemo(() => new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8), []);
  const wing1ForearmGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), []);
  const wing1EffectorGeo = useMemo(() => new THREE.BoxGeometry(0.22, 0.22, 0.22), []);

  // Ambient "active workspace" detail — a small tool/drone shape orbiting
  // the site on its own continuous motion (useFrame, not GSAP), same
  // pattern as the core ring/outer-wireframe's idle spin elsewhere in this
  // file.
  const wing1ToolGeo = useMemo(() => new THREE.OctahedronGeometry(0.16, 0), []);

  const wing2Strand1Curve = useMemo(
    () => new THREE.CatmullRomCurve3(clinicalStrandPoints(0)),
    []
  );
  const wing2Strand2Curve = useMemo(
    () => new THREE.CatmullRomCurve3(clinicalStrandPoints(Math.PI)),
    []
  );
  const wing2Strand1Geo = useMemo(
    () => new THREE.TubeGeometry(wing2Strand1Curve, isLow ? 50 : 100, 0.09, isLow ? 6 : 8, false),
    [wing2Strand1Curve, isLow]
  );
  const wing2Strand2Geo = useMemo(
    () => new THREE.TubeGeometry(wing2Strand2Curve, isLow ? 50 : 100, 0.09, isLow ? 6 : 8, false),
    [wing2Strand2Curve, isLow]
  );
  const wing2RungGeo = useMemo(() => new THREE.CylinderGeometry(0.045, 0.045, 1, 6), []);
  const wing2RungTransforms = useMemo(() => {
    const s1 = clinicalStrandPoints(0);
    const s2 = clinicalStrandPoints(Math.PI);
    return wing2RungIndices.map((i) => {
      const p1 = s1[i];
      const p2 = s2[i];
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const length = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize()
      );
      return { mid, length, quat };
    });
  }, [wing2RungIndices]);
  const wing2NodeGeo = useMemo(() => new THREE.SphereGeometry(0.15, 10, 10), []);
  const wing2RungMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: WING2_COLOR,
        emissive: WING2_COLOR,
        emissiveIntensity: 0,
        roughness: 0.3,
        metalness: 0.4,
        toneMapped: false,
      }),
    []
  );

  // Detail 0 on low-tier isn't just fewer triangles — a lower-subdivision
  // icosahedron is chunkier/more angular, which if anything reads as
  // slightly MORE crystalline, not a worse version of the same shape.
  const wing3CrystalGeo = useMemo(
    () => new THREE.IcosahedronGeometry(WING3_RADIUS, isLow ? 0 : 1),
    [isLow]
  );
  const wing3BarGeo = useMemo(() => new THREE.BoxGeometry(0.5, 1, 0.5), []);

  const connector1Curve = useMemo(
    () => new THREE.CatmullRomCurve3(connectorPoints(WING1_ORIGIN, WING2_ORIGIN)),
    []
  );
  const connector2Curve = useMemo(
    () => new THREE.CatmullRomCurve3(connectorPoints(WING2_ORIGIN, WING3_ORIGIN)),
    []
  );
  const connector1Geo = useMemo(
    () => new THREE.TubeGeometry(connector1Curve, isLow ? 24 : 40, 0.045, isLow ? 5 : 6, false),
    [connector1Curve, isLow]
  );
  const connector2Geo = useMemo(
    () => new THREE.TubeGeometry(connector2Curve, isLow ? 24 : 40, 0.045, isLow ? 5 : 6, false),
    [connector2Curve, isLow]
  );

  const strandMatsRef = useRef([]);
  const panelPlaneMatsRef = useRef([]);
  const panelTextRefs = useRef([]);
  const outerCoreMatRef = useRef(null);
  const innerCoreMatRef = useRef(null);
  const ringMatRef = useRef(null);
  const ringMeshRef = useRef(null);
  const outerCoreMeshRef = useRef(null);
  const oaiTextRef = useRef(null);
  const nexusTextRef = useRef(null);
  const wing1LabelRef = useRef(null);
  const wing1PulseRef = useRef(null);
  const wing1PulseMatRef = useRef(null);
  const wing1PieceGroupRefs = useRef([]);
  const wing1PieceMatRefs = useRef([]);
  const wing1SparkMatRefs = useRef([]);
  const wing1ShellMatRefs = useRef([]);
  const wing1ShoulderRef = useRef(null);
  const wing1ElbowRef = useRef(null);
  const wing1ToolRef = useRef(null);
  const wing2Strand1MatRef = useRef(null);
  const wing2Strand2MatRef = useRef(null);
  const wing2LabelRef = useRef(null);
  const wing2NodeRefs = useRef([]);
  const wing3BarMatsRef = useRef([]);
  const wing3BarsGroupRef = useRef(null);
  const wing3LabelRef = useRef(null);
  const connector1MatRef = useRef(null);
  const connector2MatRef = useRef(null);

  useEffect(() => {
    labEnvRef.current = {
      strandMats: strandMatsRef.current,
      panelPlaneMats: panelPlaneMatsRef.current,
      panelTexts: panelTextRefs.current,
      outerCoreMat: outerCoreMatRef.current,
      innerCoreMat: innerCoreMatRef.current,
      ringMat: ringMatRef.current,
      oaiText: oaiTextRef.current,
      nexusText: nexusTextRef.current,
      wing1Label: wing1LabelRef.current,
      wing1PulseMat: wing1PulseMatRef.current,
      wing1PieceGroups: wing1PieceGroupRefs.current,
      wing1PieceMats: wing1PieceMatRefs.current,
      wing1SparkMats: wing1SparkMatRefs.current,
      wing1ShellMats: wing1ShellMatRefs.current,
      wing1Shoulder: wing1ShoulderRef.current,
      wing1Elbow: wing1ElbowRef.current,
      wing2Strand1Mat: wing2Strand1MatRef.current,
      wing2Strand2Mat: wing2Strand2MatRef.current,
      wing2RungMat,
      wing2Label: wing2LabelRef.current,
      wing3BarMats: wing3BarMatsRef.current,
      wing3Label: wing3LabelRef.current,
      connector1Mat: connector1MatRef.current,
      connector2Mat: connector2MatRef.current,
    };
    return () => {
      labEnvRef.current = null;
    };
  }, [labEnvRef, wing2RungMat]);

  // Ambient continuous motion only — never a property GSAP also drives, so
  // the two never fight. The ring's spin, the outer wireframe's slow
  // tumble, and the pulse travelling along Wing 1's line are what read as
  // "alive" between scroll-driven activation beats.
  useFrame((state, delta) => {
    if (ringMeshRef.current) {
      ringMeshRef.current.rotation.z += delta * 0.15;
    }
    if (outerCoreMeshRef.current) {
      outerCoreMeshRef.current.rotation.y += delta * 0.04;
      outerCoreMeshRef.current.rotation.x += delta * 0.015;
    }
    if (wing1PulseRef.current) {
      const t = (state.clock.elapsedTime * 0.15) % 1;
      const p = wing1Curve.getPointAt(t);
      wing1PulseRef.current.position.set(
        WING1_ORIGIN[0] + p.x,
        WING1_ORIGIN[1] + p.y,
        WING1_ORIGIN[2] + p.z
      );
    }
    // Nodes moving together in fixed formation along strand 1 — reads as
    // data packets travelling a line, deliberately distinct from Wing 1's
    // single lone pulse. Spacing is count-aware (1/N, not a hardcoded
    // fraction) so low-tier's 2 nodes stay evenly spaced around the loop
    // rather than bunching up at whatever fraction 4-node spacing implied.
    wing2NodeRefs.current.forEach((node, i) => {
      if (!node) return;
      const t = (state.clock.elapsedTime * 0.1 + i / wing2NodeCount) % 1;
      const p = wing2Strand1Curve.getPointAt(t);
      node.position.set(WING2_ORIGIN[0] + p.x, WING2_ORIGIN[1] + p.y, WING2_ORIGIN[2] + p.z);
    });
    if (wing3BarsGroupRef.current) {
      wing3BarsGroupRef.current.rotation.y += delta * 0.1;
    }
    // Wing 1's ambient tool/drone — small orbiting shape near the
    // construction site for "active workspace" feel, independent of
    // GSAP/scroll (a fixed elliptical orbit, always running once mounted).
    if (wing1ToolRef.current) {
      const t = state.clock.elapsedTime * 0.3;
      wing1ToolRef.current.position.set(Math.cos(t) * 2.2, 2 + Math.sin(t * 1.3) * 0.4, Math.sin(t) * 2.2);
      wing1ToolRef.current.rotation.y += delta * 1.2;
      wing1ToolRef.current.rotation.x += delta * 0.6;
    }
  });

  return (
    <group>
      {/* Zone 1: conduit corridor */}
      {pillarPairs.map((p, i) => {
        const color = TONE_COLOR[p.tone];
        return [-1, 1].map((side) => (
          <group key={`${i}-${side}`} position={[side * p.offsetX, -p.height / 2 + 1, p.z]}>
            <mesh geometry={pillarGeo} scale={[1, p.height, 1]}>
              <meshStandardMaterial color="#171c28" roughness={0.6} metalness={0.4} />
            </mesh>
            <mesh
              geometry={strandGeo}
              scale={[1, p.height * 0.94, 1]}
              position={[0, 0, 0.36]}
              ref={(m) => {
                if (m) strandMatsRef.current[i * 2 + (side === -1 ? 0 : 1)] = m.material;
              }}
            >
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0}
                transparent
                opacity={0.85}
                toneMapped={false}
              />
            </mesh>
          </group>
        ));
      })}

      {/* Zone 2: holographic readout panels */}
      {panels.map((p, i) => (
        <group key={i} position={p.pos} rotation={[0, p.rotY, 0]}>
          <mesh
            geometry={panelGeo}
            ref={(m) => {
              if (m) panelPlaneMatsRef.current[i] = m.material;
            }}
          >
            <meshBasicMaterial
              color="#0d2230"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          <Text
            ref={(t) => {
              if (t) panelTextRefs.current[i] = t;
            }}
            position={[0, 0, 0.02]}
            fontSize={0.19}
            color="#8fe8d8"
            anchorX="center"
            anchorY="middle"
            lineHeight={1.4}
            letterSpacing={0.04}
            fillOpacity={0}
          >
            {p.text}
          </Text>
        </group>
      ))}

      {/* Zone 2: the core */}
      <group position={CORE_POSITION}>
        <mesh ref={outerCoreMeshRef} geometry={outerCoreGeo}>
          <meshBasicMaterial
            ref={outerCoreMatRef}
            color="#5fd8c8"
            wireframe
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
        <mesh geometry={innerCoreGeo}>
          <meshStandardMaterial
            ref={innerCoreMatRef}
            color="#cfe9e2"
            emissive="#3fd6c4"
            emissiveIntensity={0}
            roughness={0.25}
            metalness={0.5}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={ringMeshRef} geometry={ringGeo} rotation={[Math.PI / 2.15, 0, 0]}>
          <meshBasicMaterial
            ref={ringMatRef}
            color="#e0b563"
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Wordmark — materializes at the core, integrated into 3D space
          rather than a flat DOM overlay. Uses the same Fraunces serif face
          as the resting Hero's "Nexus" headline (app/layout.js) so the
          wordmark reads as the same brand mark, not a placeholder font. */}
      <Text
        ref={oaiTextRef}
        font="/fonts/Fraunces-Regular.ttf"
        position={[0, 5.6, WORDMARK_Z]}
        fontSize={0.85}
        color="#f4f6fb"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.32}
        fillOpacity={0}
      >
        OAI
      </Text>
      <Text
        ref={nexusTextRef}
        font="/fonts/Fraunces-Regular.ttf"
        position={[0, 4.15, WORDMARK_Z]}
        fontSize={1.5}
        color="#f4f6fb"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
        fillOpacity={0}
      >
        NEXUS
      </Text>

      {/* Zone 3, Wing 1 "Patient": built piece by piece by a single
          gentle/careful robotic arm — protective shell seals in around it
          once complete, status label, ambient orbiting tool. */}
      <group position={WING1_ORIGIN}>
        {wing1PieceGeos.map((geo, i) => (
          <group
            key={i}
            position={wing1PieceOffsets[i]}
            scale={[0.4, 0.4, 0.4]}
            ref={(g) => {
              if (g) {
                g.userData.startOffset = wing1PieceOffsets[i];
                wing1PieceGroupRefs.current[i] = g;
              }
            }}
          >
            <mesh geometry={geo}>
              <meshStandardMaterial
                ref={(m) => {
                  if (m) wing1PieceMatRefs.current[i] = m;
                }}
                color={WING1_COLOR}
                emissive={WING1_COLOR}
                emissiveIntensity={0}
                transparent
                opacity={0}
                roughness={0.3}
                metalness={0.4}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}

        {/* Weld/spark flash at each piece's lock point — additive-blended,
            no real light source, so N of these cost nothing extra to the
            scene's lighting pass. */}
        {wing1SparkPositions.map((pos, i) => (
          <mesh key={i} position={pos} geometry={wing1SparkGeo}>
            <meshBasicMaterial
              ref={(m) => {
                if (m) wing1SparkMatRefs.current[i] = m;
              }}
              color="#eaf6f2"
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Protective shell ribs — fade in during Completion, sealing
            around the finished line rather than hiding it. */}
        {wing1ShellRibTransforms.map((r, i) => (
          <mesh
            key={i}
            geometry={wing1ShellRibGeo}
            position={r.pos}
            ref={(m) => {
              if (!m) return;
              m.quaternion.copy(r.quat);
              wing1ShellMatRefs.current[i] = m.material;
            }}
          >
            <meshStandardMaterial
              color="#bfe9df"
              transparent
              opacity={0}
              roughness={0.2}
              metalness={0.1}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Single articulated arm — base/shoulder/elbow/effector, GSAP
            drives shoulder/elbow rotation directly (no IK). Gentle/precise
            per the Patient brief: slower motion, warm soft light already
            comes from WING1_COLOR's teal emissive rather than a separate
            light source. */}
        <group position={[2.6, 2.6, 0.4]}>
          <mesh geometry={wing1ArmBaseGeo}>
            <meshStandardMaterial color="#232837" metalness={0.6} roughness={0.35} />
          </mesh>
          <group ref={wing1ShoulderRef} rotation={[0.9, 0, 0]}>
            <mesh geometry={wing1UpperArmGeo} position={[0, -0.65, 0]}>
              <meshStandardMaterial color="#2d3345" metalness={0.55} roughness={0.4} />
            </mesh>
            <group position={[0, -1.3, 0]} ref={wing1ElbowRef} rotation={[-1.4, 0, 0]}>
              <mesh geometry={wing1ForearmGeo} position={[0, -0.55, 0]}>
                <meshStandardMaterial color="#2d3345" metalness={0.55} roughness={0.4} />
              </mesh>
              <mesh geometry={wing1EffectorGeo} position={[0, -1.15, 0]}>
                <meshStandardMaterial
                  color={WING1_COLOR}
                  emissive={WING1_COLOR}
                  emissiveIntensity={1.2}
                  toneMapped={false}
                />
              </mesh>
            </group>
          </group>
        </group>

        <mesh ref={wing1ToolRef} geometry={wing1ToolGeo}>
          <meshStandardMaterial
            color="#8fe8d8"
            emissive="#8fe8d8"
            emissiveIntensity={1.5}
            metalness={0.3}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>

        <Text
          ref={wing1LabelRef}
          position={[0, 3.2, 0]}
          fontSize={0.32}
          color="#8fe8d8"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
          fillOpacity={0}
        >
          {MODULE_SHAPES.patient.label}
        </Text>
      </group>
      <mesh ref={wing1PulseRef} geometry={wing1PulseGeo}>
        <meshStandardMaterial
          ref={wing1PulseMatRef}
          color={WING1_COLOR}
          emissive={WING1_COLOR}
          emissiveIntensity={3}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>

      {/* Zone 3, Wing 2 "Clinical": double-helix + rung ladder + status
          label. Centered on the corridor axis — the camera's straight-
          through pass (no drift) is what makes this read as precise and
          structured rather than another organic sweep. */}
      <group position={WING2_ORIGIN}>
        <mesh geometry={wing2Strand1Geo}>
          <meshStandardMaterial
            ref={wing2Strand1MatRef}
            color={WING2_COLOR}
            emissive={WING2_COLOR}
            emissiveIntensity={0}
            roughness={0.25}
            metalness={0.5}
            toneMapped={false}
          />
        </mesh>
        <mesh geometry={wing2Strand2Geo}>
          <meshStandardMaterial
            ref={wing2Strand2MatRef}
            color={WING2_COLOR}
            emissive={WING2_COLOR}
            emissiveIntensity={0}
            roughness={0.25}
            metalness={0.5}
            toneMapped={false}
          />
        </mesh>
        {wing2RungTransforms.map((r, i) => (
          <mesh
            key={i}
            geometry={wing2RungGeo}
            material={wing2RungMat}
            position={r.mid}
            scale={[1, r.length, 1]}
            ref={(m) => {
              if (m) m.quaternion.copy(r.quat);
            }}
          />
        ))}
        {Array.from({ length: wing2NodeCount }, (_, i) => i).map((i) => (
          <mesh
            key={i}
            geometry={wing2NodeGeo}
            ref={(m) => {
              if (m) wing2NodeRefs.current[i] = m;
            }}
          >
            <meshStandardMaterial
              color={WING2_COLOR}
              emissive={WING2_COLOR}
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
        ))}
        <Text
          ref={wing2LabelRef}
          position={[0, WING2_HALF_HEIGHT + 0.6, 0]}
          fontSize={0.32}
          color="#a8c4fb"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
          fillOpacity={0}
        >
          {MODULE_SHAPES.clinical.label}
        </Text>
      </group>

      {/* Zone 3, Wing 3 "Diligence": on high-tier, a real glass shell
          (transmission material) around a spinning ascending-bar "engine"
          — the crystal is always physically present but has nothing to
          refract until the engine inside lights up. Transmission forces
          an extra render-to-texture pass every frame regardless of
          geometry complexity — a genuinely different order of GPU cost
          than "more triangles", so low-tier gets a real material swap
          (plain semi-transparent, no refraction) rather than the same
          material at a smaller size. The shell still reads as a
          translucent enclosure with the bars visible inside either way;
          only the refraction is gone. The camera keeps distance here
          (see LabGate's wide-berth path) rather than approaching close
          the way Wings 1-2 do — that distance is what reads as weight. */}
      <group position={WING3_ORIGIN}>
        <mesh geometry={wing3CrystalGeo}>
          {isLow ? (
            <meshStandardMaterial
              color="#f0e6d2"
              transparent
              opacity={0.35}
              roughness={0.3}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          ) : (
            <meshPhysicalMaterial
              color="#f0e6d2"
              transmission={1}
              thickness={1.6}
              roughness={0.08}
              ior={1.45}
              clearcoat={1}
              clearcoatRoughness={0.08}
              metalness={0}
            />
          )}
        </mesh>
        <group ref={wing3BarsGroupRef}>
          {WING3_BARS.map((b, i) => (
            <mesh
              key={i}
              geometry={wing3BarGeo}
              position={[b.x, b.height / 2 - 1.5, 0]}
              scale={[1, b.height, 1]}
              ref={(m) => {
                if (m) wing3BarMatsRef.current[i] = m.material;
              }}
            >
              <meshStandardMaterial
                color={WING3_BAR_COLOR}
                emissive={WING3_BAR_COLOR}
                emissiveIntensity={0}
                roughness={0.3}
                metalness={0.4}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
        <Text
          ref={wing3LabelRef}
          position={[0, WING3_RADIUS + 0.9, 0]}
          fontSize={0.32}
          color="#f0d9a0"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
          fillOpacity={0}
        >
          {MODULE_SHAPES.diligence.label}
        </Text>
      </group>

      {/* Zone 4 "Convergence": the two conduits tying all three wings
          together into one visible system. */}
      <mesh geometry={connector1Geo}>
        <meshStandardMaterial
          ref={connector1MatRef}
          color={CONNECTOR_COLOR}
          emissive={CONNECTOR_COLOR}
          emissiveIntensity={0}
          roughness={0.3}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={connector2Geo}>
        <meshStandardMaterial
          ref={connector2MatRef}
          color={CONNECTOR_COLOR}
          emissive={CONNECTOR_COLOR}
          emissiveIntensity={0}
          roughness={0.3}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
