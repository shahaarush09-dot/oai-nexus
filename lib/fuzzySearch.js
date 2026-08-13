import Fuse from "fuse.js";

// Shared fuzzy-search config for the persistent top bar and the in-tab
// dropdowns, so a query behaves identically wherever it's typed.
//
// threshold 0.35, not Fuse's looser defaults: against 11,645 disease names
// a 5-character query at 0.6 returns mostly noise ranked above the real
// hit. 0.35 is what makes "cdkl5" land on "CDKL5 Deficiency Disorder"
// first. ignoreLocation matters just as much — without it Fuse only
// matches near the start of a string, so "deficiency" would miss every
// name that doesn't open with it.
const BASE_OPTIONS = {
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

export const SEARCH_MODES = {
  disease: {
    label: "Disease",
    dataset: "diseases",
    nameField: "diseaseName",
    // Synonyms carry real weight: Orphanet's canonical name is often not
    // what a clinician or patient would type.
    keys: [
      { name: "diseaseName", weight: 0.7 },
      { name: "synonyms", weight: 0.3 },
    ],
  },
  company: {
    label: "Company",
    dataset: "companies",
    nameField: "companyName",
    keys: [{ name: "companyName", weight: 1 }],
  },
  drug: {
    label: "Drug",
    dataset: "products",
    nameField: "productName",
    keys: [
      { name: "productName", weight: 0.85 },
      { name: "mechanism", weight: 0.15 },
    ],
  },
};

// Fuse builds its index up front, which for 23,883 products is work worth
// doing exactly once per dataset rather than on every keystroke.
const fuseCache = new Map();

function getFuse(modeKey, records) {
  const cached = fuseCache.get(modeKey);
  if (cached && cached.records === records) return cached.fuse;
  const mode = SEARCH_MODES[modeKey];
  const fuse = new Fuse(records, { ...BASE_OPTIONS, keys: mode.keys });
  fuseCache.set(modeKey, { records, fuse });
  return fuse;
}

export function searchEntities(modeKey, records, query, limit = 8) {
  if (!records || !query || query.trim().length < 2) return [];
  return getFuse(modeKey, records)
    .search(query.trim(), { limit })
    .map((r) => r.item);
}
