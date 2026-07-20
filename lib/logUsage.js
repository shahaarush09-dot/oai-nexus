import crypto from "node:crypto";
import { getPool, ensureUsageTable } from "./db";

// Never logs message content or raw IPs. The visitor hash rotates daily
// (ip + UTC date) so the same person gets one stable hash per day for
// within-day grouping, but a different, uncorrelatable hash tomorrow.
export async function logUsage({ module, ip, conversationId }) {
  if (!process.env.DATABASE_URL) return;

  const today = new Date().toISOString().slice(0, 10);
  const visitorHash = crypto
    .createHash("sha256")
    .update(`${ip}${today}`)
    .digest("hex");

  const pool = getPool();
  await ensureUsageTable();

  const existing = await pool.query(
    `SELECT id FROM usage_logs
     WHERE module = $1 AND visitor_hash = $2 AND conversation_id = $3
       AND DATE(timestamp) = CURRENT_DATE
     LIMIT 1`,
    [module, visitorHash, conversationId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE usage_logs SET message_count = message_count + 1 WHERE id = $1`,
      [existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO usage_logs (module, visitor_hash, conversation_id) VALUES ($1, $2, $3)`,
      [module, visitorHash, conversationId]
    );
  }
}

// Any prior row for this module+conversationId (regardless of day or visitor
// hash) means this isn't the first message. Throws if the DB is unreachable
// or unconfigured — callers should treat that as "assume first message" so
// content filtering fails toward being applied, not skipped.
export async function hasExistingConversation(module, conversationId) {
  const pool = getPool();
  await ensureUsageTable();

  const result = await pool.query(
    `SELECT 1 FROM usage_logs WHERE module = $1 AND conversation_id = $2 LIMIT 1`,
    [module, conversationId]
  );

  return result.rows.length > 0;
}
