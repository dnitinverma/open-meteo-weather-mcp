import type { ForecastDay, HourlyPoint, Units } from "@weather/shared";
import { describeWeatherCode } from "@weather/shared";
import { TTL } from "./cache.js";
import { fetchJson } from "./client.js";
import { buildUrl, ENDPOINTS, weatherParams, type WeatherResponseBase } from "./params.js";

// ---------- current ----------
export const CURRENT_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "precipitation",
  "weather_code",
  "is_day",
] as const;

interface RawCurrentResponse extends WeatherResponseBase {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    precipitation: number;
    weather_code: number;
    is_day: number;
  };
}

export interface CurrentConditions {
  timezone: string;
  observed_at: string;
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  precipitation: number;
  weather_code: number;
  condition: string;
  is_day: boolean;
}

export async function getCurrent(
  latitude: number,
  longitude: number,
  units: Units = "metric",
): Promise<CurrentConditions> {
  const params = weatherParams(latitude, longitude, units);
  params.set("current", CURRENT_VARS.join(","));
  const data = await fetchJson<RawCurrentResponse>(buildUrl(ENDPOINTS.forecast, params), {
    ttlMs: TTL.current,
  });
  const c = data.current;
  return {
    timezone: data.timezone,
    observed_at: c.time,
    temperature: c.temperature_2m,
    apparent_temperature: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    wind_speed: c.wind_speed_10m,
    wind_direction: c.wind_direction_10m,
    precipitation: c.precipitation,
    weather_code: c.weather_code,
    condition: describeWeatherCode(c.weather_code).condition,
    is_day: c.is_day === 1,
  };
}

// ---------- daily ----------
export const DAILY_VARS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "sunrise",
  "sunset",
  "uv_index_max",
] as const;

interface RawDailyResponse extends WeatherResponseBase {
  daily: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max: (number | null)[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: (number | null)[];
  };
}

export async function getDailyForecast(
  latitude: number,
  longitude: number,
  days: number,
  units: Units = "metric",
): Promise<{ timezone: string; days: ForecastDay[] }> {
  const params = weatherParams(latitude, longitude, units);
  params.set("daily", DAILY_VARS.join(","));
  params.set("forecast_days", String(days));
  const data = await fetchJson<RawDailyResponse>(buildUrl(ENDPOINTS.forecast, params), {
    ttlMs: TTL.forecast,
  });
  const d = data.daily;
  const out: ForecastDay[] = [];
  d.time.forEach((date, i) => {
    const max = d.temperature_2m_max[i];
    const min = d.temperature_2m_min[i];
    if (max == null || min == null) return; // no model data for this day
    const code = d.weather_code[i] ?? -1;
    out.push({
      date,
      weather_code: code,
      condition: describeWeatherCode(code).condition,
      temp_max: max,
      temp_min: min,
      precipitation_sum: d.precipitation_sum[i] ?? 0,
      precipitation_probability_max: d.precipitation_probability_max[i] ?? null,
      sunrise: d.sunrise[i] ?? "",
      sunset: d.sunset[i] ?? "",
      uv_index_max: d.uv_index_max[i] ?? null,
    });
  });
  return { timezone: data.timezone, days: out };
}

// ---------- hourly (one date) ----------
export const HOURLY_VARS = ["temperature_2m", "precipitation_probability", "weather_code"] as const;

interface RawHourlyResponse extends WeatherResponseBase {
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation_probability: (number | null)[];
    weather_code: (number | null)[];
  };
}

/**
 * Hourly detail for one local date (YYYY-MM-DD). Open-Meteo does not allow forecast_days together
 * with start_date/end_date, so this is a separate request from the daily forecast.
 */
export async function getHourlyForDate(
  latitude: number,
  longitude: number,
  date: string,
  units: Units = "metric",
): Promise<{ timezone: string; hours: HourlyPoint[] }> {
  const params = weatherParams(latitude, longitude, units);
  params.set("hourly", HOURLY_VARS.join(","));
  params.set("start_date", date);
  params.set("end_date", date);
  const data = await fetchJson<RawHourlyResponse>(buildUrl(ENDPOINTS.forecast, params), {
    ttlMs: TTL.forecast,
  });
  const h = data.hourly;
  const hours: HourlyPoint[] = [];
  h.time.forEach((time, i) => {
    const temperature = h.temperature_2m[i];
    if (temperature == null) return;
    const code = h.weather_code[i] ?? -1;
    hours.push({
      time,
      temperature,
      precipitation_probability: h.precipitation_probability[i] ?? null,
      weather_code: code,
      condition: describeWeatherCode(code).condition,
    });
  });
  return { timezone: data.timezone, hours };
}
