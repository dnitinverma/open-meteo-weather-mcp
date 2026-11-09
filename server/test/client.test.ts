import { describe, expect, it, vi } from "vitest";
import { fetchJson, TIMEOUT_MS } from "../src/openmeteo/client.js";
import { UpstreamError } from "../src/openmeteo/errors.js";
import { usage } from "../src/openmeteo/usage.js";
import { json, mockFetch } from "./mockFetch.js";

const URL_ = "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2";

/** Runs fetchJson with fake timers, advancing through all backoffs/timeouts. */
async function run<T>(p: Promise<T>): Promise<T> {
  const settled = p.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  await vi.advanceTimersByTimeAsync(3 * TIMEOUT_MS + 2_000);
  const r = await settled;
  if (r.ok) return r.v;
  throw r.e;
}

describe("fetchJson", () => {
  it("retries on 5xx then succeeds", async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetch = mockFetch(() => (++n < 3 ? json({ reason: "boom" }, 503) : json({ ok: 1 })));
    await expect(run(fetchJson(URL_))).resolves.toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("retries on 429 and network errors", async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetch = mockFetch(() => {
      n++;
      if (n === 1) return json({}, 429);
      if (n === 2) throw new TypeError("fetch failed");
      return json({ ok: 2 });
    });
    await expect(run(fetchJson(URL_))).resolves.toEqual({ ok: 2 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("waits 300 ms then 900 ms between attempts", async () => {
    vi.useFakeTimers();
    const fetch = mockFetch(() => json({}, 500));
    const p = fetchJson(URL_).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(299);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(899);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(await p).toBeInstanceOf(UpstreamError);
  });

  it("throws UpstreamError when retries are exhausted", async () => {
    vi.useFakeTimers();
    const fetch = mockFetch(() => json({ reason: "down" }, 502));
    const err = await run(fetchJson(URL_)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).code).toBe("UPSTREAM_UNAVAILABLE");
    expect((err as UpstreamError).status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("aborts after the 10 s timeout and retries", async () => {
    vi.useFakeTimers();
    const fetch = mockFetch(
      () =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (fetch.mock.calls.at(-1)?.[1] as RequestInit | undefined)?.signal;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const p = fetchJson(URL_).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3 * TIMEOUT_MS);
    const err = (await p) as UpstreamError;
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.reason).toMatch(/timeout/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 400 and hides the raw reason from the message", async () => {
    const fetch = mockFetch(() => json({ error: true, reason: "Parameter 'x' is invalid" }, 400));
    const err = (await fetchJson(URL_).catch((e: unknown) => e)) as UpstreamError;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(err.status).toBe(400);
    expect(err.reason).toBe("Parameter 'x' is invalid");
    expect(err.message).not.toContain("Parameter");
  });

  it("serves cache hits without calling fetch", async () => {
    const fetch = mockFetch(() => json({ v: 1 }));
    await fetchJson(URL_, { ttlMs: 60_000 });
    await expect(fetchJson(URL_, { ttlMs: 60_000 })).resolves.toEqual({ v: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    let n = 0;
    const fetch = mockFetch(() => (++n === 1 ? json({}, 404) : json({ v: 2 })));
    await expect(fetchJson(URL_, { ttlMs: 60_000 })).rejects.toBeInstanceOf(UpstreamError);
    await expect(fetchJson(URL_, { ttlMs: 60_000 })).resolves.toEqual({ v: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("counts every real request in the usage counter", async () => {
    vi.useFakeTimers();
    mockFetch(() => json({}, 500));
    await run(fetchJson(URL_)).catch(() => {});
    expect(usage.today).toBe(3);
  });
});
