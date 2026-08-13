"use client";

import { useEffect, useState } from "react";

// Makes the URL-synced view discoverable.
//
// The address bar already carries the current filters, grouping, and
// columns, but nobody thinks to look there — so a view that is technically
// shareable stays practically unshareable. This is the affordance that
// tells people the thing they just built is a link.
export default function CopyViewLink({ rowCount }) {
  // idle | copied | failed
  const [state, setState] = useState("idle");
  const copied = state === "copied";

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 3500);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      return;
    } catch {
      // Clipboard writes are refused on insecure origins and when the
      // document doesn't hold focus. Fall through to the legacy path.
    }
    try {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand?.("copy");
      document.body.removeChild(input);
      setState(ok ? "copied" : "failed");
    } catch {
      setState("failed");
    }
    // "failed" is a real state with its own label rather than a silent
    // no-op: a button that looks dead is worse than one that tells you to
    // copy from the address bar, where the link already is.
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy a link to this exact view, including every active filter and grouping"
      className="flex items-center gap-1.5 rounded border border-navy-border bg-navy-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
    >
      {copied ? (
        <span className="text-teal">Link copied</span>
      ) : state === "failed" ? (
        <span className="text-gold-light">Copy from address bar</span>
      ) : (
        <>
          ⧉ Copy link
          {typeof rowCount === "number" && (
            <span className="text-slate-600">{rowCount.toLocaleString("en-US")}</span>
          )}
        </>
      )}
    </button>
  );
}
