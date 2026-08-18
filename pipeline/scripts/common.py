"""Shared helpers for the rare disease pipeline.

Everything here is deliberately dependency-light and side-effect free on import,
so each numbered script can be run standalone or via run_all.py.
"""

from __future__ import annotations

import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------- paths

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
OUTPUT_DIR = PROJECT_ROOT / "output"

for _d in (DATA_DIR, RAW_DIR, OUTPUT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Canonical raw CSVs each step produces.
DISEASES_CSV = DATA_DIR / "diseases_raw.csv"
FDA_ORPHAN_CSV = DATA_DIR / "fda_orphan_raw.csv"
FDA_APPROVALS_CSV = DATA_DIR / "fda_approvals_raw.csv"
CLINICAL_TRIALS_CSV = DATA_DIR / "clinical_trials_raw.csv"
CT_PROGRESS_CSV = DATA_DIR / "clinical_trials_progress.csv"

XLSX_PATH = OUTPUT_DIR / "rare_disease_database.xlsx"
MAP_OVERFLOW_CSV = OUTPUT_DIR / "map_full.csv"

CACHE_DAYS = 30

# ---------------------------------------------------------------- logging


def get_logger(name: str) -> logging.Logger:
    """Console logger with a consistent format. Safe to call repeatedly."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s", "%H:%M:%S")
    )
    logger.addHandler(handler)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------- caching


def is_fresh(path: Path, days: int = CACHE_DAYS) -> bool:
    """True if path exists, is non-empty, and was modified within `days`."""
    if not path.exists() or path.stat().st_size == 0:
        return False
    age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
    return age < timedelta(days=days)


def cache_age_days(path: Path) -> float:
    if not path.exists():
        return float("inf")
    delta = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
    return delta.total_seconds() / 86400.0


# ---------------------------------------------------------------- http

USER_AGENT = (
    "rare-disease-database/1.0 (personal research pipeline; "
    "https://github.com/local/rare-disease-database)"
)


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def request_with_retry(
    session: requests.Session,
    method: str,
    url: str,
    *,
    max_attempts: int = 4,
    backoff: float = 2.0,
    timeout: int = 60,
    logger: logging.Logger | None = None,
    **kwargs,
) -> requests.Response | None:
    """Issue a request, retrying transient failures with exponential backoff.

    Returns None instead of raising when every attempt fails, so callers can log
    and continue rather than tearing down a multi-thousand-call pipeline.
    """
    log = logger or get_logger("http")
    for attempt in range(1, max_attempts + 1):
        try:
            resp = session.request(method, url, timeout=timeout, **kwargs)
        except requests.RequestException as exc:
            if attempt == max_attempts:
                log.warning("%s %s failed after %d attempts: %s", method, url, attempt, exc)
                return None
            wait = backoff ** attempt
            log.debug("%s (attempt %d) -> %s; retrying in %.1fs", url, attempt, exc, wait)
            time.sleep(wait)
            continue

        # 429/5xx are worth retrying; other 4xx are not.
        if resp.status_code == 429 or resp.status_code >= 500:
            if attempt == max_attempts:
                log.warning("%s returned HTTP %d after %d attempts", url, resp.status_code, attempt)
                return None
            wait = float(resp.headers.get("Retry-After", backoff ** attempt))
            log.debug("HTTP %d from %s; sleeping %.1fs", resp.status_code, url, wait)
            time.sleep(wait)
            continue

        if not resp.ok:
            log.warning("HTTP %d from %s", resp.status_code, url)
            return None
        return resp
    return None


def download_file(
    session: requests.Session,
    url: str,
    dest: Path,
    *,
    logger: logging.Logger | None = None,
    method: str = "GET",
    **kwargs,
) -> bool:
    """Stream a URL to disk via a temp file so partial downloads never poison the cache."""
    log = logger or get_logger("download")
    tmp = dest.with_suffix(dest.suffix + ".part")
    resp = request_with_retry(
        session, method, url, stream=True, timeout=300, logger=log, **kwargs
    )
    if resp is None:
        return False
    total = 0
    try:
        with open(tmp, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                if chunk:
                    fh.write(chunk)
                    total += len(chunk)
    except Exception as exc:  # noqa: BLE001 - network/disk errors both mean "retry later"
        log.warning("Download of %s aborted: %s", url, exc)
        tmp.unlink(missing_ok=True)
        return False
    finally:
        resp.close()

    tmp.replace(dest)
    log.info("Downloaded %s (%.1f MB)", dest.name, total / 1e6)
    return True


# ---------------------------------------------------------------- text normalisation

# Boilerplate that clutters FDA indication text and CT.gov condition strings.
_STOP_PREFIXES = re.compile(
    r"^(?:for\s+the\s+)?(?:treatment|prevention|diagnosis|management|therapy|"
    r"prophylaxis|adjunct(?:ive)?\s+treatment)\s+(?:of|for|in)\s+",
    re.IGNORECASE,
)
_PAREN = re.compile(r"\([^)]*\)")
_NON_ALNUM = re.compile(r"[^a-z0-9 ]+")
_WS = re.compile(r"\s+")

_ROMAN = {
    " i ": " 1 ", " ii ": " 2 ", " iii ": " 3 ", " iv ": " 4 ", " v ": " 5 ",
    " vi ": " 6 ", " vii ": " 7 ", " viii ": " 8 ", " ix ": " 9 ", " x ": " 10 ",
}

# Words that carry no discriminating power between disease names. Deliberately
# excludes clinically meaningful modifiers (acute/chronic, juvenile/infantile,
# and the numerals left by roman-numeral folding) since those distinguish real
# variants such as acute vs chronic leukaemia.
_NOISE_WORDS = {
    # generic disease nouns
    "disease", "diseases", "disorder", "disorders", "syndrome", "syndromes",
    "condition", "conditions", "deficiency", "type", "subtype",
    # descriptors that appear on both sides of nearly every pair
    "familial", "congenital", "hereditary", "rare", "idiopathic", "primary",
    "classic", "classical", "isolated", "nonclassic",
    # FDA indication-text filler
    "treatment", "treat", "therapy", "prevention", "prevent", "management",
    "prophylaxis", "adjunct", "adjunctive", "patient", "patients", "subject",
    "subjects", "adult", "adults", "pediatric", "paediatric", "children",
    "child", "infant", "infants", "adolescent", "adolescents", "use", "using",
    "associated", "related", "due", "including", "who", "have", "has", "aged",
    "age", "older", "younger", "years", "year", "months", "month",
    # stopwords
    "the", "of", "and", "or", "with", "without", "in", "for", "to", "a", "an",
    "its", "their", "at", "on", "by", "from", "as", "is", "are", "be",
    # "graft versus host" and "graft vs host" must reduce to the same key
    "vs", "versus",
}


def normalize_name(text: str | None) -> str:
    """Aggressively normalise a disease string for exact-match keying.

    Lowercases, strips 'treatment of ...' prefixes and parentheticals, converts
    roman numerals to digits, and collapses punctuation/whitespace.
    """
    if not text:
        return ""
    s = str(text).strip().lower()
    s = _STOP_PREFIXES.sub("", s)
    s = _PAREN.sub(" ", s)
    s = _NON_ALNUM.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    padded = f" {s} "
    for roman, digit in _ROMAN.items():
        padded = padded.replace(roman, digit)
    return _WS.sub(" ", padded).strip()


def singularize(token: str) -> str:
    """Cheap plural folding so 'gliomas' and 'glioma' share a token.

    Deliberately conservative: leaves Latin/Greek endings alone ('aspergillus',
    'fibrosis') rather than mangling them the way a real stemmer would.
    """
    if len(token) > 5 and token.endswith("ies"):
        return token[:-3] + "y"
    # Note "-as" is deliberately NOT protected: this corpus is full of
    # "gliomas", "carcinomas", "lymphomas", "sarcomas". A handful of true
    # singulars ("pancreas") get over-stripped, which is harmless because both
    # sides of a comparison are folded the same way.
    if (
        len(token) > 4
        and token.endswith("s")
        and not token.endswith(("ss", "us", "sis", "is"))
    ):
        return token[:-1]
    return token


def content_tokens(text: str | None) -> frozenset[str]:
    """Meaningful, singularised tokens of a normalised name."""
    return frozenset(
        singularize(t) for t in normalize_name(text).split() if t not in _NOISE_WORDS
    )


def clean_company(name: str | None) -> str:
    """Light canonicalisation of a sponsor name for dedup.

    Deliberately conservative: strips legal suffixes and punctuation but does not
    try to merge subsidiaries into parents (that needs judgement, not a regex).
    """
    if not name:
        return ""
    s = str(name).strip()
    s = _PAREN.sub(" ", s)
    s = re.sub(
        r"\b(inc|inc\.|incorporated|llc|l\.l\.c\.|ltd|ltd\.|limited|corp|corp\.|"
        r"corporation|co|co\.|company|gmbh|ag|s\.a\.|sa|sas|nv|n\.v\.|bv|b\.v\.|"
        r"plc|pty|ab|a/s|aps|oy|srl|s\.r\.l\.|spa|s\.p\.a\.|kk|k\.k\.|"
        r"pharmaceuticals?|pharma|therapeutics|biosciences?|biopharmaceuticals?)\b\.?",
        " ",
        s,
        flags=re.IGNORECASE,
    )
    s = re.sub(r"[,;]+", " ", s)
    s = _WS.sub(" ", s).strip(" .,-")
    return s or str(name).strip()


def title_company(name: str | None) -> str:
    """Display form for a company name: trims whitespace, preserves casing."""
    if not name:
        return ""
    return _WS.sub(" ", str(name).strip())


def clean_product(name: str | None) -> str:
    """Normalise a drug/intervention name for dedup keying."""
    if not name:
        return ""
    s = str(name).strip().lower()
    # CT.gov prefixes interventions with their type, e.g. "Drug: Miglustat".
    s = re.sub(r"^(drug|biological|device|procedure|dietary supplement|genetic|"
               r"radiation|behavioral|combination product|diagnostic test|other)\s*:\s*",
               "", s)
    s = _PAREN.sub(" ", s)
    s = _NON_ALNUM.sub(" ", s)
    return _WS.sub(" ", s).strip()


# ---------------------------------------------------------------- misc

# Ordered least -> most advanced, so max() picks the furthest-along stage.
STAGE_RANK = {
    "Unknown": 0,
    "Early Phase 1": 1,
    "Phase 1": 2,
    "Phase 1/Phase 2": 3,
    "Phase 2": 4,
    "Phase 2/Phase 3": 5,
    "Phase 3": 6,
    "Orphan Designated": 7,
    "Phase 4": 8,
    "Approved": 9,
}

CT_PHASE_LABELS = {
    "EARLY_PHASE1": "Early Phase 1",
    "PHASE1": "Phase 1",
    "PHASE1, PHASE2": "Phase 1/Phase 2",
    "PHASE2": "Phase 2",
    "PHASE2, PHASE3": "Phase 2/Phase 3",
    "PHASE3": "Phase 3",
    "PHASE4": "Phase 4",
    "NA": "Unknown",
}


def most_advanced(stages) -> str:
    """Pick the furthest-along stage from an iterable of stage labels."""
    best, best_rank = "Unknown", -1
    for stage in stages:
        rank = STAGE_RANK.get(stage, 0)
        if rank > best_rank:
            best, best_rank = stage, rank
    return best


def env_float(key: str, default: float) -> float:
    try:
        return float(os.environ[key])
    except (KeyError, ValueError):
        return default


def openfda_params(params: dict | None = None) -> dict:
    """Add the openFDA API key to request params when one is configured.

    Set OPENFDA_API_KEY in a .env file to lift the unauthenticated limits
    (240 requests/minute, 1,000/day) to 240/minute and 120,000/day. The pipeline
    only needs this if step 03 falls back to paginated requests.
    """
    out = dict(params or {})
    key = os.environ.get("OPENFDA_API_KEY", "").strip()
    if key:
        out["api_key"] = key
    return out
