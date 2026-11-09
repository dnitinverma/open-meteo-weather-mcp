import { afterEach, describe, expect, it, vi } from "vitest";
import { requestContext, type RequestContext } from "../src/context.js";
import { responseCache, STALE, TtlCache } from "../src/openmeteo/cache.js";
import { fetchJson, HOST_COOLDOWN_MS } from "../src/openmeteo/client.js";
import { UpstreamCooldown, UpstreamDailyCap, UpstreamError } from "../src/openmeteo/errors.js";
import { staleNote } from "../src/tools/common.js";
import { connectClient } from "./helpers.js";
import { json, mockFetch, openMeteoRoutes } from "./mockFetch.js";

afterEach(() => vi.useRealTimers());

const URL_ = "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2";
const DAILY = {
  error: true,
  reason: "Daily API request limit exceeded. Please try again tomorrow.",
};
const MIN = 60_000;

describe("TtlCache stale window", () => {
  it("get ignores expired entries but getStale serves them until the window ends", () => {
    let now = 0;
    const c = new TtlCache<string>(10, () => now);
    c.set("a", "x", 1000, 5000);
    now = 1500; // expired, inside stale window
    expect(c.get("a")).toBeUndefined();
    expect(c.getStale("a")).toEqual({ value: "x", ageMs: 1500 });
    expect(c.size).toBe(1);
    now = 6000; // stale window over (ttl 1000 + stale 5000)
    expect(c.getStale("a")).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("without a stale window behaves like before", () => {
    let now = 0;
    const c = new TtlCache<string>(10, () => now);
    c.set("a", "x", 1000);
    now = 1000;
    expect(c.get("a")).toBeUndefined();
    expect(c.getStale("a")).toBeUndefined();
  });

  it("stale windows from the plan's cache TTLs are sensible", () => {
    expect(STALE.current).toBe(2 * 60 * MIN);
    expect(STALE.geocoding).toBeGreaterThan(STALE.historical);
  });
});

describe("daily cap from Open-Meteo (HTTP 429 'Daily API request limit exceeded')", () => {
  it("is not retried, and the host cools down without further requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    const fetch = mockFetch(() => json(DAILY, 429));

    const first = await fetchJson(URL_).catch((e: unknown) => e);
    expect(first).toBeInstanceOf(UpstreamDailyCap);
    expect(fetch).toHaveBeenCalledTimes(1); // no retries

    const second = await fetchJson(URL_ + "&x=1").catch((e: unknown) => e);
    expect(second).toBeInstanceOf(UpstreamCooldown);
    expect(fetch).toHaveBeenCalledTimes(1); // no network call during cooldown

    // Other Open-Meteo hosts are unaffected.
    mockFetch(() => json({ ok: true }));
    await expect(
      fetchJson("https://air-quality-api.open-meteo.com/v1/air-quality?x=1"),
    ).resolves.toEqual({ ok: true });

    // After the cooldown one probe is made again.
    const probe = mockFetch(() => json({ ok: 1 }));
    vi.setSystemTime(new Date(Date.now() + HOST_COOLDOWN_MS + 1));
    await expect(fetchJson(URL_ + "&y=1")).resolves.toEqual({ ok: 1 });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("an ordinary 429 (no 'daily' in the reason) is still retried", async () => {
    vi.useFakeTimers();
    const fetch = mockFetch(() => json({ reason: "Too many concurrent requests" }, 429));
    const p = fetchJson(URL_).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBeInstanceOf(UpstreamError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("fetchJson serves stale cache when Open-Meteo is unavailable", () => {
  const opts = { ttlMs: 10 * MIN, staleMs: 60 * MIN };

  async function prime(): Promise<void> {
    mockFetch(() => json({ v: "fresh" }));
    await fetchJson(URL_, opts);
  }
  const ctxFor = (): RequestContext => ({
    requestId: "t",
    cacheHits: 0,
    cacheMisses: 0,
    staleAgeMs: 0,
  });

  it.each([
    ["daily cap (429)", () => json(DAILY, 429)],
    ["server error (503)", () => json({ reason: "down" }, 503)],
  ])("falls back on %s and reports the age", async (_label, failing) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    await prime();
    vi.setSystemTime(new Date(Date.now() + 25 * MIN)); // expired, within the stale window
    mockFetch(failing);
    const ctx = ctxFor();
    const p = requestContext.run(ctx, () => fetchJson(URL_, opts));
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ v: "fresh" });
    expect(Math.round(ctx.staleAgeMs / MIN)).toBe(25);
  });

  it("falls back on network errors", async () => {
    vi.useFakeTimers();
    await prime();
    vi.setSystemTime(new Date(Date.now() + 20 * MIN));
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    const p = fetchJson(URL_, opts);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toEqual({ v: "fresh" });
  });

  it("does not serve data older than the stale window", async () => {
    vi.useFakeTimers();
    await prime();
    vi.setSystemTime(new Date(Date.now() + 71 * MIN)); // ttl 10 + stale 60
    mockFetch(() => json(DAILY, 429));
    const err = await fetchJson(URL_, opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
  });

  it("does not fall back for client errors (400) or when no stale window is configured", async () => {
    vi.useFakeTimers();
    await prime();
    vi.setSystemTime(new Date(Date.now() + 20 * MIN));
    mockFetch(() => json({ reason: "bad" }, 400));
    await expect(fetchJson(URL_, opts)).rejects.toBeInstanceOf(UpstreamError);
    mockFetch(() => json({ reason: "down" }, 503));
    const p = fetchJson(URL_, { ttlMs: 10 * MIN }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBeInstanceOf(UpstreamError);
  });

  it("a fresh cache hit is not marked stale", async () => {
    await prime();
    const ctx = ctxFor();
    await requestContext.run(ctx, () => fetchJson(URL_, opts));
    expect(ctx.staleAgeMs).toBe(0);
    expect(ctx.cacheHits).toBe(1);
  });
});

describe("tools degrade gracefully on the daily cap", () => {
  it("serves the cached forecast with a note and valid structuredContent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    mockFetch(openMeteoRoutes);
    const { client, close } = await connectClient();
    const ok = (await client.callTool({
      name: "get_forecast",
      arguments: { city: "Jaipur", days: 3 },
    })) as { isError?: boolean };
    expect(ok.isError).toBeFalsy();

    vi.setSystemTime(new Date(Date.now() + 40 * MIN)); // forecast TTL (15 min) has passed
    mockFetch((url) =>
      url.host === "api.open-meteo.com" ? json(DAILY, 429) : openMeteoRoutes(url),
    );
    const res = (await client.callTool({
      name: "get_forecast",
      arguments: { city: "Jaipur", days: 3 },
    })) as {
      isError?: boolean;
      content: { text: string }[];
      structuredContent: { days: unknown[]; place: { name: string } };
    };
    expect(res.isError).toBeFalsy();
    const lines = (res.content[0]?.text ?? "").split("\n");
    expect(lines.length).toBeLessThanOrEqual(8);
    expect(lines.at(-1)).toBe("Weather data by Open-Meteo.com");
    expect(lines.at(-2)).toMatch(
      /^Note: live data is temporarily unavailable; showing results saved \d+ min ago\.$/,
    );
    expect(res.structuredContent.days).toHaveLength(3);
    expect(res.structuredContent.place.name).toBe("Jaipur");

    // A place nobody asked about yet still reports UPSTREAM_UNAVAILABLE.
    const miss = (await client.callTool({
      name: "get_forecast",
      arguments: { latitude: 5, longitude: 6 },
    })) as {
      isError?: boolean;
      structuredContent: { error: { code: string } };
    };
    expect(miss.isError).toBe(true);
    expect(miss.structuredContent.error.code).toBe("UPSTREAM_UNAVAILABLE");
    await close();
  });

  it("fresh answers carry no note", async () => {
    mockFetch(openMeteoRoutes);
    const { client, close } = await connectClient();
    const res = (await client.callTool({
      name: "get_forecast",
      arguments: { city: "Jaipur", days: 3 },
    })) as { content: { text: string }[] };
    expect(res.content[0]?.text).not.toContain("Note:");
    await close();
  });

  it("staleNote wording", () => {
    expect(staleNote(25 * MIN)).toContain("saved 25 min ago");
    expect(staleNote(10_000)).toContain("saved 1 min ago");
    expect(staleNote(3 * 60 * MIN)).toContain("saved 3 h ago");
    expect(staleNote(3 * 24 * 60 * MIN)).toContain("saved 3 days ago");
    expect(responseCache.size).toBeGreaterThanOrEqual(0);
  });
});
