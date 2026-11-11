import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../src/lib/db.ts", () => ({ client: { execute: vi.fn() } }));

const secret = "a".repeat(64);
let app: typeof import("../src/server.ts").app;
let execute: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_EMAIL", "admin@example.test");
  vi.stubEnv("ORIGIN_SECRET", secret);
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  app = (await import("../src/server.ts")).app;
  execute = vi.mocked((await import("../src/lib/db.ts")).client.execute);
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllEnvs());

describe("origin authentication on the application", () => {
  it.each([
    "/",
    "/auth/login",
    "/auth/register",
    "/app",
    "/admin",
    "/app/sse",
    "/dist/main.js",
    "/sw.js",
  ])("rejects direct access to %s before session lookup", async (path) => {
    const response = await app.request(path, {
      headers: {
        cookie: "session=some-id.some-secret",
        "CF-Connecting-IP": "198.51.100.1",
      },
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(["wrong", "b".repeat(64), `${secret}, ${secret}`])(
    "rejects an incorrect or duplicated header",
    async (value) => {
      const response = await app.request("/app", {
        headers: { "X-Origin-Secret": value },
      });
      expect(response.status).toBe(403);
    },
  );

  it("rejects login POSTs even with forged proxy headers", async () => {
    const response = await app.request("/auth/login", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": "198.51.100.2",
      },
      body: "email=admin%40example.test&password=guess",
    });
    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it("allows trusted requests but still requires a user session", async () => {
    const response = await app.request("/app", {
      headers: { "x-origin-secret": secret },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/auth/login");
    expect(response.headers.get("x-origin-secret")).toBeNull();
    expect(await response.text()).not.toContain(secret);
  });

  it("keeps the exact health endpoint available without a secret", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(execute).not.toHaveBeenCalled();
    expect((await app.request("/health/private")).status).toBe(403);
    expect((await app.request("/health", { method: "POST" })).status).toBe(403);
  });
});
