"use client";

// Scene 2 — "Power On" (scroll progress 0.15 - 0.35). Light travels along
// the dormant machinery's circuits, HUD targeting brackets snap into the
// viewport corners, small technical readouts flicker on, and the OAI Nexus
// wordmark reveals. Every element here starts hidden/collapsed — the actual
// reveal tweens live in CinematicIntro's scroll-scrubbed timeline, which
// reads these elements via registerRef/registerArrayRef.
const CIRCUIT_PATHS = [
  "M 200 800 L 200 520 L 420 520",
  "M 1400 780 L 1400 500 L 1180 500",
  "M 762 840 L 762 660",
];

const BRACKETS = [
  { pos: "top-6 left-6", border: "border-l-2 border-t-2" },
  { pos: "top-6 right-6", border: "border-r-2 border-t-2" },
  { pos: "bottom-6 left-6", border: "border-l-2 border-b-2" },
  { pos: "bottom-6 right-6", border: "border-r-2 border-b-2" },
];

const READOUTS = [
  { pos: "left-[8%] top-[24%]", text: "SYS.CORE // 0x4F2A" },
  { pos: "right-[9%] top-[32%]", text: "PWR.LEVEL // 68%" },
  { pos: "left-[11%] bottom-[28%]", text: "NET.LINK // ACTIVE" },
];

export default function PowerOn({ registerRef, registerArrayRef }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {CIRCUIT_PATHS.map((d, i) => (
          <path
            key={d}
            ref={(el) => registerArrayRef("circuits", i, el)}
            d={d}
            fill="none"
            stroke="#2a9d8f"
            strokeWidth="1.5"
            strokeDasharray="500"
            strokeDashoffset="500"
            opacity="0.75"
          />
        ))}
      </svg>

      {BRACKETS.map((b, i) => (
        <span
          key={b.pos}
          ref={(el) => registerArrayRef("brackets", i, el)}
          className={`absolute h-8 w-8 border-teal/60 opacity-0 ${b.pos} ${b.border}`}
          aria-hidden="true"
        />
      ))}

      {READOUTS.map((r, i) => (
        <p
          key={r.text}
          ref={(el) => registerArrayRef("readouts", i, el)}
          className={`absolute whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.2em] text-teal/70 opacity-0 ${r.pos}`}
        >
          {r.text}
        </p>
      ))}

      <div className="absolute inset-0 flex items-center justify-center">
        <h1
          ref={(el) => registerRef("wordmark", el)}
          className="font-serif text-4xl font-medium tracking-tight text-white sm:text-5xl"
        >
          OAI Nexus
        </h1>
      </div>
    </div>
  );
}
