import { getPool, ensureUsageTable, ensureIntelligenceEventsTable } from "./db";

const MODULE_KEYS = ["patient", "clinical", "bio"];

// "Total Messages" and per-module/day counts use SUM(message_count) rather
// than COUNT(*), since one row can represent several messages in the same
// conversation/day (message_count is incremented, not a new row inserted).
// COUNT(DISTINCT visitor_hash) is unaffected by that and stays as-is.
export async function fetchStats() {
  const pool = getPool();
  await ensureUsageTable();

  const [totalRes, perModuleRes, uniqueRes, dailyRes, concurrentRes] =
    await Promise.all([
      pool.query(`SELECT COALESCE(SUM(message_count), 0) AS total FROM usage_logs`),
      pool.query(
        `SELECT module, COALESCE(SUM(message_count), 0) AS count
         FROM usage_logs GROUP BY module`
      ),
      pool.query(
        `SELECT module, COUNT(DISTINCT visitor_hash) AS count
         FROM usage_logs GROUP BY module`
      ),
      pool.query(
        `SELECT DATE(timestamp) AS day, module, COALESCE(SUM(message_count), 0) AS count
         FROM usage_logs
         WHERE timestamp > NOW() - INTERVAL '30 days'
         GROUP BY DATE(timestamp), module
         ORDER BY DATE(timestamp) ASC`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT visitor_hash) AS count
         FROM usage_logs
         WHERE timestamp > NOW() - INTERVAL '5 minutes'`
      ),
    ]);

  const perModule = { patient: 0, clinical: 0, bio: 0 };
  perModuleRes.rows.forEach((r) => {
    if (MODULE_KEYS.includes(r.module)) perModule[r.module] = Number(r.count);
  });

  const uniqueVisitors = { patient: 0, clinical: 0, bio: 0 };
  uniqueRes.rows.forEach((r) => {
    if (MODULE_KEYS.includes(r.module)) uniqueVisitors[r.module] = Number(r.count);
  });

  const dailyMap = new Map();
  dailyRes.rows.forEach((r) => {
    const day =
      r.day instanceof Date
        ? r.day.toISOString().slice(0, 10)
        : String(r.day).slice(0, 10);
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { day, patient: 0, clinical: 0, bio: 0 });
    }
    if (MODULE_KEYS.includes(r.module)) {
      dailyMap.get(day)[r.module] = Number(r.count);
    }
  });

  return {
    totalMessages: Number(totalRes.rows[0].total),
    perModule,
    uniqueVisitors,
    dailyData: Array.from(dailyMap.values()),
    concurrentVisitors: Number(concurrentRes.rows[0].count),
  };
}

// Nexus Intelligence reads from its own table and is reported separately.
// Its events are UI interactions, not conversations, so folding them into
// the message totals above would make "Total Messages" mean two different
// things at once.
export async function fetchIntelligenceStats() {
  const pool = getPool();
  await ensureIntelligenceEventsTable();

  const [byEventRes, visitorsRes, dailyRes, searchesRes, deviceRes, askRes] =
    await Promise.all([
      pool.query(
        `SELECT event, COUNT(*) AS count FROM intelligence_events GROUP BY event`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT visitor_hash) AS visitors,
                COUNT(DISTINCT session_hash) AS sessions
         FROM intelligence_events`
      ),
      pool.query(
        `SELECT DATE(timestamp) AS day, COUNT(*) AS count
         FROM intelligence_events
         WHERE timestamp > NOW() - INTERVAL '30 days'
         GROUP BY DATE(timestamp) ORDER BY DATE(timestamp) ASC`
      ),
      // Top searches come from search_select rather than search: only a
      // chosen result carries a name, and that name is always a published
      // dataset value rather than raw typed input.
      pool.query(
        `SELECT metadata->>'entity' AS entity,
                metadata->>'mode' AS mode,
                COUNT(*) AS count
         FROM intelligence_events
         WHERE event = 'search_select' AND metadata->>'entity' IS NOT NULL
         GROUP BY entity, mode ORDER BY count DESC LIMIT 10`
      ),
      pool.query(
        `SELECT device, COUNT(*) AS count
         FROM intelligence_events WHERE device IS NOT NULL GROUP BY device`
      ),
      pool.query(
        `SELECT metadata->>'outcome' AS outcome, COUNT(*) AS count
         FROM intelligence_events
         WHERE event = 'ask_nexus' GROUP BY outcome`
      ),
    ]);

  const byEvent = {};
  byEventRes.rows.forEach((r) => {
    byEvent[r.event] = Number(r.count);
  });

  const askOutcomes = { success: 0, error: 0 };
  askRes.rows.forEach((r) => {
    if (r.outcome === "success" || r.outcome === "error") {
      askOutcomes[r.outcome] = Number(r.count);
    }
  });

  const devices = { mobile: 0, desktop: 0 };
  deviceRes.rows.forEach((r) => {
    if (r.device in devices) devices[r.device] = Number(r.count);
  });

  return {
    byEvent,
    askOutcomes,
    devices,
    uniqueVisitors: Number(visitorsRes.rows[0]?.visitors || 0),
    sessions: Number(visitorsRes.rows[0]?.sessions || 0),
    topSearches: searchesRes.rows.map((r) => ({
      entity: r.entity,
      mode: r.mode,
      count: Number(r.count),
    })),
    dailyData: dailyRes.rows.map((r) => ({
      day:
        r.day instanceof Date
          ? r.day.toISOString().slice(0, 10)
          : String(r.day).slice(0, 10),
      count: Number(r.count),
    })),
  };
}
