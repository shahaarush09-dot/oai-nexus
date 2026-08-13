"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EXPLORE_COLUMNS } from "@/components/intelligence/exploreColumns";
import { flattenGroups, groupRows } from "@/lib/exploreFilters";

const ROW_HEIGHT = 34;
const GROUP_HEADER_HEIGHT = 36;
const VIEWPORT_HEIGHT = 620;

// The Explore results table.
//
// Rows are divs on a CSS grid rather than a real <table>: virtualization
// needs absolutely-positioned rows at computed offsets, which a table's
// layout algorithm won't allow. ARIA roles put the semantics back so it
// still reads as a table to assistive tech.
//
// TanStack Table owns the column model, sorting, and visibility; grouping
// and flattening are done here because they have to produce one flat,
// positionally-indexed array for the virtualizer — a nested row model
// can't be virtualized.
export default function ExploreTable({
  rows,
  visible,
  sorting,
  setSorting,
  groupBy,
  collapsed,
  onToggleGroup,
  onEntityClick,
}) {
  const scrollRef = useRef(null);

  const columns = useMemo(
    () =>
      EXPLORE_COLUMNS.map((c) => ({
        id: c.accessor,
        accessorKey: c.accessor,
        header: c.header,
        meta: c,
        // Stage must sort by clinical progress, not alphabetically —
        // otherwise "Approved" lands between "Phase 1" and "Phase 2".
        sortingFn: c.sortValue
          ? (a, b) => c.sortValue(a.original) - c.sortValue(b.original)
          : "auto",
      })),
    []
  );

  const columnVisibility = useMemo(
    () =>
      Object.fromEntries(
        EXPLORE_COLUMNS.map((c) => [c.accessor, visible.includes(c.accessor)])
      ),
    [visible]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = table.getRowModel().rows;

  // Sort first, then group: grouping a pre-sorted list keeps each group's
  // internal order consistent with whatever column the user sorted by.
  const flat = useMemo(() => {
    const originals = sortedRows.map((r) => r.original);
    if (groupBy === "none") {
      return originals.map((row) => ({ type: "row", row }));
    }
    return flattenGroups(groupRows(originals, groupBy), collapsed);
  }, [sortedRows, groupBy, collapsed]);

  // Changing the filters, the sort, or the grouping produces a different
  // result set, and holding scroll position across that drop the user
  // 40,000 rows into a list they didn't ask for. Collapse state is
  // deliberately excluded — expanding a group shouldn't yank the view
  // back to the top.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rows, groupBy, sorting]);

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) =>
      flat[i]?.type === "header" ? GROUP_HEADER_HEIGHT : ROW_HEIGHT,
    overscan: 12,
  });

  const headers = table.getHeaderGroups()[0].headers;
  const template = headers.map((h) => h.column.columnDef.meta.width).join(" ");

  if (!rows.length) {
    return (
      <div className="rounded border border-navy-border bg-navy-900/40 px-4 py-16 text-center">
        <p className="text-sm font-light text-slate-400">
          No rows match this combination of filters.
        </p>
        <p className="mt-1.5 text-xs font-light text-slate-600">
          Remove a filter chip above to widen the view.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-navy-border">
      <div className="overflow-x-auto">
        <div role="table" aria-rowcount={flat.length} style={{ minWidth: "fit-content" }}>
          <div
            role="row"
            className="grid border-b border-navy-border bg-navy-900"
            style={{ gridTemplateColumns: template }}
          >
            {headers.map((header) => {
              const meta = header.column.columnDef.meta;
              const dir = header.column.getIsSorted();
              return (
                <button
                  key={header.id}
                  role="columnheader"
                  type="button"
                  onClick={header.column.getToggleSortingHandler()}
                  title={meta.definition ? `${meta.header} — ${meta.definition}` : undefined}
                  aria-sort={
                    dir === "asc"
                      ? "ascending"
                      : dir === "desc"
                      ? "descending"
                      : "none"
                  }
                  className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors hover:text-teal ${
                    dir ? "text-teal" : "text-slate-500"
                  } ${meta.align === "right" ? "justify-end" : "justify-start"}`}
                >
                  <span className="truncate">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  <span className={dir ? "text-teal" : "text-navy-500"}>
                    {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "◆"}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{ height: VIEWPORT_HEIGHT }}
          >
            <div
              role="rowgroup"
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const entry = flat[item.index];
                return (
                  // No measureElement: both row heights are fixed and
                  // known, so dynamic measurement would only add a layout
                  // read per row for an answer estimateSize already has.
                  <div
                    key={item.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    {entry.type === "header" ? (
                      <GroupHeader
                        label={entry.key}
                        count={entry.count}
                        collapsed={collapsed.has(entry.key)}
                        onToggle={() => onToggleGroup(entry.key)}
                      />
                    ) : (
                      <DataRow
                        row={entry.row}
                        headers={headers}
                        template={template}
                        onEntityClick={onEntityClick}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ label, count, collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{ height: GROUP_HEADER_HEIGHT }}
      className="flex w-full items-center gap-2 border-b border-navy-border bg-navy-800/90 px-3 text-left transition-colors hover:bg-navy-700/90"
    >
      <span className="w-3 shrink-0 font-mono text-[10px] text-teal">
        {collapsed ? "▸" : "▾"}
      </span>
      <span className="truncate text-xs font-medium text-slate-200">{label}</span>
      <span className="shrink-0 font-mono text-[10px] text-slate-500">
        {count.toLocaleString("en-US")}
      </span>
    </button>
  );
}

function DataRow({ row, headers, template, onEntityClick }) {
  return (
    <div
      role="row"
      className="grid border-b border-navy-border/40 transition-colors hover:bg-navy-800/50"
      style={{ gridTemplateColumns: template, height: ROW_HEIGHT }}
    >
      {headers.map((header) => {
        const meta = header.column.columnDef.meta;
        const value = row[meta.accessor];
        return (
          <div
            key={header.id}
            role="cell"
            className={`flex items-center overflow-hidden px-3 text-xs ${
              meta.align === "right"
                ? "justify-end tabular-nums text-slate-300"
                : "text-slate-300"
            }`}
          >
            {meta.render ? (
              meta.render(row)
            ) : meta.entity && value ? (
              <button
                type="button"
                onClick={(e) => onEntityClick(meta.entity, value, e.currentTarget)}
                title={value}
                className="truncate border-b border-dotted border-slate-700 text-left transition-colors hover:border-teal hover:text-teal"
              >
                {value}
              </button>
            ) : (
              <span className="truncate" title={value == null ? "" : String(value)}>
                {value == null || value === "" ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  value
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
