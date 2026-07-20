import crypto from "node:crypto";

export const SESSION_COOKIE = "nexus_admin_session";

export function sessionToken(secret) {
  return crypto.createHmac("sha256", secret).update("nexus-admin-session").digest("hex");
}
