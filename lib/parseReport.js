const SECTION_TITLES = [
  "Executive Summary",
  "Scientific Assessment",
  "Clinical Development Outlook",
  "Market and Epidemiology",
  "Pricing and Reimbursement Considerations",
  "Competitive Landscape",
  "Investment Perspective",
];

export function parseReportSections(reportText) {
  if (!reportText) return [];

  const pattern = SECTION_TITLES.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
