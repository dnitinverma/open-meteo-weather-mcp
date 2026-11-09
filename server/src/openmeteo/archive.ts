import type { HistoricalResult, Units } from "@weather/shared";
import { TTL } from "./cache.js";
import { fetchJson } from "./client.js";
import { buildUrl, ENDPOINTS, weatherParams, type WeatherResponseBase } from "./params.js";

interface RawArchiveResponse extends WeatherResponseBase {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

export type HistoricalDay = HistoricalResult["days"][number];

/**
 * Past daily max/min temperature and precipitation between two dates (inclusive).
 * Days the archive has no data for yet (the most recent few days) are skipped.
 */
export async function getArchive(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  units: Units = "metric",
): Promise<{ timezone: string; days: HistoricalDay[] }> {
  const params = weatherParams(latitude, longitude, units);
  params.set("start_date", startDate);
  params.set("end_date", endDate);
  params.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  const data = await fetchJson<RawArchiveResponse>(buildUrl(ENDPOINTS.archive, params), {
    ttlMs: TTL.historical,
  });
  const d = data.daily;
  const days: HistoricalDay[] = [];
  d.time.forEach((date, i) => {
    const max = d.temperature_2m_max[i];
    const min = d.temperature_2m_min[i];
    if (max == null || min == null) return;
    days.push({
      date,
      temp_max: max,
      temp_min: min,
      precipitation_sum: d.precipitation_sum[i] ?? 0,
    });
  });
  return { timezone: data.timezone, days };
}
