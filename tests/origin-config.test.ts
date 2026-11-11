import { Hono } from "hono";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("ADMIN_EMAIL", "admin@example.test");
});
afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "", "   "])(
  "refuses production startup with an absent or blank secret",
  async (secret) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORIGIN_SECRET", secret);
    await expect(import("../src/env.ts")).rejects.toThrow(
      "ORIGIN_SECRET is required in production",
    );
  },
);

it.each([undefined, ""])(
  "allows local development without a secret",
  async (secret) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ORIGIN_SECRET", secret);
    const { requireTrustedOrigin } = await import("../src/lib/auth/origin.ts");
    const app = new Hono()
      .use("*", requireTrustedOrigin)
      .get("/", (c) => c.text("Local"));
    expect((await app.request("/")).status).toBe(200);
  },
);

it("enforces a configured secret in development too", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ORIGIN_SECRET", "test-secret");
  const { requireTrustedOrigin } = await import("../src/lib/auth/origin.ts");
  const app = new Hono()
    .use("*", requireTrustedOrigin)
    .get("/", (c) => c.text("Trusted"));
  expect((await app.request("/")).status).toBe(403);
  expect(
    (await app.request("/", { headers: { "X-Origin-Secret": "test-secret" } }))
      .status,
  ).toBe(200);
});

it("defaults to production protection when NODE_ENV is omitted", async () => {
  vi.stubEnv("NODE_ENV", undefined);
  vi.stubEnv("ORIGIN_SECRET", undefined);
  await expect(import("../src/env.ts")).rejects.toThrow(
    "ORIGIN_SECRET is required in production",
  );
});
