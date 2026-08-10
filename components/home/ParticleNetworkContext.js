"use client";

import { createContext, useContext, useRef, useState } from "react";

const ParticleNetworkRefContext = createContext(null);
const HeroRevealContext = createContext(null);
const LabActiveContext = createContext(null);
const LabEnvironmentRefContext = createContext(null);

// Holds the ref that the shared particle Canvas attaches its instance to,
// shared with the lab gate so its GSAP timeline can drive the exact same
// scene — not a second instance. Also holds two small pieces of
// coordination state:
//   - heroReady: whether Hero's content may start its reveal (the gate
//     flips this at its own completion; without it Hero would reveal itself
//     behind an opaque gate for no visible reason, wastefully).
//   - labActive: whether the gate is still mounted/running. The particle
//     Canvas uses this to decide whether to render the lab's environment
//     geometry at all — once the gate finishes, that geometry is disposed
//     rather than kept around invisible, so the resting page doesn't carry
//     the lab's GPU cost forever.
// The provider itself doesn't mount anything.
export function ParticleNetworkProvider({ children }) {
  const networkRef = useRef(null);
  const [heroReady, setHeroReady] = useState(false);
  const [labActive, setLabActive] = useState(false);
  // Populated by LabEnvironment on mount with direct references to its
  // Three.js objects/materials (pillars, panels, core parts, wordmark) —
  // LabGate's GSAP timeline tweens these object properties directly rather
  // than relaying values through a per-frame control object, since R3F's
  // continuous render loop picks up mutated object properties on its own.
  const labEnvRef = useRef(null);
  return (
    <ParticleNetworkRefContext.Provider value={networkRef}>
      <HeroRevealContext.Provider value={{ heroReady, setHeroReady }}>
        <LabActiveContext.Provider value={{ labActive, setLabActive }}>
          <LabEnvironmentRefContext.Provider value={labEnvRef}>
            {children}
          </LabEnvironmentRefContext.Provider>
        </LabActiveContext.Provider>
      </HeroRevealContext.Provider>
    </ParticleNetworkRefContext.Provider>
  );
}

export function useParticleNetworkRef() {
  const ctx = useContext(ParticleNetworkRefContext);
  if (!ctx) {
    throw new Error(
      "useParticleNetworkRef must be used within a ParticleNetworkProvider"
    );
  }
  return ctx;
}

export function useHeroReveal() {
  const ctx = useContext(HeroRevealContext);
  if (!ctx) {
    throw new Error("useHeroReveal must be used within a ParticleNetworkProvider");
  }
  return ctx;
}

export function useLabActive() {
  const ctx = useContext(LabActiveContext);
  if (!ctx) {
    throw new Error("useLabActive must be used within a ParticleNetworkProvider");
  }
  return ctx;
}

export function useLabEnvironmentRef() {
  const ctx = useContext(LabEnvironmentRefContext);
  if (!ctx) {
    throw new Error(
      "useLabEnvironmentRef must be used within a ParticleNetworkProvider"
    );
  }
  return ctx;
}
