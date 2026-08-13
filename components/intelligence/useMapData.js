"use client";

import { useEffect, useState } from "react";
import { loadMapData } from "@/lib/loadIntelligenceData";

// Lazy access to the disease-company-product map. Mounting a detail view
// is what triggers the ~2MB (gzipped) fetch; the loader memoizes, so only
// the first detail view of a session actually waits, and every one after
// resolves from cache on the same tick.
export function useMapData(enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => (s.data ? s : { data: null, loading: true, error: null }));
    loadMapData()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
