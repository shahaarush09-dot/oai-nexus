import { stageRank } from "@/lib/stages";

// Filtering, grouping, and CSV export for the Explore tab.
//
// Everything here runs over all 63,433 map rows on every keystroke and
// every checkbox click, so the shape of these functions matters more than
// it would elsewhere: single pass, no intermediate arrays, no per-row
// allocation. A linear scan at this size lands in single-digit
// milliseconds, which is what makes the filters feel instant without any
// "apply" button.

export const MATCH_SCORE_MIN = 88;
export const MATCH_SCORE_MAX = 100;

export const SOURCE_OPTIONS = [
  "ClinicalTrials.gov",
  "FDA Orphan Designation",
  "ClinicalTrials.gov + FDA Orphan Designation",
];

export const TRIAL_STATUS_OPTIONS = [
  "COMPLETED",
  "RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "TERMINATED",
  "UNKNOWN",
];

export const APPROVED_ELSEWHERE_OPTIONS = ["Yes", "No"];

export const emptyFilters = () => ({
  stages: new Set(),
  categories: new Set(),
  sources: new Set(),
  trialStatuses: new Set(),
  approvedElsewhere: new Set(),
  minMatchScore: MATCH_SCORE_MIN,
  text: "",
});

// Lowercased haystack per row, built once when map.json lands. Without
// it, a text search re-lowercases three strings on all 63,433 rows for
// every keystroke — the single most expensive thing this tab could do.
export function buildSearchIndex(rows) {
  const haystack = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    haystack[i] = `${r.diseaseName || ""} ${r.companyName || ""} ${
      r.productName || ""
    }`.toLowerCase();
  }
  return haystack;
}

export function applyFilters(rows, haystack, filters) {
  const {
    stages,
    categories,
    sources,
    trialStatuses,
    approvedElsewhere,
    minMatchScore,
    text,
  } = filters;

  const query = text.trim().toLowerCase();
  // Hoisted out of the loop: `.size` on an empty Set is the cheapest
  // possible check, but reading it 63,433 times per filter is still work
  // that never changes mid-pass.
  const hasStage = stages.size > 0;
  const hasCategory = categories.size > 0;
  const hasSource = sources.size > 0;
  const hasStatus = trialStatuses.size > 0;
  const hasApproved = approvedElsewhere.size > 0;
  const hasScore = minMatchScore > MATCH_SCORE_MIN;

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (hasStage && !stages.has(row.developmentStage || "Unknown")) continue;
    if (hasCategory && !categories.has(row.category)) continue;
    if (hasSource && !sources.has(row.source)) continue;
    // trialStatus is null on every FDA-designation row (there's no trial
    // behind it); those group under "UNKNOWN" so the filter can reach them.
    if (hasStatus && !trialStatuses.has(row.trialStatus || "UNKNOWN")) continue;
    if (hasApproved && !approvedElsewhere.has(row.drugApprovedElsewhere)) continue;
    if (hasScore && !(row.matchScore >= minMatchScore)) continue;
    if (query && !haystack[i].includes(query)) continue;
    out.push(row);
  }
  return out;
}

export const GROUP_BY_OPTIONS = [
  { key: "none", label: "None" },
  { key: "diseaseName", label: "Disease" },
  { key: "companyName", label: "Company" },
  { key: "developmentStage", label: "Development stage" },
  { key: "category", label: "Category" },
];

// Groups are ordered largest-first, except stage grouping which reads far
// better in clinical order — "Approved" belongs at the top of that list
// even when it's the smallest bucket.
export function groupRows(rows, groupBy) {
  if (groupBy === "none") return null;
  const groups = new Map();
  for (const row of rows) {
    const key = row[groupBy] || "—";
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  const list = [...groups.entries()].map(([key, groupRowsList]) => ({
    key,
    rows: groupRowsList,
  }));
  if (groupBy === "developmentStage") {
    list.sort((a, b) => stageRank(a.key) - stageRank(b.key));
  } else {
    list.sort((a, b) => b.rows.length - a.rows.length);
  }
  return list;
}

// Flattens groups into a single positional list of header and data rows,
// which is what makes grouped mode virtualizable: the virtualizer needs
// one flat array with a stable index, not a nested structure.
export function flattenGroups(groups, collapsed) {
  const flat = [];
  for (const group of groups) {
    flat.push({ type: "header", key: group.key, count: group.rows.length });
    if (!collapsed.has(group.key)) {
      for (const row of group.rows) flat.push({ type: "row", row });
    }
  }
  return flat;
}

function csvCell(value) {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exports exactly what's on screen: the visible columns, in their current
// order, over the filtered rows. When grouped, the group key is written
// as its own leading column so the structure survives the trip into Excel
// rather than collapsing back into an undifferentiated flat list.
export function toCsv(rows, columns, groupBy) {
  const grouping = groupBy && groupBy !== "none";
  const header = [
    ...(grouping ? ["Group"] : []),
    ...columns.map((c) => c.header),
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const cells = [
      ...(grouping ? [row[groupBy] || "—"] : []),
      ...columns.map((c) => row[c.accessor]),
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(csv, filename) {
  // Leading UTF-8 BOM so Excel decodes correctly — disease names carry
  // accented characters and Greek letters that become mojibake without
  // it. Written as an escape rather than a literal BOM so this file stays
  // plain ASCII and grep doesn't treat it as binary.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoked on the next tick rather than immediately: Safari aborts the
  // download if the object URL disappears in the same frame as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
