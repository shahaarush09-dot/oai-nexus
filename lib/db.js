import { Pool } from "pg";

// Global singleton so we don't open a new pool per request/invocation.
// globalThis survives warm serverless reuse and Next.js dev-mode hot reload.
export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalThis.__nexusPgPool) {
    globalThis.__nexusPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }

  return globalThis.__nexusPgPool;
}

// Lazily creates the usage_logs table on first access per warm process.
// Cached as a shared promise so concurrent callers await the same init
// instead of racing duplicate CREATE TABLE statements.
export function ensureUsageTable() {
  if (!globalThis.__nexusUsageTableReady) {
    const pool = getPool();
    globalThis.__nexusUsageTableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS usage_logs (
          id BIGSERIAL PRIMARY KEY,
          module VARCHAR(20) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          visitor_hash VARCHAR(64) NOT NULL,
          message_count INTEGER DEFAULT 1,
          conversation_id VARCHAR(64) NOT NULL
        )`
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS idx_usage_logs_lookup
           ON usage_logs (module, visitor_hash, conversation_id)`
        )
      )
      .catch((err) => {
        // Allow a retry on the next call instead of caching a failed init.
        globalThis.__nexusUsageTableReady = undefined;
        throw err;
      });
  }

  return globalThis.__nexusUsageTableReady;
}

// Intelligence events live in their own table rather than usage_logs.
//
// usage_logs counts conversations and messages for the three chat tools —
// it has no event-type or metadata column, and one row means "a person had
// a conversation on a day". Intelligence produces a different shape
// entirely (discrete UI events, several per minute, no conversation), and
// folding it in would make "Total Messages" silently start counting button
// clicks.
export function ensureIntelligenceEventsTable() {
  if (!globalThis.__nexusIntelEventsReady) {
    const pool = getPool();
    globalThis.__nexusIntelEventsReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS intelligence_events (
          id BIGSERIAL PRIMARY KEY,
          event VARCHAR(32) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          visitor_hash VARCHAR(64) NOT NULL,
          session_hash VARCHAR(64),
          device VARCHAR(10),
          metadata JSONB
        )`
      )
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS idx_intel_events_lookup
           ON intelligence_events (event, timestamp)`
        )
      )
      .catch((err) => {
        globalThis.__nexusIntelEventsReady = undefined;
        throw err;
      });
  }

  return globalThis.__nexusIntelEventsReady;
}
