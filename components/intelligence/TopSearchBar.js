"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SEARCH_MODES } from "@/lib/fuzzySearch";
import { useEntitySearch, useListKeyboard } from "@/components/intelligence/useEntitySearch";
import { track } from "@/lib/trackIntelligence";

const MODE_ORDER = ["drug", "disease", "company"];

// The persistent command-palette-style search. Mounted once by
// IntelligencePageClient above the tab bar — never inside a tab — so it
// survives every tab switch and detail-view navigation with its query
// intact. Tabs get their own dropdown for direct entry; this one is
// always there.
export default function TopSearchBar({ mode, onModeChange, data, onSelect, focusToken }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const modeConfig = SEARCH_MODES[mode];
  const records = data?.[modeConfig.dataset];
  const { results } = useEntitySearch(mode, records, query);

  function choose(item) {
    // The chosen name is safe to record — it can only be a value already
    // published in the dataset, never whatever was typed.
    track("search_select", {
      mode,
      entity: item[modeConfig.nameField],
    });
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onSelect(mode, item);
  }

  const { active, setActive, onKeyDown } = useListKeyboard(results, choose, () =>
    setOpen(false)
  );

  // One `search` event per completed query rather than per keystroke —
  // 500ms is longer than the 150ms result debounce on purpose, so typing
  // "cdkl5" records one search and not five. Only the mode is recorded;
  // the typed string is never sent.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => track("search", { mode }), 500);
    return () => clearTimeout(timer);
  }, [query, mode]);

  // The Overview cards focus this input by bumping a token rather than
  // reaching in through a ref, which keeps the parent from needing a
  // handle on this component's DOM.
  useEffect(() => {
    if (!focusToken) return;
    // Not on touch: focusing an input on arrival raises the on-screen
    // keyboard over the very content the user just navigated to.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    inputRef.current?.focus();
  }, [focusToken]);

  // Cmd/Ctrl+K from anywhere on the page, the shortcut people already
  // expect from a bar that looks like this.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dismiss on outside click. Pointerdown rather than click so the
  // dropdown closes on press, before a stray selection can register.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Segmented control — one click to switch what you're searching,
            never a dropdown hunt. */}
        <div
          role="tablist"
          aria-label="Search mode"
          className="flex shrink-0 rounded border border-navy-border bg-navy-900 p-0.5"
        >
          {MODE_ORDER.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              type="button"
              onClick={() => {
                onModeChange(key);
                inputRef.current?.focus();
              }}
              className={`rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                mode === key
                  ? "bg-teal/15 text-teal"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {SEARCH_MODES[key].label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={
              records
                ? `Search ${modeConfig.label.toLowerCase()}…`
                : "Loading index…"
            }
            disabled={!records}
            aria-label={`Search by ${modeConfig.label}`}
            className="w-full rounded border border-navy-border bg-navy-900 px-3 py-2 pr-14 text-sm text-white placeholder:text-slate-600 focus:border-teal/50 focus:outline-none disabled:opacity-50"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] text-slate-400 sm:block">
            ⌘K
          </kbd>
        </div>
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded border border-navy-border bg-navy-900 shadow-2xl shadow-black/50"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm font-light text-slate-500">
                No {modeConfig.label.toLowerCase()} matches “{query}”.
              </li>
            ) : (
              results.map((item, i) => (
                <li key={item.id ?? i}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-teal/10" : "hover:bg-navy-800"
                    }`}
                  >
                    <span className="truncate text-sm text-slate-200">
                      {item[modeConfig.nameField]}
                    </span>
                    <ResultMeta mode={mode} item={item} />
                  </button>
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// The one line of context that makes a result list scannable — without
// it, a dozen similarly-named diseases are indistinguishable.
function ResultMeta({ mode, item }) {
  const text =
    mode === "disease"
      ? item.category
      : mode === "company"
      ? `${item.productCount?.toLocaleString("en-US") ?? 0} rare disease products`
      : item.developmentStage;
  if (!text) return null;
  return (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
      {text}
    </span>
  );
}
