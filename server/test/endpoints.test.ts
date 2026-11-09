import { describe, expect, it } from "vitest";
import { dailyMaxAqi, getAirQuality } from "../src/openmeteo/airQuality.js";
import { getArchive } from "../src/openmeteo/archive.js";
import { getCurrent, getDailyForecast, getHourlyForDate } from "../src/openmeteo/forecast.js";
import { mockFetch, openMeteoRoutes } from "./mockFetch.js";

const LAT = 26.91962;
const LON = 75.78781;
const lastUrl = (fetch: ReturnType<typeof mockFetch>) =>
  new URL(String(fetch.mock.calls.at(-1)![0]));

describe("forecast endpoint", () => {
  it("current: maps fields and always sends timezone=auto", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const c = await getCurrent(LAT, LON);
    const url = lastUrl(fetch);
    expect(url.searchParams.get("timezone")).toBe("auto");
    expect(url.searchParams.get("current")).toBe(
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,is_day",
    );
    expect(url.searchParams.has("temperature_unit")).toBe(false);
    expect(c.timezone).toBe("Asia/Kolkata");
    expect(typeof c.temperature).toBe("number");
    expect(typeof c.is_day).toBe("boolean");
    expect(c.condition).not.toBe("Unknown");
  });

  it("imperial units add fahrenheit / mph / inch", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const c = await getCurrent(LAT, LON, "imperial");
    const p = lastUrl(fetch).searchParams;
    expect(p.get("temperature_unit")).toBe("fahrenheit");
    expect(p.get("wind_speed_unit")).toBe("mph");
    expect(p.get("precipitation_unit")).toBe("inch");
    expect(c.temperature).toBeGreaterThan(50); // °F
  });

  it("daily: requests forecast_days and maps every ForecastDay field", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const { days } = await getDailyForecast(LAT, LON, 3);
    expect(lastUrl(fetch).searchParams.get("forecast_days")).toBe("3");
    expect(days).toHaveLength(3);
    expect(Object.keys(days[0]!).sort()).toEqual(
      [
        "condition",
        "date",
        "precipitation_probability_max",
        "precipitation_sum",
        "sunrise",
        "sunset",
        "temp_max",
        "temp_min",
        "uv_index_max",
        "weather_code",
      ].sort(),
    );
  });

  it("hourly: one date via start_date/end_date, never forecast_days", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const { hours } = await getHourlyForDate(LAT, LON, "2026-11-10");
    const p = lastUrl(fetch).searchParams;
    expect(p.get("start_date")).toBe("2026-11-10");
    expect(p.get("end_date")).toBe("2026-11-10");
    expect(p.has("forecast_days")).toBe(false);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toHaveProperty("condition");
  });
});

describe("air quality endpoint", () => {
  it("returns current AQI with category and daily max per date", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const aq = await getAirQuality(LAT, LON, 3);
    const p = lastUrl(fetch).searchParams;
    expect(p.get("current")).toBe("us_aqi,pm2_5,pm10");
    expect(p.get("hourly")).toBe("us_aqi");
    expect(p.get("timezone")).toBe("auto");
    expect(aq.daily).toHaveLength(3);
    expect(aq.current.category).toBeTypeOf("string");
    expect(Number.isInteger(aq.current.us_aqi)).toBe(true);
  });

  it("dailyMaxAqi groups by local date and skips nulls", () => {
    expect(
      dailyMaxAqi(
        ["2026-11-09T00:00", "2026-11-09T01:00", "2026-11-10T00:00", "2026-11-11T00:00"],
        [40, 160.4, null, 55],
      ),
    ).toEqual([
      { date: "2026-11-09", us_aqi_max: 160, category: "Unhealthy" },
      { date: "2026-11-11", us_aqi_max: 55, category: "Moderate" },
    ]);
  });
});

describe("archive endpoint", () => {
  it("returns daily max/min/precipitation for the date range", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const { days, timezone } = await getArchive(LAT, LON, "2025-07-01", "2025-07-31");
    const p = lastUrl(fetch).searchParams;
    expect(p.get("start_date")).toBe("2025-07-01");
    expect(p.get("daily")).toBe("temperature_2m_max,temperature_2m_min,precipitation_sum");
    expect(timezone).toBe("Asia/Kolkata");
    expect(days).toHaveLength(31);
  });
});
