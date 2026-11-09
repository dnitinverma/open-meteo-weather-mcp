// The ONLY module that calls fetch() against Open-Meteo (CLAUDE.md rule 2).
import { currentContext } from "../context.js";
import { logger } from "../logger.js";
import { responseCache } from "./cache.js";
import { DailyLimitReached, UpstreamCooldown, UpstreamDailyCap, UpstreamError } from "./errors.js";
import { usage } from "./usage.js";

export const TIMEOUT_MS = 10_000;
/** Backoff before retry 1 and retry 2. */
export const RETRY_DELAYS_MS = [300, 900] as const;

/** After Open-Meteo reports its daily cap for a host, wait this long before probing it again. */
export const HOST_COOLDOWN_MS = 15 * 60_000;
const cooldownUntil = new Map<string, number>();

/** Forget host cooldowns (tests). */
export function resetHostCooldowns(): void {
  cooldownUntil.clear();
}

export interface FetchJsonOptions {
  /** Cache the parsed response for this long. Omit to skip the cache. */
  ttlMs?: number;
  /** Serve the cached response for this much longer if Open-Meteo is unavailable. */
  staleMs?: number;
}

/** Errors for which an expired cached answer is a better outcome than failing. */
function isUnavailable(err: UpstreamError): boolean {
  return err.status === null || err.status === 429 || err.status >= 500;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Short, log-safe reason from an Open-Meteo error body (`{ error: true, reason: "..." }`). */
async function readReason(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "reason" in body && typeof body.reason === "string") {
      return body.reason.slice(0, 200);
    }
  } catch {
    // not JSON
  }
  return `HTTP ${res.status}`;
}

async function fetchOnce(url: string): Promise<unknown> {
  const host = new URL(url).host;
  // A host that just reported its daily cap is not hammered again until the cooldown ends.
  if ((cooldownUntil.get(host) ?? 0) > Date.now()) throw new UpstreamCooldown(host);
  // Out of our own budget: cached data is still served (see fetchJson), real requests are not made.
  if (usage.exhausted) throw new DailyLimitReached();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    usage.increment();
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const reason = await readReason(res);
      if (res.status === 429 && /daily/i.test(reason)) {
        cooldownUntil.set(host, Date.now() + HOST_COOLDOWN_MS);
        throw new UpstreamDailyCap(reason);
      }
      throw new UpstreamError(res.status, reason);
    }
    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const reason = controller.signal.aborted
      ? `timeout after ${TIMEOUT_MS} ms`
      : err instanceof Error
        ? err.message
        : String(err);
    throw new UpstreamError(null, reason);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET a JSON document from Open-Meteo with timeout, retries and caching.
 * - 10 s timeout per attempt (AbortController)
 * - 2 retries (300 ms, then 900 ms) on network errors, timeouts, 5xx and 429; none on other 4xx
 * - throws UpstreamError on final failure
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  if (options.ttlMs !== undefined) {
    const cached = responseCache.get(url);
    if (cached !== undefined) {
      const ctx = currentContext();
      if (ctx) ctx.cacheHits++;
      return cached as T;
    }
    const ctx = currentContext();
    if (ctx) ctx.cacheMisses++;
  }

  let lastError: UpstreamError | undefined;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 0);
    try {
      const data = await fetchOnce(url);
      if (options.ttlMs !== undefined) {
        responseCache.set(url, data, options.ttlMs, options.staleMs ?? 0);
      }
      return data as T;
    } catch (err) {
      lastError = err as UpstreamError;
      logger.debug(
        {
          host: new URL(url).host,
          attempt,
          status: lastError.status,
          retryable: lastError.retryable,
        },
        "Open-Meteo request failed",
      );
      if (!lastError.retryable) break;
    }
  }
  const failure = lastError ?? new UpstreamError(null, "unknown");
  logger.warn(
    { host: new URL(url).host, status: failure.status, reason: failure.reason },
    "Open-Meteo request gave up",
  );

  // Unavailable upstream: prefer an expired cached answer (within its stale window) to failing.
  if (options.ttlMs !== undefined && options.staleMs && isUnavailable(failure)) {
    const stale = responseCache.getStale(url);
    if (stale) {
      const ctx = currentContext();
      if (ctx) ctx.staleAgeMs = Math.max(ctx.staleAgeMs, stale.ageMs);
      logger.info(
        { host: new URL(url).host, ageSeconds: Math.round(stale.ageMs / 1000) },
        "served stale cache: Open-Meteo unavailable",
      );
      return stale.value as T;
    }
  }
  throw failure;
}
