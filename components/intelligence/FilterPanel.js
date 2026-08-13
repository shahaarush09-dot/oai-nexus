"use client";

import { useState } from "react";
import { STAGE_ORDER } from "@/lib/stages";
import {
  APPROVED_ELSEWHERE_OPTIONS,
  MATCH_SCORE_MAX,
  MATCH_SCORE_MIN,
  SOURCE_OPTIONS,
  TRIAL_STATUS_OPTIONS,
} from "@/lib/exploreFilters";

// Persistent filter sidebar. Every control here writes straight to state
// with no "apply" step — checkboxes and toggles commit on click, and only
// the text box is debounced (upstream, in ExploreTab).
export default function FilterPanel({
  filters,
  setFilters,
  categories,
  resultCount,
  open,
}) {
  function toggleSet(key, value) {
    setFilters((f) => {
      const next = new Set(f[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, [key]: next };
    });
  }

  return (
    // Below lg the panel is collapsed by default and toggled from the
    // results header. Left expanded, its ~620px of controls push the table
    // entirely below the fold on a phone, so arriving at Explore shows a
    // wall of checkboxes and no data at all. Always visible from lg up,
    // where there's room for the sidebar beside the table.
    <aside
      id="explore-filters"
      className={`w-full shrink-0 lg:block lg:w-64 ${open ? "block" : "hidden"}`}
    >
      <div className="lg:sticky lg:top-[210px] lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto lg:pr-2">
        <FilterGroup label="Search" defaultOpen>
          <input
            type="text"
            value={filters.text}
            onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
            placeholder="Disease, company, or product…"
            aria-label="Search across disease, company, and product names"
            className="w-full rounded border border-navy-border bg-navy-900 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-teal/50 focus:outline-none"
          />
        </FilterGroup>

        <FilterGroup label="Development stage" count={filters.stages.size} defaultOpen>
          {STAGE_ORDER.map((stage) => (
            <CheckRow
              key={stage}
              label={stage}
              checked={filters.stages.has(stage)}
              onChange={() => toggleSet("stages", stage)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Disease category" count={filters.categories.size}>
          {categories.map((cat) => (
            <CheckRow
              key={cat}
              label={cat}
              checked={filters.categories.has(cat)}
              onChange={() => toggleSet("categories", cat)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Source" count={filters.sources.size}>
          {SOURCE_OPTIONS.map((s) => (
            <CheckRow
              key={s}
              label={s}
              checked={filters.sources.has(s)}
              onChange={() => toggleSet("sources", s)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Trial status" count={filters.trialStatuses.size}>
          {TRIAL_STATUS_OPTIONS.map((s) => (
            <CheckRow
              key={s}
              label={s.replace(/_/g, " ")}
              checked={filters.trialStatuses.has(s)}
              onChange={() => toggleSet("trialStatuses", s)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Approved elsewhere" count={filters.approvedElsewhere.size}>
          {APPROVED_ELSEWHERE_OPTIONS.map((v) => (
            <CheckRow
              key={v}
              label={v}
              checked={filters.approvedElsewhere.has(v)}
              onChange={() => toggleSet("approvedElsewhere", v)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Match confidence" defaultOpen>
          <input
            type="range"
            min={MATCH_SCORE_MIN}
            max={MATCH_SCORE_MAX}
            step={1}
            value={filters.minMatchScore}
            onChange={(e) =>
              setFilters((f) => ({ ...f, minMatchScore: Number(e.target.value) }))
            }
            aria-label="Minimum match score"
            className="w-full accent-teal"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
            <span>≥ {filters.minMatchScore}</span>
            <span>{resultCount.toLocaleString("en-US")} rows</span>
          </div>
          {/* Nearly every row scores a perfect 100, so without this the
              slider looks broken until it's dragged most of the way up. */}
          <p className="mt-2 text-[10px] font-light leading-snug text-slate-600">
            96% of rows score 100. Scores run 88–100.
          </p>
        </FilterGroup>
      </div>
    </aside>
  );
}

function FilterGroup({ label, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-navy-border py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-teal"
      >
        <span>
          {label}
          {count > 0 && <span className="ml-1.5 text-teal">{count}</span>}
        </span>
        <span className="text-navy-500">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-2.5 space-y-1.5">{children}</div>}
    </div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300 transition-colors hover:text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3 w-3 shrink-0 accent-teal"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}
