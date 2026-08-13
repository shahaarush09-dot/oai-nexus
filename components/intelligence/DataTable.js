"use client";

import { useMemo, useState } from "react";

const INITIAL_ROWS = 50;

// Sortable table for the detail views. Deliberately plain React rather
// than TanStack + virtualization: the biggest detail view in the dataset
// is ~820 rows and starts capped at 50, so there's nothing here that
// virtualization would rescue. The Explore tab (Phase 4) filters across
// all 63,433 rows at once and is where that machinery actually earns its
// weight.
//
// columns: [{ key, header, align, sortValue?, render? }]
export default function DataTable({ columns, rows, emptyMessage = "No rows." }) {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const value = column.sortValue || ((row) => row[column.key]);
    // Copy before sorting — these arrays come straight from the memoized
    // map indexes, and sorting in place would quietly reorder the shared
    // cache for every other view reading the same bucket.
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      // Missing values sort last in both directions; a column of dashes
      // floating to the top is never what someone sorting wants.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const visible = expanded ? sorted : sorted.slice(0, INITIAL_ROWS);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  if (!rows.length) {
    return <p className="py-6 text-sm font-light text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-navy-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`py-2 pr-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-teal"
                    aria-label={`Sort by ${c.header}`}
                  >
                    {c.header}
                    <span className={sort.key === c.key ? "text-teal" : "text-navy-500"}>
                      {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "◆"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.id ?? i}
                className="border-b border-navy-border/50 transition-colors hover:bg-navy-800/60"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2 pr-4 align-top ${
                      c.align === "right"
                        ? "text-right tabular-nums text-slate-300"
                        : "text-slate-300"
                    }`}
                  >
                    {c.render ? c.render(row) : row[c.key] ?? <span className="text-slate-600">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > INITIAL_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-teal transition-opacity hover:opacity-70"
        >
          {expanded
            ? `Show first ${INITIAL_ROWS}`
            : `Show all ${sorted.length.toLocaleString("en-US")}`}
        </button>
      )}
    </div>
  );
}
