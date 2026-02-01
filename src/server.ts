import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { serveStatic } from "hono/serve-static";
import { sessionMiddleware } from "./lib/auth/middleware.js";
import { compressionMiddleware } from "./lib/hono/index.js";
import { adminRouter } from "./pages/admin/index.js";
import { appRouter } from "./pages/app/index.js";
import { authRouter } from "./pages/auth/index.js";
import { marketingRouter } from "./pages/marketing/index.js";
import type { HonoContext } from "./types/hono.js";

export const app = new Hono<HonoContext>();

// CSRF protection
app.use(csrf());

// Compression
app.use(compressionMiddleware);

// Static assets
app.use("/dist/*", serveStatic({ root: "./dist-public" }));

// Session middleware - loads user from cookie
app.use("*", sessionMiddleware);

// Routes
app.route("/", marketingRouter);
app.route("/auth", authRouter);
app.route("/app", appRouter);
app.route("/admin", adminRouter);

export default app;
