// Server-side only. API key is read from environment and never exposed to the client.
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ENTITY_TYPES = {
  disease: { file: "diseases.json", nameField: "diseaseName", label: "disease" },
  company: { file: "companies.json", nameField: "companyName", label: "company" },
  product: { file: "products.json", nameField: "productName", label: "product" },
};

const MODEL = "claude-haiku-4-5";

// Per-session cap from the spec. The IP ceiling above it exists because
// sessionId arrives in the request body — anyone can regenerate it and reset
// their own counter, so on its own it is a UX guard, not a limit. The IP is
// derived server-side from proxy headers and is what actually bounds spend.
const SESSION_LIMIT = 20;
const IP_LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Bounded so a script walking thousands of distinct entity names can't grow
// the cache until the process runs out of memory.
const CACHE_MAX_ENTRIES = 500;

const SYSTEM_PROMPT = `You are a narrow, rigorous lookup tool for recent biotech and rare disease information.
You will be given the name of ONE specific drug, company, or disease, along with recent
web search results about it. Your job is to write a factual, up-to-date overview (2-3 sentences)
and list 2-4 of the most recent news items about this exact entity, each attributed to its source.

CRITICAL REQUIREMENTS:
- Use ONLY information from the search results provided. Do not supplement from general knowledge.
- Prioritize the most recent sources. If results span multiple dates, lead with the newest.
- Only cite sources that are reliable: official FDA/government databases, peer-reviewed journals,
  major news outlets (Reuters, Bloomberg, AP, STAT News), company official statements, ClinicalTrials.gov.
  Do not cite blogs, forums, press releases without verification, or low-authority sources.
- If search results contain conflicting information, note the conflict explicitly rather than
  picking one: "Recent reports indicate X, though some sources state Y."
- If search results don't contain enough current information, say so plainly: "Recent sources
  do not yet contain substantive updates on this entity."

TONE AND STYLE:
- Write in plain, factual prose. No speculation, no predictions, no investment advice.
- Recent news items should each be a single short sentence, attributed by source name and date if available.
- No bullet formatting in the overview; news items can be terse but must be complete.
- No em dashes, no asterisks, no headers, no formatting tricks.
- If a piece of information is dated (e.g., "FDA approval on [date]"), include the date.

SCOPE:
- Discuss only the named entity. Do not discuss competitors, similar drugs, or related diseases
  unless they are directly mentioned in the search results as context for this specific entity.
- For drugs: clinical status, approval status, trial updates, manufacturing/supply news,
  pricing/access news, safety updates.
- For companies: pipeline updates, partnerships, funding, regulatory actions, clinical results.
- For diseases: treatment landscape updates, new trial launches, recent epidemiological data,
  clinical guideline changes.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overview: {
      type: "string",
      description: "A factual 2-3 sentence overview drawn only from the search results.",
    },
    recentNews: {
      type: "array",
      description: "2-4 recent news items about this exact entity.",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "One short, complete sentence." },
          source: { type: "string", description: "The source name, plus date if known." },
        },
        required: ["text", "source"],
        additionalProperties: false,
      },
    },
  },
  required: ["overview", "recentNews"],
  additionalProperties: false,
};

// Name sets for entity validation, built once per entity type on first use.
//
// Only the names are retained: the parsed array is discarded as soon as the
// Set is built, so validating against diseases.json costs a few hundred KB of
// resident memory rather than the 10MB the file occupies on disk.
const nameSets = new Map();

async function getNameSet(entityType) {
  const cached = nameSets.get(entityType);
  if (cached) return cached;

  const { file, nameField } = ENTITY_TYPES[entityType];
  const promise = fs
    .readFile(path.join(process.cwd(), "public", "data", file), "utf8")
    .then((raw) => {
      const set = new Set();
      for (const record of JSON.parse(raw)) {
        const name = record[nameField];
        if (typeof name === "string" && name.trim()) {
          set.add(name.trim().toLowerCase());
        }
      }
      return set;
    })
    .catch((err) => {
      // Don't cache a rejection — a transient read failure would otherwise
      // poison validation for the life of the process.
      nameSets.delete(entityType);
      throw err;
    });

  nameSets.set(entityType, promise);
  return promise;
}

const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order so eviction below removes the least recently
  // read entry rather than the oldest written one.
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, storedAt: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

// The Anthropic web search tool exposes no date-range parameter, so recency
// is steered through the query text and the system prompt rather than a
// filter the API would enforce.
function buildQuery(entityType, entityName) {
  if (entityType === "product") return `"${entityName}" drug news recent`;
  if (entityType === "company") return `"${entityName}" biotech company news recent`;
  return `"${entityName}" treatment research news recent`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const entityType = body?.entityType;
  const entityName = typeof body?.entityName === "string" ? body.entityName.trim() : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 100) : "";

  if (!Object.prototype.hasOwnProperty.call(ENTITY_TYPES, entityType)) {
    return Response.json(
      { error: "entityType must be one of: disease, company, product" },
      { status: 400 }
    );
  }
  if (!entityName) {
    return Response.json({ error: "entityName is required" }, { status: 400 });
  }

  const ip = getClientIp(request);

  // IP ceiling first: it's the limit a client can't talk its way around, so
  // it should reject before any per-session bookkeeping.
  const ipCheck = checkRateLimit("ask-nexus-ip", ip, IP_LIMIT, WINDOW_MS);
  if (!ipCheck.allowed) {
    return Response.json({ error: "Too many requests this session" }, { status: 429 });
  }

  const sessionCheck = checkRateLimit(
    "ask-nexus-session",
    `${ip}:${sessionId}`,
    SESSION_LIMIT,
    WINDOW_MS
  );
  if (!sessionCheck.allowed) {
    return Response.json({ error: "Too many requests this session" }, { status: 429 });
  }

  // The guardrail that keeps this endpoint from being a general-purpose
  // search proxy: the entity must exist in the shipped dataset, so a crafted
  // request can't aim the web search and the model at an arbitrary topic.
  let nameSet;
  try {
    nameSet = await getNameSet(entityType);
  } catch (err) {
    console.error("Ask Nexus dataset load failed:", err);
    return Response.json({ error: "Unable to validate entity" }, { status: 500 });
  }

  const normalized = entityName.toLowerCase();
  if (!nameSet.has(normalized)) {
    return Response.json({ error: "Entity not found in database" }, { status: 404 });
  }

  const cacheKey = `${entityType}:${normalized}`;
  const hit = cacheGet(cacheKey);
  if (hit) {
    return Response.json({ ...hit, cached: true });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      tools: [
        {
          // allowed_callers "direct" opts out of programmatic tool calling,
          // which this tool version otherwise implies and Haiku 4.5 does not
          // support. Same configuration as the Diligence route.
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 2,
          allowed_callers: ["direct"],
        },
      ],
      output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Search for recent news about this ${ENTITY_TYPES[entityType].label}, then summarize what you find.\n\nSearch query: ${buildQuery(entityType, entityName)}\n\nEntity name: ${entityName}`,
        },
      ],
    });
  } catch (err) {
    console.error("Ask Nexus model call failed:", err);
    // A failure here covers both the hosted web search and the model turn —
    // they run inside one request, so the two error cases in the spec are not
    // separately observable from the caller's side.
    const status = err?.status === 429 ? 429 : 500;
    return Response.json(
      { error: status === 429 ? "Too many requests this session" : "Unable to generate summary" },
      { status }
    );
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Ask Nexus returned unparseable output:", err, text.slice(0, 300));
    return Response.json({ error: "Unable to generate summary" }, { status: 500 });
  }

  const result = {
    entityType,
    entityName,
    overview: parsed.overview,
    recentNews: Array.isArray(parsed.recentNews) ? parsed.recentNews.slice(0, 4) : [],
  };

  cacheSet(cacheKey, result);
  return Response.json({ ...result, cached: false });
}
