// Reads and writes the whole Intelligence view as query parameters, so any
// state a user builds is a URL they can bookmark, refresh, or paste to a
// colleague. Without this every view is ephemeral: a reload drops you back
// to the Overview tab, the browser Back button leaves the page entirely,
// and "all Phase 3 neurological diseases" is something you can only
// describe, never send.
//
// Kept deliberately terse — these strings end up in a URL someone pastes
// into Slack, so `stage=Approved,Phase+3` beats a base64 blob nobody can
// read or hand-edit.

const SET_PARAMS = {
  stages: "stage",
  categories: "cat",
  sources: "src",
  trialStatuses: "trial",
  approvedElsewhere: "appr",
};

export const TABS = ["overview", "diseases", "companies", "products", "explore"];

export function readUrlState(search = typeof window === "undefined" ? "" : window.location.search) {
  const p = new URLSearchParams(search);
  const tab = p.get("tab");
  const state = {
    tab: TABS.includes(tab) ? tab : null,
    // Entity name for a detail view. Names are the join key across this
    // dataset (see loadIntelligenceData), so the name is the stable
    // identifier a link should carry.
    selection: p.get("sel") || null,
    explore: null,
  };

  const hasExplore = ["q", "group", "score", "cols", ...Object.values(SET_PARAMS)].some((k) =>
    p.has(k)
  );
  if (hasExplore) {
    const filters = {};
    for (const [key, param] of Object.entries(SET_PARAMS)) {
      const raw = p.get(param);
      filters[key] = new Set(raw ? raw.split(",").filter(Boolean) : []);
    }
    filters.text = p.get("q") || "";
    const score = Number(p.get("score"));
    filters.minMatchScore = Number.isFinite(score) && score >= 88 && score <= 100 ? score : 88;
    state.explore = {
      filters,
      groupBy: p.get("group") || "none",
      visible: p.get("cols") ? p.get("cols").split(",").filter(Boolean) : null,
    };
  }
  return state;
}

// Only non-default values are written, so a plain visit keeps a clean
// /intelligence URL instead of a wall of empty parameters.
export function buildUrlQuery({ tab, selection, explore }) {
  const p = new URLSearchParams();
  if (tab && tab !== "overview") p.set("tab", tab);
  if (selection) p.set("sel", selection);

  if (explore && tab === "explore") {
    const { filters, groupBy, visible, defaultVisible } = explore;
    for (const [key, param] of Object.entries(SET_PARAMS)) {
      const set = filters?.[key];
      if (set && set.size) p.set(param, [...set].join(","));
    }
    if (filters?.text?.trim()) p.set("q", filters.text.trim());
    if (filters?.minMatchScore > 88) p.set("score", String(filters.minMatchScore));
    if (groupBy && groupBy !== "none") p.set("group", groupBy);
    // Column choices only ride along when they differ from the default,
    // which keeps the common case out of the URL entirely.
    if (visible && defaultVisible && !sameMembers(visible, defaultVisible)) {
      p.set("cols", visible.join(","));
    }
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

function sameMembers(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

// replaceState rather than pushState: a filter checkbox is a continuous
// adjustment, not a navigation event, and pushing one history entry per
// keystroke would bury the Back button under hundreds of near-identical
// states. The URL still updates live, so copying it always yields the
// view currently on screen.
export function syncUrl(query) {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${query}`;
  if (next === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(null, "", next);
}
