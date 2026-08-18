"""Master runner - rebuilds the whole spreadsheet with one command.

    python scripts/run_all.py            # use cached raw data newer than 30 days
    python scripts/run_all.py --force    # ignore the cache, refetch everything

Each fetch step is skipped when its raw CSV already exists and is younger than
CACHE_DAYS. The spreadsheet build always runs, since it is fast and is the whole
point of the exercise.

Step 4 (clinical trials) is resumable in its own right: if a previous run was
interrupted, running this again continues from where it stopped rather than
refetching thousands of diseases.
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (  # noqa: E402
    CACHE_DAYS,
    CLINICAL_TRIALS_CSV,
    DISEASES_CSV,
    FDA_APPROVALS_CSV,
    FDA_ORPHAN_CSV,
    XLSX_PATH,
    cache_age_days,
    get_logger,
    is_fresh,
)

LOG = get_logger("run_all")
SCRIPT_DIR = Path(__file__).resolve().parent

# (module filename, human label, the CSV that proves the step ran, is_fetch_step)
STEPS = [
    ("01_fetch_diseases.py", "Orphanet diseases", DISEASES_CSV, True),
    ("02_fetch_fda_orphan.py", "FDA orphan designations", FDA_ORPHAN_CSV, True),
    ("03_fetch_fda_approvals.py", "Drugs@FDA approvals", FDA_APPROVALS_CSV, True),
    ("04_fetch_clinical_trials.py", "ClinicalTrials.gov trials", CLINICAL_TRIALS_CSV, True),
    ("05_build_spreadsheet.py", "Build spreadsheet", XLSX_PATH, False),
]


def load_module(filename: str):
    """Import a numbered step module by path (the names are not valid identifiers)."""
    path = SCRIPT_DIR / filename
    spec = importlib.util.spec_from_file_location(f"step_{path.stem}", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rebuild the rare disease spreadsheet end to end.")
    parser.add_argument("--force", action="store_true",
                        help=f"Refetch everything, ignoring the {CACHE_DAYS}-day cache.")
    parser.add_argument("--threshold", type=int, default=88,
                        help="Fuzzy disease-name match cutoff (default 88).")
    parser.add_argument("--skip", nargs="*", default=[],
                        help="Step numbers to skip, e.g. --skip 04")
    args = parser.parse_args()

    LOG.info("=" * 66)
    LOG.info("Rare disease database pipeline%s", "  [--force]" if args.force else "")
    LOG.info("=" * 66)

    started = time.time()
    failures: list[str] = []

    for filename, label, artifact, is_fetch in STEPS:
        number = filename[:2]
        if number in args.skip:
            LOG.info("[%s] %-28s SKIPPED (--skip)", number, label)
            continue

        fresh = is_fetch and not args.force and is_fresh(artifact, CACHE_DAYS)

        # Step 04 is the one step that can be half-finished. Treat a fresh but
        # incomplete fetch as "resume", not "cached", or an interrupted run
        # would silently stay incomplete for 30 days.
        resume_04 = False
        if filename.startswith("04"):
            try:
                complete = load_module(filename).is_complete()
            except Exception:  # noqa: BLE001 - fall back to normal cache rules
                complete = True
            if fresh and not complete:
                LOG.info("[%s] %-28s INCOMPLETE - resuming", number, label)
                fresh, resume_04 = False, True

        if fresh:
            LOG.info("[%s] %-28s CACHED (%.1f days old, limit %d)",
                     number, label, cache_age_days(artifact), CACHE_DAYS)
            continue

        LOG.info("-" * 66)
        LOG.info("[%s] %s ...", number, label)
        LOG.info("-" * 66)
        step_started = time.time()

        try:
            module = load_module(filename)
            if filename.startswith("05"):
                module.build(threshold=args.threshold)
            elif filename.startswith("04"):
                # Resuming keeps existing progress; otherwise we are here because
                # the cache expired or --force was passed, and both mean the
                # trial data should be rebuilt from scratch.
                module.build(force=not resume_04)
            else:
                module.build(force=args.force)
        except SystemExit as exc:
            LOG.error("[%s] %s failed: %s", number, label, exc)
            failures.append(label)
            if filename.startswith(("01", "05")):
                LOG.error("This step is required - stopping.")
                break
        except Exception:  # noqa: BLE001 - report and keep going where possible
            LOG.error("[%s] %s crashed:\n%s", number, label, traceback.format_exc())
            failures.append(label)
            if filename.startswith(("01", "05")):
                LOG.error("This step is required - stopping.")
                break
        else:
            LOG.info("[%s] %s done in %.1f min",
                     number, label, (time.time() - step_started) / 60)

    LOG.info("=" * 66)
    LOG.info("Pipeline finished in %.1f min", (time.time() - started) / 60)
    if failures:
        LOG.warning("Steps with problems: %s", ", ".join(failures))
    if XLSX_PATH.exists():
        LOG.info("Spreadsheet: %s (%.1f MB)",
                 XLSX_PATH, XLSX_PATH.stat().st_size / 1e6)
    else:
        LOG.error("No spreadsheet was produced.")
    LOG.info("=" * 66)

    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
