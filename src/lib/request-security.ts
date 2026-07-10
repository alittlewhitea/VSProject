import { createHmac } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { mysqlExecute } from "./mysql";

function rateLimitSecret() {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET || process.env.AUTH_SESSION_SECRET || process.env.MYSQL_PASSWORD;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_RATE_LIMIT_SECRET is not configured.");
  }
  return secret || "local-auth-rate-limit-secret";
}

function subjectHash(scope: string, subject: string) {
  return createHmac("sha256", rateLimitSecret()).update(`${scope}:${subject.trim().toLowerCase()}`).digest("hex");
}

export function safeInternalPath(value: unknown, fallback = "/studio") {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n\0]/.test(path)) {
    return fallback;
  }
  try {
    const parsed = new URL(path, "https://dreamface.invalid");
    if (parsed.origin !== "https://dreamface.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function trustedPublicOrigin(requestUrl: string) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL or SITE_URL must be configured in production.");
  }
  const parsed = new URL(configured || requestUrl);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("The production public site URL must use HTTPS.");
  }
  return parsed.origin;
}

export async function consumeRateLimit(input: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}) {
  const windowStart = Math.floor(Date.now() / (input.windowSeconds * 1000));
  const hash = subjectHash(input.scope, input.subject);
  await mysqlExecute(
    "insert into request_rate_limits (scope, subject_hash, window_start, request_count, expires_at) values (?, ?, ?, 1, date_add(now(6), interval ? second)) on duplicate key update request_count = request_count + 1, expires_at = values(expires_at)",
    [input.scope, hash, windowStart, input.windowSeconds]
  );
  const rows = await mysqlExecute<RowDataPacket[]>(
    "select request_count from request_rate_limits where scope = ? and subject_hash = ? and window_start = ? limit 1",
    [input.scope, hash, windowStart]
  );
  const count = Number(rows[0]?.request_count || 0);
  if (Math.random() < 0.01) {
    await mysqlExecute("delete from request_rate_limits where expires_at < now(6) limit 500").catch(() => null);
  }
  return {
    allowed: count <= input.limit,
    count,
    retryAfterSeconds: Math.max(1, input.windowSeconds - Math.floor((Date.now() / 1000) % input.windowSeconds))
  };
}
