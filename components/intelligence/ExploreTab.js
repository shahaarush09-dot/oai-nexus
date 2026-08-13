"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FilterPanel from "@/components/intelligence/FilterPanel";
import ActiveFilterChips from "@/components/intelligence/ActiveFilterChips";
import ColumnMenu from "@/components/intelligence/ColumnMenu";
import ColumnGuide from "@/components/intelligence/ColumnGuide";
import CopyViewLink from "@/components/intelligence/CopyViewLink";
import ExploreTable from "@/components/intelligence/ExploreTable";
import AskNexusPopover from "@/components/intelligence/AskNexusPopover";
import { DEFAULT_VISIBLE, EXPLORE_COLUMNS } from "@/components/intelligence/exploreColumns";
import { useMapData } from "@/components/intelligence/useMapData";
import {
  applyFilters,
  buildSearchIndex,
  downloadCsv,
  emptyFilters,
  GROUP_BY_OPTIONS,
  toCsv,
} from "@/lib/exploreFilters";

const TEXT_DEBOUNCE_MS = 150;

// One-click starting points. Not a replacement for the filter panel —
// they set exactly the same state the checkboxes do, so anything a preset
// applies can be adjusted or removed chip by chip afterwards.
const PRESETS = [
  { label: "Approved only", apply: (f) => ({ ...f, stages: new Set(["Approved"]) }) },
  {
    label: "Phase 3+",
    apply: (f) => ({
      ...f,
      stages: new Set(["Approved", "Phase 4", "Phase 3", "Phase 2/Phase 3"]),
    }),
  },
  {
    label: "Orphan designated",
    apply: (f) => ({ ...f, stages: new Set(["Orphan Designated"]) }),
  },
  {
    label: "Recruiting trials",
    apply: (f) => ({ ...f, trialStatuses: new Set(["RECRUITING"]) }),
  },
];

export default function ExploreTab({ onNavigate, initialFilters, initialView, onStateChange }) {
  const { data: map, loading, error } = useMapData();

  const [filters, setFilters] = useState(() => ({
    ...emptyFilters(),
    ...initialView?.filters,
    ...initialFilters,
  }));
  const [debouncedText, setDebouncedText] = useState(filters.text);
  const [groupBy, setGroupBy] = useState(initialView?.groupBy || "none");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [visible, setVisible] = useState(initialView?.visible || DEFAULT_VISIBLE);
  const [sorting, setSorting] = useState([]);
  const [askTarget, setAskTarget] = useState(null);
  const [exportNote, setExportNote] = useState(null);
  // Mobile only — from lg up the sidebar is always shown and this is ignored.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Only the free-text box is debounced. Checkboxes, toggles, the slider,
  // and the group-by dropdown all commit immediately — they're discrete
  // actions, and making a click feel 150ms late is exactly the friction
  // this tab exists to avoid.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(filters.text), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.text]);

  // Publishes the view upward so the page can mirror it into the URL.
  // Debounced text is deliberately not used here — the URL should reflect
  // what's typed, not lag a beat behind it.
  useEffect(() => {
    onStateChange?.({ filters, groupBy, visible, defaultVisible: DEFAULT_VISIBLE });
  }, [filters, groupBy, visible, onStateChange]);

  // Built once per dataset, not per keystroke.
  const haystack = useMemo(
    () => (map ? buildSearchIndex(map.rows) : null),
    [map]
  );

  const categories = useMemo(() => {
    if (!map) return [];
    return [...new Set(map.rows.map((r) => r.category).filter(Boolean))].sort();
  }, [map]);

  const filtered = useMemo(() => {
    if (!map || !haystack) return [];
    return applyFilters(map.rows, haystack, { ...filters, text: debouncedText });
  }, [map, haystack, filters, debouncedText]);

  // Drives the count on the mobile Filters button, so a collapsed panel
  // still says how much is being filtered out.
  const activeFilterCount = useMemo(() => {
    const sets =
      filters.stages.size +
      filters.categories.size +
      filters.sources.size +
      filters.trialStatuses.size +
      filters.approvedElsewhere.size;
    return sets + (filters.text.trim() ? 1 : 0) + (filters.minMatchScore > 88 ? 1 : 0);
  }, [filters]);

  // Switching group-by must not strand collapse state from the previous
  // grouping — those keys refer to a different set of groups entirely.
  useEffect(() => {
    setCollapsed(new Set());
  }, [groupBy]);

  const toggleGroup = useCallback((key) => {
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleEntityClick = useCallback((entity, name, el) => {
    const rect = el.getBoundingClientRect();
    setAskTarget({ entity, name, x: rect.left, y: rect.bottom + 6 });
  }, []);

  function handleExport() {
    const cols = EXPLORE_COLUMNS.filter((c) => visible.includes(c.accessor));
    const csv = toCsv(filtered, cols, groupBy);
    downloadCsv(csv, `nexus-intelligence-${Date.now()}.csv`);
    setExportNote(`${filtered.length.toLocaleString("en-US")} rows exported`);
  }

  useEffect(() => {
    if (!exportNote) return;
    const timer = setTimeout(() => setExportNote(null), 4000);
    return () => clearTimeout(timer);
  }, [exportNote]);

  if (loading || error) {
    return (
      <p className="py-20 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {error
          ? "Could not load the map."
          : "Loading the disease-company-product map…"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Sits above the panel it controls so opening it pushes content
          downward rather than displacing the button itself. Hidden from lg
          up, where the sidebar is always on screen. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((o) => !o)}
        aria-expanded={filtersOpen}
        aria-controls="explore-filters"
        className="flex w-full items-center justify-center gap-2 rounded border border-navy-border bg-navy-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300 transition-colors hover:border-teal/40 hover:text-teal lg:hidden"
      >
        {filtersOpen ? "Hide filters" : "Show filters"}
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-teal/20 px-1.5 text-teal">{activeFilterCount}</span>
        )}
      </button>

      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        resultCount={filtered.length}
        open={filtersOpen}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Group by
            </span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="rounded border border-navy-border bg-navy-900 px-2 py-1.5 text-xs text-white focus:border-teal/50 focus:outline-none"
            >
              {GROUP_BY_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <ColumnMenu visible={visible} setVisible={setVisible} />

          <ColumnGuide />

          <CopyViewLink rowCount={filtered.length} />

          <button
            type="button"
            onClick={handleExport}
            disabled={!filtered.length}
            className="rounded border border-navy-border bg-navy-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↓ CSV
          </button>

          {exportNote && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-teal">
              {exportNote}
            </span>
          )}

          <span className="ml-auto font-mono text-[11px] text-slate-400">
            <span className="text-teal">{filtered.length.toLocaleString("en-US")}</span>
            <span className="text-slate-600">
              {" "}
              / {map.rows.length.toLocaleString("en-US")} rows
            </span>
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setFilters((f) => p.apply(f))}
              className="rounded-full border border-navy-border px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <ActiveFilterChips
            filters={filters}
            setFilters={setFilters}
            onReset={() => setFilters(emptyFilters())}
          />
        </div>

        <div className="mt-4">
          <ExploreTable
            rows={filtered}
            visible={visible}
            sorting={sorting}
            setSorting={setSorting}
            groupBy={groupBy}
            collapsed={collapsed}
            onToggleGroup={toggleGroup}
            onEntityClick={handleEntityClick}
          />
        </div>
      </div>

      <AskNexusPopover
        target={askTarget}
        onClose={() => setAskTarget(null)}
        onOpenDetail={onNavigate}
      />
    </div>
  );
}
