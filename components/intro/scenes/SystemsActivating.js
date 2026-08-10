"use client";

// Scene 3 — "Three Systems Activating" (scroll progress 0.35 - 0.75). The
// core "machines coming out" moment: Patient, Clinical, and Diligence each
// assemble in turn from scattered pieces, using the exact same visual
// language as Scene 2 — teal circuit-drawn lines (stroke-dasharray reveal)
// and the same 4-corner bracket shape used for the viewport HUD corners —
// so this doesn't read as a different intro bolted on. Each module gets its
// own accent color pulled straight from the site's existing module palette
// (Patient=teal, Clinical=clinicalblue, Diligence=gold) rather than
// inventing new colors. CinematicIntro drives the actual reveal via
// registerRef/registerArrayRef; this component only lays out the DOM.

const BRACKET_ARM = 20;

// Four L-shaped corner brackets (8 line segments) around a hw x hh box,
// centered on the module's local origin — the same visual unit as Scene 2's
// viewport corner brackets, just scaled down and mirrored per corner.
function cornerBracketLines(hw, hh, arm = BRACKET_ARM) {
  const corners = [
    { sx: -1, sy: -1 }, // top-left
    { sx: 1, sy: -1 }, // top-right
    { sx: -1, sy: 1 }, // bottom-left
    { sx: 1, sy: 1 }, // bottom-right
  ];
  const lines = [];
  for (const { sx, sy } of corners) {
    const x = sx * hw;
    const y = sy * hh;
    lines.push({ x1: x, y1: y, x2: x - sx * arm, y2: y });
    lines.push({ x1: x, y1: y, x2: x, y2: y - sy * arm });
  }
  return lines;
}

const PATIENT_BRACKETS = cornerBracketLines(110, 55);
const PATIENT_PATH = "M -90 0 L -40 0 L -25 -35 L -8 25 L 8 -15 L 25 0 L 90 0";

// Double-helix silhouette: both strands share start/end points at the
// vertical center (x=0) and bow to opposite sides between them, crossing at
// top, middle, and bottom — the classic "twisted ladder" outline, legible
// as DNA at a glance rather than reading as a diamond/lattice.
const CLINICAL_BRACKETS = cornerBracketLines(55, 90);
const CLINICAL_STRAND_A = "M 0 -80 C 34 -62, 34 -18, 0 0 C -34 18, -34 62, 0 80";
const CLINICAL_STRAND_B = "M 0 -80 C -34 -62, -34 -18, 0 0 C 34 18, 34 62, 0 80";
const CLINICAL_RUNGS = [
  { x1: -26, y1: -40, x2: 26, y2: -40 },
  { x1: -26, y1: 40, x2: 26, y2: 40 },
];

const DILIGENCE_BRACKETS = cornerBracketLines(95, 70);
const DILIGENCE_BARS = [
  { x: -70, w: 22, h: 25 },
  { x: -35, w: 22, h: 40 },
  { x: 0, w: 22, h: 55 },
  { x: 35, w: 22, h: 70 },
  { x: 70, w: 22, h: 85 },
];
const DILIGENCE_BASELINE_Y = 40;

const MODULES = [
  { key: "patient", x: 340, y: 580, color: "#2a9d8f", label: "PATIENT NEXUS // ONLINE" },
  { key: "clinical", x: 800, y: 580, color: "#3b6fd6", label: "CLINICAL NEXUS // ONLINE" },
  { key: "diligence", x: 1420, y: 580, color: "#c8a24a", label: "NEXUS DILIGENCE // ONLINE" },
];

export default function SystemsActivating({ registerRef, registerArrayRef }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {MODULES.map((m) => (
        <g key={m.key} ref={(el) => registerRef(`${m.key}Group`, el)} transform={`translate(${m.x} ${m.y})`}>
          <circle
            ref={(el) => registerRef(`${m.key}Glow`, el)}
            r="70"
            fill={m.color}
            opacity="0"
          />

          {(m.key === "patient" ? PATIENT_BRACKETS : m.key === "clinical" ? CLINICAL_BRACKETS : DILIGENCE_BRACKETS).map(
            (b, i) => (
              <line
                key={i}
                ref={(el) => registerArrayRef(`${m.key}Brackets`, i, el)}
                x1={b.x1}
                y1={b.y1}
                x2={b.x2}
                y2={b.y2}
                stroke={m.color}
                strokeWidth="2"
                opacity="0"
              />
            )
          )}

          {m.key === "patient" && (
            <path
              ref={(el) => registerRef("patientPath", el)}
              d={PATIENT_PATH}
              fill="none"
              stroke={m.color}
              strokeWidth="2"
              strokeDasharray="320"
              strokeDashoffset="320"
            />
          )}

          {m.key === "clinical" && (
            <>
              <path
                ref={(el) => registerArrayRef("clinicalPaths", 0, el)}
                d={CLINICAL_STRAND_A}
                fill="none"
                stroke={m.color}
                strokeWidth="2"
                strokeDasharray="280"
                strokeDashoffset="280"
              />
              <path
                ref={(el) => registerArrayRef("clinicalPaths", 1, el)}
                d={CLINICAL_STRAND_B}
                fill="none"
                stroke={m.color}
                strokeWidth="2"
                strokeDasharray="280"
                strokeDashoffset="280"
              />
              {CLINICAL_RUNGS.map((r, i) => (
                <line
                  key={i}
                  ref={(el) => registerArrayRef("clinicalRungs", i, el)}
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  stroke={m.color}
                  strokeWidth="1.5"
                  opacity="0"
                />
              ))}
            </>
          )}

          {m.key === "diligence" &&
            DILIGENCE_BARS.map((bar, i) => (
              <rect
                key={i}
                ref={(el) => registerArrayRef("diligenceBars", i, el)}
                x={bar.x}
                y={DILIGENCE_BASELINE_Y - bar.h}
                width={bar.w}
                height={bar.h}
                fill={m.color}
                opacity="0"
              />
            ))}

          <text
            ref={(el) => registerRef(`${m.key}Label`, el)}
            y="112"
            textAnchor="middle"
            fontFamily="var(--font-plex), monospace"
            fontSize="10"
            letterSpacing="2"
            fill={m.color}
            opacity="0"
          >
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
