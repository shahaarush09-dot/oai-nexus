"""Step 1 - Build the disease backbone from Orphanet bulk XML.

Downloads three Orphanet products from orphadata.com and merges them:

  en_product1.xml        names, synonyms, cross-references (ICD-10/11, OMIM,
                         MONDO, UMLS...), and the textual definition
  en_product9_prev.xml   prevalence estimates
  en_product3_<id>.xml   32 classification trees, used to assign categories

Writes data/diseases_raw.csv.

Run standalone:  python scripts/01_fetch_diseases.py [--force]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from lxml import etree

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (  # noqa: E402
    DISEASES_CSV,
    RAW_DIR,
    download_file,
    get_logger,
    is_fresh,
    make_session,
)

LOG = get_logger("01_diseases")

ORPHADATA_BASE = "https://www.orphadata.com/data/xml"

PRODUCT1 = "en_product1.xml"        # nomenclature + cross-references + definitions
PRODUCT9 = "en_product9_prev.xml"   # prevalence

# Orphanet publishes one classification tree per medical specialty. Each file's
# root disorder name becomes the category label (e.g. "Rare genetic disease").
CLASSIFICATION_IDS = [
    146, 147, 148, 150, 152, 156, 181, 182, 183, 184, 185, 186, 187, 188, 189,
    193, 194, 195, 196, 197, 199, 200, 201, 202, 203, 204, 205, 209, 212, 216,
    231, 233,
]

# Cross-reference sources worth keeping as their own columns.
XREF_SOURCES = ("ICD-10", "ICD-11", "OMIM", "MONDO", "UMLS", "MeSH", "GARD")


def _text(element, path: str) -> str:
    """Return stripped text at `path` relative to `element`, or ''."""
    found = element.find(path)
    if found is None or found.text is None:
        return ""
    return found.text.strip()


def download_sources(session, force: bool) -> dict[str, Path]:
    """Fetch all Orphanet XML files, skipping any already cached."""
    wanted = {PRODUCT1: PRODUCT1, PRODUCT9: PRODUCT9}
    for cid in CLASSIFICATION_IDS:
        name = f"en_product3_{cid}.xml"
        wanted[name] = name

    paths: dict[str, Path] = {}
    for name in wanted:
        dest = RAW_DIR / name
        if not force and is_fresh(dest):
            LOG.info("Cached %s (skipping download)", name)
            paths[name] = dest
            continue
        ok = download_file(session, f"{ORPHADATA_BASE}/{name}", dest, logger=LOG)
        if ok:
            paths[name] = dest
        elif dest.exists():
            LOG.warning("Download of %s failed; falling back to stale copy", name)
            paths[name] = dest
        else:
            LOG.error("Could not obtain %s - continuing without it", name)
    return paths


def parse_nomenclature(path: Path) -> dict[str, dict]:
    """Parse en_product1.xml into {orpha_code: {...}} using streaming iterparse."""
    records: dict[str, dict] = {}
    context = etree.iterparse(str(path), events=("end",), tag="Disorder")

    for _event, disorder in context:
        # Nested <Disorder> nodes appear inside DisorderDisorderAssociation
        # (parent/child links). Only top-level entries carry a SynonymList.
        orpha = _text(disorder, "OrphaCode")
        if not orpha:
            _clear(disorder)
            continue

        synonyms = [
            s.text.strip()
            for s in disorder.findall("SynonymList/Synonym")
            if s.text and s.text.strip()
        ]

        xrefs: dict[str, list[str]] = {}
        for ref in disorder.findall("ExternalReferenceList/ExternalReference"):
            source = _text(ref, "Source")
            value = _text(ref, "Reference")
            if source and value:
                xrefs.setdefault(source, []).append(value)

        definition = ""
        for section in disorder.findall(
            "SummaryInformationList/SummaryInformation/TextSectionList/TextSection"
        ):
            kind = _text(section, "TextSectionType/Name")
            contents = _text(section, "Contents")
            if contents and (not kind or "definition" in kind.lower()):
                definition = contents
                break
            if contents and not definition:
                definition = contents

        row = {
            "orpha_code": orpha,
            "disease_name": _text(disorder, "Name"),
            "synonyms": "; ".join(synonyms),
            "n_synonyms": len(synonyms),
            "disorder_type": _text(disorder, "DisorderType/Name"),
            "disorder_group": _text(disorder, "DisorderGroup/Name"),
            "definition": definition,
            "orphanet_url": _text(disorder, "ExpertLink"),
        }
        for source in XREF_SOURCES:
            key = source.lower().replace("-", "")
            row[f"{key}_code"] = "; ".join(xrefs.get(source, []))

        # Keep the richest record if an orpha code appears more than once.
        existing = records.get(orpha)
        if existing is None or len(row["definition"]) > len(existing["definition"]):
            records[orpha] = row

        _clear(disorder)

    del context
    return records


def _clear(element) -> None:
    """Free a parsed element and its already-processed siblings."""
    element.clear()
    parent = element.getparent()
    if parent is not None:
        while element.getprevious() is not None:
            del parent[0]


def parse_prevalence(path: Path) -> dict[str, dict]:
    """Parse en_product9_prev.xml, picking the most informative estimate per disease."""
    out: dict[str, dict] = {}
    context = etree.iterparse(str(path), events=("end",), tag="Disorder")

    for _event, disorder in context:
        orpha = _text(disorder, "OrphaCode")
        if not orpha:
            _clear(disorder)
            continue

        best = None
        best_score = -1
        all_classes: list[str] = []

        for prev in disorder.findall("PrevalenceList/Prevalence"):
            ptype = _text(prev, "PrevalenceType/Name")
            pclass = _text(prev, "PrevalenceClass/Name")
            geo = _text(prev, "PrevalenceGeographic/Name")
            status = _text(prev, "PrevalenceValidationStatus/Name")
            qualification = _text(prev, "PrevalenceQualification/Name")
            val = _text(prev, "ValMoy")

            if pclass:
                all_classes.append(pclass)

            # Prefer validated, worldwide, point-prevalence estimates that
            # actually carry a class band.
            score = 0
            if status.lower() == "validated":
                score += 8
            if geo.lower() == "worldwide":
                score += 4
            if ptype.lower() == "point prevalence":
                score += 2
            if pclass:
                score += 1
            if score > best_score:
                best_score = score
                best = {
                    "prevalence_class": pclass,
                    "prevalence_type": ptype,
                    "prevalence_qualification": qualification,
                    "prevalence_geographic": geo,
                    "prevalence_value": val,
                }

        if best:
            best["prevalence_all_classes"] = "; ".join(sorted(set(all_classes)))
            out[orpha] = best

        _clear(disorder)

    del context
    return out


def parse_classification(path: Path) -> tuple[str, set[str]]:
    """Return (category_name, {orpha codes appearing in this tree})."""
    tree = etree.parse(str(path))
    root_node = tree.find(".//Classification/ClassificationNodeRootList/ClassificationNode")
    category = ""
    if root_node is not None:
        category = _text(root_node, "Disorder/Name")
    if not category:
        category = _text(tree.getroot(), ".//Classification/Name")

    codes = {
        el.text.strip()
        for el in tree.findall(".//Disorder/OrphaCode")
        if el.text and el.text.strip()
    }
    return category, codes


def build(force: bool = False) -> pd.DataFrame:
    session = make_session()
    paths = download_sources(session, force)

    if PRODUCT1 not in paths:
        raise SystemExit("Cannot continue: en_product1.xml is unavailable.")

    LOG.info("Parsing %s ...", PRODUCT1)
    nomenclature = parse_nomenclature(paths[PRODUCT1])
    LOG.info("  %s disorder entries parsed", f"{len(nomenclature):,}")

    prevalence: dict[str, dict] = {}
    if PRODUCT9 in paths:
        LOG.info("Parsing %s ...", PRODUCT9)
        prevalence = parse_prevalence(paths[PRODUCT9])
        LOG.info("  %s entries carry a prevalence estimate", f"{len(prevalence):,}")

    LOG.info("Parsing %d classification trees ...", len(CLASSIFICATION_IDS))
    categories: dict[str, list[str]] = {}
    category_order: dict[str, int] = {}
    for cid in CLASSIFICATION_IDS:
        name = f"en_product3_{cid}.xml"
        if name not in paths:
            continue
        try:
            category, codes = parse_classification(paths[name])
        except (etree.XMLSyntaxError, OSError) as exc:
            LOG.warning("  skipping %s: %s", name, exc)
            continue
        if not category:
            continue
        category_order[category] = len(category_order)
        for code in codes:
            bucket = categories.setdefault(code, [])
            if category not in bucket:
                bucket.append(category)

    # A disease commonly sits in several trees and Orphanet does not rank them,
    # so there is no single "correct" primary. Keep Orphanet's own tree order for
    # determinism, but push the etiological catch-all behind organ-system trees
    # so `category` is as specific as the source allows. `all_categories` always
    # carries the full, unranked truth.
    catch_all = {"Rare genetic disease"}
    for bucket in categories.values():
        bucket.sort(key=lambda c: (c in catch_all, category_order.get(c, 999)))
    LOG.info("  %s disorders assigned to >=1 category", f"{len(categories):,}")

    rows = []
    for orpha, row in nomenclature.items():
        merged = dict(row)
        merged.update(
            prevalence.get(
                orpha,
                {
                    "prevalence_class": "",
                    "prevalence_type": "",
                    "prevalence_qualification": "",
                    "prevalence_geographic": "",
                    "prevalence_value": "",
                    "prevalence_all_classes": "",
                },
            )
        )
        cats = categories.get(orpha, [])
        merged["category"] = cats[0] if cats else ""
        merged["all_categories"] = " | ".join(cats)
        # Only true disorders get queried against ClinicalTrials.gov; Orphanet
        # also ships "Category" and "Group of disorders" nodes that are buckets,
        # not diseases.
        merged["is_disease"] = merged["disorder_group"] == "Disorder"
        rows.append(merged)

    df = pd.DataFrame(rows)
    column_order = [
        "orpha_code", "disease_name", "synonyms", "n_synonyms", "category",
        "all_categories", "disorder_type", "disorder_group", "is_disease",
        "prevalence_class", "prevalence_type", "prevalence_qualification",
        "prevalence_geographic", "prevalence_value", "prevalence_all_classes",
        "definition",
    ] + [f"{s.lower().replace('-', '')}_code" for s in XREF_SOURCES] + ["orphanet_url"]
    df = df[[c for c in column_order if c in df.columns]]
    df = df.sort_values("disease_name", kind="stable").reset_index(drop=True)

    df.to_csv(DISEASES_CSV, index=False, encoding="utf-8")
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and parse Orphanet rare disease data.")
    parser.add_argument("--force", action="store_true", help="Re-download even if cached.")
    args = parser.parse_args()

    df = build(force=args.force)

    n_disease = int(df["is_disease"].sum())
    LOG.info("=" * 62)
    LOG.info("Parsed %s Orphanet entries -> %s", f"{len(df):,}", DISEASES_CSV.name)
    LOG.info("  %s are true diseases (queried for trials)", f"{n_disease:,}")
    LOG.info("  %s are categories/groups (kept, not queried)", f"{len(df) - n_disease:,}")
    LOG.info("  %s have a definition", f"{int((df['definition'].str.len() > 0).sum()):,}")
    LOG.info("  %s have a prevalence estimate", f"{int((df['prevalence_class'].str.len() > 0).sum()):,}")
    LOG.info("  %s have an ICD-10 code", f"{int((df['icd10_code'].str.len() > 0).sum()):,}")
    LOG.info("  %s have >=1 category", f"{int((df['category'].str.len() > 0).sum()):,}")
    LOG.info("=" * 62)


if __name__ == "__main__":
    main()
