"use client";

import { useMemo, useState } from "react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const OTHER = "#";
const PAGE = 300;

// A-Z browse for someone who doesn't have a specific name in mind, in the
// spirit of NORD's own index. Bucketing runs once per dataset and is
// memoized: re-partitioning 23,883 products on every letter click would
// make the alphabet feel sticky.
//
// "#" collects everything that doesn't start with a letter — gene symbols,
// numeric codes, and the many products whose names begin with a digit.
// Without it those records are unreachable by browsing at all.
export default function AlphabetBrowse({ records, nameField, onSelect, metaField }) {
  const [letter, setLetter] = useState("A");
  const [limit, setLimit] = useState(PAGE);

  const buckets = useMemo(() => {
    const map = new Map();
    for (const r of records || []) {
      const name = r[nameField];
      if (!name) continue;
      const first = name.trim().charAt(0).toUpperCase();
      const key = first >= "A" && first <= "Z" ? first : OTHER;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a[nameField].localeCompare(b[nameField]));
    }
    return map;
  }, [records, nameField]);

  const current = buckets.get(letter) || [];

  function pick(next) {
    setLetter(next);
    setLimit(PAGE);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {[...LETTERS, OTHER].map((l) => {
          const count = buckets.get(l)?.length || 0;
          return (
            <button
              key={l}
              type="button"
              disabled={!count}
              onClick={() => pick(l)}
              className={`h-7 w-7 rounded font-mono text-[11px] transition-colors ${
                letter === l
                  ? "bg-teal/20 text-teal"
                  : count
                  ? "text-slate-400 hover:bg-navy-800 hover:text-slate-200"
                  : "cursor-not-allowed text-navy-600"
              }`}
              title={count ? `${count.toLocaleString("en-US")} entries` : "None"}
            >
              {l}
            </button>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {current.length.toLocaleString("en-US")} under “{letter}”
      </p>

      <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {current.slice(0, limit).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="w-full truncate rounded px-2 py-1 text-left text-sm text-slate-300 transition-colors hover:bg-teal/10 hover:text-teal"
              title={r[nameField]}
            >
              {r[nameField]}
              {metaField && r[metaField] != null && (
                <span className="ml-2 font-mono text-[10px] text-slate-600">
                  {typeof r[metaField] === "number"
                    ? r[metaField].toLocaleString("en-US")
                    : r[metaField]}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {current.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-teal transition-opacity hover:opacity-70"
        >
          Show {Math.min(PAGE, current.length - limit).toLocaleString("en-US")} more
        </button>
      )}
    </div>
  );
}
