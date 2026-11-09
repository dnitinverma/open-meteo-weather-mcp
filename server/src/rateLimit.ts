import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface RateLimiterOptions {
  limit: number;
  windowMs?: number;
  /** Upper bound on tracked IPs so memory stays bounded under a flood of distinct addresses. */
  maxKeys?: number;
  now?: () => number;
}

/**
 * Fixed-window per-IP rate limiter, in memory only. IPs are used as map keys and are never logged
 * or persisted (CLAUDE.md rule 10: no tracking).
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const { limit, windowMs = 60_000, maxKeys = 10_000, now = Date.now } = options;
  const hits = new Map<string, { count: number; resetAt: number }>();

  function prune(t: number): void {
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    // Still too many (all active): drop the oldest entries.
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const t = now();
    const key = req.ip ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (hits.size >= maxKeys) prune(t);
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    res.set("RateLimit-Limit", String(limit));
    res.set("RateLimit-Remaining", String(remaining));
    if (entry.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - t) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Rate limit exceeded: at most ${limit} requests per minute per IP. Try again in ${retryAfter} seconds.`,
        },
        id: null,
      });
      return;
    }
    next();
  };
}
