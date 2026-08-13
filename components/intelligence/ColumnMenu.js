"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_VISIBLE, EXPLORE_COLUMNS } from "@/components/intelligence/exploreColumns";

// Gear menu for column visibility. Lets someone strip the table back to
// two columns or pull in every field the pipeline carries — the same view
// serving a quick scan and a detailed audit.
export default function ColumnMenu({ visible, setVisible }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(accessor) {
    setVisible((v) =>
      v.includes(accessor) ? v.filter((a) => a !== accessor) : [...v, accessor]
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Column visibility"
        className="flex items-center gap-1.5 rounded border border-navy-border bg-navy-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
      >
        ⚙ Columns
        <span className="text-teal">{visible.length}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded border border-navy-border bg-navy-900 p-2 shadow-2xl shadow-black/50">
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {EXPLORE_COLUMNS.map((c) => {
              const checked = visible.includes(c.accessor);
              // Blocking the last column keeps the grid from collapsing to
              // a zero-column template, which renders as an empty box with
              // no obvious way back.
              const isLast = checked && visible.length === 1;
              return (
                <label
                  key={c.accessor}
                  // The definition rides along as a title so the meaning of
                  // a column is available at the moment someone decides
                  // whether to show it, not buried in a separate help page.
                  title={c.definition}
                  className={`flex items-start gap-2 rounded px-2 py-1 text-xs transition-colors ${
                    isLast
                      ? "cursor-not-allowed text-slate-600"
                      : "cursor-pointer text-slate-300 hover:bg-navy-800 hover:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLast}
                    onChange={() => toggle(c.accessor)}
                    className="mt-0.5 h-3 w-3 shrink-0 accent-teal"
                  />
                  <span>{c.header}</span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setVisible(DEFAULT_VISIBLE)}
            className="mt-2 w-full border-t border-navy-border pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-teal"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
