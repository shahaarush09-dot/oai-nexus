"use client";

// Scene 1 — "Dormant Lab" (scroll progress 0 - 0.15). A dark, minimal
// environment: barely-visible angular machinery silhouettes and a single
// dormant light source. Purely a waiting state — CinematicIntro's timeline
// nudges the glow point and label to a faint "stirring" opacity across this
// range; nothing else here is scroll-tied, it's set dressing.
export default function DormantLab({ registerRef }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <polygon points="120,780 340,620 420,780" fill="#c8a24a" />
        <polygon points="1180,760 1420,560 1520,760" fill="#2a9d8f" />
        <rect x="70" y="150" width="230" height="7" fill="#8892a8" transform="rotate(-8 70 150)" />
        <rect x="1250" y="190" width="270" height="7" fill="#8892a8" transform="rotate(6 1250 190)" />
        <polygon points="700,840 762,700 832,840" fill="#3b6fd6" opacity="0.6" />
      </svg>

      <div
        ref={(el) => registerRef("glow", el)}
        className="absolute h-2 w-2 rounded-full bg-teal opacity-0"
        style={{ boxShadow: "0 0 24px 8px rgba(42,157,143,0.5)" }}
        aria-hidden="true"
      />

      <p
        ref={(el) => registerRef("dormantLabel", el)}
        className="absolute bottom-[18%] font-mono text-[10px] uppercase tracking-[0.4em] text-slate-600 opacity-0"
      >
        OAI NEXUS
      </p>
    </div>
  );
}
