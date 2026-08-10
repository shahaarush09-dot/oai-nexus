"use client";

import { useMemo, useRef } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HALL, MODULE_ACCENTS } from "@/lib/labStations";
import { mat } from "./kit/shared";

// One construction bay: the recessed back wall it sits against, the
// dividers that make it a discrete room-within-the-room, the floor
// marking, the wall screen, and the physical signage.
//
// The bay is what turns "an object standing in a hall" into "a station".
// Without the dividers and the floor marking the three constructs read as
// three things scattered down one long room; with them, each is its own
// bay you arrive at, which is the museum-exhibit framing the whole
// navigation model is built around.

export const SIGN_FONT = "/fonts/IBMPlexSans-SemiBold.ttf";

const BAY_DEPTH = 13;
const BAY_WALL_INSET = 1.4;
const PILLAR_H = HALL.ceilingHeight;

// Each station is an enclosed ROOM opening onto the hall, not an alcove in
// it. This is the change that makes "a doctor's office" possible at all:
// a furnished vignette sitting in a 26-unit-wide, 6.2-unit-high corridor
// reads as furniture that happens to be in a corridor, however good the
// furniture is. Real rooms are bounded, and the boundary is most of what
// the eye uses to identify one. Side walls plus a dropped ceiling also
// constrain the composition — the camera can be placed in the doorway and
// the walls frame the shot for free.
const ROOM_DEPTH = 5.4; // how far the room extends out from the bay wall
const ROOM_W = 7.6; // along the hall
const ROOM_H = 3.45; // dropped ceiling, well under the hall's 6.2
// Working footprint of the bay — the painted area the plinth sits in.
const MARK_W = 5.6;
const MARK_D = 6.6;
// Work-surface height. Puts the construct near the camera's 2.0 eye level
// rather than down at the floor, which is both better framing and what a
// real assembly station would do.
export const PLINTH_H = 0.95;

export default function StationBay({
  station,
  controlRef,
  isLow,
  // The plinth is right for an object presented on a pedestal and wrong
  // for a furnished room — an examination table does not stand on a
  // display plinth. Stations that stage a real space opt out.
  showPlinth = true,
  children,
}) {
  const accent = MODULE_ACCENTS[station.module];
  const [ox, , oz] = station.origin;
  // Which side of the hall this bay is on. Bays alternate, so the camera
  // turns the other way at each station and no two stops frame alike.
  const side = Math.sign(ox) || -1;
  const wallX = side * (HALL.width / 2 - BAY_WALL_INSET);
  // A plane's +Z faces the hall centre only after a quarter turn; the sign
  // of that turn flips with the side.
  const facing = -side * (Math.PI / 2);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const statusRef = useRef(null);

  // Vents / panel seams on the bay wall. Real inset geometry rather than a
  // texture: with a shadow-casting key light and AO in the chain, actual
  // depth catches light and reads correctly from every angle the camera
  // takes, where a normal map on a flat plane would not.
  const vents = useMemo(() => {
    const n = isLow ? 4 : 7;
    return Array.from({ length: n }, (_, i) => -1.9 + i * 0.36);
  }, [isLow]);

  useFrame((state) => {
    const ctrl = controlRef?.current;
    const active = ctrl && (ctrl.stationIndex ?? 0) === station.index;
    const built = ctrl?.stationBuilt?.[station.id] ?? 0;

    // The bay's status lamp: dim and slowly breathing while idle, pulsing
    // faster while its robot is actually working, solid once the module is
    // online. It is a small thing but it is the bay's own state readout,
    // separate from the construct's.
    if (statusRef.current) {
      const t = state.clock.elapsedTime;
      const idle = 0.35 + Math.sin(t * 1.1) * 0.15;
      const working = 1.6 + Math.sin(t * 7) * 0.7;
      statusRef.current.emissiveIntensity =
        built >= 0.999 ? 2.4 : active ? working : idle;
    }
  });

  return (
    <group>
      {/* --- recessed bay wall ---------------------------------------- */}
      <mesh
        geometry={boxGeo}
        position={[wallX, HALL.ceilingHeight / 2, oz]}
        scale={[0.6, HALL.ceilingHeight, BAY_DEPTH]}
        receiveShadow
      >
        {/* Darker than the hall walls so the bay reads as a recess the
            camera is looking into, not as more of the same corridor. */}
        <meshStandardMaterial color="#aab5c6" roughness={0.58} metalness={0.07} />
      </mesh>

      {/* NOTE: a full-height accent trim used to run down both edges of
          the bay wall here. It has been removed deliberately. Module
          colour now appears only as small detail INSIDE the room — the
          monitor glow, a thin light-line, the sign's accent bar and status
          lamp. A large flat panel of brand colour on the wall undercut the
          realism of the room exactly the way the display plinth did: it
          reads as branding applied to a space rather than as a property of
          the space. */}

      {/* Vent slots, inset into the wall below the screen. */}
      {vents.map((v, i) => (
        <mesh
          key={`vent-${i}`}
          geometry={boxGeo}
          position={[wallX - side * 0.31, 0.8, oz + v]}
          scale={[0.04, 1.1, 0.16]}
        >
          <meshStandardMaterial color="#aeb7c6" roughness={0.9} metalness={0.15} />
        </mesh>
      ))}

      {/* --- room enclosure -------------------------------------------- */}
      {/* Side walls and a dropped ceiling turn the bay into a room with a
          doorway. The opening faces the hall centre line, which is where
          the station camera sits. */}
      {[-1, 1].map((edge) => (
        <mesh
          key={`roomwall-${edge}`}
          geometry={boxGeo}
          position={[
            side * (HALL.width / 2 - BAY_WALL_INSET - ROOM_DEPTH / 2),
            ROOM_H / 2,
            oz + edge * (ROOM_W / 2),
          ]}
          scale={[ROOM_DEPTH, ROOM_H, 0.3]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#b9c4d4" roughness={0.62} metalness={0.05} />
        </mesh>
      ))}
      {/* Dropped ceiling — the single biggest contributor to the room
          reading as a room. It also stops the hall's overhead fixtures
          being visible above the scene, which was quietly destroying the
          sense of enclosure. */}
      <mesh
        geometry={boxGeo}
        position={[
          side * (HALL.width / 2 - BAY_WALL_INSET - ROOM_DEPTH / 2),
          ROOM_H + 0.12,
          oz,
        ]}
        scale={[ROOM_DEPTH, 0.24, ROOM_W]}
        castShadow
      >
        <meshStandardMaterial color="#aab5c6" roughness={0.78} metalness={0.03} />
      </mesh>
      {/* Recessed ceiling panel light inside the room, so it has its own
          apparent light source rather than being lit from nowhere. */}
      <mesh
        geometry={boxGeo}
        position={[
          side * (HALL.width / 2 - BAY_WALL_INSET - ROOM_DEPTH / 2),
          ROOM_H - 0.04,
          oz,
        ]}
        scale={[ROOM_DEPTH * 0.5, 0.06, ROOM_W * 0.42]}
      >
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.85}
          toneMapped={false}
        />
      </mesh>
      {/* Door-frame lip around the opening — reads as a threshold and
          gives the accent trim somewhere architectural to live. */}
      {[-1, 1].map((edge) => (
        <mesh
          key={`jamb-${edge}`}
          geometry={boxGeo}
          position={[
            side * (HALL.width / 2 - BAY_WALL_INSET - ROOM_DEPTH),
            ROOM_H / 2,
            oz + edge * (ROOM_W / 2),
          ]}
          scale={[0.34, ROOM_H, 0.44]}
          castShadow
        >
          <meshStandardMaterial color="#f3f6fa" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}
      <mesh
        geometry={boxGeo}
        position={[
          side * (HALL.width / 2 - BAY_WALL_INSET - ROOM_DEPTH),
          ROOM_H + 0.02,
          oz,
        ]}
        scale={[0.34, 0.28, ROOM_W]}
        castShadow
      >
        <meshStandardMaterial color="#f3f6fa" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* --- dividing pillars ------------------------------------------ */}
      {[-1, 1].map((edge) => (
        <RoundedBox
          key={`pillar-${edge}`}
          args={[0.72, PILLAR_H, 0.72]}
          radius={0.07}
          smoothness={3}
          position={[
            side * (HALL.width / 2 - BAY_DEPTH / 2.6),
            PILLAR_H / 2,
            oz + edge * (BAY_DEPTH / 2),
          ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#f1f4f8" roughness={0.4} metalness={0.12} />
        </RoundedBox>
      ))}

      {/* --- floor marking --------------------------------------------- */}
      {/* A painted bay outline on the floor, in the module accent. Reads as
          a real workshop safety marking and, more usefully, tells the eye
          exactly where one station ends and the next begins.
          Sized to the bay's actual working footprint, NOT to the full bay
          depth — spanning the whole bay it ran right up under the camera
          and became a coloured wash across half the frame rather than a
          marking on a floor. */}
      <mesh
        geometry={planeGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[ox, 0.012, oz]}
        scale={[MARK_W, MARK_D, 1]}
      >
        <meshBasicMaterial color={accent.accent} transparent opacity={0.12} />
      </mesh>
      {[-1, 1].map((edge) => (
        <mesh
          key={`mark-${edge}`}
          geometry={planeGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[ox, 0.014, oz + edge * (MARK_D / 2)]}
          scale={[MARK_W, 0.11, 1]}
        >
          <meshBasicMaterial color={accent.accent} transparent opacity={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((edge) => (
        <mesh
          key={`markx-${edge}`}
          geometry={planeGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[ox + edge * (MARK_W / 2), 0.014, oz]}
          scale={[0.11, MARK_D, 1]}
        >
          <meshBasicMaterial color={accent.accent} transparent opacity={0.9} />
        </mesh>
      ))}

      {/* --- work plinth ------------------------------------------------ */}
      {/* The surface the module is actually assembled on. Real fixture,
          not a placeholder: it gives the robot a defined work height, puts
          the construct at eye level instead of on the floor, and stops the
          bay reading as an empty painted rectangle. */}
      {showPlinth && (
        <>
          <RoundedBox
            args={[3.4, PLINTH_H, 2.6]}
            radius={0.06}
            smoothness={3}
            position={[ox, PLINTH_H / 2, oz]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#eaeef4" roughness={0.32} metalness={0.22} />
          </RoundedBox>
          {/* Accent light-line let into the plinth edge, facing the camera. */}
          <mesh
            geometry={boxGeo}
            position={[ox - side * 1.72, PLINTH_H - 0.16, oz]}
            scale={[0.03, 0.05, 2.2]}
          >
            <meshStandardMaterial
              color={accent.glow}
              emissive={accent.glow}
              emissiveIntensity={1.3}
              toneMapped={false}
            />
          </mesh>
          {/* Dark inset deck so the construct has something to read against
              rather than sitting white-on-white. */}
          <mesh
            geometry={planeGeo}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[ox, PLINTH_H + 0.002, oz]}
            scale={[2.9, 2.1, 1]}
          >
            <meshStandardMaterial color="#9aa5b6" roughness={0.5} metalness={0.3} />
          </mesh>
        </>
      )}

      {/* --- wall screen ------------------------------------------------ */}
      {/* Bezel + dark panel. Readouts (scrolling values, charts) are added
          per module in the station build steps; this is the physical
          fixture they mount into. */}
      <RoundedBox
        args={[4.6, 2.5, 0.16]}
        radius={0.06}
        smoothness={3}
        position={[wallX - side * 0.34, 3.5, oz]}
        rotation={[0, facing, 0]}
        castShadow
      >
        <meshStandardMaterial color="#dfe4ec" roughness={0.35} metalness={0.25} />
      </RoundedBox>
      <mesh
        geometry={planeGeo}
        position={[wallX - side * 0.44, 3.5, oz]}
        rotation={[0, facing, 0]}
        scale={[4.3, 2.24, 1]}
      >
        <meshBasicMaterial color="#12202e" toneMapped={false} />
      </mesh>
      {/* --- signage ---------------------------------------------------- */}
      {/* A real mounted sign: backing plate, accent bar, status lamp, and
          text rendered onto the plate rather than floating in space. It is
          legible from the moment the camera arrives — before the robot
          starts — so the user always knows what they are looking at. */}
      <group position={[wallX - side * 0.42, 5.15, oz]} rotation={[0, facing, 0]}>
        <RoundedBox args={[5.2, 0.92, 0.14]} radius={0.05} smoothness={3} castShadow>
          <meshStandardMaterial color="#f7f9fc" roughness={0.3} metalness={0.18} />
        </RoundedBox>
        <mesh geometry={boxGeo} position={[-2.36, 0, 0.09]} scale={[0.16, 0.66, 0.04]}>
          <meshStandardMaterial
            color={accent.glow}
            emissive={accent.glow}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[2.32, 0, 0.09]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial
            ref={statusRef}
            color={accent.glow}
            emissive={accent.glow}
            emissiveIntensity={0.4}
            toneMapped={false}
          />
        </mesh>
        <Text
          font={SIGN_FONT}
          position={[-0.1, 0, 0.085]}
          fontSize={0.42}
          color="#1b2433"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.13}
        >
          {accent.sign}
        </Text>
      </group>

      {/* --- in-room plaque -------------------------------------------- */}
      {/* The doorway sign is only legible from out in the hall. Once the
          camera steps into the room it is behind and above the viewpoint,
          so the room itself carried no identification at all — the user
          could be standing in a doctor's office with no indication of
          which module it belongs to. This is a wall-mounted plaque on the
          room's back wall, sized and placed to be read from the station
          camera. */}
      <group
        position={[
          wallX - side * 0.34,
          1.95,
          oz - (ROOM_W / 2) * 0.66,
        ]}
        rotation={[0, facing, 0]}
      >
        <RoundedBox
          args={[2.35, 0.56, 0.07]}
          radius={0.03}
          smoothness={3}
          material={mat.plaque()}
          castShadow
        />
        {/* Accent bar — module colour as a detail on a real object, which
            is the only place it appears in the room now. */}
        <mesh
          geometry={boxGeo}
          position={[-1.02, 0, 0.045]}
          scale={[0.09, 0.36, 0.03]}
        >
          <meshStandardMaterial
            color={accent.glow}
            emissive={accent.glow}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
        <Text
          font={SIGN_FONT}
          position={[0.11, 0.03, 0.042]}
          fontSize={0.2}
          color="#101822"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.1}
        >
          {accent.sign}
        </Text>
        <Text
          font={SIGN_FONT}
          position={[0.11, -0.16, 0.042]}
          fontSize={0.082}
          color="#5c6a7d"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.22}
        >
          OAI NEXUS
        </Text>
      </group>

      {/* Per-station room content mounts here. */}
      {children}
    </group>
  );
}
