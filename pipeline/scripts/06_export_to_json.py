"""Step 6 - Export the built workbook to static JSON for OAI Nexus Intelligence.

The Intelligence page (oai-nexus.org/intelligence) reads five JSON files at
runtime instead of parsing the 9+ MB Excel workbook in the browser. This script
is the one place that translates the workbook's four sheets - plus the three
raw source CSVs, for the aggregate "built from" counts that don't survive the
match/merge into the workbook - into that JSON contract.

Column names are converted from the workbook's Title Case headers to camelCase
keys (e.g. "Disease Name" -> "diseaseName") so the JSON reads naturally from
JS/React on the other end, rather than forcing bracket-notation access to
Title Case keys everywhere in the frontend.

Every record also gets a stable `id`. Diseases already have one (Orpha Code);
Companies, Products and Map rows don't have a natural unique key in this
schema, so those get a simple positional id instead.

Writes:
  output/json/diseases.json
  output/json/companies.json
  output/json/products.json
  output/json/map.json
  output/json/metadata.json

Run standalone:  python scripts/06_export_to_json.py
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (  # noqa: E402
    CLINICAL_TRIALS_CSV,
    FDA_APPROVALS_CSV,
    FDA_ORPHAN_CSV,
    OUTPUT_DIR,
    XLSX_PATH,
    get_logger,
)

LOG = get_logger("06_export_json")

JSON_OUTPUT_DIR = OUTPUT_DIR / "json"

# Title Case workbook header -> camelCase JSON key, per sheet.
DISEASE_COLUMNS = {
    "Orpha Code": "orphaCode",
    "Disease Name": "diseaseName",
    "Category": "category",
    "Record Type": "recordType",
    "Prevalence": "prevalence",
    "Companies": "companyCount",
    "Products": "productCount",
    "Trials": "trialCount",
    "FDA Designations": "fdaDesignationCount",
    "Most Advanced Stage": "mostAdvancedStage",
    "Description": "description",
    "Synonyms": "synonyms",
    "ICD-10": "icd10",
    "OMIM": "omim",
    "Disorder Type": "disorderType",
    "Prevalence Type": "prevalenceType",
    "Prevalence Region": "prevalenceRegion",
    "All Categories": "allCategories",
    "Orphanet URL": "orphanetUrl",
}
COMPANY_COLUMNS = {
    "Company Name": "companyName",
    "Diseases": "diseaseCount",
    "Products": "productCount",
    "Links": "linkCount",
    "Trials": "trialCount",
    "Most Advanced Stage": "mostAdvancedStage",
    "Has Approved Product": "hasApprovedProduct",
    "Sources": "sources",
}
PRODUCT_COLUMNS = {
    "Product Name": "productName",
    "Development Stage": "developmentStage",
    "Mechanism": "mechanism",
    "Diseases": "diseaseCount",
    "Companies": "companyCount",
    "Trials": "trialCount",
    "FDA Approved (any indication)": "fdaApproved",
    "Approval Date": "approvalDate",
    "Companies (names)": "companyNames",
    "Sources": "sources",
}
# "Evidence" and "Source Text Matched" are deliberately excluded: together
# they were 60% of map.json's size (19.4MB + 1MB of ~50MB raw) and neither
# is referenced anywhere in the Explore tab spec, which only surfaces
# matchScore (as a filter slider) and source (as a togglable column) - not
# the underlying match-evidence text. If a future "why did this match"
# detail view needs them, they can be shipped as a separate, smaller
# lazy-loaded lookup keyed by id rather than bloating the eager map dataset.
MAP_COLUMNS = {
    "Disease Name": "diseaseName",
    "Orpha Code": "orphaCode",
    "Category": "category",
    "Company Name": "companyName",
    "Product Name": "productName",
    "Development Stage": "developmentStage",
    "Mechanism": "mechanism",
    "Source": "source",
    "Trials": "trialCount",
    "Trial Status": "trialStatus",
    "Drug Approved Elsewhere": "drugApprovedElsewhere",
    "Approval Date": "approvalDate",
    "Match Score": "matchScore",
    "Match Method": "matchMethod",
    "Prevalence": "prevalence",
}


def _load_sheet(sheet_name: str, columns: dict[str, str]) -> pd.DataFrame:
    df = pd.read_excel(XLSX_PATH, sheet_name=sheet_name, dtype=object)
    missing = set(columns) - set(df.columns)
    if missing:
        raise ValueError(f"{sheet_name!r} is missing expected column(s): {sorted(missing)}")
    df = df[list(columns)].rename(columns=columns)
    # NaN (pandas' representation of blank Excel cells) must become JSON
    # null, not the literal string "NaN" - where() swaps it for None, which
    # json.dump renders correctly.
    df = df.where(pd.notna(df), None)
    return df


def _write_json(data, path: Path, *, label: str = "records") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = path.stat().st_size / (1024 * 1024)
    count = len(data) if isinstance(data, list) else 1
    LOG.info("  wrote %s (%d %s, %.2f MB)", path.name, count, label, size_mb)


def _distinct_count(csv_path: Path, key_column: str) -> int:
    with csv_path.open(encoding="utf-8") as f:
        return len({row[key_column] for row in csv.DictReader(f)})


def _row_count(csv_path: Path) -> int:
    with csv_path.open(encoding="utf-8") as f:
        return sum(1 for _ in csv.DictReader(f))


def main() -> None:
    if not XLSX_PATH.exists():
        LOG.error("Workbook not found at %s - run 05_build_spreadsheet.py first.", XLSX_PATH)
        sys.exit(1)

    LOG.info("Reading %s", XLSX_PATH)
    diseases = _load_sheet("Diseases", DISEASE_COLUMNS)
    companies = _load_sheet("Companies", COMPANY_COLUMNS)
    products = _load_sheet("Products", PRODUCT_COLUMNS)
    map_df = _load_sheet("Disease-Company-Product Map", MAP_COLUMNS)

    # Diseases already carry a real stable id (orphaCode). The other three
    # sheets don't have a natural unique key in this schema, so they get a
    # simple positional one.
    diseases.insert(0, "id", diseases["orphaCode"])
    companies.insert(0, "id", range(len(companies)))
    products.insert(0, "id", range(len(products)))
    map_df.insert(0, "id", range(len(map_df)))

    LOG.info("Writing JSON to %s", JSON_OUTPUT_DIR)
    _write_json(diseases.to_dict(orient="records"), JSON_OUTPUT_DIR / "diseases.json")
    _write_json(companies.to_dict(orient="records"), JSON_OUTPUT_DIR / "companies.json")
    _write_json(products.to_dict(orient="records"), JSON_OUTPUT_DIR / "products.json")
    _write_json(map_df.to_dict(orient="records"), JSON_OUTPUT_DIR / "map.json")

    # "Built from" counts are the size of the underlying source pulls, not a
    # count derived from the merged workbook - a company/product/trial only
    # ends up in the workbook if it matched a disease, so counting workbook
    # rows would understate how much source data the pipeline actually
    # covers. fda_orphan_raw.csv has one row per designation already;
    # fda_approvals_raw.csv and clinical_trials_raw.csv have one row per
    # disease-match rather than per application/trial, so those two need a
    # distinct-key count instead of a raw row count.
    LOG.info("Computing sourcing counts from raw CSVs")
    fda_orphan_designation_count = _row_count(FDA_ORPHAN_CSV)
    drugs_fda_application_count = _distinct_count(FDA_APPROVALS_CSV, "application_number")
    clinical_trial_count = _distinct_count(CLINICAL_TRIALS_CSV, "nct_id")

    diseases_with_linked_companies = int((diseases["companyCount"].fillna(0) > 0).sum())

    metadata = {
        "lastUpdated": datetime.fromtimestamp(
            XLSX_PATH.stat().st_mtime, tz=timezone.utc
        ).strftime("%Y-%m-%d"),
        "diseaseCount": len(diseases),
        "diseasesWithLinkedCompanies": diseases_with_linked_companies,
        "companyCount": len(companies),
        "productCount": len(products),
        "mapRowCount": len(map_df),
        "fdaOrphanDesignationCount": fda_orphan_designation_count,
        "drugsFdaApplicationCount": drugs_fda_application_count,
        "clinicalTrialCount": clinical_trial_count,
    }
    _write_json(metadata, JSON_OUTPUT_DIR / "metadata.json", label="fields")
    LOG.info("metadata.json contents: %s", json.dumps(metadata, indent=2))

    LOG.info("Done.")


if __name__ == "__main__":
    main()
