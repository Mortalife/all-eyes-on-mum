import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { env } from "../../env.ts";

const expectedSecret = env.ORIGIN_SECRET
  ? Buffer.from(env.ORIGIN_SECRET)
  : null;

// Cloudflare overwrites X-Origin-Secret before forwarding to this application.
export const requireTrustedOrigin: MiddlewareHandler = async (c, next) => {
  // Production configuration requires a secret; local development can omit it.
  if (!expectedSecret) return next();

  const suppliedSecret = Buffer.from(c.req.header("X-Origin-Secret") ?? "");
  if (
    suppliedSecret.length !== expectedSecret.length ||
    !timingSafeEqual(suppliedSecret, expectedSecret)
  ) {
    c.header("Cache-Control", "no-store");
    return c.text("Forbidden", 403);
  }

  return next();
};
