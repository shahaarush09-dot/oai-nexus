"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AskNexusCrossToolButtons from "@/components/intelligence/AskNexusCrossToolButtons";
import { askNexus, getCachedAsk } from "@/lib/askNexus";
import { track } from "@/lib/trackIntelligence";

const ENTITY_LABEL = { disease: "disease", company: "company", drug: "drug" };

const POPOVER_WIDTH = 288;
// A resolved answer carries the three cross-tool buttons, and three
// columns inside 288px would leave ~90px each — not enough for
// "Scientific Pipeline", let alone the line explaining it. The popover
// widens for that state only, so the prompt and loading states keep the
// compact footprint they were sized for.
const ANSWER_WIDTH = 520;
const MAX_HEIGHT = 420;
const EDGE_GAP = 8;

// The Ask Nexus popover: a read-only, one-entity-at-a-time lookup against
// recent web sources. There is deliberately no text input and no follow-up
// turn — the only thing it can ever be asked about is the entity that was
// clicked, which is what keeps the endpoint from becoming a general-purpose
// search box pointed at someone else's API budget.
export default function AskNexusPopover({ target, onClose, onOpenDetail }) {
  const ref = useRef(null);
  const [state, setState] = useState({ phase: "idle" });

  // Seed from the session cache whenever the target changes, so reopening a
  // popover shows the previous answer immediately instead of re-asking.
  useEffect(() => {
    if (!target) {
      setState({ phase: "idle" });
      return;
    }
    const cached = getCachedAsk(target.entity, target.name);
    setState(cached ? { phase: "resolved", result: cached } : { phase: "idle" });
  }, [target]);

  useEffect(() => {
    function onPointerDown(e) {
      if (!ref.current?.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // The width and position below are computed during render from the live
  // viewport, which only helps if a resize actually causes one. Nothing
  // else re-renders this component on resize, so an open popover kept the
  // width it was born with: opened on a desktop and then narrowed to a
  // phone, a 520px answer hung off the right edge of a 375px screen.
  const [, onViewportChange] = useState(0);
  useEffect(() => {
    const bump = () => onViewportChange((n) => n + 1);
    window.addEventListener("resize", bump);
    window.addEventListener("orientationchange", bump);
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("orientationchange", bump);
    };
  }, []);

  const ask = useCallback(async () => {
    if (!target) return;
    setState({ phase: "loading" });
    const result = await askNexus(target.entity, target.name);
    track("ask_nexus", {
      entityType: target.entity,
      outcome: result.status === "success" ? "success" : "error",
    });
    // The user may have closed or switched entities mid-flight; the result is
    // already cached, so dropping it here loses nothing.
    setState((s) => (s.phase === "loading" ? { phase: "resolved", result } : s));
  }, [target]);

  if (!target) return null;

  // Measured at render rather than stored, so an orientation change or a
  // resize while the popover is open can't strand it off-screen.
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  // On a 375px phone a fixed 288px box plus edge gaps leaves almost no
  // margin, and a tall answer would run past the bottom of the screen —
  // so both axes are fitted to the viewport rather than assumed.
  const showsAnswer = state.phase === "resolved" && state.result.status === "success";
  const width = Math.min(showsAnswer ? ANSWER_WIDTH : POPOVER_WIDTH, vw - EDGE_GAP * 2);
  const maxHeight = Math.min(MAX_HEIGHT, vh - EDGE_GAP * 2);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Ask Nexus about ${target.name}`}
      style={{
        position: "fixed",
        // Clamped so a cell near an edge doesn't push the popover somewhere
        // it can't be read or dismissed. The bottom clamp uses the real max
        // height, since a resolved answer is far taller than the button it
        // replaces.
        left: Math.max(EDGE_GAP, Math.min(target.x, vw - width - EDGE_GAP)),
        top: Math.max(EDGE_GAP, Math.min(target.y, vh - maxHeight - EDGE_GAP)),
        width,
        maxHeight,
      }}
      className="z-[60] overflow-y-auto rounded border border-navy-border bg-navy-900 p-3 shadow-2xl shadow-black/60"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-teal">
        {ENTITY_LABEL[target.entity]}
      </p>
      <p className="mt-1.5 break-words text-sm text-white">{target.name}</p>

      {state.phase === "idle" && (
        <div className="mt-3 space-y-1.5">
          <button
            type="button"
            onClick={ask}
            className="w-full rounded border border-teal/40 bg-teal/10 px-2.5 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-teal transition-colors hover:border-teal hover:bg-teal/20"
          >
            Ask Nexus about this
          </button>
          <OpenProfileButton target={target} onOpenDetail={onOpenDetail} onClose={onClose} />
        </div>
      )}

      {state.phase === "loading" && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400"
        >
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1 w-1 animate-pulseDot rounded-full bg-teal" />
            <span
              className="h-1 w-1 animate-pulseDot rounded-full bg-teal"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="h-1 w-1 animate-pulseDot rounded-full bg-teal"
              style={{ animationDelay: "0.4s" }}
            />
          </span>
          Checking recent sources…
        </p>
      )}

      {state.phase === "resolved" && state.result.status === "error" && (
        <div className="mt-3 space-y-2.5">
          <p className="text-xs font-light leading-relaxed text-slate-400">
            {state.result.message}
          </p>
          <OpenProfileButton target={target} onOpenDetail={onOpenDetail} onClose={onClose} />
        </div>
      )}

      {state.phase === "resolved" && state.result.status === "success" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-light leading-relaxed text-slate-300">
            {state.result.overview}
          </p>

          {state.result.recentNews.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
                Recent news
              </p>
              <ul className="mt-2 space-y-2">
                {state.result.recentNews.map((item, i) => (
                  <li key={i} className="text-xs font-light leading-relaxed text-slate-300">
                    {item.text}{" "}
                    <span className="text-slate-500">({item.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* "Sources checked", not "data is fresh as of": this timestamp is
              when the lookup ran, which says nothing about how recent the
              underlying news is. Each item carries its own date. */}
          <p className="border-t border-navy-border pt-2 text-[10px] font-light text-slate-600">
            Sources checked {formatChecked(state.result.checkedAt)}
          </p>

          {/* Only on a successful answer: an error state has nothing to
              carry into another tool, and offering three onward journeys
              from a failure reads as deflection. */}
          <AskNexusCrossToolButtons entityType={target.entity} entityName={target.name} />

          <OpenProfileButton target={target} onOpenDetail={onOpenDetail} onClose={onClose} />
        </div>
      )}
    </div>
  );
}

function OpenProfileButton({ target, onOpenDetail, onClose }) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpenDetail(target.entity, target.name);
        onClose();
      }}
      className="w-full rounded border border-navy-border px-2.5 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
    >
      Open full profile
    </button>
  );
}

function formatChecked(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
