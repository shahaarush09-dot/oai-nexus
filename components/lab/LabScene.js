"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILD_STATIONS, MODULE_ACCENTS, STATIONS } from "@/lib/labStations";
import { getInitialQualityTier } from "@/lib/deviceCapability";
import LabRoom from "./LabRoom";
import StationBay from "./StationBay";
import PatientStation from "./stations/PatientStation";

// Composes the room and its bays, owns the shared per-station build state,
// and runs the adaptive quality monitor.

const STATION_SCENES = {
  patient: PatientStation,
};

// How long a station's build-in takes once the camera arrives. Paired with
// BUILD_DWELL_MS in labStations.js, which holds input off for slightly
// less than this — so the room is effectively complete the moment the user
// is able to move on, and nobody ever waits on an invisible lockout.
const BUILD_SECONDS = 1.4;

// Stations either side of the active one that keep their furniture
// mounted. The exit station is exempt — showing all three finished rooms
// at once is its entire purpose.
const NEIGHBOUR_RANGE = 1;

// --- adaptive quality -------------------------------------------------
// A static device-tier guess made once at mount cannot know what a given
// GPU/driver actually does with this scene. This watches real frame times
// during the lab and steps quality down when they slip, which is the only
// signal that reflects the machine the user is genuinely on.
const QUALITY_HIGH = 2;
const QUALITY_MED = 1;
const QUALITY_LOW = 0;
const SAMPLE_FRAMES = 45;
// ~45fps. Above this we leave quality alone; sustained frames slower than
// this cost more in perceived jank than the effects are worth.
const SLOW_FRAME_MS = 22;

export default function LabScene({ controlRef }) {
  const initialLow = getInitialQualityTier() !== "high";
  const [quality, setQuality] = useState(initialLow ? QUALITY_LOW : QUALITY_HIGH);
  const isLow = quality === QUALITY_LOW;

  const blockGeo = useMemo(() => new THREE.BoxGeometry(1.9, 1.9, 1.9), []);

  const arrivalRef = useRef(0);
  const lastIndexRef = useRef(-1);
  const frameAccum = useRef({ n: 0, total: 0 });
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  useFrame((state, delta) => {
    const ctrl = controlRef?.current;
    if (!ctrl) return;

    // --- adaptive quality ---------------------------------------------
    // Averaged over a window rather than reacting per frame: a single
    // slow frame is meaningless (shader compiles, GC), a sustained
    // average is not. Only ever steps down — oscillating between quality
    // levels would be far more distracting than staying at the lower one.
    const fa = frameAccum.current;
    // Same guard as sampleFps: a throttled tab reports frame times of
    // hundreds of milliseconds regardless of how fast the machine is, and
    // acting on that permanently degrades quality for a user who simply
    // had the page open in the background. Discard the window entirely
    // rather than let a single throttled stretch poison the average.
    if (typeof document !== "undefined" && document.hidden) {
      fa.n = 0;
      fa.total = 0;
    } else {
      fa.n += 1;
      fa.total += delta * 1000;
    }
    if (fa.n >= SAMPLE_FRAMES) {
      const avg = fa.total / fa.n;
      fa.n = 0;
      fa.total = 0;
      if (avg > SLOW_FRAME_MS && qualityRef.current > QUALITY_LOW) {
        const next = qualityRef.current - 1;
        qualityRef.current = next;
        setQuality(next);
        console.info(
          `[lab] frame avg ${avg.toFixed(1)}ms — stepping quality down to ${next}`
        );
      }
    }

    // --- per-station build-in -----------------------------------------
    // Driven by time from arrival, not by scroll. See labStations.js for
    // why the scroll-scrubbed version was replaced.
    if (!ctrl.stationBuilt) ctrl.stationBuilt = {};
    const index = ctrl.stationIndex ?? 0;
    if (index !== lastIndexRef.current) {
      lastIndexRef.current = index;
      arrivalRef.current = state.clock.elapsedTime;
    }

    const station = STATIONS[index] ?? STATIONS[0];
    if (station.module) {
      const t = (state.clock.elapsedTime - arrivalRef.current) / BUILD_SECONDS;
      const prev = ctrl.stationBuilt[station.id] ?? 0;
      // max() so a station never un-builds: walking back up the hall shows
      // finished rooms still standing rather than replaying every assembly.
      ctrl.stationBuilt[station.id] = Math.max(prev, Math.min(1, t));
      ctrl.stationDisplay = ctrl.stationBuilt[station.id];
      ctrl.accentColor = MODULE_ACCENTS[station.module].glow;
    } else {
      ctrl.stationDisplay = 1;
    }
  });

  return (
    <group>
      <LabRoom controlRef={controlRef} quality={quality} isLow={isLow} />

      {BUILD_STATIONS.map((station) => {
        const Staged = STATION_SCENES[station.id];
        return (
          <StationBay
            key={station.id}
            station={station}
            controlRef={controlRef}
            isLow={isLow}
            showPlinth={!Staged}
          >
            <BayContents station={station} controlRef={controlRef}>
              {Staged ? (
                <Staged station={station} controlRef={controlRef} isLow={isLow} />
              ) : (
                <PlaceholderConstruct
                  station={station}
                  controlRef={controlRef}
                  geometry={blockGeo}
                />
              )}
            </BayContents>
          </StationBay>
        );
      })}
    </group>
  );
}

function BayContents({ station, controlRef, children }) {
  const groupRef = useRef(null);

  useFrame(() => {
    const ctrl = controlRef?.current;
    const g = groupRef.current;
    if (!ctrl || !g) return;
    const active = ctrl.stationIndex ?? 0;
    const isExit = active === STATIONS.length - 1;
    g.visible = isExit || Math.abs(active - station.index) <= NEIGHBOUR_RANGE;
  });

  return <group ref={groupRef}>{children}</group>;
}

// Stand-in for stations whose staged room isn't built yet.
function PlaceholderConstruct({ station, controlRef, geometry }) {
  const ref = useRef(null);

  useFrame((_, delta) => {
    const ctrl = controlRef?.current;
    const mesh = ref.current;
    if (!ctrl || !mesh) return;
    const built = ctrl.stationBuilt?.[station.id] ?? 0;
    const s = 0.5 + built * 0.8;
    mesh.scale.set(s, s, s);
    mesh.rotation.y += delta * 0.3 * built;
  });

  const accent = MODULE_ACCENTS[station.module];
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      position={station.origin}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={accent.accent}
        emissive={accent.glow}
        emissiveIntensity={0.25}
        roughness={0.3}
        metalness={0.35}
      />
    </mesh>
  );
}
