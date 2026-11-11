import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { serveStatic } from "@hono/node-server/serve-static";
import { sessionMiddleware } from "./lib/auth/middleware.ts";
import { requireTrustedOrigin } from "./lib/auth/origin.ts";
import { compressionMiddleware } from "./lib/hono/index.ts";
import { adminRouter } from "./pages/admin/index.ts";
import { appRouter } from "./pages/app/index.ts";
import { authRouter } from "./pages/auth/index.ts";
import { marketingRouter } from "./pages/marketing/index.ts";
import type { HonoContext } from "./types/hono.ts";

export const app = new Hono<HonoContext>();

// Healthcheck — before any middleware so it's fast and has no side effects
app.get("/health", (c) => c.json({ status: "ok" }));

// Authenticate the proxy before serving assets, reading sessions, or rate limiting.
app.use("*", requireTrustedOrigin);

// CSRF protection
app.use(csrf());

// Compression
app.use(compressionMiddleware);

// Static assets
app.use(
  "/dist/*",
  serveStatic({
    root: "./dist-public",
    rewriteRequestPath: (path) => path.replace(/^\/dist\//, ""),
  }),
);

// Service worker must be served from the root so its scope covers the whole app
app.get("/sw.js", serveStatic({ path: "./dist-public/sw.js" }));

// Session middleware - loads user from cookie
app.use("*", sessionMiddleware);

// Routes
app.route("/", marketingRouter);
app.route("/auth", authRouter);
app.route("/app", appRouter);
app.route("/admin", adminRouter);

export default app;
