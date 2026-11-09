/** In-memory TTL cache with least-recently-used eviction. */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  hits = 0;
  misses = 0;

  constructor(
    readonly maxEntries = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) {
      if (entry) this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh recency: Map iteration order is insertion order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
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

/** Shared response cache; key = full request URL. */
export const responseCache = new TtlCache<unknown>(1000);
