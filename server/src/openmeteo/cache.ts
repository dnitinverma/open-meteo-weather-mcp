interface Entry<V> {
  value: V;
  storedAt: number;
  expiresAt: number;
  /** Until when the entry may still be served as a stale fallback (>= expiresAt). */
  staleUntil: number;
}

/**
 * In-memory TTL cache with least-recently-used eviction. Entries can outlive their TTL for a
 * "stale window": `get` ignores them, but `getStale` can serve them when the upstream is down.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  hits = 0;
  misses = 0;

  constructor(
    readonly maxEntries = 1000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) {
      if (entry && entry.staleUntil <= this.now()) this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh recency: Map iteration order is insertion order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /** An expired-but-within-stale-window entry and how old it is; undefined if none. */
  getStale(key: string): { value: V; ageMs: number } | undefined {
    const entry = this.entries.get(key);
    const t = this.now();
    if (!entry) return undefined;
    if (entry.staleUntil <= t) {
      this.entries.delete(key);
      return undefined;
    }
    return { value: entry.value, ageMs: t - entry.storedAt };
  }

  set(key: string, value: V, ttlMs: number, staleMs = 0): void {
    const t = this.now();
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      storedAt: t,
      expiresAt: t + ttlMs,
      staleUntil: t + ttlMs + staleMs,
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

const MINUTE = 60_000;

/** Cache TTLs from "Data contracts → Other fixed values". */
export const TTL = {
  geocoding: 7 * 24 * 60 * MINUTE,
  current: 10 * MINUTE,
  forecast: 15 * MINUTE,
  airQuality: 30 * MINUTE,
  historical: 24 * 60 * MINUTE,
} as const;

/**
 * How long past its TTL an entry may still be served when Open-Meteo is unavailable (rate limited,
 * down, over our own daily budget). Short for fast-changing data, long for rarely-changing data.
 */
export const STALE = {
  geocoding: 30 * 24 * 60 * MINUTE,
  current: 2 * 60 * MINUTE,
  forecast: 12 * 60 * MINUTE,
  airQuality: 6 * 60 * MINUTE,
  historical: 7 * 24 * 60 * MINUTE,
} as const;

/** Shared response cache; key = full request URL. */
export const responseCache = new TtlCache<unknown>(1000);
