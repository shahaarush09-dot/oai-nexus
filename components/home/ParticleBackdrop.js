"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLabActive, useParticleNetworkRef } from "./ParticleNetworkContext";
import { getInitialQualityTier, sampleFps } from "@/lib/deviceCapability";

const ParticleNetwork = dynamic(() => import("./ParticleNetwork"), { ssr: false });

// Low tier keeps postprocessing. It used to be disabled outright, which
// was right when the lab was a bright room where bloom did almost nothing
// — but the hall is now a dark environment whose entire read depends on
// emissive light lines, fixtures and screens actually glowing. Without
// bloom a low-tier machine doesn't get a cheaper version of the design, it
// gets a different and much worse one. The savings come from particle
// count, dpr, and the runtime quality monitor instead.
const TIER_CONFIG = {
  high: { count: 800, postprocessing: true },
  low: { count: 350, postprocessing: true },
};

// Resting vignette is deliberately off-center (72% 40%) to frame Hero's
// left-aligned copy against a darkened right/decorative side. Lab mode's
// composition is symmetric and centered on the corridor/core, so an
// off-center spotlight would read as a mistake — this is centered, softer,
// and starts later so it frames the edges/corners without competing with
// the fog's own depth cueing or washing out the pillars near frame edges.
const VIGNETTE = {
  resting:
    "radial-gradient(ellipse 70% 60% at 72% 40%, rgba(8,11,21,0) 20%, rgba(8,11,21,0.92) 72%, rgba(8,11,21,1) 100%)",
  // The hall is a dark environment again, so the vignette goes back to
  // darkening the edges — but cooler and softer than the resting one, to
  // sit with the cyan light architecture rather than fight it.
  lab: "radial-gradient(ellipse 92% 84% at 50% 46%, rgba(8,12,20,0) 42%, rgba(8,12,20,0.42) 82%, rgba(8,12,20,0.72) 100%)",
};

// The single, page-level mount point for the shared particle field — fixed
// behind everything else on the page, mounted once and never remounted.
// CinematicIntro drives it directly via the shared control object
// (ParticleNetworkContext) during its Scenes 1-5; Hero then just displays
// whatever resting state the intro left it in. It has to live here rather
// than scoped to Hero's own section, because the intro's pinned scroll
// section needs the same canvas visible beneath it long before Hero is ever
// scrolled to.
export default function ParticleBackdrop() {
  const networkRef = useParticleNetworkRef();
  const { labActive } = useLabActive();
  const [tier, setTier] = useState(null);

  useEffect(() => {
    const initial = getInitialQualityTier();
    setTier(initial);
    if (initial === "high") {
      return sampleFps(1000, (result) => {
        if (result === "low") setTier("low");
      });
    }
  }, []);

  const config = tier && tier !== "minimal" ? TIER_CONFIG[tier] : null;

  return (
    // Resting state: z-0, sitting behind Header/page content as a decorative
    // background — the normal case. Lab mode reuses this same canvas as the
    // gate's actual visual content, which must cover Header (z-30); z-0
    // doesn't carry over, so this is raised above Header (but still below
    // LabGate's own z-100 skip-button/UI layer) only while labActive.
    <div
      className="fixed inset-0"
      style={{
        zIndex: labActive ? 90 : 0,
        // Guaranteed opaque backing while the lab gate is active. The
        // WebGL canvas only paints pixels where fog/geometry reach —
        // empty space past the scene's fog range is transparent, and the
        // vignette above is deliberately see-through at its center (it's
        // an edge-darkening effect, not a background). In resting mode
        // this canvas sits at z-0 behind everything so transparency never
        // mattered; promoted to z-90 above Header during the gate, any
        // transparent pixel let the real page (e.g. Header, z-40) show
        // through — confirmed live at t=0 with zero scroll, at the very
        // top strip of the viewport where the scene's fog doesn't reach.
        // Now matches the lab's own bright fog/background colour rather
        // than the old near-black, so any such gap is invisible instead of
        // being a black band across a white room.
        backgroundColor: labActive ? "#0e141f" : "transparent",
      }}
    >
      {config && (
        <ParticleNetwork
          externalRef={networkRef}
          count={config.count}
          postprocessing={config.postprocessing}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: labActive ? VIGNETTE.lab : VIGNETTE.resting }}
      />
    </div>
  );
}
