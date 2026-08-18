"""Step 2 - FDA Orphan Drug Designations.

NOTE ON THE DATA SOURCE
-----------------------
openFDA has no orphan drug endpoint. `https://api.fda.gov/drug/orphan.json`
returns HTTP 404; the drug endpoints openFDA actually serves are event, label,
ndc, enforcement, orangebook, drugsfda and drugshortages.

The complete designation data lives in FDA's Orphan Drug Product Designation
Database, which exposes an official "Download Excel file" export. We POST the
same form the site's own download button posts, with the full 1983->today date
range, and get back every designation in one request (~8,200 records).

The file is served as `application/msexcel` but is really an HTML <table>, so it
is parsed with pandas.read_html rather than an xlsx reader.

Writes data/fda_orphan_raw.csv.

Run standalone:  python scripts/02_fetch_fda_orphan.py [--force]
"""

from __future__ import annotations

import argparse
import io
import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (  # noqa: E402
    FDA_ORPHAN_CSV,
    RAW_DIR,
    download_file,
    get_logger,
    is_fresh,
    make_session,
)

LOG = get_logger("02_fda_orphan")

OOPD_URL = "https://www.accessdata.fda.gov/scripts/opdlisting/oopd/"
RAW_EXPORT = RAW_DIR / "fda_oopd_export.html"

# Maps the export's verbose headers onto tidy column names.
COLUMN_MAP = {
    "Generic Name": "product_generic_name",
    "Trade Name": "product_trade_name",
    "Date Designated": "designation_date",
    "Orphan Designation": "designated_indication",
    "Orphan Designation Status": "designation_status",
    "Date Designation Withdrawn or Revoked": "designation_withdrawn_date",
    "FDA Orphan Approval Status": "orphan_approval_status",
    "Approved Labeled Indication": "approved_indication",
    "Marketing Approval Date": "marketing_approval_date",
    "Exclusivity End Date": "exclusivity_end_date",
    "Sponsor Company": "company_name",
    "Sponsor City": "sponsor_city",
    "Sponsor State": "sponsor_state",
    "Sponsor Country": "sponsor_country",
    "CF Grid Key": "fda_grid_key",
}

KEEP_COLUMNS = [
    "product_generic_name", "product_trade_name", "company_name",
    "designated_indication", "designation_date", "designation_status",
    "orphan_approval_status", "approved_indication", "marketing_approval_date",
    "exclusivity_end_date", "designation_withdrawn_date",
    "sponsor_city", "sponsor_state", "sponsor_country", "fda_grid_key",
]

_WS = re.compile(r"\s+")


def fetch_export(force: bool) -> Path | None:
    """POST the OOPD search form asking for the full-range Excel export."""
    if not force and is_fresh(RAW_EXPORT):
        LOG.info("Cached %s (skipping download)", RAW_EXPORT.name)
        return RAW_EXPORT

    form = {
        "Product_name": "",
        "sponsor_name": "",
        "Designation": "",
        "Designation_Start_Date": "01/01/1983",
        "Designation_End_Date": date.today().strftime("%m/%d/%Y"),
        "Search_param": "DESDATE",     # all designations, not just approved
        "Output_Format": "Excel",      # full dump rather than a paged HTML list
        "Sort_order": "Date_Order",
        "RecordsPerPage": "25",        # ignored by the Excel export
    }

    session = make_session()
    LOG.info("Requesting full orphan designation export from FDA ...")
    ok = download_file(session, OOPD_URL, RAW_EXPORT, logger=LOG, method="POST", data=form)
    if ok:
        return RAW_EXPORT
    if RAW_EXPORT.exists():
        LOG.warning("Export request failed; falling back to stale copy")
        return RAW_EXPORT
    return None


def _clean_cell(value) -> str:
    """Strip the export's whitespace padding and &nbsp; filler."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).replace("\xa0", " ")
    text = text.replace("'", "'").strip().strip("'").strip()
    return _WS.sub(" ", text).strip()


def read_export_text(path: Path) -> str:
    """Decode the export, working around FDA's mislabelled encoding.

    The response declares charset=UTF-8 but actually contains cp1252 bytes:
    0xAE for the registered-trademark sign, 0x92 for curly apostrophes. Decoding
    it as UTF-8 turns "Bronchitol(R)" into "Bronchitol�", so fall back to
    cp1252 when strict UTF-8 rejects the file.
    """
    raw = path.read_bytes()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        LOG.info("Export is not valid UTF-8 despite its header; decoding as cp1252")
        return raw.decode("cp1252", errors="replace")


def parse_export(path: Path) -> pd.DataFrame:
    html = read_export_text(path)
    tables = pd.read_html(io.StringIO(html), flavor="lxml")
    if not tables:
        raise SystemExit("No table found in the FDA orphan export.")
    df = max(tables, key=len)
    LOG.info("Parsed table with %s rows, %d columns", f"{len(df):,}", len(df.columns))

    df.columns = [_WS.sub(" ", str(c)).strip() for c in df.columns]
    unmapped = [c for c in df.columns if c not in COLUMN_MAP]
    if unmapped:
        LOG.info("Columns not in the known map (kept as-is): %s", unmapped)
    df = df.rename(columns=COLUMN_MAP)

    for col in df.columns:
        df[col] = df[col].map(_clean_cell)

    for col in KEEP_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[KEEP_COLUMNS]

    # Drop rows with neither a product nor an indication - nothing to link.
    before = len(df)
    df = df[
        (df["product_generic_name"] != "") | (df["product_trade_name"] != "")
    ].copy()
    df = df[df["designated_indication"] != ""].copy()
    if before != len(df):
        LOG.info("Dropped %d unusable rows (no product or no indication)", before - len(df))

    # "FDA Orphan Approval Status" is only populated for the negative case
    # ("Not FDA Approved for Orphan Indication") and left blank otherwise, so it
    # cannot be used on its own. "Orphan Designation Status" is populated for
    # every row and spells out the approval state, so derive from that.
    status = df["designation_status"].str.lower()
    df["is_approved"] = status.str.contains("approved", na=False)
    df["is_withdrawn"] = status.str.contains("withdrawn|revoked", na=False, regex=True)

    return df.reset_index(drop=True)


def build(force: bool = False) -> pd.DataFrame:
    path = fetch_export(force)
    if path is None:
        raise SystemExit("Could not download the FDA orphan designation export.")
    df = parse_export(path)
    df.to_csv(FDA_ORPHAN_CSV, index=False, encoding="utf-8")
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch FDA orphan drug designations.")
    parser.add_argument("--force", action="store_true", help="Re-download even if cached.")
    args = parser.parse_args()

    df = build(force=args.force)

    LOG.info("=" * 62)
    LOG.info("Fetched %s orphan designations -> %s", f"{len(df):,}", FDA_ORPHAN_CSV.name)
    LOG.info("  %s distinct sponsor companies", f"{df['company_name'].nunique():,}")
    LOG.info("  %s distinct generic product names", f"{df['product_generic_name'].nunique():,}")
    LOG.info("  %s distinct designated indications", f"{df['designated_indication'].nunique():,}")
    LOG.info("  %s approved for their orphan indication", f"{int(df['is_approved'].sum()):,}")
    LOG.info("  %s withdrawn or revoked", f"{int(df['is_withdrawn'].sum()):,}")
    if (df["designation_date"] != "").any():
        dates = pd.to_datetime(df["designation_date"], errors="coerce", format="mixed")
        LOG.info("  designation dates span %s to %s",
                 dates.min().date(), dates.max().date())
    LOG.info("=" * 62)


if __name__ == "__main__":
    main()
