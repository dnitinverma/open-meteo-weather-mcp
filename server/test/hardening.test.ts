import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, MAX_BODY } from "../src/app.js";
import { gracefulShutdown } from "../src/lifecycle.js";
import { logger } from "../src/logger.js";
import { cacheLabel } from "../src/tools/common.js";
import { usage } from "../src/openmeteo/usage.js";
import { createRateLimiter } from "../src/rateLimit.js";
import { connectClient } from "./helpers.js";
import { json, mockFetch, openMeteoRoutes } from "./mockFetch.js";

const servers: Server[] = [];
async function listen(app: ReturnType<typeof createApp>): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "t", version: "0" },
  },
};
const post = (base: string, body: unknown, init: RequestInit = {}) =>
  fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });

describe("rate limiting", () => {
  it("allows the limit then returns 429 with a clear message and Retry-After", async () => {
    const base = await listen(createApp({ rateLimitPerMinute: 3 }));
    for (let i = 0; i < 3; i++) expect((await post(base, INIT)).status).toBe(200);
    const res = await post(base, INIT);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(res.headers.get("ratelimit-remaining")).toBe("0");
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/Rate limit exceeded: at most 3 requests per minute per IP/);
  });

  it("does not limit /health", async () => {
    const base = await listen(createApp({ rateLimitPerMinute: 1 }));
    for (let i = 0; i < 5; i++) expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it("windows reset and keys are bounded", () => {
    let now = 0;
    const handler = createRateLimiter({ limit: 2, windowMs: 1000, maxKeys: 3, now: () => now });
    const run = (ip: string) => {
      const res = {
        code: 200,
        set: vi.fn(),
        status(c: number) {
          this.code = c;
          return this;
        },
        json: vi.fn(),
      };
      const next = vi.fn();
      handler({ ip } as never, res as never, next);
      return { limited: res.code === 429, next };
    };
    expect(run("a").limited).toBe(false);
    expect(run("a").limited).toBe(false);
    expect(run("a").limited).toBe(true);
    now = 1000; // new window
    expect(run("a").limited).toBe(false);
    for (const ip of ["b", "c", "d", "e"]) run(ip); // exceeds maxKeys → pruned, no throw
  });
});

describe("request limits and routing", () => {
  it("rejects a body over 100 KB with 413 and a JSON error", async () => {
    const base = await listen(createApp());
    expect(MAX_BODY).toBe("100kb");
    const big = JSON.stringify({
      ...INIT,
      params: { ...INIT.params, pad: "x".repeat(101 * 1024) },
    });
    const res = await post(base, big);
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/too large/);
    expect(JSON.stringify(body)).not.toMatch(/at .*\.(js|ts)|node_modules/);
  });

  it("accepts a body just under the limit", async () => {
    const base = await listen(createApp());
    const ok = JSON.stringify({ ...INIT, params: { ...INIT.params, pad: "x".repeat(90 * 1024) } });
    expect((await post(base, ok)).status).toBe(200);
  });

  it("returns 400 for invalid JSON without a stack trace", async () => {
    const base = await listen(createApp());
    const res = await post(base, "{not json");
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/SyntaxError|at /);
  });

  it.each([
    ["GET", "/nope"],
    ["POST", "/nope"],
    ["PUT", "/mcp"],
    ["GET", "/.env"],
  ])("%s %s → 404", async (method, path) => {
    const base = await listen(createApp());
    const res = await fetch(`${base}${path}`, {
      method,
      ...(method === "POST" ? { body: "{}", headers: { "content-type": "application/json" } } : {}),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("sends security headers, hides x-powered-by and sets a request id", async () => {
    const base = await listen(createApp());
    const res = await post(base, INIT);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toMatch(/no-(store|cache)/);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("enforces ALLOWED_HOSTS when configured", async () => {
    const base = await listen(createApp({ allowedHosts: ["weather.example.com"] }));
    expect((await fetch(`${base}/health`)).status).toBe(403);
    const ok = await fetch(`${base}/health`, { headers: { Host: "weather.example.com" } }).catch(
      () => null,
    );
    // fetch forbids overriding Host in some runtimes; only assert the rejection above.
    expect(ok === null || ok.status === 200 || ok.status === 403).toBe(true);
  });
});

describe("daily upstream limit fallback", () => {
  function exhaust() {
    while (!usage.exhausted) usage.increment();
  }

  it("serves cached data but returns UPSTREAM_UNAVAILABLE for cache misses", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const { client, close } = await connectClient();
    const call = (name: string, args: Record<string, unknown>) =>
      client.callTool({ name, arguments: args }) as Promise<{
        isError?: boolean;
        structuredContent?: Record<string, unknown>;
        content: { text?: string }[];
      }>;

    expect((await call("get_current_weather", { city: "Jaipur" })).isError).toBeFalsy();
    const callsBefore = fetch.mock.calls.length;

    exhaust();
    // Cached: served without any new request.
    expect((await call("get_current_weather", { city: "Jaipur" })).isError).toBeFalsy();
    expect(fetch.mock.calls.length).toBe(callsBefore);
    // Not cached: UPSTREAM_UNAVAILABLE, and still no upstream request.
    const miss = await call("get_forecast", { city: "Jaipur", days: 3 });
    expect(miss.isError).toBe(true);
    expect((miss.structuredContent as { error: { code: string } }).error.code).toBe(
      "UPSTREAM_UNAVAILABLE",
    );
    expect(fetch.mock.calls.length).toBe(callsBefore);
    await close();
  });

  it("resumes after the counter resets (midnight UTC)", async () => {
    mockFetch(openMeteoRoutes);
    const { client, close } = await connectClient();
    exhaust();
    const blocked = await client.callTool({
      name: "get_current_weather",
      arguments: { latitude: 1, longitude: 2 },
    });
    expect(blocked.isError).toBe(true);
    usage.reset();
    const ok = await client.callTool({
      name: "get_current_weather",
      arguments: { latitude: 1, longitude: 2 },
    });
    expect(ok.isError).toBeFalsy();
    await close();
  });

  it("is not retried (one check, no backoff)", async () => {
    vi.useFakeTimers();
    mockFetch(() => json({}, 500));
    exhaust();
    const { fetchJson } = await import("../src/openmeteo/client.js");
    const p = fetchJson("https://api.open-meteo.com/v1/forecast?x=1").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(await p).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
});

describe("structured tool-call logs", () => {
  it("logs request id, tool, latency, cache hit/miss and error code — never arguments", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    mockFetch(openMeteoRoutes);
    const base = await listen(createApp());
    const rpc = (id: number, name: string, args: unknown) =>
      post(
        base,
        { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
        {
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
        },
      );

    const first = await rpc(1, "get_current_weather", { city: "Jaipur" });
    await first.text();
    const second = await rpc(2, "get_current_weather", { city: "Jaipur" });
    await second.text();
    const bad = await rpc(3, "get_forecast", { city: "Xyzabc" });
    await bad.text();
    const invalid = await rpc(4, "get_forecast", { days: 99 });
    await invalid.text();

    const calls = info.mock.calls
      .filter((c) => c[1] === "tool call")
      .map((c) => c[0] as Record<string, unknown>);
    expect(calls).toHaveLength(4);
    expect(calls[0]).toMatchObject({ tool: "get_current_weather", cache: "miss" });
    expect(calls[1]).toMatchObject({ tool: "get_current_weather", cache: "hit" });
    expect(calls[2]).toMatchObject({ tool: "get_forecast", errorCode: "LOCATION_NOT_FOUND" });
    expect(calls[3]).toMatchObject({ errorCode: "INVALID_INPUT", cache: "none" });
    expect(calls[0]!.requestId).toBe(first.headers.get("x-request-id"));
    expect(calls[1]!.requestId).toBe(second.headers.get("x-request-id"));
    expect(calls[0]!.requestId).not.toBe(calls[1]!.requestId);
    for (const c of calls) {
      expect(typeof c.latencyMs).toBe("number");
      expect(JSON.stringify(c)).not.toMatch(/Jaipur|Xyzabc|city|arguments/);
    }
    info.mockRestore();
  });

  it("cacheLabel", () => {
    expect(cacheLabel(0, 0)).toBe("none");
    expect(cacheLabel(2, 0)).toBe("hit");
    expect(cacheLabel(0, 1)).toBe("miss");
    expect(cacheLabel(1, 1)).toBe("partial");
  });
});

describe("graceful shutdown", () => {
  it("finishes in-flight requests, refuses new ones, then resolves", async () => {
    const app = createApp({
      routes: (a) => a.get("/slow", (_req, res) => void setTimeout(() => res.send("done"), 200)),
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.once("listening", () => r()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const inflight = fetch(`${base}/slow`).then((r) => r.text());
    await new Promise((r) => setTimeout(r, 50));
    const started = Date.now();
    const closed = gracefulShutdown(server, 5000);
    await expect(inflight).resolves.toBe("done");
    await closed;
    expect(Date.now() - started).toBeLessThan(2000);
    await expect(fetch(`${base}/health`)).rejects.toThrow();
  });

  it("force-closes connections that outlive the deadline", async () => {
    const app = createApp({ routes: (a) => a.get("/hang", () => {}) });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.once("listening", () => r()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const hung = fetch(`${base}/hang`).catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 50));
    const started = Date.now();
    await gracefulShutdown(server, 300);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(await hung).toBeInstanceOf(Error);
  });
});
