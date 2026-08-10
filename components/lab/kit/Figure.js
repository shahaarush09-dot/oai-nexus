"use client";

import { CAPSULE_TOTAL, geo, mat } from "./shared";

// Architectural-visualisation entourage figures: simplified human forms
// built from capsules and ellipsoids, in the tradition of the abstract
// white figures in an architect's model.
//
// The proportions below are the whole job. An abstract figure with correct
// proportions reads as a deliberate stylistic choice; the same figure with
// a head 20% too large or legs the wrong length reads as a modelling
// failure, and no amount of material quality rescues it. So these follow
// standard figure-drawing canon — roughly 7.5 heads tall, shoulders about
// two head-widths, legs a little under half of total height — rather than
// being eyeballed.
//
// Everything is a fraction of `height`, so a seated figure and a standing
// one stay consistent with each other.

const HEAD = 1 / 7.5; // head height as a fraction of total height

// Capsule limb of a given overall LENGTH and radius. The divide by
// CAPSULE_TOTAL is load-bearing — see the note on that constant.
function Limb({ position, rotation, length, radius, material, castShadow = false }) {
  return (
    <mesh
      geometry={geo.capsule()}
      material={material}
      position={position}
      rotation={rotation}
      scale={[radius * 2, length / CAPSULE_TOTAL, radius * 2]}
      castShadow={castShadow}
    />
  );
}

// Rounded mass (torso, head, hands) as a scaled sphere. Capsules make poor
// torsos: at torso proportions their end caps flatten to near-discs and
// the shape reads as a canister. An ellipsoid stays rounded at any aspect.
function Mass({ position, rotation, size, material, castShadow = false }) {
  return (
    <mesh
      geometry={geo.sphere()}
      material={material}
      position={position}
      rotation={rotation}
      scale={size}
      castShadow={castShadow}
    />
  );
}

export default function Figure({
  pose = "standing",
  height = 1.75,
  body = mat.suit(),
  legs,
  skin = mat.skin(),
  castShadow = true,
  ...groupProps
}) {
  const h = height;
  const headR = (h * HEAD) / 2;
  const legMat = legs || body;

  // Vertical landmarks from standard figure canon, chosen so they SUM to
  // exactly `height`: legs 0.47h to the hip, torso 0.35h hip-to-shoulder,
  // then neck and head filling the remaining 0.18h. The first pass used
  // 0.46/0.28 and left the head top at 0.89h — a figure measurably shorter
  // than it claimed to be, which is the kind of error that reads as
  // "badly modelled" without being obviously attributable to anything.
  const legLen = h * 0.47;
  const torsoLen = h * 0.35;
  const armLen = h * 0.36;
  const shoulderW = h * 0.105;
  const hipY = legLen;
  const shoulderY = hipY + torsoLen;
  const neckTop = h - headR * 2;
  const headY = h - headR;

  const headSize = [headR * 1.7, headR * 2, headR * 1.85];
  const torsoSize = [h * 0.19, torsoLen, h * 0.115];
  const legR = h * 0.05;
  const armR = h * 0.033;

  if (pose === "lying") {
    // Supine, extending along the group's local +Z, head toward -Z.
    return (
      <group {...groupProps}>
        <Mass
          material={body}
          position={[0, h * 0.075, 0]}
          size={[h * 0.16, h * 0.1, torsoLen]}
          castShadow={castShadow}
        />
        {/* head, slightly raised on a pillow */}
        <Mass
          material={skin}
          position={[0, h * 0.1, -torsoLen - headR * 0.6]}
          size={headSize}
          castShadow={castShadow}
        />
        {/* legs together under a sheet-like mass, knees very slightly up */}
        {[-1, 1].map((s) => (
          <Limb
            key={s}
            material={legMat}
            position={[s * h * 0.045, h * 0.07, torsoLen + legLen * 0.5]}
            rotation={[Math.PI / 2, 0, 0]}
            length={legLen}
            radius={legR}
            castShadow={castShadow}
          />
        ))}
        {/* feet */}
        {[-1, 1].map((s) => (
          <Mass
            key={`f${s}`}
            material={body}
            position={[s * h * 0.045, h * 0.085, torsoLen + legLen + h * 0.03]}
            size={[h * 0.05, h * 0.05, h * 0.07]}
          />
        ))}
        {/* arms at the sides */}
        {[-1, 1].map((s) => (
          <Limb
            key={`a${s}`}
            material={body}
            position={[s * h * 0.105, h * 0.075, -h * 0.01]}
            rotation={[Math.PI / 2, 0, 0]}
            length={armLen}
            radius={armR}
          />
        ))}
      </group>
    );
  }

  if (pose === "seated") {
    // Seated on a ~0.27h surface; thighs forward along +Z, shins down.
    const seatY = h * 0.26;
    const sShoulderY = seatY + torsoLen;
    return (
      <group {...groupProps}>
        <Mass
          material={body}
          position={[0, seatY + torsoLen * 0.5, -h * 0.01]}
          rotation={[-0.07, 0, 0]}
          size={torsoSize}
          castShadow={castShadow}
        />
        <Mass
          material={skin}
          position={[0, sShoulderY + headR * 1.25, h * 0.005]}
          size={headSize}
          castShadow={castShadow}
        />
        {/* thighs */}
        {[-1, 1].map((s) => (
          <Limb
            key={`t${s}`}
            material={legMat}
            position={[s * h * 0.05, seatY - h * 0.02, h * 0.115]}
            rotation={[Math.PI / 2, 0, 0]}
            length={legLen * 0.5}
            radius={legR}
            castShadow={castShadow}
          />
        ))}
        {/* shins */}
        {[-1, 1].map((s) => (
          <Limb
            key={`s${s}`}
            material={legMat}
            position={[s * h * 0.05, seatY * 0.48, h * 0.225]}
            rotation={[0.05, 0, 0]}
            length={legLen * 0.5}
            radius={legR * 0.88}
            castShadow={castShadow}
          />
        ))}
        {/* upper arms hanging, forearms resting forward on the thighs */}
        {[-1, 1].map((s) => (
          <Limb
            key={`ua${s}`}
            material={body}
            position={[s * shoulderW * 1.08, sShoulderY - armLen * 0.24, -h * 0.005]}
            rotation={[0.1, 0, s * 0.05]}
            length={armLen * 0.5}
            radius={armR}
          />
        ))}
        {[-1, 1].map((s) => (
          <Limb
            key={`fa${s}`}
            material={body}
            position={[s * shoulderW * 1.08, sShoulderY - armLen * 0.52, h * 0.075]}
            rotation={[Math.PI / 2, 0, 0]}
            length={armLen * 0.5}
            radius={armR * 0.92}
          />
        ))}
      </group>
    );
  }

  // standing / gesturing
  const gesture = pose === "gesturing";
  return (
    <group {...groupProps}>
      <Mass
        material={body}
        position={[0, hipY + torsoLen * 0.5, 0]}
        size={torsoSize}
        castShadow={castShadow}
      />
      {/* shoulders — a slightly wider mass across the top of the torso is
          what gives the silhouette a human upper body rather than an egg */}
      <Mass
        material={body}
        position={[0, shoulderY - torsoLen * 0.12, 0]}
        size={[h * 0.22, h * 0.075, h * 0.11]}
      />
      <mesh
        geometry={geo.cylinderLow()}
        material={skin}
        position={[0, (shoulderY + neckTop) / 2, 0]}
        scale={[h * 0.042, neckTop - shoulderY, h * 0.042]}
      />
      <Mass
        material={skin}
        position={[0, headY, gesture ? h * 0.012 : 0]}
        size={headSize}
        castShadow={castShadow}
      />
      {/* legs */}
      {[-1, 1].map((s) => (
        <Limb
          key={`l${s}`}
          material={legMat}
          position={[s * h * 0.052, legLen * 0.5, 0]}
          rotation={[0, 0, s * 0.015]}
          length={legLen}
          radius={legR}
          castShadow={castShadow}
        />
      ))}
      {/* far arm hangs naturally in both poses */}
      <Limb
        material={body}
        position={[-shoulderW, shoulderY - armLen * 0.5, 0]}
        rotation={[0, 0, 0.06]}
        length={armLen}
        radius={armR}
      />
      {gesture ? (
        // Near arm raised and open toward what is being discussed. This
        // single pose change is what turns two figures standing near each
        // other into a consultation.
        <>
          <Limb
            material={body}
            position={[shoulderW * 1.1, shoulderY - armLen * 0.28, h * 0.05]}
            rotation={[-0.45, 0, -0.42]}
            length={armLen * 0.52}
            radius={armR}
          />
          <Limb
            material={body}
            position={[shoulderW * 1.6, shoulderY - armLen * 0.16, h * 0.2]}
            rotation={[-1.05, 0, -0.18]}
            length={armLen * 0.52}
            radius={armR * 0.92}
          />
          <Mass
            material={skin}
            position={[shoulderW * 1.75, shoulderY - armLen * 0.03, h * 0.31]}
            size={[h * 0.032, h * 0.026, h * 0.04]}
          />
        </>
      ) : (
        <Limb
          material={body}
          position={[shoulderW, shoulderY - armLen * 0.5, 0]}
          rotation={[0, 0, -0.06]}
          length={armLen}
          radius={armR}
        />
      )}
    </group>
  );
}
