const SECTION_TITLES = [
  "Executive Summary",
  "Scientific Assessment",
  "Clinical Development & Regulatory Pathway",
  "Market Sizing & Competitive Analysis",
  "Commercialization Strategy",
  "Financial Scenarios",
  "Investment Recommendation",
  "Comparable Assets",
  "Critical Caveats",
];

export function parseReportSections(reportText) {
  if (!reportText) return [];

  // Models don't always reproduce a header verbatim ("&" vs "and") — treat
  // the two as interchangeable rather than requiring byte-exact headers.
  const pattern = SECTION_TITLES.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/&/g, "(?:&|and)")
  ).join("|");
  const regex = new RegExp(
    `(^|\\n)\\s{0,3}(?:#{1,3}\\s*)?(${pattern})\\s*:?\\s*\\n`,
    "gi"
  );

  const matches = [...reportText.matchAll(regex)];

  if (matches.length === 0) {
    return [{ title: "Report", body: reportText.trim() }];
  }

  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const title = match[2];
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : reportText.length;
    const body = reportText.slice(start, end).trim();
    sections.push({ title, body });
  }

  return sections;
}
