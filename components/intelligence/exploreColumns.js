"use client";

import StageBadge from "@/components/intelligence/StageBadge";
import { stageRank } from "@/lib/stages";

// Column catalogue for the Explore table.
//
// `accessor` doubles as the CSV field and the sort key, `width` feeds the
// CSS grid template (virtualized rows are divs, not <td>s, so widths have
// to be declared rather than negotiated by the browser). `entity` marks
// the three columns whose cells are named entities — the only ones that
// become clickable Ask Nexus targets.
//
// The default-visible five are the ones that answer "what is this row";
// everything else is real data the pipeline carries but that would turn
// the default view into a wall, so it's opt-in via the gear menu.
export const EXPLORE_COLUMNS = [
  {
    accessor: "diseaseName",
    definition:
      "The Orphanet-listed rare disease this row links to.",
    header: "Disease",
    width: "minmax(200px, 2fr)",
    entity: "disease",
    defaultVisible: true,
  },
  {
    accessor: "companyName",
    definition:
      "The trial sponsor or designation holder, as named by the source record.",
    header: "Company",
    width: "minmax(180px, 1.6fr)",
    entity: "company",
    defaultVisible: true,
  },
  {
    accessor: "productName",
    definition:
      "The drug or intervention, as named by the source record. Naming follows the source, so the same molecule can appear under a brand name, a generic name, and a code.",
    header: "Product",
    width: "minmax(180px, 1.6fr)",
    entity: "drug",
    defaultVisible: true,
  },
  {
    accessor: "developmentStage",
    definition:
      "Furthest stage reported for this disease-company-product link. Approved means an approval exists; Orphan Designated means an FDA orphan designation with no trial phase attached.",
    header: "Stage",
    width: "150px",
    defaultVisible: true,
    sortValue: (row) => stageRank(row.developmentStage),
    render: (row) => <StageBadge stage={row.developmentStage} />,
  },
  {
    accessor: "category",
    definition:
      "Orphanet's disease classification. A disease can belong to several; this is the primary one.",
    header: "Category",
    width: "minmax(160px, 1.2fr)",
    defaultVisible: true,
  },
  { accessor: "mechanism",
    definition:
      "Mechanism of action, where the source supplies one. Often blank for trial-sourced rows.", header: "Mechanism", width: "minmax(180px, 1.4fr)" },
  { accessor: "source",
    definition:
      "Which dataset produced this row: a ClinicalTrials.gov trial record, an FDA orphan designation, or both agreeing.", header: "Source", width: "150px" },
  { accessor: "matchScore",
    definition:
      "How confidently the disease name was matched across sources, from 88 to 100. Sources name the same disease differently, so rows are joined by name rather than a shared key. 100 is an exact or trial-verified match; lower values are fuzzy matches worth a second look.", header: "Match", width: "80px", align: "right" },
  { accessor: "matchMethod",
    definition:
      "How the match was made: trial-verified, exact name match, or fuzzy name match.", header: "Match method", width: "120px" },
  { accessor: "trialCount",
    definition:
      "Number of distinct clinical trials behind this link.", header: "Trials", width: "80px", align: "right" },
  { accessor: "trialStatus",
    definition:
      "Recruitment status of the underlying trial, as reported by ClinicalTrials.gov. Blank for rows that come from an FDA designation rather than a trial.", header: "Trial status", width: "150px" },
  {
    accessor: "drugApprovedElsewhere",
    definition:
      "Whether this product holds an approval somewhere, for any indication — not necessarily for this disease.",
    header: "Approved elsewhere",
    width: "140px",
  },
  { accessor: "approvalDate",
    definition:
      "Date of approval where one exists.", header: "Approval date", width: "120px" },
  { accessor: "orphaCode",
    definition:
      "Orphanet's stable identifier for the disease.", header: "ORPHA", width: "90px" },
  { accessor: "prevalence",
    definition:
      "Orphanet's reported prevalence for the disease.", header: "Prevalence", width: "130px" },
];

export const DEFAULT_VISIBLE = EXPLORE_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.accessor
);
