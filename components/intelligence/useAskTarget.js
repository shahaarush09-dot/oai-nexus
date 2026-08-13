"use client";

import { useCallback, useState } from "react";

// Shared Ask Nexus popover target for the detail views. Each detail
// component owns one instance; the popover anchors to the button that was
// clicked, matching how the Explore table already positions it.
export function useAskTarget() {
  const [askTarget, setAskTarget] = useState(null);

  const openAsk = useCallback((entity, name, el) => {
    const rect = el.getBoundingClientRect();
    setAskTarget({ entity, name, x: rect.left, y: rect.bottom + 6 });
  }, []);

  const closeAsk = useCallback(() => setAskTarget(null), []);

  return { askTarget, openAsk, closeAsk };
}
