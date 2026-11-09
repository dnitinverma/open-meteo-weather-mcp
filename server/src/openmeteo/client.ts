// The ONLY module that calls fetch() against Open-Meteo (CLAUDE.md rule 2).
import { currentContext } from "../context.js";
import { logger } from "../logger.js";
import { responseCache } from "./cache.js";
import { DailyLimitReached, UpstreamError } from "./errors.js";
import { usage } from "./usage.js";

export const TIMEOUT_MS = 10_000;
/** Backoff before retry 1 and retry 2. */
export const RETRY_DELAYS_MS = [300, 900] as const;

export interface FetchJsonOptions {
  /** Cache the parsed response for this long. Omit to skip the cache. */
  ttlMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

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
  const controller = new AbortController();
  // Out of budget: cached data is still served (see fetchJson), real requests are not made.
  if (usage.exhausted) throw new DailyLimitReached();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    usage.increment();
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const reason = await readReason(res);
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
      if (options.ttlMs !== undefined) responseCache.set(url, data, options.ttlMs);
      return data as T;
    } catch (err) {
      lastError = err as UpstreamError;
      const retryable = lastError.status === null || isRetryableStatus(lastError.status);
      logger.debug(
        { host: new URL(url).host, attempt, status: lastError.status, retryable },
        "Open-Meteo request failed",
      );
      if (!retryable || lastError instanceof DailyLimitReached) break;
    }
  }
  logger.warn(
    { host: new URL(url).host, status: lastError?.status, reason: lastError?.reason },
    "Open-Meteo request gave up",
  );
  throw lastError ?? new UpstreamError(null, "unknown");
}
