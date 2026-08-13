"use client";

import { useEffect, useRef, useState } from "react";
import { EXPLORE_COLUMNS } from "@/components/intelligence/exploreColumns";

// A plain-language definition for every column in the map.
//
// Without this the table asks people to trust numbers it never explains:
// "Match 100" and "Approved elsewhere: Yes" are the two most consequential
// values here and the two most easily misread — the first looks like a
// quality score, the second like an approval for the disease in the same
// row. Both readings are wrong, and a dataset that invites that is worse
// than one that says less.
export default function ColumnGuide() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded border border-navy-border bg-navy-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
      >
        ? What do these mean
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Column definitions"
          className="absolute right-0 z-50 mt-2 max-h-[26rem] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded border border-navy-border bg-navy-900 p-4 shadow-2xl shadow-black/60"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal">
            What each column means
          </p>
          <dl className="mt-3 space-y-3">
            {EXPLORE_COLUMNS.filter((c) => c.definition).map((c) => (
              <div key={c.accessor}>
                <dt className="text-xs font-medium text-slate-200">{c.header}</dt>
                <dd className="mt-0.5 text-xs font-light leading-relaxed text-slate-400">
                  {c.definition}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-navy-border pt-3 text-[11px] font-light leading-relaxed text-slate-500">
            Every row is a link between one disease, one company, and one
            product, drawn from a named source. A disease with many sponsors
            and many products produces many rows, so row counts measure
            links, not distinct drugs.
          </p>
        </div>
      )}
    </div>
  );
}
