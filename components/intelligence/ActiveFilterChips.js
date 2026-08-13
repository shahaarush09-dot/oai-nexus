"use client";

import { MATCH_SCORE_MIN } from "@/lib/exploreFilters";

// Every active filter as a removable tag. The point is that the view a
// user has built is always fully legible in one glance — no filter can be
// silently in effect three collapsed accordion sections up the sidebar,
// and any single one can be dropped without resetting the whole thing.
export default function ActiveFilterChips({ filters, setFilters, onReset }) {
  const chips = [];

  const addSet = (key, label) => {
    for (const value of filters[key]) {
      chips.push({
        id: `${key}:${value}`,
        label: `${label}: ${value.replace(/_/g, " ")}`,
        remove: () =>
          setFilters((f) => {
            const next = new Set(f[key]);
            next.delete(value);
            return { ...f, [key]: next };
          }),
      });
    }
  };

  addSet("stages", "Stage");
  addSet("categories", "Category");
  addSet("sources", "Source");
  addSet("trialStatuses", "Trial");
  addSet("approvedElsewhere", "Approved elsewhere");

  if (filters.text.trim()) {
    chips.push({
      id: "text",
      label: `Search: “${filters.text.trim()}”`,
      remove: () => setFilters((f) => ({ ...f, text: "" })),
    });
  }

  if (filters.minMatchScore > MATCH_SCORE_MIN) {
    chips.push({
      id: "score",
      label: `Match ≥ ${filters.minMatchScore}`,
      remove: () => setFilters((f) => ({ ...f, minMatchScore: MATCH_SCORE_MIN })),
    });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.remove}
          className="group inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-1 text-[11px] text-teal transition-colors hover:border-teal/60 hover:bg-teal/20"
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <span className="text-teal/60 transition-colors group-hover:text-teal">×</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-teal"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
