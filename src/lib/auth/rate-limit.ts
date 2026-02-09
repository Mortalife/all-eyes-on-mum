import type { Context, Next } from "hono";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

const store = new Map<string, RateLimitEntry>();

// Periodically cleans up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

// Extracts the client IP from the request (Cloudflare -> Traefik -> app)
// CF-Connecting-IP is set by Cloudflare to the real client address and cannot be spoofed.
const getClientIp = (c: Context): string => {
  return c.req.header("cf-connecting-ip") || "unknown";
};

// Creates a rate limiting middleware that restricts requests per IP within a time window
export const rateLimit = ({ windowMs, maxRequests }: RateLimitOptions) => {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfterSec));
      return c.text("Too many requests. Please try again later.", 429);
    }

    entry.count++;
    await next();
  };
};
