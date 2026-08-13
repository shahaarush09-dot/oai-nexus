// Development-stage badge. Keys match the vocabulary in lib/stages.js —
// anything unrecognized falls through to the neutral style rather than
// rendering unstyled.
//
// Colour carries meaning here: green reads as "on the market", the blue
// ramp darkens as trials get earlier, and the non-trial states (orphan
// designation, unknown) sit outside that ramp in gold and grey so they're
// never mistaken for a phase.
const STAGE_STYLES = {
  Approved: "bg-teal/15 text-teal border-teal/30",
  "Phase 4": "bg-clinicalblue/15 text-clinicalblue border-clinicalblue/30",
  "Phase 3": "bg-clinicalblue/15 text-clinicalblue border-clinicalblue/30",
  "Phase 2/Phase 3": "bg-clinicalblue/10 text-clinicalblue/90 border-clinicalblue/25",
  "Phase 2": "bg-clinicalblue/10 text-clinicalblue/80 border-clinicalblue/20",
  "Phase 1/Phase 2": "bg-navy-600/60 text-slate-300 border-navy-500",
  "Phase 1": "bg-navy-600/60 text-slate-300 border-navy-500",
  "Early Phase 1": "bg-navy-600/40 text-slate-400 border-navy-500",
  "Orphan Designated": "bg-gold/10 text-gold-light border-gold/25",
  Unknown: "bg-navy-700 text-slate-500 border-navy-600",
};

const NEUTRAL = "bg-navy-700 text-slate-500 border-navy-600";

export default function StageBadge({ stage, className = "" }) {
  if (!stage) return <span className="text-slate-600">—</span>;
  const style = STAGE_STYLES[stage] || NEUTRAL;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${style} ${className}`}
    >
      {stage}
    </span>
  );
}
