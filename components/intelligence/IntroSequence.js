"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { loadIntelligenceMetadata } from "@/lib/intelligenceMetadata";

const SESSION_KEY = "intelligence-intro-seen";
// Four stat beats at 1000ms, then a 1900ms summary, then a 500ms exit:
// ~6.4s end to end. The count-up finishes at 700ms so each number sits
// fully settled for ~300ms before the next beat replaces it — without
// that pause the sequence reads as a blur of moving digits rather than
// four distinct facts, and the extra beat time is what lets a reader
// actually register each figure instead of watching it flash past.
const BEAT_MS = 1000;
const COUNT_S = 0.7;
const SUMMARY_MS = 1900;
const EXIT_MS = 500;
const SKIP_DELAY_MS = 1500;
// metadata.json is a few hundred bytes and same-origin, so anything past
// this is a broken or pathologically slow connection. Rather than stall on
// a dark screen (or worse, animate to zeros), give up and hand the user
// straight to the interface — the intro is a flourish, not a gate.
const METADATA_TIMEOUT_MS = 1500;

const EASE_OUT = [0.22, 1, 0.36, 1];
// Steeper than EASE_OUT: the count-up should sprint and then decelerate
// hard onto the exact figure, which is what makes it read as confident.
const COUNT_EASE = [0.16, 1, 0.3, 1];

// Beat order and copy. `statKey` names a field in metadata.json rather
// than carrying a literal, so a database refresh moves these numbers
// without anyone editing this file.
const BEATS = [
  {
    label: "Diseases",
    statKey: "diseaseCount",
    subKey: "diseasesWithLinkedCompanies",
    subSuffix: "with at least one linked company",
  },
  { label: "Companies", statKey: "companyCount" },
  { label: "Products", statKey: "productCount" },
  { label: "Disease-Company-Product Map", statKey: "mapRowCount" },
];

const SOURCE_KEYS = [
  { key: "fdaOrphanDesignationCount", noun: "FDA orphan drug designations" },
  { key: "drugsFdaApplicationCount", noun: "Drugs@FDA applications" },
  { key: "clinicalTrialCount", noun: "distinct clinical trials" },
];

function format(n) {
  return typeof n === "number" ? n.toLocaleString("en-US") : "—";
}

// The 5-second animated stat reveal that opens /intelligence (System 0).
// Self-contained: it fetches only metadata.json, so it starts animating
// while the multi-megabyte dataset JSON loads in parallel behind it, and
// tells the page exactly once — via onComplete — when the interface
// should take over.
export default function IntroSequence({ onComplete }) {
  const [stats, setStats] = useState(null);
  // loading → beats → summary → exiting → done
  const [phase, setPhase] = useState("loading");
  const [beat, setBeat] = useState(0);
  const [showSkip, setShowSkip] = useState(false);
  const finishedRef = useRef(false);

  // Single funnel for every ending — natural completion, the skip button,
  // a reduced-motion bypass, an already-seen session, and the metadata
  // failure path all route through here, so "seen" is recorded in exactly
  // one place and onComplete can never fire twice.
  const finish = useCallback(
    (instant) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      try {
        sessionStorage.setItem(SESSION_KEY, "true");
      } catch {
        // ignore — worst case the intro replays next load
      }
      if (instant) {
        setPhase("done");
        onComplete?.({ skipped: true });
        return;
      }
      setPhase("exiting");
      setTimeout(() => {
        setPhase("done");
        onComplete?.({ skipped: false });
      }, EXIT_MS);
    },
    [onComplete]
  );

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      // sessionStorage unavailable (private mode etc.) — treat as not seen
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (alreadySeen || reduceMotion) {
      finish(true);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) finish(true);
    }, METADATA_TIMEOUT_MS);

    loadIntelligenceMetadata()
      .then((data) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setStats(data);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeout);
        console.error("[IntroSequence] could not load metadata.json", err);
        finish(true);
      });

    const skipTimer = setTimeout(() => setShowSkip(true), SKIP_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearTimeout(skipTimer);
    };
  }, [finish]);

  // The beat timeline. Deliberately a flat list of absolute offsets rather
  // than chained timeouts: every timer is scheduled from the same t0, so a
  // slow frame can't compound drift across five beats.
  useEffect(() => {
    if (!stats || finishedRef.current) return;
    setPhase("beats");
    const timers = BEATS.slice(1).map((_, i) =>
      setTimeout(() => setBeat(i + 1), (i + 1) * BEAT_MS)
    );
    timers.push(setTimeout(() => setPhase("summary"), BEATS.length * BEAT_MS));
    timers.push(
      setTimeout(() => finish(false), BEATS.length * BEAT_MS + SUMMARY_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [stats, finish]);

  // The overlay covers the viewport but doesn't own the wheel, so without
  // this the page scrolls silently behind it and the interface is already
  // halfway down by the time it's revealed.
  useEffect(() => {
    if (phase === "done") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  if (phase === "done" || !stats) return null;

  const current = BEATS[beat];
  const exiting = phase === "exiting";

  return (
    <motion.div
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center overflow-hidden bg-navy-950"
      initial={{ opacity: 0 }}
      animate={{
        opacity: exiting ? 0 : 1,
        // Contracts up and inward on the way out, toward where the
        // condensed stat strip lives in the interface header.
        scale: exiting ? 0.94 : 1,
        y: exiting ? -28 : 0,
      }}
      transition={{ duration: exiting ? EXIT_MS / 1000 : 0.3, ease: EASE_OUT }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, rgba(42,157,143,0.14), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-4xl px-6 text-center">
        <AnimatePresence mode="wait">
          {phase === "beats" ? (
            <motion.div
              key={`beat-${beat}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal">
                {current.label}
              </p>
              <CountUp
                target={stats[current.statKey]}
                className="mt-4 block font-serif text-6xl font-medium tabular-nums text-white sm:text-7xl"
              />
              {current.subKey && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.35 }}
                  className="mt-4 text-sm font-light text-slate-400"
                >
                  {format(stats[current.subKey])} {current.subSuffix}
                </motion.p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE_OUT }}
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
                {BEATS.map((b, i) => (
                  <motion.div
                    key={b.statKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * i, duration: 0.3, ease: EASE_OUT }}
                  >
                    <p className="font-serif text-3xl font-medium tabular-nums text-white sm:text-4xl">
                      {format(stats[b.statKey])}
                    </p>
                    <p className="mt-2 font-mono text-[10px] uppercase leading-tight tracking-[0.2em] text-teal">
                      {b.label}
                    </p>
                  </motion.div>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                className="mx-auto mt-10 max-w-2xl text-sm font-light leading-relaxed text-slate-400"
              >
                Built from{" "}
                {SOURCE_KEYS.map((s, i) => (
                  <span key={s.key}>
                    {i === SOURCE_KEYS.length - 1 ? "and " : ""}
                    <span className="text-slate-200 tabular-nums">
                      {format(stats[s.key])}
                    </span>{" "}
                    {s.noun}
                    {i < SOURCE_KEYS.length - 1 ? ", " : "."}
                  </span>
                ))}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showSkip && !exiting && (
        <motion.button
          type="button"
          onClick={() => finish(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-8 right-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 transition-colors hover:text-teal"
        >
          Skip
        </motion.button>
      )}
    </motion.div>
  );
}

// Eased count-up driven entirely by a MotionValue: the digits update
// outside React's render cycle, so a 700ms animation costs zero
// re-renders of the surrounding beat. Remounts with each beat (the parent
// keys on beat index), which is what restarts it from zero.
function CountUp({ target, className }) {
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => format(Math.round(v)));

  useEffect(() => {
    const controls = animate(value, target ?? 0, {
      duration: COUNT_S,
      ease: COUNT_EASE,
    });
    return () => controls.stop();
  }, [value, target]);

  return <motion.span className={className}>{text}</motion.span>;
}
