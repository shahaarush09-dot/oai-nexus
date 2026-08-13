"use client";

import { useRef, useState } from "react";
import { SEARCH_MODES } from "@/lib/fuzzySearch";
import { useEntitySearch, useListKeyboard } from "@/components/intelligence/useEntitySearch";

// In-tab search. Redundant with the persistent top bar by design: someone
// who lands directly on the Diseases tab shouldn't have to notice the
// global bar and switch its mode before they can search. Same hook, same
// threshold, same debounce — so results are identical either way.
export default function SearchDropdown({ mode, records, onSelect, autoFocus }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const modeConfig = SEARCH_MODES[mode];
  const { results } = useEntitySearch(mode, records, query, 10);

  function choose(item) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onSelect(item);
  }

  const { active, setActive, onKeyDown } = useListKeyboard(results, choose, () =>
    setOpen(false)
  );

  return (
    <div className="relative max-w-xl">
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={records ? `Search ${modeConfig.label.toLowerCase()} by name…` : "Loading…"}
        disabled={!records}
        aria-label={`Search ${modeConfig.label}`}
        className="w-full rounded border border-navy-border bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-teal/50 focus:outline-none disabled:opacity-50"
      />
      {open && query.trim().length >= 2 && (
        <ul className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded border border-navy-border bg-navy-900 shadow-2xl shadow-black/50">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm font-light text-slate-500">
              No matches for “{query}”.
            </li>
          ) : (
            results.map((item, i) => (
              <li key={item.id ?? i}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(item)}
                  className={`w-full truncate px-3 py-2 text-left text-sm text-slate-200 transition-colors ${
                    i === active ? "bg-teal/10" : "hover:bg-navy-800"
                  }`}
                >
                  {item[modeConfig.nameField]}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
