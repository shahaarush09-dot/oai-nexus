"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { HALL, STATIONS } from "@/lib/labStations";

// The physical room: floor, walls, ceiling, overhead fixtures, and the
// lighting rig. Everything station-specific lives in StationBay.js.
//
// Lighting philosophy — this is a from-scratch build, not a retune. The
// previous dark corridor had NO light sources of any kind: every visible
// surface was an emissive material with toneMapped={false}, which works
// when the room is black and nothing else is competing. A bright room has
// the opposite problem — almost everything is near the top of the
// luminance range, so form has to come from the DIFFERENCE between lit and
// shadowed surfaces rather than from glow against black. That needs three
// things working together, none of which existed before:
//
//   1. Image-based ambient (Environment + Lightformers) for soft,
//      directionless fill that makes white surfaces read as white rather
//      than flat grey. This is the single biggest contributor to the
//      "product render" look and the reason a plain ambientLight alone
//      always looks cheap.
//   2. One strong directional key WITH a shadow map, tracking the active
//      station, for contact and direction.
//   3. Accent colour applied as emissive trim and a single tracking point
//      light — never as the primary illumination.
//
// The Environment is generated procedurally from Lightformer meshes, NOT
// from a preset. drei's `preset="..."` fetches an HDR from a CDN at
// runtime; that is a network dependency inside a first-paint gate, and a
// failed fetch would leave the room unlit. Lightformers have no such
// dependency and are also directly art-directable.
const ENV_RESOLUTION = 256;

// Shadow-camera half-extent around the active station. Kept tight
// deliberately: a single directional shadow camera stretched over the whole
// 108-unit hall would spread 2048 texels so thin that contact shadows turn
// to mush. Tracking the station the camera is actually looking at buys
// roughly an order of magnitude more shadow resolution where it is visible.
const SHADOW_EXTENT = 15;
const KEY_TRACK_SPEED = 3.2;

// PALETTE — the hall.
//
// A dark environment is built from LOW LIGHT, not from black paint. The
// first attempt at this darkened the surface colours AND cut the light
// levels at the same time, which is a compounding error: an albedo down at
// ~0.02 linear reflects essentially nothing no matter what illuminates it,
// so the hall rendered as a flat void with no visible geometry at all.
//
// These values keep surface reflectance in a real mid-range — dark, but
// with enough albedo to catch light and show form — while the LIGHTING
// stays low and directional. That is what produces a space that reads as
// dim rather than as unlit, and it leaves the emissive light lines and
// ceiling fixtures as genuinely the brightest things in frame, which is
// what makes them read as light sources rather than as bright paint.
const COLORS = {
  floor: "#3c4658",
  floorSeam: "#5c6980",
  wall: "#454f63",
  wallSeam: "#2a3140",
  skirting: "#1e2431",
  ceiling: "#2b3342",
  fixture: "#eaf6ff",
  lightLine: "#3fd6c4",
  lightLineCool: "#5aa9e0",
};

export default function LabRoom({ controlRef, quality = 2, isLow }) {
  const { scene } = useThree();
  const keyRef = useRef(null);
  const accentRef = useRef(null);
  const targetRef = useRef(new THREE.Object3D());

  const hallDepth = HALL.zNear - HALL.zFar;
  const zCenter = (HALL.zNear + HALL.zFar) / 2;
  const halfW = HALL.width / 2;
  const h = HALL.ceilingHeight;

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Wall sections with a visible seam gap between them, rather than one
  // continuous slab. The seams are what give the walls scale — a bare
  // 108-unit wall reads as a backdrop, panelled it reads as a built room.
  const wallSections = useMemo(() => {
    const sectionLen = 12;
    const n = Math.ceil(hallDepth / sectionLen);
    return Array.from({ length: n }, (_, i) => HALL.zNear - i * sectionLen - sectionLen / 2);
  }, [hallDepth]);

  // Overhead fixtures: simple emissive slabs recessed into the ceiling.
  // These are the only geometry deliberately pushed above the bloom
  // threshold, so they are what actually blooms.
  const fixtures = useMemo(() => {
    const spacing = 9;
    const n = Math.floor(hallDepth / spacing);
    return Array.from({ length: n }, (_, i) => HALL.zNear - 4 - i * spacing);
  }, [hallDepth]);

  const floorSeams = useMemo(() => {
    const spacing = 11;
    const n = Math.floor(hallDepth / spacing);
    return Array.from({ length: n }, (_, i) => HALL.zNear - i * spacing);
  }, [hallDepth]);

  // The directional light's target is an Object3D that three.js only reads
  // through its world matrix — it has to be in the scene graph (or have its
  // matrix updated by hand) or the light silently keeps pointing at the
  // origin no matter what position is written to it.
  useEffect(() => {
    const target = targetRef.current;
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene]);

  useFrame((_, delta) => {
    const ctrl = controlRef?.current;
    if (!ctrl) return;
    const station = STATIONS[ctrl.stationIndex ?? 0] ?? STATIONS[0];
    const [ox, , oz] = station.origin;

    // Ease the rig toward the active station rather than snapping it: a
    // shadow that jumps to a new angle the instant the station index
    // changes is far more noticeable than the camera move itself.
    const k = 1 - Math.exp(-KEY_TRACK_SPEED * delta);
    const key = keyRef.current;
    if (key) {
      key.position.x += (ox * 0.35 + 5 - key.position.x) * k;
      key.position.z += (oz + 9 - key.position.z) * k;
      const t = targetRef.current;
      t.position.x += (ox - t.position.x) * k;
      t.position.z += (oz - t.position.z) * k;
      t.updateMatrixWorld();
    }
    if (accentRef.current) {
      accentRef.current.position.x += (ox - accentRef.current.position.x) * k;
      accentRef.current.position.z += (oz - accentRef.current.position.z) * k;
      const accent = ctrl.accentColor;
      if (accent) accentRef.current.color.set(accent);
    }
  });

  return (
    <group>
      {/* --- lighting rig ------------------------------------------- */}
      {/* Soft IBL fill. frames={1} bakes it once at mount — without that
          it re-renders a cube target every frame for a rig that never
          moves. */}
      <Environment resolution={ENV_RESOLUTION} frames={1}>
        <color attach="background" args={["#39445c"]} />
        {/* Broad overhead source — stands in for the ceiling as a light
            box, which is what makes the floor and horizontal surfaces read
            as an interior rather than an object on a backdrop. */}
        <Lightformer
          intensity={1.7}
          rotation-x={Math.PI / 2}
          position={[0, 8, 0]}
          scale={[30, 40, 1]}
        />
        {/* Two long wall bounces, slightly cool, for the soft gradient
            across vertical surfaces. */}
        <Lightformer
          intensity={0.75}
          rotation-y={Math.PI / 2}
          position={[-16, 3, 0]}
          scale={[40, 8, 1]}
          color="#eaf0fa"
        />
        <Lightformer
          intensity={0.75}
          rotation-y={-Math.PI / 2}
          position={[16, 3, 0]}
          scale={[40, 8, 1]}
          color="#eaf0fa"
        />
        {/* A brighter, tighter source down the hall so the far end reads
            as receding toward light rather than flattening out. */}
        <Lightformer
          intensity={1.0}
          position={[0, 4, HALL.zFar - 6]}
          scale={[16, 8, 1]}
          color="#ffffff"
        />
      </Environment>

      {/* Ambient is deliberately modest — the Environment is doing the
          fill. A high ambientLight on top of IBL is what flattens these
          scenes out and loses all the form the key light is providing. */}
      <ambientLight intensity={0.38} color="#8fa4c4" />

      <directionalLight
        ref={keyRef}
        position={[5, 16, 0]}
        target={targetRef.current}
        intensity={1.75}
        color="#eaf4ff"
        castShadow
        // 1024 over a 30-unit shadow camera is ~34 texels/unit, which is
        // plenty at these object sizes — 2048 measurably cost frames on
        // integrated graphics for detail that the soft PCF radius blurs
        // away again anyway.
        shadow-mapSize={quality >= 2 ? [1024, 1024] : quality === 1 ? [768, 768] : [512, 512]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={48}
        // normalBias is the one that matters on the large flat floor —
        // without it a low-angle key produces shadow acne across the whole
        // plane, which on a near-white surface is extremely visible.
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        // Softens the PCF kernel. A hard-edged shadow in an otherwise
        // diffusely-lit white room reads as wrong — the room's own
        // lighting implies large soft sources, so the key's shadow has to
        // agree with that or the two look like different scenes.
        shadow-radius={3}
      />

      {/* Cool counter-fill from the opposite side, no shadows: stops the
          key's shadow side going dead grey. */}
      <directionalLight position={[-9, 7, 12]} intensity={0.4} color="#6d8ec4" />

      {/* Single accent light, recoloured per station. Accent colour as
          real light rather than only emissive trim is what ties the
          construct into the room instead of leaving it looking pasted on. */}
      <pointLight
        ref={accentRef}
        position={[0, 2.4, 0]}
        intensity={isLow ? 4 : 7}
        distance={16}
        decay={2}
        color="#3fd6c4"
      />

      {/* --- floor ---------------------------------------------------- */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, zCenter]}
        receiveShadow
      >
        <planeGeometry args={[HALL.width, hallDepth]} />
        {quality < 2 ? (
          // Reflector renders the whole scene a second time into an
          // offscreen target every frame. That is a genuinely different
          // order of cost to "more triangles" and is the one thing here
          // that gets a real material swap on weak hardware rather than a
          // reduced-quality version of itself.
          <meshStandardMaterial color={COLORS.floor} roughness={0.5} metalness={0.35} />
        ) : (
          <MeshReflectorMaterial
            // The reflection is heavily blurred and mixed in at under a
            // third strength, so it carries almost no high-frequency
            // detail — rendering it at 512 and blurring with a 400px kernel
            // was paying full price for information immediately thrown
            // away. 256 with a proportionally smaller kernel is visually
            // near-identical and roughly a quarter of the fill cost.
            resolution={256}
            mixBlur={0.85}
            blur={[200, 64]}
            // Kept low on purpose. A mirror-bright floor reads as a video
            // game; a polished-concrete suggestion of a reflection reads
            // as an expensive real room.
            mirror={0.5}
            // Cut back from 1.1: the reflection is of a near-white ceiling
            // and near-white walls, so mixing it in at full strength wiped
            // out the floor's own (deliberately darker) albedo and undid
            // the value separation the palette exists to create.
            mixStrength={0.9}
            roughness={0.62}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.35}
            color={COLORS.floor}
            metalness={0.45}
          />
        )}
      </mesh>

      {/* Transverse floor seams — minimal, just enough that the floor has
          a sense of scale and construction under the reflection. */}
      {floorSeams.map((z) => (
        <mesh
          key={`fs-${z}`}
          geometry={planeGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.008, z]}
          scale={[HALL.width, 0.06, 1]}
        >
          <meshBasicMaterial color={COLORS.floorSeam} transparent opacity={0.65} />
        </mesh>
      ))}

      {/* --- walls ---------------------------------------------------- */}
      {[-1, 1].map((side) =>
        wallSections.map((z) => (
          <mesh
            key={`w-${side}-${z}`}
            geometry={boxGeo}
            position={[side * (halfW + 0.4), h / 2, z]}
            scale={[0.8, h, 11.4]}
            receiveShadow
          >
            <meshStandardMaterial color={COLORS.wall} roughness={0.55} metalness={0.25} />
          </mesh>
        ))
      )}

      {/* Continuous recessed seam strip behind the panel gaps, so the gaps
          read as depth rather than as holes onto nothing. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`ws-${side}`}
          geometry={boxGeo}
          position={[side * (halfW + 0.85), h / 2, zCenter]}
          scale={[0.2, h, hallDepth]}
        >
          <meshStandardMaterial color={COLORS.wallSeam} roughness={0.8} metalness={0.15} />
        </mesh>
      ))}

      {/* Skirting. A small thing that does a lot of work: without a darker
          line where the walls meet the floor, two planes at different
          angles blend into each other and the room loses its corners. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`sk-${side}`}
          geometry={boxGeo}
          position={[side * (halfW - 0.06), 0.11, zCenter]}
          scale={[0.14, 0.22, hallDepth]}
          receiveShadow
        >
          <meshStandardMaterial color={COLORS.skirting} roughness={0.65} metalness={0.3} />
        </mesh>
      ))}

      {/* --- light architecture --------------------------------------- */}
      {/* SIZING NOTE: these were first modelled at realistic physical
          scale — 5cm strips let into the wall. At corridor viewing
          distances (15-60 units) a 0.05-unit strip subtends well under a
          pixel, so the hall rendered as an unlit void even with the
          emissives at full brightness: the light architecture was there
          and simply too thin to resolve. Architectural light features have
          to be sized for the ANGULAR size they need to occupy in frame,
          not for what would be correct in millimetres. */}
      {/* Continuous illuminated lines let into the wall/floor junction and
          running the full length of the hall. In a dark environment these
          do the work the white walls used to: they describe the room's
          shape, give the perspective something to converge along, and are
          the main thing the reflective floor has to reflect. They are also
          the clearest single "advanced facility" signal in the scene —
          light as architecture rather than light as illumination. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`ll-${side}`}
          geometry={boxGeo}
          position={[side * (halfW - 0.22), 0.42, zCenter]}
          scale={[0.16, 0.26, hallDepth]}
        >
          <meshStandardMaterial
            color={COLORS.lightLine}
            emissive={COLORS.lightLine}
            emissiveIntensity={3.2}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* A second, cooler line high on the wall, so the vertical extent of
          the hall is described too and the walls don't vanish above eye
          level into unlit dark. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`llh-${side}`}
          geometry={boxGeo}
          position={[side * (halfW - 0.16), h - 1.35, zCenter]}
          scale={[0.13, 0.16, hallDepth]}
        >
          <meshStandardMaterial
            color={COLORS.lightLineCool}
            emissive={COLORS.lightLineCool}
            emissiveIntensity={3.0}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Transverse floor light bars at each seam — these are what give
          the floor a sense of travel as the camera moves down the hall. */}
      {floorSeams.map((z) => (
        <mesh
          key={`fl-${z}`}
          geometry={boxGeo}
          position={[0, 0.03, z]}
          scale={[HALL.width * 0.62, 0.05, 0.2]}
        >
          <meshStandardMaterial
            color={COLORS.lightLineCool}
            emissive={COLORS.lightLineCool}
            emissiveIntensity={1.9}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* --- ceiling -------------------------------------------------- */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, zCenter]}>
        <planeGeometry args={[HALL.width, hallDepth]} />
        <meshStandardMaterial color={COLORS.ceiling} roughness={0.85} metalness={0.1} />
      </mesh>

      {fixtures.map((z) => (
        <mesh
          key={`fx-${z}`}
          geometry={boxGeo}
          position={[0, h - 0.22, z]}
          scale={[10.5, 0.22, 1.15]}
        >
          <meshStandardMaterial
            color={COLORS.fixture}
            emissive={COLORS.fixture}
            // Above the lab's 0.88 bloom threshold, so these are the
            // sources that actually bloom — deliberately the only
            // white-hot thing in the room.
            emissiveIntensity={3.0}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* --- end caps -------------------------------------------------- */}
      {/* Both ends are closed. The exit station looks back UP the hall, so
          an open entry end would frame a void behind the three finished
          bays and undo the whole "you are inside a room" premise. */}
      <mesh geometry={boxGeo} position={[0, h / 2, HALL.zNear]} scale={[HALL.width, h, 0.5]} receiveShadow>
        <meshStandardMaterial color={COLORS.wall} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh geometry={boxGeo} position={[0, h / 2, HALL.zFar]} scale={[HALL.width, h, 0.5]} receiveShadow>
        <meshStandardMaterial color={COLORS.wall} roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}
