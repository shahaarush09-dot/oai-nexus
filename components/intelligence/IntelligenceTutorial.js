"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { track } from "@/lib/trackIntelligence";

export const TUTORIAL_KEY = "intelligence-tutorial-completed";

// Steps point at real UI via data-tour attributes rather than CSS classes,
// so restyling a component can't silently break the tour. A step whose
// target isn't on screen still works — the callout just centers itself
// (see position()), which is what makes step 4 viable from the Overview
// tab, where no entity table exists to point at.
const STEPS = [
  {
    target: '[data-tour="search"]',
    title: "Search anything",
    body: "Search for any drug, disease, or company. Results appear instantly as you type — switch what you're searching with the toggle on the left.",
  },
  {
    target: '[data-tour="tab-diseases"]',
    title: "Open a full profile",
    body: "Click into any result to see its full profile: linked companies, products in development, and how mature the pipeline is.",
  },
  {
    target: '[data-tour="tab-explore"]',
    title: "Build your own view",
    body: "Combine filters and grouping to build custom views, then export exactly what you see as CSV. No Excel skills required.",
  },
  {
    target: null,
    title: "Ask Nexus",
    body: "Click any drug, company, or disease name in a table to see recent news and current status, drawn from sources like the FDA and ClinicalTrials.gov.",
  },
];

const CALLOUT_W = 300;
const GAP = 12;

export default function IntelligenceTutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const done = step >= STEPS.length;

  // Both endings call onClose, so the outcome has to be recorded here —
  // "reached the end" and "bailed at step 2" are the whole point of
  // tracking a tutorial.
  const finish = useCallback(
    (outcome) => {
      track("tutorial_finished", { outcome });
      onClose();
    },
    [onClose]
  );

  const measure = useCallback(() => {
    if (done) return setRect(null);
    const sel = STEPS[step].target;
    if (!sel) return setRect(null);
    const el = document.querySelector(sel);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // A target scrolled out of view would put the ring off-screen; treating
    // it as absent centers the callout instead of pointing at nothing.
    if (r.bottom < 0 || r.top > window.innerHeight) return setRect(null);
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step, done]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") finish("skipped");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Callout placement: below the highlighted element when there's room,
  // above it when there isn't, centered when there's no target at all.
  let calloutStyle;
  if (!rect) {
    calloutStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.min(CALLOUT_W, window.innerWidth - 32),
    };
  } else {
    const below = rect.top + rect.height + GAP;
    const fitsBelow = below + 190 < window.innerHeight;
    calloutStyle = {
      left: Math.max(
        16,
        Math.min(rect.left, window.innerWidth - CALLOUT_W - 16)
      ),
      top: fitsBelow ? below : Math.max(16, rect.top - 190),
      width: Math.min(CALLOUT_W, window.innerWidth - 32),
    };
  }

  return (
    // pointer-events-none on the layer, re-enabled only on the callout, so
    // the tour never blocks the interface it's describing.
    <div className="pointer-events-none fixed inset-0 z-[200]">
      {rect && (
        <div
          aria-hidden
          className="absolute rounded transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            border: "2px solid #2a9d8f",
            boxShadow: "0 0 0 9999px rgba(5,7,13,0.72)",
          }}
        />
      )}

      <div
        role="dialog"
        aria-label="Nexus Intelligence tour"
        className="pointer-events-auto absolute rounded-lg border border-teal/40 bg-navy-900 p-4 shadow-2xl shadow-black/70"
        style={calloutStyle}
      >
        {done ? (
          <>
            <p className="font-serif text-lg font-medium text-white">Tour complete</p>
            <p className="mt-2 text-xs font-light leading-relaxed text-slate-300">
              You&apos;re ready to explore. Everything here is browsable without
              signing in, and nothing you filter or export leaves your browser.
            </p>
            <button
              type="button"
              onClick={() => finish("completed")}
              className="mt-4 w-full rounded border border-teal/40 bg-teal/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-teal transition-colors hover:border-teal hover:bg-teal/20"
            >
              Start exploring
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-teal">
                Step {step + 1} of {STEPS.length}
              </p>
              <button
                type="button"
                onClick={() => finish("skipped")}
                className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-teal"
              >
                Skip tour
              </button>
            </div>
            <p className="mt-2 font-serif text-base font-medium text-white">
              {STEPS[step].title}
            </p>
            <p className="mt-1.5 text-xs font-light leading-relaxed text-slate-300">
              {STEPS[step].body}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 rounded border border-teal/40 bg-teal/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-teal transition-colors hover:border-teal hover:bg-teal/20"
              >
                {step === STEPS.length - 1 ? "Finish" : "Next"}
              </button>
              <span className="flex gap-1" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i === step ? "bg-teal" : "bg-navy-500"
                    }`}
                  />
                ))}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
