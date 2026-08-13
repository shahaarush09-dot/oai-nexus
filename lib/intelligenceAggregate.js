import { normalizeKey } from "@/lib/loadIntelligenceData";
import { stageRank } from "@/lib/stages";

// Roll map rows up by one of their three entity names.
//
// Every detail view needs the same shape: "for this disease, one row per
// company, with how many distinct products that company has and how far
// along the furthest one is." Counting distinct product names rather than
// map rows matters — a product appears once per company that works on it,
// so counting rows would inflate whichever partnership happens to be the
// most crowded.
export function rollUp(rows, field, opts = {}) {
  const { countField = "productName", labelField } = opts;
  const groups = new Map();

  for (const row of rows) {
    const name = row[field];
    const key = normalizeKey(name);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = {
        id: key,
        name,
        rows: [],
        counted: new Set(),
        label: labelField ? row[labelField] : null,
      };
      groups.set(key, g);
    }
    g.rows.push(row);
    const counted = row[countField];
    if (counted) g.counted.add(normalizeKey(counted));
    // First non-null wins for the descriptive label (category, mechanism):
    // these repeat across a group's rows, but sources disagree often
    // enough that some rows carry null where others don't.
    if (labelField && !g.label && row[labelField]) g.label = row[labelField];
  }

  return [...groups.values()].map((g) => ({
    id: g.id,
    name: g.name,
    label: g.label,
    count: g.counted.size,
    stage: bestStage(g.rows),
    rows: g.rows,
  }));
}

// Furthest-along stage in a set of rows, by clinical progress rather than
// alphabetically.
export function bestStage(rows) {
  let best = null;
  let bestRank = Infinity;
  for (const row of rows) {
    const r = stageRank(row.developmentStage);
    if (r < bestRank) {
      bestRank = r;
      best = row.developmentStage;
    }
  }
  return best;
}

// Other products made by the companies behind this one. Bounded on both
// sides on purpose: a widely-partnered generic like cyclophosphamide is
// linked to 283 companies, and walking all of them would scan a large
// share of the 63,433-row map on every selection to produce a "related"
// list nobody would read to the end of.
const RELATED_COMPANY_CAP = 20;
const RELATED_PRODUCT_CAP = 200;

// Returns { items, capped } rather than a bare array: hitting the cap
// makes the list length an artifact of this function, not a fact about
// the data, and a section header reading "Related products 200" would be
// asserting something untrue.
export function relatedProducts(byCompany, companyNames, excludeProduct) {
  const exclude = normalizeKey(excludeProduct);
  const seen = new Map();
  // Truncating the company list also makes the result partial, even if
  // the product cap is never reached.
  const partialCompanies = companyNames.length > RELATED_COMPANY_CAP;

  for (const company of companyNames.slice(0, RELATED_COMPANY_CAP)) {
    for (const row of byCompany.get(normalizeKey(company)) || []) {
      const key = normalizeKey(row.productName);
      if (!key || key === exclude || seen.has(key)) continue;
      seen.set(key, {
        id: key,
        name: row.productName,
        stage: row.developmentStage,
        company: row.companyName,
      });
      if (seen.size >= RELATED_PRODUCT_CAP) {
        return { items: [...seen.values()], capped: true };
      }
    }
  }
  return { items: [...seen.values()], capped: partialCompanies };
}
