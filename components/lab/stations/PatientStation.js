"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { geo, mat, emissive } from "../kit/shared";
import Figure from "../kit/Figure";
import { createAssembly, stagger } from "../kit/assembly";
import { MODULE_ACCENTS } from "@/lib/labStations";

// Station 1 — Patient Nexus, staged as a doctor's examination room.
//
// The brief's key inversion: the module is no longer an abstract sculpture
// a robot assembles, it is a ROOM that assembles. What the user watches
// build is a recognisable clinical space — exam table, patient, doctor,
// monitor, instruments — and the heartbeat motif appears where it actually
// belongs in that space, as the trace on the vitals monitor, rather than
// as a floating sculpture standing in for the idea of a patient.
//
// The scene is laid out to be legible from ONE fixed viewpoint. The user
// cannot orbit, so this is staged like a theatre set rather than a room
// that happens to contain furniture.
//
// The station camera stands just outside the doorway looking nearly
// straight along -x into the room, which makes +z screen RIGHT and -z
// screen LEFT. Everything is assigned to a band against that axis so
// nothing occludes anything else:
//
//   screen LEFT   IV stand, instrument table, wall light box
//   CENTRE        exam table + patient
//   screen RIGHT  doctor (beyond the table), vitals monitor, wall plaque
//
// Which world axis maps to screen-left was established by LOOKING, not by
// deriving it: with the camera facing along -x, DECREASING z is screen
// right. Getting that backwards on the first pass put every object on the
// wrong side and left half the frame empty.
//
// Iterating on this by nudging one object at a time did not converge —
// each fix pushed something else out of frame. Assigning bands first and
// placing into them is what actually resolved it.

const ACCENT = MODULE_ACCENTS.patient;

// Build order. Grouped into readable beats rather than one flat list, so
// the assembly narrates "room, then furniture, then people, then it comes
// alive" instead of parts appearing in arbitrary order.
const ORDER = [
  "floorPad",
  "tableBase",
  "tableTop",
  "sideTable",
  "monitorStand",
  "monitorBody",
  "ivStand",
  "instruments",
  "laptop",
  "patient",
  "doctor",
  "lightbox",
];
const WINDOWS = stagger(ORDER.length, { from: 0.04, to: 0.94, overlap: 0.5 });
const W = Object.fromEntries(ORDER.map((k, i) => [k, WINDOWS[i]]));

// ECG trace, as an actual polyline drawn across the monitor face. Same
// heartbeat silhouette the particle field has always used for this module,
// so the motif is continuous with the rest of the site — just expressed as
// a real instrument readout instead of a particle shape.
const ECG_KEYS = [
  [0, 0], [0.3, 0], [0.36, 0.12], [0.42, -0.1],
  [0.48, 0.62], [0.54, -0.42], [0.6, 0.1], [0.66, 0], [1, 0],
];
function ecgY(t) {
  for (let i = 0; i < ECG_KEYS.length - 1; i++) {
    const [t0, v0] = ECG_KEYS[i];
    const [t1, v1] = ECG_KEYS[i + 1];
    if (t >= t0 && t <= t1) return v0 + (v1 - v0) * ((t - t0) / (t1 - t0 || 1));
  }
  return 0;
}

export default function PatientStation({ station, controlRef, isLow }) {
  const [ox, , oz] = station.origin;
  const side = Math.sign(ox) || -1;
  const asm = useMemo(() => createAssembly(), []);
  const reg = (key, cfg) => (node) => asm.set(key, node, cfg);

  const traceRef = useRef(null);
  const monitorGlowRef = useRef(null);
  const roomLightRef = useRef(null);

  // The vitals trace as a tube along the ECG polyline — a real 3D line on
  // the monitor face rather than a texture, so it catches the accent
  // emissive and blooms like a lit display should.
  const traceGeo = useMemo(() => {
    const n = isLow ? 48 : 96;
    const pts = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return new THREE.Vector3((t - 0.5) * 1.5, ecgY(t) * 0.34, 0);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.012, 5, false);
  }, [isLow]);

  const traceMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: ACCENT.glow,
        toneMapped: false,
        transparent: true,
        opacity: 1,
      }),
    []
  );

  useFrame((state) => {
    const ctrl = controlRef?.current;
    if (!ctrl) return;
    const built = ctrl.stationBuilt?.[station.id] ?? 0;
    asm.apply(built);

    // Once the room is assembled it comes alive: the trace sweeps, the
    // monitor glow breathes with it. Gated on `built` so a half-built room
    // isn't already running vitals.
    const alive = Math.max(0, (built - 0.72) / 0.28);
    if (traceRef.current) {
      const t = state.clock.elapsedTime;
      traceMat.opacity = alive;
      // Sweep left-to-right the way a real monitor redraws, by clipping
      // how much of the tube is drawn.
      const sweep = (t * 0.55) % 1;
      const count = traceGeo.index ? traceGeo.index.count : 0;
      traceGeo.setDrawRange(0, Math.floor(count * sweep));
    }
    if (monitorGlowRef.current) {
      const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 2.1) * 0.12;
      monitorGlowRef.current.opacity = alive * pulse * 0.5;
    }
    if (roomLightRef.current) {
      roomLightRef.current.intensity = alive * (isLow ? 1.4 : 2.1);
    }
  });

  // Local helper — everything is authored in bay-local space and this
  // shifts it into the hall. Keeps all the layout numbers below readable
  // as "0.9 metres left of the table" rather than "-6.3 in world space".
  const P = (x, y, z) => [ox + x * -side, y, oz + z];

  return (
    <group>
      {/* Warm clinical fill, local to this room. Distinct from the hall's
          cooler key: a doctor's office is lit warmer than a corridor, and
          that shift is a large part of why the space reads as its own
          room rather than a section of the same hall. */}
      <pointLight
        ref={roomLightRef}
        position={P(-2.2, 2.9, -0.2)}
        intensity={0}
        distance={9}
        decay={2}
        color="#fff2e2"
      />

      {/* --- floor pad: a different flooring for the room ------------- */}
      <mesh
        ref={reg("floorPad", { ...W.floorPad, from: [0, -0.3, 0] })}
        geometry={geo.plane()}
        rotation={[-Math.PI / 2, 0, 0]}
        position={P(-1.9, 0.02, 0)}
        scale={[5.0, 7.2, 1]}
      >
        <meshStandardMaterial color="#c6d0dd" roughness={0.5} metalness={0.12} />
      </mesh>

      {/* --- examination table ---------------------------------------- */}
      {/* Runs ACROSS the camera's view rather than into it, so the patient
          is seen in profile at full length instead of foreshortened. */}
      <group position={P(-2.1, 0, -0.3)} rotation={[0, side * 1.15, 0]}>
        {/* pedestal + legs */}
        <group ref={reg("tableBase", { ...W.tableBase, from: [0, -1.1, 0] })}>
          <RoundedBox
            args={[1.5, 0.5, 0.62]}
            radius={0.04}
            smoothness={2}
            position={[0, 0.26, 0]}
            material={mat.steel()}
            castShadow
            receiveShadow
          />
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geo.box()}
              material={mat.steelDark()}
              position={[s * 0.62, 0.12, 0]}
              scale={[0.1, 0.24, 0.5]}
              castShadow
            />
          ))}
        </group>
        {/* padded top, with a raised backrest section */}
        <group ref={reg("tableTop", { ...W.tableTop, from: [0, 0.9, 0] })}>
          <RoundedBox
            args={[2.05, 0.16, 0.78]}
            radius={0.07}
            smoothness={3}
            position={[0, 0.6, 0]}
            material={mat.padding()}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[0.62, 0.15, 0.76]}
            radius={0.07}
            smoothness={3}
            position={[-0.72, 0.7, 0]}
            rotation={[0, 0, 0.3]}
            material={mat.padding()}
            castShadow
          />
          {/* paper roll across the bed — small, but it is the detail that
              makes it an EXAM table rather than a bench. */}
          <mesh
            geometry={geo.box()}
            material={mat.paper()}
            position={[0.15, 0.685, 0]}
            scale={[1.05, 0.012, 0.6]}
          />
        </group>

        {/* patient, lying on the table */}
        <group ref={reg("patient", { ...W.patient, from: [0, 0.7, 0] })}>
          {/* The lying pose extends along its own +Z with the head at -Z;
              the quarter turn lays it along the table's long axis, and the
              x offset centres that span on the table so the feet don't
              hang off the end. */}
          <group position={[-0.25, 0.69, 0]} rotation={[0, Math.PI / 2, 0]}>
            <Figure
              pose="lying"
              height={1.68}
              body={mat.gownLight()}
              legs={mat.gownLight()}
              skin={mat.skin()}
            />
          </group>
        </group>
      </group>

      {/* --- doctor --------------------------------------------------- */}
      {/* Stands beyond the table, angled back toward the camera and
          gesturing at the patient. Placed so the two figures don't overlap
          from the station viewpoint. */}
      <group ref={reg("doctor", { ...W.doctor, from: [0, 0, -1.1] })}>
        <group position={P(-3.35, 0, -1.5)} rotation={[0, side * -0.85, 0]}>
          <Figure
            pose="gesturing"
            height={1.78}
            body={mat.coat()}
            legs={mat.scrubs()}
            skin={mat.skinAlt()}
          />
        </group>
      </group>

      {/* --- vitals monitor on a stand -------------------------------- */}
      <group position={P(-3.1, 0, -2.45)} rotation={[0, side * -0.35, 0]}>
        <group ref={reg("monitorStand", { ...W.monitorStand, from: [0, -0.8, 0] })}>
          <mesh
            geometry={geo.cylinderLow()}
            material={mat.steelDark()}
            position={[0, 0.03, 0]}
            scale={[0.42, 0.06, 0.42]}
            castShadow
          />
          <mesh
            geometry={geo.cylinderLow()}
            material={mat.steel()}
            position={[0, 0.6, 0]}
            scale={[0.07, 1.2, 0.07]}
            castShadow
          />
        </group>
        <group ref={reg("monitorBody", { ...W.monitorBody, from: [0, 0.6, 0.3] })}>
          <RoundedBox
            args={[1.72, 1.12, 0.13]}
            radius={0.05}
            smoothness={3}
            position={[0, 1.66, 0]}
            material={mat.equipment()}
            castShadow
          />
          {/* dark display face */}
          <mesh
            geometry={geo.plane()}
            material={mat.screen()}
            position={[0, 1.7, 0.07]}
            scale={[1.5, 0.88, 1]}
          />
          {/* the heartbeat trace itself */}
          <mesh
            ref={traceRef}
            geometry={traceGeo}
            material={traceMat}
            position={[0, 1.78, 0.08]}
          />
          {/* readout blocks under the trace — abstract, but they are what
              make the face read as an instrument rather than a picture */}
          {[-0.5, -0.05, 0.42].map((x, i) => (
            <mesh
              key={i}
              geometry={geo.box()}
              material={emissive(i === 0 ? ACCENT.glow : "#9fb8c9", 1.1)}
              position={[x, 1.44, 0.08]}
              scale={[0.3, 0.07, 0.01]}
            />
          ))}
          {/* soft glow off the display */}
          <mesh
            geometry={geo.plane()}
            position={[0, 1.7, 0.09]}
            scale={[1.62, 0.98, 1]}
          >
            <meshBasicMaterial
              ref={monitorGlowRef}
              color={ACCENT.glow}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      {/* --- IV stand ------------------------------------------------- */}
      <group ref={reg("ivStand", { ...W.ivStand, from: [0, -1.2, 0] })}>
        <group position={P(-3.0, 0, 2.75)}>
          <mesh
            geometry={geo.cylinderLow()}
            material={mat.steelDark()}
            position={[0, 0.03, 0]}
            scale={[0.36, 0.06, 0.36]}
          />
          <mesh
            geometry={geo.cylinderLow()}
            material={mat.steel()}
            position={[0, 0.92, 0]}
            scale={[0.045, 1.84, 0.045]}
            castShadow
          />
          <mesh
            geometry={geo.cylinderLow()}
            material={mat.steel()}
            position={[0.12, 1.82, 0]}
            scale={[0.24, 0.03, 0.03]}
          />
          {/* IV bag — an ellipsoid, not the shared capsule: that geometry
              is 5 units tall by design (see CAPSULE_TOTAL) and scaling it
              like a unit primitive produces something enormous. */}
          <mesh
            geometry={geo.sphere()}
            material={mat.glass()}
            position={[0.22, 1.6, 0]}
            scale={[0.17, 0.3, 0.1]}
          />
        </group>
      </group>

      {/* --- side table with instruments ------------------------------ */}
      <group position={P(-1.5, 0, 1.95)} rotation={[0, side * 0.4, 0]}>
        <group ref={reg("sideTable", { ...W.sideTable, from: [0, -0.9, 0] })}>
          <RoundedBox
            args={[1.15, 0.07, 0.72]}
            radius={0.03}
            smoothness={2}
            position={[0, 0.86, 0]}
            material={mat.equipment()}
            castShadow
            receiveShadow
          />
          {[[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]].map(([x, z], i) => (
            <mesh
              key={i}
              geometry={geo.cylinderLow()}
              material={mat.steelDark()}
              position={[x, 0.43, z]}
              scale={[0.05, 0.86, 0.05]}
            />
          ))}
        </group>
        <group ref={reg("instruments", { ...W.instruments, from: [0, 0.5, 0], spin: 0.7 })}>
          {/* kidney dish */}
          <mesh
            geometry={geo.cylinderLow()}
            material={mat.steel()}
            position={[-0.32, 0.92, 0.02]}
            scale={[0.34, 0.06, 0.24]}
            castShadow
          />
          {/* two instrument forms in the dish */}
          <mesh
            geometry={geo.box()}
            material={mat.steel()}
            position={[-0.34, 0.955, 0.02]}
            rotation={[0, 0.4, 0]}
            scale={[0.22, 0.015, 0.02]}
          />
          <mesh
            geometry={geo.box()}
            material={mat.steel()}
            position={[-0.3, 0.955, 0.07]}
            rotation={[0, -0.25, 0]}
            scale={[0.2, 0.015, 0.018]}
          />
          {/* stethoscope suggestion: a torus + short lead */}
          <mesh
            geometry={geo.torus()}
            material={mat.equipmentDark()}
            position={[0.24, 0.95, -0.1]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.3, 0.3, 0.3]}
          />
        </group>
        <group ref={reg("laptop", { ...W.laptop, from: [0, 0.45, 0], rotFrom: [-0.9, 0, 0] })}>
          {/* tablet/chart propped on the table */}
          <RoundedBox
            args={[0.44, 0.03, 0.32]}
            radius={0.012}
            smoothness={2}
            position={[0.3, 0.905, 0.2]}
            rotation={[-0.32, 0.2, 0]}
            material={mat.equipmentDark()}
            castShadow
          />
          <mesh
            geometry={geo.plane()}
            material={emissive("#cfe6ef", 0.7)}
            position={[0.3, 0.922, 0.208]}
            rotation={[-Math.PI / 2 - 0.32, 0, 0.2]}
            scale={[0.38, 0.27, 1]}
          />
        </group>
      </group>

      {/* --- wall light box (X-ray / scan viewer) --------------------- */}
      {/* NOTE the sign on the x term: `side` is -1 for a left-hand bay, so
          "into the bay" is `ox + side * d`, not `ox + side * -d`. Getting
          it backwards put this panel out in the hall in FRONT of the room,
          where it read as a floating white slab covering the plaque. */}
      {/* Mounted on the bay's back wall beside the main screen. The main
          bay screen shows the module readout; this is the room's own
          medical fixture. */}
      <group ref={reg("lightbox", { ...W.lightbox, from: [side * 0.6, 0, 0] })}>
        <group
          position={[ox + side * 4.15, 2.05, oz + 1.9]}
          rotation={[0, -side * (Math.PI / 2), 0]}
        >
          <RoundedBox
            args={[1.35, 1.62, 0.09]}
            radius={0.03}
            smoothness={2}
            material={mat.equipment()}
            castShadow
          />
          <mesh
            geometry={geo.plane()}
            material={emissive("#eaf4f8", 1.35)}
            position={[0, 0, 0.05]}
            scale={[1.18, 1.44, 1]}
          />
          {/* abstract scan forms silhouetted on the light box */}
          <mesh
            geometry={geo.sphere()}
            material={mat.equipmentDark()}
            position={[0, 0.16, 0.055]}
            scale={[0.52, 0.62, 0.01]}
          />
          <mesh
            geometry={geo.sphere()}
            material={mat.equipment()}
            position={[-0.12, 0.2, 0.06]}
            scale={[0.16, 0.3, 0.01]}
          />
          <mesh
            geometry={geo.box()}
            material={mat.equipmentDark()}
            position={[0, -0.42, 0.055]}
            scale={[0.66, 0.1, 0.01]}
          />
        </group>
      </group>
    </group>
  );
}
