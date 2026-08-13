// Client-side transport for Ask Nexus: session identity, the per-session
// result cache, and the single fetch. Kept out of the popover component so
// the caching and error-mapping rules are testable without a DOM.

const SESSION_KEY = "nexus-ask-sessionid";

// The table columns call products "drug" (see exploreColumns.js); the API
// validates against the dataset files and calls them "product". Without this
// bridge every product lookup would 400 on entityType.
const API_ENTITY_TYPE = {
  disease: "disease",
  company: "company",
  drug: "product",
};

export function getAskSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Private browsing can throw on storage access. A per-call id still
    // works — the server's IP ceiling is the limit that actually binds, so
    // losing session continuity degrades the cap rather than removing it.
    return crypto.randomUUID();
  }
}

// Results live for the page's lifetime, keyed by entity. Reopening a popover
// must not re-fetch: the server caches for 24h, so a second request would
// return identical bytes while consuming one of the 20 session lookups.
// Errors are cached too — a 404 is a stable fact about the entity, and
// retrying it automatically would burn the same budget to no effect.
const results = new Map();

function cacheKey(entity, name) {
  return `${entity}:${name.trim().toLowerCase()}`;
}

export function getCachedAsk(entity, name) {
  return results.get(cacheKey(entity, name)) || null;
}

const ERROR_BY_STATUS = {
  404:
    "No recent-news lookup is available for this record. Its name doesn't match an entry in the source index, usually a formatting difference.",
  429: "Too many lookups this session. Try again in a few moments.",
  500:
    "Unable to fetch recent sources. The entity may be too new or obscure for current news coverage.",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function askNexus(entity, name) {
  const key = cacheKey(entity, name);
  const cached = results.get(key);
  if (cached) return cached;

  let outcome;
  try {
    const res = await fetch("/api/ask-nexus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: API_ENTITY_TYPE[entity],
        entityName: name,
        sessionId: getAskSessionId(),
      }),
    });

    if (!res.ok) {
      outcome = {
        status: "error",
        message: ERROR_BY_STATUS[res.status] || GENERIC_ERROR,
      };
    } else {
      const data = await res.json();
      outcome = {
        status: "success",
        overview: data.overview,
        recentNews: Array.isArray(data.recentNews) ? data.recentNews : [],
        // When the sources were consulted, not when the news happened —
        // labelled accordingly in the UI so the two aren't conflated.
        checkedAt: new Date(),
      };
    }
  } catch {
    // Network failure or malformed JSON — never a status code to map.
    outcome = { status: "error", message: GENERIC_ERROR };
  }

  results.set(key, outcome);
  return outcome;
}
