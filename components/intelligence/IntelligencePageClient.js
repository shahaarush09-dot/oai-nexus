"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import IntroSequence from "@/components/intelligence/IntroSequence";
import TopSearchBar from "@/components/intelligence/TopSearchBar";
import OverviewTab from "@/components/intelligence/OverviewTab";
import DiseasesTab from "@/components/intelligence/DiseasesTab";
import CompaniesTab from "@/components/intelligence/CompaniesTab";
import ProductsTab from "@/components/intelligence/ProductsTab";
import ExploreTab from "@/components/intelligence/ExploreTab";
import IntelligenceTutorial, {
  TUTORIAL_KEY,
} from "@/components/intelligence/IntelligenceTutorial";
import { loadIntelligenceMetadata } from "@/lib/intelligenceMetadata";
import { loadIndexData, normalizeKey } from "@/lib/loadIntelligenceData";
import { buildUrlQuery, readUrlState, syncUrl } from "@/lib/urlState";
import { track, trackOnce } from "@/lib/trackIntelligence";

const STRIP = [
  { statKey: "diseaseCount", label: "Diseases" },
  { statKey: "companyCount", label: "Companies" },
  { statKey: "productCount", label: "Products" },
  { statKey: "mapRowCount", label: "Map rows" },
];

// Search mode ↔ tab. The top bar thinks in modes (Drug/Disease/Company),
// the tab bar thinks in tabs, and selecting a result has to move both.
const MODE_TO_TAB = { disease: "diseases", company: "companies", drug: "products" };
const TAB_TO_MODE = { diseases: "disease", companies: "company", products: "drug" };

const TABS = [
  { key: "overview", label: "Overview", ready: true },
  { key: "diseases", label: "Diseases", ready: true },
  { key: "companies", label: "Companies", ready: true },
  { key: "products", label: "Products", ready: true },
  { key: "explore", label: "Explore", ready: true },
];

function format(n) {
  return typeof n === "number" ? n.toLocaleString("en-US") : "—";
}

// Page-level coordinator for /intelligence: owns the intro gate, the index
// data, the active tab, and the per-tab selection. The search bar lives
// here rather than inside any tab so it survives every tab switch and
// detail-view navigation with its mode intact.
export default function IntelligencePageClient() {
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState(null);
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState(null);
  // Read after mount, never during render. The server has no location, so
  // reading it in a useState initializer makes the server and client
  // produce different first renders and React fails hydration (#418/#423)
  // on every shared link. The swap happens behind the intro overlay, so
  // the cost of deferring it is invisible.
  const [urlInit, setUrlInit] = useState(null);
  const [tab, setTab] = useState("overview");
  const [mode, setMode] = useState("disease");
  // Bumped to ask TopSearchBar to take focus. A counter rather than a
  // boolean so repeated Overview-card clicks each re-focus, instead of
  // only the first one firing.
  const [focusToken, setFocusToken] = useState(0);
  // One selection per tab, so switching tabs and coming back doesn't
  // discard the record someone was reading.
  const [selection, setSelection] = useState({ diseases: null, companies: null, products: null });
  const [exploreSeed, setExploreSeed] = useState(null);
  // Latches true on the first visit and stays true, which is what keeps
  // Explore mounted across later tab switches. Until then it's never
  // mounted at all, so someone who only uses the browse tabs never pays
  // for the map.json fetch.
  const [exploreOpened, setExploreOpened] = useState(false);
  // Latest Explore view, reported upward by ExploreTab purely so it can be
  // mirrored into the URL.
  const [exploreView, setExploreView] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  // Read from sessionStorage after mount, never during render — the server
  // has no sessionStorage, and branching on it during render would produce
  // a hydration mismatch.
  const [tourDone, setTourDone] = useState(false);

  useEffect(() => {
    try {
      setTourDone(sessionStorage.getItem(TUTORIAL_KEY) === "true");
    } catch {
      // sessionStorage unavailable (private mode) — offer the tour anyway.
    }
  }, []);

  const finishTour = useCallback(() => {
    setTourOpen(false);
    setTourDone(true);
    try {
      sessionStorage.setItem(TUTORIAL_KEY, "true");
    } catch {
      // ignore — worst case the tour is offered again next load
    }
  }, []);

  const skippedRef = useRef(true);
  const reveal = useCallback(({ skipped }) => {
    skippedRef.current = skipped;
    setRevealed(true);
  }, []);

  // Both fetches start on mount, in parallel with the intro animation —
  // by the time the ~5s sequence finishes, the indexes are already parsed
  // and the interface is interactive with no spinner.
  useEffect(() => {
    let cancelled = false;
    loadIntelligenceMetadata()
      .then((d) => !cancelled && setStats(d))
      .catch(() => {});
    loadIndexData()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setDataError(err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Name-keyed lookups for cross-entity navigation. map.json joins its
  // three entity types by name string, so a click on a company inside a
  // disease's table arrives here holding a name and nothing else — this
  // is what turns that back into the full index record.
  const byName = useMemo(() => {
    if (!data) return null;
    const build = (records, field) => {
      const m = new Map();
      for (const r of records) m.set(normalizeKey(r[field]), r);
      return m;
    };
    return {
      disease: build(data.diseases, "diseaseName"),
      company: build(data.companies, "companyName"),
      drug: build(data.products, "productName"),
    };
  }, [data]);

  const select = useCallback((selectMode, item) => {
    const targetTab = MODE_TO_TAB[selectMode];
    setTab(targetTab);
    setMode(selectMode);
    setSelection((s) => ({ ...s, [targetTab]: item }));
  }, []);

  // Cross-entity hop from inside a detail table. A name that isn't in the
  // index is a real possibility — map.json and the index files are built
  // from overlapping but not identical source joins — so a miss leaves
  // the current view alone rather than blanking it.
  const navigate = useCallback(
    (targetMode, name) => {
      const record = byName?.[targetMode]?.get(normalizeKey(name));
      if (!record) return;
      select(targetMode, record);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [byName, select]
  );

  // Hand-off from a detail view's "Build a custom view from here". Seeds
  // the Explore tab's free-text filter with the entity name, which lands
  // the user on exactly that entity's rows — as a normal, removable filter
  // chip they can widen or replace, not a locked-in scope.
  const openExplore = useCallback((entityName) => {
    setExploreSeed({ token: Date.now(), filters: { text: entityName } });
    setTab("explore");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (tab === "explore") setExploreOpened(true);
  }, [tab]);

  // One page_view per page load, regardless of remounts or a StrictMode
  // double-invoke.
  useEffect(() => {
    trackOnce("page_view");
  }, []);

  // Apply the shared view once, on the client, after hydration has matched.
  useEffect(() => {
    const state = readUrlState();
    setUrlInit(state);
    if (state.tab) setTab(state.tab);
  }, []);

  // Restore a linked detail view once the indexes are parsed. A shared link
  // carries the entity name, which can't be resolved to a record until the
  // index it lives in has loaded.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !byName || !urlInit?.selection) return;
    const mode = TAB_TO_MODE[urlInit.tab];
    if (!mode) return;
    restoredRef.current = true;
    const record = byName[mode]?.get(normalizeKey(urlInit.selection));
    if (record) {
      setSelection((s) => ({ ...s, [MODE_TO_TAB[mode]]: record }));
      setMode(mode);
    }
  }, [byName, urlInit]);

  // Mirror the live view into the address bar. Everything a user builds —
  // which tab, which record, which filters and grouping — becomes a link
  // they can bookmark or send to someone else.
  useEffect(() => {
    // Until the incoming URL has been read, writing would erase the very
    // parameters this component is about to restore.
    if (!urlInit) return;
    const selected = selection[tab];
    const name =
      selected?.diseaseName || selected?.companyName || selected?.productName || null;
    syncUrl(
      buildUrlQuery({
        tab,
        selection: tab === "explore" ? null : name,
        explore: exploreView,
      })
    );
  }, [tab, selection, exploreView, urlInit]);

  // Overview card → the matching browse tab, with the top search bar
  // already switched to that mode and focused, so the next keystroke is
  // already a search.
  const enterSearchMode = useCallback((searchMode) => {
    setTab(MODE_TO_TAB[searchMode]);
    setMode(searchMode);
    setFocusToken((t) => t + 1);
  }, []);

  const setTabAndMode = useCallback((key) => {
    setTab(key);
    if (TAB_TO_MODE[key]) setMode(TAB_TO_MODE[key]);
  }, []);

  const tabProps = {
    data,
    onNavigate: navigate,
    onBuildView: openExplore,
  };

  return (
    <>
      <IntroSequence onComplete={reveal} />
      <motion.main
        initial={false}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: skippedRef.current ? 0 : 0.5 }}
        aria-hidden={!revealed}
        inert={!revealed ? "" : undefined}
        className="nexus-intel min-h-screen bg-navy-950 text-white"
      >
        {/* Header, search bar, and tab bar are one sticky unit — the
            search bar is meant to be reachable without scrolling back up,
            from anywhere in a 63,000-row table. */}
        <div className="sticky top-0 z-40 border-b border-navy-border bg-navy-950/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                {/* Always present in the sticky header, same "← OAI Nexus"
                    pattern the other three tools use — this page is deep,
                    and someone 60,000 rows into Explore or several detail
                    views in needs a way out that doesn't mean hitting Back
                    repeatedly through their own navigation history. */}
                <Link
                  href="/"
                  className="text-[11px] font-medium text-slate-500 transition-colors hover:text-teal"
                >
                  &larr; OAI Nexus
                </Link>
                <h1 className="mt-1.5 font-serif text-xl font-medium">Nexus Intelligence</h1>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
                  Rare disease database explorer
                </p>
              </div>
              {/* The condensed, permanent form of the four numbers the
                  intro revealed — scale stays in view after it ends. */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {STRIP.map((s) => (
                  <div key={s.statKey}>
                    <p className="font-serif text-lg font-medium tabular-nums leading-none">
                      {format(stats?.[s.statKey])}
                    </p>
                    <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-teal">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5" data-tour="search">
              <TopSearchBar
                mode={mode}
                onModeChange={setMode}
                data={data}
                onSelect={select}
                focusToken={focusToken}
              />
            </div>

            <nav className="mt-5 flex gap-1 overflow-x-auto" aria-label="Sections">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-tour={`tab-${t.key}`}
                  disabled={!t.ready}
                  onClick={() => setTabAndMode(t.key)}
                  title={t.ready ? undefined : `${t.note} — not built yet`}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                    tab === t.key
                      ? "border-teal text-teal"
                      : t.ready
                      ? "border-transparent text-slate-400 hover:text-slate-200"
                      : "cursor-not-allowed border-transparent text-navy-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-10">
          {/* Overview reads only metadata.json — a few hundred bytes — so
              it renders without waiting on the multi-megabyte indexes the
              browse tabs need. Gating the landing view behind a fetch it
              doesn't use would be the slowest thing on the page. */}
          {tab === "overview" && (
            <OverviewTab
              stats={stats}
              onEnter={enterSearchMode}
              onExplore={() => setTab("explore")}
              onStartTour={() => setTourOpen(true)}
              tourDone={tourDone}
            />
          )}

          {tab !== "overview" && dataError && (
            <p className="text-sm font-light text-slate-500">
              Could not load the dataset indexes. Reload to try again.
            </p>
          )}

          {tab !== "overview" && !dataError && !data && (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Loading indexes…
            </p>
          )}

          {data && (
            <>
              {tab === "diseases" && (
                <DiseasesTab
                  {...tabProps}
                  selected={selection.diseases}
                  onSelect={(item) =>
                    setSelection((s) => ({ ...s, diseases: item }))
                  }
                />
              )}
              {tab === "companies" && (
                <CompaniesTab
                  {...tabProps}
                  selected={selection.companies}
                  onSelect={(item) =>
                    setSelection((s) => ({ ...s, companies: item }))
                  }
                />
              )}
              {tab === "products" && (
                <ProductsTab
                  {...tabProps}
                  selected={selection.products}
                  onSelect={(item) =>
                    setSelection((s) => ({ ...s, products: item }))
                  }
                />
              )}
              {/* Explore stays mounted once opened, hidden rather than
                  unmounted, because a half-built view is expensive to
                  reconstruct — filters, grouping, column choices, sort,
                  and scroll position would all reset on a trip to another
                  tab and back. The `key` still forces a deliberate reset
                  when a detail view hands off a new pre-filter. */}
              {exploreOpened && (
                <div hidden={tab !== "explore"}>
                  <ExploreTab
                    key={exploreSeed?.token ?? "base"}
                    onNavigate={navigate}
                    initialFilters={exploreSeed?.filters}
                    initialView={urlInit?.explore}
                    onStateChange={setExploreView}
                  />
                </div>
              )}
            </>
          )}

        </div>
      </motion.main>

      {tourOpen && <IntelligenceTutorial onClose={finishTour} />}
    </>
  );
}
