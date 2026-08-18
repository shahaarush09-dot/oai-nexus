"""Step 4 - ClinicalTrials.gov API v2 trial search, one query per disease.

This is the long pole of the pipeline: roughly 7,500 queries against
https://clinicaltrials.gov/api/v2/studies, one per Orphanet disorder.

RESUMABILITY
------------
Trial rows are appended to data/clinical_trials_raw.csv as each disease
finishes, and the disease is recorded in data/clinical_trials_progress.csv at
the same moment. Re-running skips every disease already in the progress file, so
an interrupted run picks up where it stopped instead of restarting from zero.
Rows are buffered per-disease and only written once that disease completes, so a
kill mid-disease cannot leave half its trials behind a "done" marker.

Only entries with DisorderGroup == "Disorder" are queried; Orphanet's category
and group nodes are buckets, not diseases, and querying them wastes calls.

Writes data/clinical_trials_raw.csv (+ a progress sidecar).

Run standalone:  python scripts/04_fetch_clinical_trials.py [--force] [--limit N]
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (  # noqa: E402
    CLINICAL_TRIALS_CSV,
    CT_PROGRESS_CSV,
    DISEASES_CSV,
    CT_PHASE_LABELS,
    env_float,
    get_logger,
    make_session,
    request_with_retry,
)

LOG = get_logger("04_trials")

API_URL = "https://clinicaltrials.gov/api/v2/studies"
PAGE_SIZE = 100
MAX_PAGES_PER_DISEASE = 10          # hard stop at 1,000 trials for one disease
REQUEST_DELAY = env_float("CT_DELAY", 0.15)   # polite pause between calls
LOG_EVERY = 100

FIELDS = ",".join([
    "NCTId", "BriefTitle", "OverallStatus", "Phase", "StudyType",
    "LeadSponsorName", "LeadSponsorClass", "CollaboratorName",
    "InterventionName", "InterventionType", "Condition", "StartDate",
])

TRIAL_COLUMNS = [
    "orpha_code", "disease_name", "nct_id", "brief_title", "trial_conditions",
    "lead_sponsor", "lead_sponsor_class", "collaborators",
    "intervention_name", "intervention_type",
    "phase", "overall_status", "study_type", "start_date",
]

PROGRESS_COLUMNS = ["orpha_code", "disease_name", "n_trials", "n_rows", "status", "fetched_at"]


# ClinicalTrials.gov rejects condition queries above ~13 terms with
# "Error parsing query in Conditions or disease: Too complicated query" (HTTP
# 400). Measured: 12 terms succeed, 14 fail. Orphanet has a few hundred names
# long enough to trip this, e.g. "Global developmental delay-nystagmus-short
# stature-corpus callosum hypoplasia-white matter abnormalities syndrome".
MAX_QUERY_TERMS = 12

_TERM_SPLIT = re.compile(r"[^\w]+", re.UNICODE)


def query_term(disease_name: str) -> str:
    """Reduce a disease name to a query the API will accept.

    Hyphenated Orphanet names are exploded into separate terms by the API, so
    long compound names must be truncated to stay under the term ceiling.
    """
    terms = [t for t in _TERM_SPLIT.split(disease_name) if t]
    if len(terms) <= MAX_QUERY_TERMS:
        return disease_name
    return " ".join(terms[:MAX_QUERY_TERMS])


def phase_label(phases: list[str]) -> str:
    """Map CT.gov's phase enum list onto a human-readable label."""
    if not phases:
        return "Unknown"
    key = ", ".join(sorted(phases))
    return CT_PHASE_LABELS.get(key, CT_PHASE_LABELS.get(phases[0], "Unknown"))


def parse_study(study: dict, orpha_code: str, disease_name: str) -> list[dict]:
    """Flatten one study into one row per intervention."""
    section = study.get("protocolSection", {})
    ident = section.get("identificationModule", {})
    status = section.get("statusModule", {})
    sponsors = section.get("sponsorCollaboratorsModule", {})
    conditions = section.get("conditionsModule", {})
    design = section.get("designModule", {})
    arms = section.get("armsInterventionsModule", {})

    lead = sponsors.get("leadSponsor") or {}
    collaborators = "; ".join(
        c.get("name", "").strip()
        for c in (sponsors.get("collaborators") or [])
        if c.get("name")
    )

    base = {
        "orpha_code": orpha_code,
        "disease_name": disease_name,
        "nct_id": ident.get("nctId", ""),
        "brief_title": (ident.get("briefTitle") or "").strip(),
        "trial_conditions": "; ".join(conditions.get("conditions") or []),
        "lead_sponsor": (lead.get("name") or "").strip(),
        "lead_sponsor_class": lead.get("class", ""),
        "collaborators": collaborators,
        "phase": phase_label(design.get("phases") or []),
        "overall_status": status.get("overallStatus", ""),
        "study_type": design.get("studyType", ""),
        "start_date": (status.get("startDateStruct") or {}).get("date", ""),
    }

    interventions = arms.get("interventions") or []
    if not interventions:
        return [dict(base, intervention_name="", intervention_type="")]

    rows, seen = [], set()
    for item in interventions:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append(dict(base, intervention_name=name,
                         intervention_type=item.get("type", "")))
    return rows or [dict(base, intervention_name="", intervention_type="")]


def fetch_disease(session, orpha_code: str, disease_name: str) -> tuple[list[dict], int, str]:
    """Query every page of trials for one disease. Returns (rows, n_trials, status)."""
    rows: list[dict] = []
    seen_nct: set[str] = set()
    token = None
    pages = 0
    status = "ok"

    while pages < MAX_PAGES_PER_DISEASE:
        params = {
            "query.cond": query_term(disease_name),
            "pageSize": PAGE_SIZE,
            "fields": FIELDS,
        }
        if token:
            params["pageToken"] = token

        resp = request_with_retry(session, "GET", API_URL, params=params,
                                  logger=LOG, timeout=60)
        if resp is None:
            # Network/rate-limit failure: keep whatever we already have and mark
            # the disease so a later run can retry it.
            return rows, len(seen_nct), "error"

        try:
            payload = resp.json()
        except ValueError:
            return rows, len(seen_nct), "error"

        studies = payload.get("studies") or []
        for study in studies:
            nct = (study.get("protocolSection", {})
                        .get("identificationModule", {})
                        .get("nctId", ""))
            if nct and nct in seen_nct:
                continue
            if nct:
                seen_nct.add(nct)
            rows.extend(parse_study(study, orpha_code, disease_name))

        pages += 1
        token = payload.get("nextPageToken")
        if not token or not studies:
            break
        time.sleep(REQUEST_DELAY)

    if pages >= MAX_PAGES_PER_DISEASE and token:
        status = "truncated"
    return rows, len(seen_nct), status


def load_progress() -> set[str]:
    """Orpha codes already fetched successfully in a previous run."""
    if not CT_PROGRESS_CSV.exists():
        return set()
    try:
        done = pd.read_csv(CT_PROGRESS_CSV, dtype=str)
    except (pd.errors.EmptyDataError, OSError):
        return set()
    if "orpha_code" not in done.columns:
        return set()
    # Retry anything that previously errored out.
    ok = done[done.get("status", "ok") != "error"]
    return set(ok["orpha_code"].dropna().astype(str))


def queryable_diseases() -> pd.DataFrame:
    """The Orphanet entries this step queries: real disorders with a name."""
    diseases = pd.read_csv(DISEASES_CSV, dtype=str).fillna("")
    diseases = diseases[diseases["is_disease"] == "True"]
    return diseases[diseases["disease_name"].str.strip() != ""]


def is_complete() -> bool:
    """True when every queryable disease already has a progress record.

    run_all uses this to tell "finished" apart from "interrupted": a half-done
    fetch inside the cache window must resume, not be skipped as cached.
    """
    if not DISEASES_CSV.exists() or not CT_PROGRESS_CSV.exists():
        return False
    try:
        return len(queryable_diseases()[~queryable_diseases()["orpha_code"]
                                        .isin(load_progress())]) == 0
    except (OSError, pd.errors.EmptyDataError):
        return False


def build(force: bool = False, limit: int | None = None) -> pd.DataFrame:
    if not DISEASES_CSV.exists():
        raise SystemExit("data/diseases_raw.csv not found - run 01_fetch_diseases.py first.")

    diseases = queryable_diseases()

    if force:
        CLINICAL_TRIALS_CSV.unlink(missing_ok=True)
        CT_PROGRESS_CSV.unlink(missing_ok=True)
        LOG.info("--force: cleared previous trial data")

    done = load_progress()
    if done:
        LOG.info("Resuming: %s diseases already fetched", f"{len(done):,}")

    todo = diseases[~diseases["orpha_code"].isin(done)]
    if limit:
        todo = todo.head(limit)

    total = len(todo)
    LOG.info("Querying ClinicalTrials.gov for %s diseases (%.2fs delay, ~%.0f min est.)",
             f"{total:,}", REQUEST_DELAY, total * (REQUEST_DELAY + 0.15) / 60)

    if total == 0:
        LOG.info("Nothing to do - all diseases already fetched.")
        return pd.read_csv(CLINICAL_TRIALS_CSV, dtype=str).fillna("") \
            if CLINICAL_TRIALS_CSV.exists() else pd.DataFrame(columns=TRIAL_COLUMNS)

    session = make_session()
    write_header = not CLINICAL_TRIALS_CSV.exists()
    progress_header = not CT_PROGRESS_CSV.exists()

    started = time.time()
    n_rows_total = n_trials_total = n_errors = n_with_trials = 0

    with open(CLINICAL_TRIALS_CSV, "a", newline="", encoding="utf-8") as trials_fh, \
         open(CT_PROGRESS_CSV, "a", newline="", encoding="utf-8") as progress_fh:

        trials_writer = csv.DictWriter(trials_fh, fieldnames=TRIAL_COLUMNS)
        progress_writer = csv.DictWriter(progress_fh, fieldnames=PROGRESS_COLUMNS)
        if write_header:
            trials_writer.writeheader()
        if progress_header:
            progress_writer.writeheader()

        for i, (_idx, disease) in enumerate(todo.iterrows(), start=1):
            orpha = disease["orpha_code"]
            name = disease["disease_name"]

            try:
                rows, n_trials, status = fetch_disease(session, orpha, name)
            except Exception as exc:  # noqa: BLE001 - never let one disease kill the run
                LOG.warning("Unexpected error on %s (%s): %s", name, orpha, exc)
                rows, n_trials, status = [], 0, "error"

            # Write rows and the done-marker together so an interrupt cannot
            # leave a disease marked complete with only some of its trials saved.
            if rows:
                trials_writer.writerows(rows)
            progress_writer.writerow({
                "orpha_code": orpha,
                "disease_name": name,
                "n_trials": n_trials,
                "n_rows": len(rows),
                "status": status,
                "fetched_at": datetime.now().isoformat(timespec="seconds"),
            })
            trials_fh.flush()
            progress_fh.flush()

            n_rows_total += len(rows)
            n_trials_total += n_trials
            if n_trials:
                n_with_trials += 1
            if status == "error":
                n_errors += 1

            if i % LOG_EVERY == 0 or i == total:
                elapsed = time.time() - started
                rate = i / elapsed if elapsed else 0
                remaining = (total - i) / rate / 60 if rate else 0
                LOG.info(
                    "[%s/%s] %.0f%% | %s trials, %s rows | %s with trials, %s errors "
                    "| %.1f/s | ~%.0f min left",
                    f"{i:,}", f"{total:,}", 100 * i / total,
                    f"{n_trials_total:,}", f"{n_rows_total:,}",
                    f"{n_with_trials:,}", n_errors, rate, remaining,
                )

            time.sleep(REQUEST_DELAY)

    LOG.info("Fetch loop finished in %.1f min", (time.time() - started) / 60)
    return pd.read_csv(CLINICAL_TRIALS_CSV, dtype=str).fillna("")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch ClinicalTrials.gov studies per disease.")
    parser.add_argument("--force", action="store_true",
                        help="Discard previous progress and refetch everything.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Only process the first N outstanding diseases (for testing).")
    args = parser.parse_args()

    df = build(force=args.force, limit=args.limit)

    LOG.info("=" * 62)
    LOG.info("Collected %s trial-intervention rows -> %s",
             f"{len(df):,}", CLINICAL_TRIALS_CSV.name)
    if len(df):
        LOG.info("  %s distinct trials (NCT IDs)", f"{df['nct_id'].nunique():,}")
        LOG.info("  %s diseases with >=1 trial", f"{df['orpha_code'].nunique():,}")
        LOG.info("  %s distinct lead sponsors", f"{df['lead_sponsor'].nunique():,}")
        LOG.info("  %s distinct intervention names",
                 f"{df[df['intervention_name'] != '']['intervention_name'].nunique():,}")
    LOG.info("=" * 62)


if __name__ == "__main__":
    main()
