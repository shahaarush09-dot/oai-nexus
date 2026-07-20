import { getPool, ensureUsageTable } from "./db";

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
