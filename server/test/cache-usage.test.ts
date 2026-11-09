import { describe, expect, it, vi } from "vitest";
import { TtlCache, TTL } from "../src/openmeteo/cache.js";
import { UsageCounter } from "../src/openmeteo/usage.js";

describe("TtlCache", () => {
  it("expires entries after their TTL", () => {
    let now = 0;
    const c = new TtlCache<string>(10, () => now);
    c.set("a", "x", 1000);
    now = 999;
    expect(c.get("a")).toBe("x");
    now = 1000;
    expect(c.get("a")).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("evicts the least recently used entry when full", () => {
    const c = new TtlCache<number>(2);
    c.set("a", 1, 1e6);
    c.set("b", 2, 1e6);
    c.get("a"); // a is now most recent
    c.set("c", 3, 1e6);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });

  it("caps at 1,000 entries by default", () => {
    const c = new TtlCache<number>();
    for (let i = 0; i < 1005; i++) c.set(String(i), i, 1e6);
    expect(c.size).toBe(1000);
    expect(c.get("0")).toBeUndefined();
    expect(c.get("1004")).toBe(1004);
  });

  it("uses the TTLs from the plan", () => {
    const min = 60_000;
    expect(TTL).toEqual({
      geocoding: 7 * 24 * 60 * min,
      current: 10 * min,
      forecast: 15 * min,
      airQuality: 30 * min,
      historical: 24 * 60 * min,
    });
  });
});

describe("UsageCounter", () => {
  it("resets at 00:00 UTC", () => {
    let now = new Date("2026-11-09T23:59:59Z");
    const u = new UsageCounter(
      100,
      () => now,
      () => {},
    );
    u.increment();
    u.increment();
    expect(u.today).toBe(2);
    now = new Date("2026-11-10T00:00:00Z");
    expect(u.today).toBe(0);
    u.increment();
    expect(u.today).toBe(1);
  });

  it("warns once at 80% of the limit and reports exhaustion", () => {
    const warn = vi.fn();
    const u = new UsageCounter(10, () => new Date("2026-11-09T12:00:00Z"), warn);
    for (let i = 0; i < 7; i++) u.increment();
    expect(warn).not.toHaveBeenCalled();
    u.increment();
    expect(warn).toHaveBeenCalledTimes(1);
    u.increment();
    u.increment();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(u.exhausted).toBe(true);
  });
});
