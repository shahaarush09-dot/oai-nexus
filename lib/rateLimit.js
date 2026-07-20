import crypto from "node:crypto";

const buckets = new Map();

/**
 * True sliding-window rate limiter: stores a timestamp per request in an
 * in-memory array keyed by name+IP, prunes anything older than the window
 * on every check, and compares the remaining count to the limit. Resets on
 * cold start and is per-instance only (no Redis configured in this
 * project), same caveat as before — not a new limitation.
 */
export function checkRateLimit(name, ip, limit, windowMs = 60 * 60 * 1000) {
  const key = `${name}:${ip}`;
  const now = Date.now();

  const existing = buckets.get(key) || [];
  const timestamps = existing.filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    buckets.set(key, timestamps);
    logLimitHit(name, ip);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length };
}

function logLimitHit(name, ip) {
  const today = new Date().toISOString().slice(0, 10);
  const ipHash = crypto.createHash("sha256").update(`${ip}${today}`).digest("hex");
  console.warn(`[rate-limit] hit module=${name} visitor_hash=${ipHash}`);
}

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
