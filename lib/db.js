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
