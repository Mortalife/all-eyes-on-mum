import { createHash } from "node:crypto";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { client } from "../db.ts";

type RateLimitOptions = {
  bucket: string;
  windowMs: number;
  maxRequests: number;
  progressive?: boolean;
};

// Opaque identifiers keep emails and IP addresses out of security logs.
const identifier = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const securityEvent = (
  event: "login_failed" | "login_succeeded" | "auth_throttled",
  scope: string,
  key: string,
) => {
  console.info(
    JSON.stringify({
      type: "security",
      event,
      scope,
      subject: identifier(key),
      at: new Date().toISOString(),
    }),
  );
};

// Reserve an attempt atomically before doing password work, including concurrent requests.
export const consumeAuthAttempt = async (
  identity: string,
  options: RateLimitOptions,
): Promise<number> => {
  const now = Date.now();
  const key = identifier(`${options.bucket}:${identity}`);
  await client.execute({
    sql: "DELETE FROM auth_rate_limit WHERE reset_at <= ?",
    args: [now],
  });
  const result = await client.execute({
    sql: `INSERT INTO auth_rate_limit (key, count, reset_at, blocked_until)
          VALUES (?, 1, ?, 0)
          ON CONFLICT(key) DO UPDATE SET
            count = count + 1,
            blocked_until = CASE WHEN ? AND count >= 4
              THEN MIN(reset_at, ? + 1000 * (1 << MIN(count - 4, 9))) ELSE 0 END
          WHERE count < ? AND blocked_until <= ?
          RETURNING count`,
    args: [
      key,
      now + options.windowMs,
      options.progressive ? 1 : 0,
      now,
      options.maxRequests,
      now,
    ],
  });
  if (result.rows.length) return 0;
  const blocked = await client.execute({
    sql: "SELECT count, reset_at, blocked_until FROM auth_rate_limit WHERE key = ?",
    args: [key],
  });
  const row = blocked.rows[0];
  const until = row
    ? Number(row.count) >= options.maxRequests
      ? Number(row.reset_at)
      : Number(row.blocked_until)
    : now + 1000;
  securityEvent("auth_throttled", options.bucket, identity);
  return Math.max(1, Math.ceil((until - now) / 1000));
};

export const clearLoginAttempts = async (email: string): Promise<void> => {
  await client.execute({
    sql: "DELETE FROM auth_rate_limit WHERE key = ?",
    args: [identifier(`login-account:${email.trim().toLowerCase()}`)],
  });
};

export const throttledResponse = (c: Context, retryAfter: number) => {
  c.header("Retry-After", String(retryAfter));
  return c.text("Too many requests. Please try again later.", 429);
};

export const rateLimit = (options: RateLimitOptions) =>
  createMiddleware(async (c, next) => {
    // The origin guard authenticates Cloudflare before these headers are used.
    const retryAfter = await consumeAuthAttempt(
      c.req.header("cf-connecting-ip") || "unknown",
      options,
    );
    if (retryAfter) return throttledResponse(c, retryAfter);
    return next();
  });
