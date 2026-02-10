import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { HonoContext } from "../../types/hono.ts";
import { env } from "../../env.ts";
import { validateSessionToken, extendSession } from "./session.ts";
import { isDatastarSSERequest, redirectFragmentEvent } from "../datastar.ts";
import { stream } from "hono/streaming";

const SESSION_COOKIE_NAME = "session";

// Session cookie options
const getCookieOptions = () => ({
  path: "/",
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
});

// Sets the session cookie
export const setSessionCookie = (c: Context, token: string) => {
  setCookie(c, SESSION_COOKIE_NAME, token, getCookieOptions());
};

// Clears the session cookie
export const clearSessionCookie = (c: Context) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
};

// Gets the session token from cookie
export const getSessionToken = (c: Context): string | undefined => {
  return getCookie(c, SESSION_COOKIE_NAME);
};

// Middleware that loads user and session from cookie
export const sessionMiddleware: MiddlewareHandler<HonoContext> = async (
  c,
  next,
) => {
  const token = getSessionToken(c);

  if (!token) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  const result = await validateSessionToken(token);

  if (!result) {
    // Invalid or expired session, clear the cookie
    clearSessionCookie(c);
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  c.set("user", result.user);
  c.set("session", result.session);

  // Extend session if it's been more than 1 day since last activity
  const expiresAt = new Date(result.session.expiresAt).getTime();
  const now = Date.now();
  const daysUntilExpiry = (expiresAt - now) / (24 * 60 * 60 * 1000);

  if (daysUntilExpiry < 15) {
    // Refresh cookie and extend session
    await extendSession(result.session.token);
    setSessionCookie(c, token);
  }

  return next();
};

// Middleware that requires authentication
export const requireAuth: MiddlewareHandler<HonoContext> = async (c, next) => {
  const user = c.get("user");

  if (!user) {
    if (isDatastarSSERequest(c.req)) {
      return stream(c, async (stream) => {
        stream.write(redirectFragmentEvent("/auth/login"));
      });
    }
    return c.redirect("/auth/login");
  }

  return next();
};

// Middleware that requires a specific role
export const requireRole = (
  ...roles: Array<"admin" | "user">
): MiddlewareHandler<HonoContext> => {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.redirect("/auth/login");
    }

    if (!roles.includes(user.role)) {
      return c.text("Forbidden", 403);
    }

    return next();
  };
};
