"""Step 3 - Drugs@FDA approval status and dates.

Uses openFDA's bulk export rather than paginating /drug/drugsfda.json:
one ~9 MB zip holds all ~29,000 applications, versus ~300 paged requests. It
also sidesteps openFDA's hard `skip` ceiling of 25,000 records.

If the bulk file is unavailable the script falls back to paginated API calls.

Emits one row per marketed product (an application can carry several), with the
approval date taken from the earliest approved ORIG submission, plus the
openFDA pharmacologic class fields that later become the "mechanism" column.

Writes data/fda_approvals_raw.csv.

Run standalone:  python scripts/03_fetch_fda_approvals.py [--force]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import zipfile
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (  # noqa: E402
    FDA_APPROVALS_CSV,
    RAW_DIR,
    download_file,
    get_logger,
    is_fresh,
    make_session,
    openfda_params,
    request_with_retry,
)

LOG = get_logger("03_fda_approvals")

BULK_URL = "https://download.open.fda.gov/drug/drugsfda/drug-drugsfda-0001-of-0001.json.zip"
BULK_ZIP = RAW_DIR / "drug-drugsfda.json.zip"
API_URL = "https://api.fda.gov/drug/drugsfda.json"
PAGE_SIZE = 1000
API_SKIP_CEILING = 25_000


def _joined(block: dict, key: str, limit: int | None = None) -> str:
    values = block.get(key) or []
    if isinstance(values, str):
        values = [values]
    values = [str(v).strip() for v in values if str(v).strip()]
    seen, out = set(), []
    for v in values:
        low = v.lower()
        if low not in seen:
            seen.add(low)
            out.append(v)
    if limit:
        out = out[:limit]
    return "; ".join(out)


def fetch_bulk(force: bool) -> list[dict] | None:
    """Download and read the openFDA bulk drugsfda export."""
    if force or not is_fresh(BULK_ZIP):
        session = make_session()
        LOG.info("Downloading Drugs@FDA bulk export ...")
        if not download_file(session, BULK_URL, BULK_ZIP, logger=LOG) and not BULK_ZIP.exists():
            return None
    else:
        LOG.info("Cached %s (skipping download)", BULK_ZIP.name)

    try:
        with zipfile.ZipFile(BULK_ZIP) as zf:
            name = next(n for n in zf.namelist() if n.endswith(".json"))
            with zf.open(name) as fh:
                payload = json.load(fh)
    except (zipfile.BadZipFile, StopIteration, json.JSONDecodeError, OSError) as exc:
        LOG.warning("Could not read bulk export (%s)", exc)
        return None

    results = payload.get("results", [])
    meta = payload.get("meta", {})
    LOG.info("Bulk export: %s applications (openFDA last_updated %s)",
             f"{len(results):,}", meta.get("last_updated", "?"))
    return results


def fetch_paginated() -> list[dict]:
    """Fallback: page through the live API until exhausted or capped."""
    LOG.info("Falling back to paginated %s ...", API_URL)
    session = make_session()
    results: list[dict] = []
    skip = 0
    while skip < API_SKIP_CEILING:
        resp = request_with_retry(
            session, "GET", API_URL,
            params=openfda_params({"limit": PAGE_SIZE, "skip": skip}), logger=LOG,
        )
        if resp is None:
            LOG.warning("Stopping pagination at skip=%d after repeated failures", skip)
            break
        try:
            payload = resp.json()
        except ValueError:
            LOG.warning("Unparseable JSON at skip=%d", skip)
            break
        batch = payload.get("results", [])
        if not batch:
            break
        results.extend(batch)
        total = payload.get("meta", {}).get("results", {}).get("total", 0)
        skip += len(batch)
        LOG.info("  fetched %s / %s", f"{len(results):,}", f"{total:,}")
        if skip >= total:
            break
        time.sleep(0.25)  # stay well inside openFDA's unauthenticated rate limit
    return results


def flatten(applications: list[dict]) -> pd.DataFrame:
    rows = []
    for app in applications:
        app_no = str(app.get("application_number", "")).strip()
        sponsor = str(app.get("sponsor_name", "")).strip()
        openfda = app.get("openfda") or {}

        # Approval date = earliest approved original submission. Supplements
        # (label changes, new strengths) are tracked separately.
        orig_dates, all_ap_dates = [], []
        for sub in app.get("submissions") or []:
            if str(sub.get("submission_status", "")).upper() != "AP":
                continue
            raw = str(sub.get("submission_status_date", "")).strip()
            if len(raw) != 8 or not raw.isdigit():
                continue
            iso = f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
            all_ap_dates.append(iso)
            if str(sub.get("submission_type", "")).upper() == "ORIG":
                orig_dates.append(iso)

        approval_date = min(orig_dates) if orig_dates else (min(all_ap_dates) if all_ap_dates else "")
        latest_action = max(all_ap_dates) if all_ap_dates else ""

        moa = _joined(openfda, "pharm_class_moa")
        epc = _joined(openfda, "pharm_class_epc")
        chem = _joined(openfda, "pharm_class_cs")

        products = app.get("products") or []
        if not products:
            products = [{}]

        for product in products:
            ingredients = "; ".join(
                f"{i.get('name', '').strip()}".strip()
                for i in (product.get("active_ingredients") or [])
                if i.get("name")
            )
            rows.append({
                "application_number": app_no,
                "application_type": app_no[:4].rstrip("0123456789") or "",
                "company_name": sponsor,
                "product_brand_name": str(product.get("brand_name", "")).strip(),
                "product_generic_name": ingredients or _joined(openfda, "generic_name", 3),
                "active_ingredients": ingredients,
                "dosage_form": str(product.get("dosage_form", "")).strip(),
                "route": str(product.get("route", "")).strip(),
                "marketing_status": str(product.get("marketing_status", "")).strip(),
                "approval_date": approval_date,
                "latest_action_date": latest_action,
                "mechanism_moa": moa,
                "pharm_class_epc": epc,
                "pharm_class_chemical": chem,
                "substance_name": _joined(openfda, "substance_name", 5),
                "manufacturer_name": _joined(openfda, "manufacturer_name", 3),
            })

    df = pd.DataFrame(rows)
    # Same drug appears under many ANDAs; keep the earliest approval per identity.
    df = df.sort_values("approval_date", kind="stable")
    return df.reset_index(drop=True)


def build(force: bool = False) -> pd.DataFrame:
    applications = fetch_bulk(force)
    if applications is None:
        applications = fetch_paginated()
    if not applications:
        raise SystemExit("Could not retrieve any Drugs@FDA data.")

    df = flatten(applications)
    df.to_csv(FDA_APPROVALS_CSV, index=False, encoding="utf-8")
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Drugs@FDA approval records.")
    parser.add_argument("--force", action="store_true", help="Re-download even if cached.")
    args = parser.parse_args()

    df = build(force=args.force)

    dated = df[df["approval_date"] != ""]
    LOG.info("=" * 62)
    LOG.info("Flattened %s product records -> %s", f"{len(df):,}", FDA_APPROVALS_CSV.name)
    LOG.info("  %s distinct applications", f"{df['application_number'].nunique():,}")
    LOG.info("  %s distinct sponsors", f"{df['company_name'].nunique():,}")
    LOG.info("  %s distinct brand names", f"{df['product_brand_name'].nunique():,}")
    LOG.info("  %s rows carry an approval date (%s to %s)",
             f"{len(dated):,}",
             dated["approval_date"].min() if len(dated) else "-",
             dated["approval_date"].max() if len(dated) else "-")
    LOG.info("  %s rows carry a mechanism of action",
             f"{int((df['mechanism_moa'] != '').sum()):,}")
    LOG.info("=" * 62)


if __name__ == "__main__":
    main()
