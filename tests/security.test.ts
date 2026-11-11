import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "mum-security-"));
const secret = "origin-secret-for-security-tests";
let app: typeof import("../src/server.ts").app;
let db: typeof import("../src/lib/db.ts");
let auth: typeof import("../src/lib/auth/index.ts");
let crypto: typeof import("../src/lib/auth/crypto.ts");
let tokens: typeof import("../src/lib/auth/registration-token.ts");
let limiter: typeof import("../src/lib/auth/rate-limit.ts");
let bootstrap: typeof import("../src/lib/auth/bootstrap.ts").bootstrapAdmin;
let logs: ReturnType<typeof vi.spyOn>;
let counter = 0;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ADMIN_EMAIL", "admin@example.test");
  vi.stubEnv("BASE_URL", "https://mum.example.test");
  vi.stubEnv("ORIGIN_SECRET", secret);
  vi.stubEnv("DATABASE_PATH", directory + "/");
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  db = await import("../src/lib/db.ts");
  auth = await import("../src/lib/auth/index.ts");
  crypto = await import("../src/lib/auth/crypto.ts");
  tokens = await import("../src/lib/auth/registration-token.ts");
  limiter = await import("../src/lib/auth/rate-limit.ts");
  bootstrap = (await import("../src/lib/auth/bootstrap.ts")).bootstrapAdmin;
  app = (await import("../src/server.ts")).app;
  await db.initDatabase();
  await auth.initAuthTables();
  logs = vi.spyOn(console, "info").mockImplementation(() => {});
});
beforeEach(async () => {
  await db.client.execute("DELETE FROM auth_rate_limit");
  logs.mockClear();
});
afterAll(() => {
  logs.mockRestore();
  db.client.close();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
const member = () =>
  auth.createUser(`member${++counter}@example.test`, null, "Member");
const request = (
  path: string,
  fields: Record<string, string> = {},
  ip = "198.51.100.1",
  cookie = "",
) =>
  app.request(path, {
    method: "POST",
    headers: {
      "X-Origin-Secret": secret,
      "CF-Connecting-IP": ip,
      origin: "http://localhost",
      "content-type": "application/x-www-form-urlencoded",
      cookie,
    },
    body: new URLSearchParams(fields),
  });

it("keeps every registered private endpoint behind authentication", async () => {
  const routes = app.routes.filter(
    (r) =>
      ["GET", "POST"].includes(r.method) && /^\/(app|admin)(\/|$)/.test(r.path),
  );
  expect(routes.length).toBeGreaterThan(50);
  for (const route of routes) {
    const response = await app.request(
      route.path.replace(/:[^/]+/g, "missing-id"),
      {
        method: route.method,
        headers: {
          "X-Origin-Secret": secret,
          origin: "http://localhost",
          "content-type": "application/json",
        },
      },
    );
    expect(response.status, route.path).toBe(302);
    expect(response.headers.get("location")).toBe("/auth/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
});

it("disables HTTP admin registration and only bootstraps through the local command", async () => {
  expect(
    (
      await request("/auth/register", {
        email: "admin@example.test",
        password: "chosen by attacker",
      })
    ).status,
  ).toBe(403);
  const url = await bootstrap();
  const token = url.split("/").at(-1)!;
  const pending = await tokens.validateRegistrationToken(token);
  expect(pending?.role).toBe("admin");
  const replacement = await bootstrap();
  expect(await tokens.validateRegistrationToken(token)).toBeNull();
  const accepted = await request(new URL(replacement).pathname, {
    password: "long admin password",
    confirmPassword: "long admin password",
  });
  expect(accepted.status).toBe(302);
  expect(accepted.headers.get("set-cookie")).toContain("HttpOnly");
  await expect(bootstrap()).rejects.toThrow("already complete");
});

it("verifies legacy passwords and upgrades only after a correct login", async () => {
  const user = await member();
  const salt = randomBytes(16);
  const legacy = Buffer.concat([
    salt,
    pbkdf2Sync("legacy password", salt, 100_000, 32, "sha256"),
  ]).toString("base64");
  await db.client.execute({
    sql: "UPDATE user SET password_hash = ? WHERE id = ?",
    args: [legacy, user.id],
  });
  expect(await auth.verifyUserCredentials(user.email, "wrong")).toBeNull();
  expect(
    (
      await db.client.execute({
        sql: "SELECT password_hash FROM user WHERE id = ?",
        args: [user.id],
      })
    ).rows[0].password_hash,
  ).toBe(legacy);
  expect(
    (await auth.verifyUserCredentials(user.email, "legacy password"))?.id,
  ).toBe(user.id);
  const upgraded = (
    await db.client.execute({
      sql: "SELECT password_hash FROM user WHERE id = ?",
      args: [user.id],
    })
  ).rows[0].password_hash as string;
  expect(upgraded).toMatch(/^pbkdf2-sha256\$600000\$/);
  expect(await crypto.verifyPassword("legacy password", upgraded)).toBe(true);
  expect(await crypto.verifyPassword("wrong", upgraded)).toBe(false);
  expect(await crypto.verifyPassword("any", null)).toBe(false);
  expect(
    await auth.verifyUserCredentials("unknown@example.test", "any"),
  ).toBeNull();
});

it("limits the same normalized account across IPs and logs no credentials", async () => {
  for (let i = 0; i < 5; i++) {
    const response = await request(
      "/auth/login",
      {
        email: i % 2 ? " VICTIM@example.test " : "victim@example.test",
        password: "private guess",
      },
      `198.51.100.${i}`,
    );
    expect(response.status).toBe(200);
  }
  const blocked = await request(
    "/auth/login",
    { email: "victim@example.test", password: "private guess" },
    "198.51.100.99",
  );
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  const output = JSON.stringify(logs.mock.calls);
  expect(output).toContain("login_failed");
  expect(output).toContain("auth_throttled");
  expect(output).not.toContain("victim@example.test");
  expect(output).not.toContain("private guess");
  expect(output).not.toContain(secret);
});

it("persists atomic attempt limits across clients and startup initialization", async () => {
  const options = { bucket: "concurrency", windowMs: 60_000, maxRequests: 3 };
  const attempts = await Promise.all(
    Array.from({ length: 12 }, () =>
      limiter.consumeAuthAttempt("same-account", options),
    ),
  );
  expect(attempts.filter((value) => value === 0)).toHaveLength(3);
  const other = createClient({ url: `file:${directory}/app.sqlite` });
  expect(
    (await other.execute("SELECT count FROM auth_rate_limit")).rows[0].count,
  ).toBe(3);
  other.close();
  await auth.initAuthTables();
  expect(
    await limiter.consumeAuthAttempt("same-account", options),
  ).toBeGreaterThan(0);
  await db.client.execute("UPDATE auth_rate_limit SET reset_at = 0");
  expect(await limiter.consumeAuthAttempt("same-account", options)).toBe(0);
});

it("increases cooldowns without letting blocked traffic extend them", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  try {
    const options = {
      bucket: "progressive",
      windowMs: 900_000,
      maxRequests: 10,
      progressive: true,
    };
    for (let i = 0; i < 5; i++)
      expect(await limiter.consumeAuthAttempt("user", options)).toBe(0);
    expect(await limiter.consumeAuthAttempt("user", options)).toBe(1);
    now.mockReturnValue(1_800_000_001_000);
    expect(await limiter.consumeAuthAttempt("user", options)).toBe(0);
    expect(await limiter.consumeAuthAttempt("user", options)).toBe(2);
  } finally {
    now.mockRestore();
  }
});

it("limits IPs across varying invitation URLs", async () => {
  for (let i = 0; i < 10; i++)
    expect(
      (
        await request(`/auth/register/invalid-${i}`, {
          password: "long password here",
          confirmPassword: "long password here",
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await request("/auth/register/another-token", {
        password: "long password here",
        confirmPassword: "long password here",
      })
    ).status,
  ).toBe(429);
});

it("consumes an invitation once under concurrent redemption and rejects expiry", async () => {
  const user = await member();
  const token = await tokens.createRegistrationToken(user.id);
  const results = await Promise.all(
    Array.from({ length: 8 }, () => tokens.consumeRegistrationToken(token)),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const expired = await tokens.createRegistrationToken(user.id);
  await db.client.execute({
    sql: "UPDATE registration_token SET expires_at = 0 WHERE user_id = ?",
    args: [user.id],
  });
  expect(await tokens.consumeRegistrationToken(expired)).toBeNull();
});

it("requires same-origin POST to log out and supports revoking every device", async () => {
  const user = await member();
  const token = await auth.createSession(user.id);
  const other = await auth.createSession(user.id);
  const headers = { "X-Origin-Secret": secret, cookie: `session=${token}` };
  expect((await app.request("/auth/logout", { headers })).status).toBe(404);
  expect(await auth.validateSessionToken(token)).not.toBeNull();
  expect(
    (
      await app.request("/auth/logout", {
        method: "POST",
        headers: {
          ...headers,
          origin: "https://evil.test",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "",
      })
    ).status,
  ).toBe(403);
  expect(await auth.validateSessionToken(token)).not.toBeNull();
  expect(
    (await request("/auth/logout-all", {}, "198.51.100.1", `session=${token}`))
      .status,
  ).toBe(302);
  expect(await auth.validateSessionToken(token)).toBeNull();
  expect(await auth.validateSessionToken(other)).toBeNull();
});

it("caps session renewal at 90 days", async () => {
  const user = await member();
  const token = await auth.createSession(user.id);
  const id = token.split(".")[0];
  const createdAt = Math.floor(Date.now() / 1000) - 89 * 86400;
  await db.client.execute({
    sql: "UPDATE session SET created_at = ? WHERE id = ?",
    args: [createdAt, id],
  });
  await auth.extendSession(id);
  expect(
    new Date(
      (await auth.validateSessionToken(token))!.session.expiresAt,
    ).getTime() / 1000,
  ).toBe(createdAt + 90 * 86400);
  await db.client.execute({
    sql: "UPDATE session SET created_at = 0 WHERE id = ?",
    args: [id],
  });
  expect(await auth.validateSessionToken(token)).toBeNull();
});

it.each(["page", "form"])(
  "closes %s streams on revocation without requiring another event",
  async (kind) => {
    const { createSSEResource } =
      await import("../src/lib/cqrs/sse-resource.ts");
    const { createFormResource } =
      await import("../src/lib/cqrs/form-resource.ts");
    const { eventBus } = await import("../src/lib/cqrs/event-bus.ts");
    const user = await member();
    const token = await auth.createSession(user.id);
    const options = {
      loadState: async () => "private content",
      render: (state: string) => html`<div>${state}</div>`,
      eventTypes: ["private.*"],
    };
    const streamApp = new Hono().use(
      "*",
      auth.sessionMiddleware,
      auth.requireAuth,
    );
    if (kind === "page") streamApp.get("/stream", createSSEResource(options));
    else
      streamApp.post(
        "/stream",
        createFormResource({
          ...options,
          path: "/stream",
          schema: z.object({}),
          command: { type: "test", emits: "test", handler: async () => null },
        }).sseHandler,
      );
    const response = await streamApp.request("/stream", {
      method: kind === "page" ? "GET" : "POST",
      headers: {
        cookie: `session=${token}`,
        "content-type": "application/json",
      },
      ...(kind === "form" ? { body: JSON.stringify({ cid: "test-cid" }) } : {}),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "private content",
    );
    await auth.deleteSession(token.split(".")[0]);
    eventBus.publishToUser(user.id, { type: "private.changed" });
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "/auth/login",
    );
    expect((await reader.read()).done).toBe(true);
  },
);

it.each(["expired", "revoked elsewhere", "storage failure"])(
  "closes idle streams when the session is %s",
  async (reason) => {
    const { createSSEResource } =
      await import("../src/lib/cqrs/sse-resource.ts");
    const user = await member();
    const token = await auth.createSession(user.id);
    const streamApp = new Hono().use(
      "*",
      auth.sessionMiddleware,
      auth.requireAuth,
    );
    streamApp.get(
      "/stream",
      createSSEResource({
        loadState: async () => "private content",
        render: (state) => html`<div>${state}</div>`,
        eventTypes: ["private.*"],
      }),
    );
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let fail: ReturnType<typeof vi.spyOn> | undefined;
    try {
      const response = await streamApp.request("/stream", {
        headers: { cookie: `session=${token}` },
      });
      reader = response.body!.getReader();
      await reader.read();
      if (reason === "expired")
        await db.client.execute({
          sql: "UPDATE session SET expires_at = 0 WHERE id = ?",
          args: [token.split(".")[0]],
        });
      else if (reason === "revoked elsewhere")
        await db.client.execute({
          sql: "DELETE FROM session WHERE id = ?",
          args: [token.split(".")[0]],
        });
      else
        fail = vi
          .spyOn(db.client, "execute")
          .mockRejectedValue(new Error("storage unavailable"));
      await vi.advanceTimersByTimeAsync(15_000);
      expect(new TextDecoder().decode((await reader.read()).value)).toContain(
        "/auth/login",
      );
      expect((await reader.read()).done).toBe(true);
    } finally {
      fail?.mockRestore();
      await reader?.cancel();
      vi.useRealTimers();
    }
  },
);

it("rechecks authorization after an in-flight render", async () => {
  const { createSSEResource } = await import("../src/lib/cqrs/sse-resource.ts");
  const user = await member();
  const token = await auth.createSession(user.id);
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<string>();
  const streamApp = new Hono().use(
    "*",
    auth.sessionMiddleware,
    auth.requireAuth,
  );
  streamApp.get(
    "/stream",
    createSSEResource({
      loadState: async () => {
        started.resolve();
        return finish.promise;
      },
      render: (state) => html`<div>${state}</div>`,
      eventTypes: ["private.*"],
    }),
  );
  const response = await streamApp.request("/stream", {
    headers: { cookie: `session=${token}` },
  });
  const reader = response.body!.getReader();
  await started.promise;
  await auth.deleteUserSessions(user.id);
  finish.resolve("must not leak");
  expect(new TextDecoder().decode((await reader.read()).value)).toContain(
    "/auth/login",
  );
  expect((await reader.read()).done).toBe(true);
});

it("clears account cooldowns after a successful login without clearing IP limits", async () => {
  const user = await member();
  await auth.setUserPassword(user.id, "a known good password");
  const options = {
    bucket: "login-account",
    windowMs: 900_000,
    maxRequests: 10,
    progressive: true,
  };
  for (let i = 0; i < 4; i++)
    await limiter.consumeAuthAttempt(user.email, options);
  expect(
    (
      await request("/auth/login", {
        email: user.email,
        password: "a known good password",
      })
    ).status,
  ).toBe(302);
  const rows = (await db.client.execute("SELECT count FROM auth_rate_limit"))
    .rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].count).toBe(1);
  expect(JSON.stringify(logs.mock.calls)).toContain("login_succeeded");
});

it("rejects oversized auth requests before password work", async () => {
  expect(
    (
      await request("/auth/login", {
        email: "member@example.test",
        password: "x".repeat(20_000),
      })
    ).status,
  ).toBe(413);
});
