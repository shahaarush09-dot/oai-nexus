"use client";

// A named entity inside a table: the name navigates to that entity's
// profile, and an adjacent button opens Ask Nexus for it.
//
// The Ask button is always rendered rather than revealed on hover. Hover
// doesn't exist on touch devices, so a hover-only affordance would be
// invisible and unreachable on phones and tablets — it stays low-contrast
// until hover or focus instead, which keeps the table quiet without
// hiding the feature from half the devices that load it.
export default function EntityCell({ name, onSelect, onAskNexus, title }) {
  if (!name) return <span className="text-slate-600">—</span>;
  return (
    <span className="group/cell inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onSelect ? () => onSelect(name) : undefined}
        title={title || name}
        className="-mx-1 rounded px-1 text-left transition-colors hover:bg-teal/10"
      >
        <span className="border-b border-dotted border-slate-600 text-slate-200 transition-colors group-hover/cell:border-teal group-hover/cell:text-teal">
          {name}
        </span>
      </button>

      {onAskNexus && (
        <button
          type="button"
          onClick={(e) => onAskNexus(name, e.currentTarget)}
          aria-label={`Ask Nexus about ${name}`}
          title={`Ask Nexus about ${name}`}
          className="shrink-0 rounded-full border border-navy-600 px-1.5 font-mono text-[9px] leading-[1.35] text-slate-600 opacity-60 transition-all hover:border-teal/60 hover:text-teal focus-visible:opacity-100 group-hover/cell:opacity-100"
        >
          ask
        </button>
      )}
    </span>
  );
}
