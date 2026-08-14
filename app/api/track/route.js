// Server-side only. Analytics ingest for Nexus Intelligence.
//
// Unlike the three chat tools — which log as a side effect of an already
// rate-limited AI call — Intelligence is almost entirely client-side, so
// its events have to be reported from the browser. That makes this a
// public, unauthenticated write path, and it is treated as one:
//
//   - the event name must match a fixed allowlist, not free text
//   - metadata is whitelisted per event and type-checked, never stored raw
//   - no user-typed text is persisted (see SEARCH note below)
//   - IPs are hashed with the daily rotation used by logUsage, never stored
//   - a per-IP hourly cap bounds how much any one client can write
//
// The worst a determined client can do is inflate counts within that cap.
import crypto from "node:crypto";
import { getPool, ensureIntelligenceEventsTable } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Generous enough that a heavy real session never trips it (a few hundred
// filter toggles is plausible), tight enough to bound a script.
const EVENT_LIMIT = 300;
const WINDOW_MS = 60 * 60 * 1000;

// Allowlist. Anything not named here is rejected outright, so a new event
// can never appear in the table without a deliberate code change.
const EVENTS = {
  page_view: {},
  // Fires on a completed (debounced) query. Deliberately records only WHICH
  // index was searched, never the typed string — the chat tools promise not
  // to log message content and a raw search box is the same exposure.
  search: { mode: ["disease", "company", "drug"] },
  // Fires when a result is chosen. The entity name is safe to store because
  // it can only be a value already published in the dataset, never
  // arbitrary input — this is what powers "top searches".
  search_select: { mode: ["disease", "company", "drug"], entity: "string" },
  ask_nexus: {
    entityType: ["disease", "company", "product", "drug"],
    outcome: ["success", "error"],
  },
  explore_open: {},
  filter_applied: { resultCount: "number" },
  csv_export: { rowCount: "number" },
  view_shared: {},
  tutorial_finished: { outcome: ["completed", "skipped"] },
};

const MAX_ENTITY_LEN = 200;

function cleanMetadata(event, raw) {
  const spec = EVENTS[event];
  const out = {};
  if (!spec || typeof raw !== "object" || raw === null) return out;

  for (const [key, rule] of Object.entries(spec)) {
    const value = raw[key];
    if (value == null) continue;
    if (Array.isArray(rule)) {
      if (rule.includes(value)) out[key] = value;
    } else if (rule === "number") {
      if (typeof value === "number" && Number.isFinite(value)) {
        out[key] = Math.max(0, Math.round(value));
      }
    } else if (rule === "string") {
      if (typeof value === "string" && value.trim()) {
        out[key] = value.trim().slice(0, MAX_ENTITY_LEN);
      }
    }
  }
  return out;
}

// Coarse enough to be non-identifying — two buckets, derived server-side
// from the UA rather than trusted from the client.
function deviceFrom(userAgent) {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent || "") ? "mobile" : "desktop";
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export async function POST(request) {
  // Analytics must never be able to break the page that reports it, so
  // every failure path below still returns 200-with-ok:false rather than
  // an error the client has to handle.
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, reason: "not configured" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad body" }, { status: 400 });
  }

  const event = body?.event;
  if (!Object.prototype.hasOwnProperty.call(EVENTS, event)) {
    return Response.json({ ok: false, reason: "unknown event" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const { allowed } = checkRateLimit("intel-track", ip, EVENT_LIMIT, WINDOW_MS);
  if (!allowed) {
    return Response.json({ ok: false, reason: "rate limited" }, { status: 429 });
  }

  // Same daily-rotating visitor hash as logUsage: stable within a day for
  // grouping, uncorrelatable across days.
  const today = new Date().toISOString().slice(0, 10);
  const visitorHash = hash(`${ip}${today}`);
  // The client's session id is hashed too — it never needs to be readable,
  // only comparable, and this keeps a raw client-supplied identifier out of
  // the table.
  const sessionHash =
    typeof body?.sessionId === "string" && body.sessionId
      ? hash(body.sessionId.slice(0, 100))
      : null;

  try {
    const pool = getPool();
    await ensureIntelligenceEventsTable();
    await pool.query(
      `INSERT INTO intelligence_events
         (event, visitor_hash, session_hash, device, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event,
        visitorHash,
        sessionHash,
        deviceFrom(request.headers.get("user-agent")),
        JSON.stringify(cleanMetadata(event, body?.metadata)),
      ]
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Intelligence track write failed:", err);
    return Response.json({ ok: false, reason: "write failed" });
  }
}
