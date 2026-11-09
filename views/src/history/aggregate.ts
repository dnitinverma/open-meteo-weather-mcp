import type { HistoricalResult } from "@weather/shared";

export const MONTHLY_THRESHOLD_DAYS = 62;

export interface Bucket {
  /** YYYY-MM-DD for daily buckets, YYYY-MM for monthly buckets. */
  key: string;
  precipitation: number;
  temp_max: number;
  temp_min: number;
  days: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Daily marks for ranges up to 62 days; otherwise monthly totals (rain) and monthly averages
 * (max/min temperature).
 */
export function bucketize(days: HistoricalResult["days"]): { monthly: boolean; buckets: Bucket[] } {
  if (days.length <= MONTHLY_THRESHOLD_DAYS) {
    return {
      monthly: false,
      buckets: days.map((d) => ({
        key: d.date,
        precipitation: d.precipitation_sum,
        temp_max: d.temp_max,
        temp_min: d.temp_min,
        days: 1,
      })),
    };
  }
  const byMonth = new Map<string, { p: number; max: number; min: number; n: number }>();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    const m = byMonth.get(k) ?? { p: 0, max: 0, min: 0, n: 0 };
    m.p += d.precipitation_sum;
    m.max += d.temp_max;
    m.min += d.temp_min;
    m.n += 1;
    byMonth.set(k, m);
  }
  return {
    monthly: true,
    buckets: [...byMonth].map(([key, m]) => ({
      key,
      precipitation: round1(m.p),
      temp_max: round1(m.max / m.n),
      temp_min: round1(m.min / m.n),
      days: m.n,
    })),
  };
}

/** Show every n-th axis label so labels (≈ `labelPx` wide) never overlap. */
export function labelStep(count: number, width: number, labelPx: number): number {
  if (count <= 0 || width <= 0) return 1;
  return Math.max(1, Math.ceil((count * labelPx) / width));
}
