import type { AirQualityResult } from "@weather/shared";
import { aqiCategory } from "@weather/shared";
import { TTL } from "./cache.js";
import { fetchJson } from "./client.js";
import { buildUrl, ENDPOINTS, weatherParams, type WeatherResponseBase } from "./params.js";

interface RawAirQualityResponse extends WeatherResponseBase {
  current: { time: string; us_aqi: number | null; pm2_5: number | null; pm10: number | null };
  hourly: { time: string[]; us_aqi: (number | null)[] };
}

export type AirQualityData = Pick<AirQualityResult, "current" | "daily"> & { timezone: string };

/** Current AQI + PM, and the daily max US AQI (from hourly values) for `days` days (1–5). */
export async function getAirQuality(
  latitude: number,
  longitude: number,
  days: number,
): Promise<AirQualityData> {
  const params = weatherParams(latitude, longitude);
  params.set("current", "us_aqi,pm2_5,pm10");
  params.set("hourly", "us_aqi");
  params.set("forecast_days", String(days));
  const data = await fetchJson<RawAirQualityResponse>(buildUrl(ENDPOINTS.airQuality, params), {
    ttlMs: TTL.airQuality,
  });

  const us_aqi = Math.round(data.current.us_aqi ?? 0);
  return {
    timezone: data.timezone,
    current: {
      time: data.current.time,
      us_aqi,
      category: aqiCategory(us_aqi),
      pm2_5: data.current.pm2_5 ?? 0,
      pm10: data.current.pm10 ?? 0,
    },
    daily: dailyMaxAqi(data.hourly.time, data.hourly.us_aqi).slice(0, days),
  };
}

/** Group hourly AQI by local date and take the max per day (days with no data are skipped). */
export function dailyMaxAqi(times: string[], values: (number | null)[]): AirQualityResult["daily"] {
  const byDate = new Map<string, number>();
  times.forEach((t, i) => {
    const v = values[i];
    if (v == null) return;
    const date = t.slice(0, 10);
    byDate.set(date, Math.max(byDate.get(date) ?? -Infinity, v));
  });
  return [...byDate].map(([date, max]) => {
    const us_aqi_max = Math.round(max);
    return { date, us_aqi_max, category: aqiCategory(us_aqi_max) };
  });
}
