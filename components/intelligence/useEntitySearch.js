"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchEntities } from "@/lib/fuzzySearch";

const DEBOUNCE_MS = 150;

// Debounced fuzzy search shared by the persistent top bar and the in-tab
// dropdowns, so a query behaves the same wherever it's typed.
//
// Only the query is debounced. Switching mode (Drug/Disease/Company) or
// the underlying records arriving re-runs immediately: those are discrete
// events, not a keystroke stream, and making a mode toggle feel 150ms
// laggy is exactly the friction this page is supposed to avoid.
export function useEntitySearch(modeKey, records, query, limit = 8) {
  const [debounced, setDebounced] = useState(query);
  const firstRun = useRef(true);

  useEffect(() => {
    // Don't sit on the opening render — a query restored from a parent
    // (say, a mode switch that keeps the text) should resolve at once.
    if (firstRun.current) {
      firstRun.current = false;
      setDebounced(query);
      return;
    }
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => searchEntities(modeKey, records, debounced, limit),
    [modeKey, records, debounced, limit]
  );

  return {
    results,
    // True while the user has typed ahead of the debounce. Callers use it
    // to hold the previous result list steady instead of flashing "no
    // results" for a frame mid-keystroke.
    pending: debounced !== query,
  };
}

// Shared arrow/enter/escape handling for a result list. Kept here so the
// top bar and the in-tab dropdowns can't drift apart in how they behave.
export function useListKeyboard(results, onChoose, onDismiss) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [results]);

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) {
        e.preventDefault();
        onChoose(results[active]);
      }
    } else if (e.key === "Escape") {
      onDismiss?.();
    }
  }

  return { active, setActive, onKeyDown };
}
