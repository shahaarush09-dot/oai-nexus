"""Self-check for the disease-name matcher.

The matcher is the part of this pipeline most likely to break silently: a tweak
to the noise-word list or the thresholds can quietly start accepting wrong links
or dropping right ones, and you would only notice by reading the spreadsheet.

These cases are all real pairs observed in the data, including the ones that
were wrong during development.

    python scripts/test_matching.py

Exits non-zero if any case misbehaves.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import DISEASES_CSV, content_tokens, get_logger  # noqa: E402

LOG = get_logger("test_matching")

# (source text, Orphanet disease name, should these link?)
CASES: list[tuple[str, str, bool]] = [
    # --- must match: single distinctive token carries the link
    ("IgA Nephropathy; Focal Segmental Glomerulosclerosis; Alport Syndrome",
     "Alport syndrome", True),
    ("Gaucher Disease Type 1", "Gaucher disease", True),
    ("Fabry Disease", "Fabry disease", True),
    ("Rett Syndrome", "Rett syndrome", True),
    ("Pompe Disease (Late-Onset)", "Pompe disease", True),
    ("Treatment of patients with cystic fibrosis", "Cystic fibrosis", True),
    ("Cystic Fibrosis (CF)", "Cystic fibrosis", True),
    ("treatment of patients with Duchenne muscular dystrophy (DMD)",
     "Duchenne muscular dystrophy", True),
    ("Treatment of gliomas", "Glioma", True),                      # plural folding
    ("Graft vs Host Disease; Transplantation, Homologous",
     "Graft versus host disease", True),                            # vs / versus
    ("Treatment of Huntington's Disease", "Huntington disease", True),

    # --- must not match: these were all false positives during development
    ("Treatment of invasive Aspergillus infections",
     "Invasive infections due to vancomycin-resistant enterococci", False),
    ("Treatment of eosinophilic gastritis", "Eosinophilic cystitis", False),
    ("Treatment of non-Hodgkin's lymphoma", "Classic Hodgkin lymphoma", False),
    ("Treatment of pediatric chronic hepatitis B infection",
     "Chronic Epstein-Barr virus infection syndrome", False),
    ("Treatment of pediatric hyperphosphatemia", "Juvenile Paget disease", False),
    ("Treatment of pericarditis.",
     "Camptodactyly-arthropathy-coxa-vara-pericarditis syndrome", False),
    ("Infection, Human Immunodeficiency Virus", "KID syndrome", False),
    ("Renal Cell Carcinoma (RCC)",
     "Autosomal dominant multiple pterygium syndrome", False),
    ("Hepatoblastoma; Recurrent Childhood Liver Cancer", "Ependymoblastoma", False),
    ("Treatment of carcinoma in situ (CIS) of the urinary bladder",
     "Small cell carcinoma of the bladder", False),
]


def main() -> int:
    spec = importlib.util.spec_from_file_location(
        "build5", SCRIPT_DIR / "05_build_spreadsheet.py")
    build5 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(build5)

    if not DISEASES_CSV.exists():
        LOG.error("data/diseases_raw.csv not found - run 01_fetch_diseases.py first.")
        return 2

    # The IDF table is derived from the real disease corpus, so it has to be
    # built before any verdict means anything.
    diseases = pd.read_csv(DISEASES_CSV, dtype=str).fillna("")
    build5.build_disease_index(diseases)

    failures = 0
    print(f"\n{'':9}{'expect':8}source -> disease")
    print("-" * 108)
    for source, disease, expected in CASES:
        ok, _rank = build5.structural_verdict(
            content_tokens(source), content_tokens(disease))
        passed = ok == expected
        failures += not passed
        print(f"{'PASS' if passed else '**FAIL**':9}{str(expected):8}"
              f"{source[:48]:50} -> {disease[:44]}")

    print("-" * 108)
    print(f"{len(CASES) - failures}/{len(CASES)} cases behave as intended\n")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
