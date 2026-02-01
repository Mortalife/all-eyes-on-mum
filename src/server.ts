import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { serveStatic } from "@hono/node-server/serve-static";
import { sessionMiddleware } from "./lib/auth/middleware.ts";
import { compressionMiddleware } from "./lib/hono/index.ts";
import { adminRouter } from "./pages/admin/index.ts";
import { appRouter } from "./pages/app/index.ts";
import { authRouter } from "./pages/auth/index.ts";
import { marketingRouter } from "./pages/marketing/index.ts";
import type { HonoContext } from "./types/hono.ts";

export const app = new Hono<HonoContext>();

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

// Session middleware - loads user from cookie
app.use("*", sessionMiddleware);

// Routes
app.route("/", marketingRouter);
app.route("/auth", authRouter);
app.route("/app", appRouter);
app.route("/admin", adminRouter);

export default app;
