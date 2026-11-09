import type { Units } from "@weather/shared";

export const ENDPOINTS = {
  geocoding: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  airQuality: "https://air-quality-api.open-meteo.com/v1/air-quality",
  archive: "https://archive-api.open-meteo.com/v1/archive",
} as const;

/** Round coordinates so nearby requests share a cache key (4 dp ≈ 11 m). */
export function coord(n: number): string {
  return String(Math.round(n * 1e4) / 1e4);
}

/** Base query for weather endpoints: coordinates + timezone=auto (+ imperial units). */
export function weatherParams(latitude: number, longitude: number, units: Units = "metric") {
  const params = new URLSearchParams({
    latitude: coord(latitude),
    longitude: coord(longitude),
    timezone: "auto",
  });
  if (units === "imperial") {
    params.set("temperature_unit", "fahrenheit");
    params.set("wind_speed_unit", "mph");
    params.set("precipitation_unit", "inch");
  }
  return params;
}

export function buildUrl(base: string, params: URLSearchParams): string {
  return `${base}?${params.toString()}`;
}

/** Open-Meteo weather response header fields we use. */
export interface WeatherResponseBase {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
}
