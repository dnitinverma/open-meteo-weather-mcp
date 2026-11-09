import type { Client } from "@modelcontextprotocol/client";
import {
  airQualityResultSchema,
  currentWeatherResultSchema,
  forecastResultSchema,
  historicalResultSchema,
  searchLocationResultSchema,
  toolErrorSchema,
  type ToolError,
} from "@weather/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { connectClient } from "./helpers.js";
import { json, mockFetch, openMeteoRoutes } from "./mockFetch.js";

let client: Client;
let close: () => Promise<void>;
beforeEach(async () => {
  ({ client, close } = await connectClient());
});
afterEach(async () => {
  await close();
});

interface ToolCall {
  content: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

async function call(name: string, args: Record<string, unknown>): Promise<ToolCall> {
  return (await client.callTool({ name, arguments: args })) as ToolCall;
}
const textOf = (r: ToolCall) => r.content.map((c) => c.text ?? "").join("\n");

function expectOk<S extends z.ZodType>(r: ToolCall, schema: S): z.output<S> {
  expect(r.isError, textOf(r)).toBeFalsy();
  const lines = textOf(r).split("\n");
  expect(lines.length).toBeLessThanOrEqual(8);
  expect(lines.at(-1)).toBe("Weather data by Open-Meteo.com");
  return schema.parse(r.structuredContent);
}

function expectError(r: ToolCall, code: ToolError["error"]["code"]): ToolError {
  expect(r.isError).toBe(true);
  const err = toolErrorSchema.parse(r.structuredContent);
  expect(err.error.code).toBe(code);
  expect(textOf(r).split("\n")).toHaveLength(1);
  expect(textOf(r)).not.toMatch(/\n\s+at |Error:|"reason"/);
  return err;
}

const DESCRIPTIONS: Record<string, string> = {
  search_location:
    "Find places matching a name and return their coordinates. Use when a location is unclear or ambiguous, before calling a weather tool.",
  get_current_weather:
    "Current weather right now for a city or coordinates: temperature, feels-like, humidity, wind, precipitation and conditions.",
  get_forecast:
    "Daily weather forecast for 1 to 16 days for a city or coordinates, with optional hourly detail for one date. Use for any question about future weather, such as rain this weekend.",
  get_air_quality:
    "Current US AQI with PM2.5 and PM10 for a city or coordinates, plus a daily AQI forecast for up to 5 days.",
  get_historical_weather:
    "Past daily temperatures and rainfall for a city or coordinates between two dates, up to 366 days. Use for weather that already happened.",
};

describe("tools/list", () => {
  it("lists exactly the five tools with the plan's descriptions and annotations", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(DESCRIPTIONS).sort());
    for (const t of tools) {
      expect(t.description).toBe(DESCRIPTIONS[t.name]);
      expect(t.title).toBeTruthy();
      expect(t.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: true,
        destructiveHint: false,
      });
      const props = (t.inputSchema as { properties: Record<string, { description?: string }> })
        .properties;
      for (const [key, prop] of Object.entries(props)) {
        expect(prop.description, `${t.name}.${key}`).toBeTruthy();
      }
    }
  });

  it("advertises input constraints in the JSON Schema", async () => {
    const { tools } = await client.listTools();
    const fc = tools.find((t) => t.name === "get_forecast")!;
    const props = (fc.inputSchema as { properties: Record<string, Record<string, unknown>> })
      .properties;
    expect(props.days).toMatchObject({ type: "integer", minimum: 1, maximum: 16, default: 7 });
    expect(props.latitude).toMatchObject({ minimum: -90, maximum: 90 });
  });
});

describe("search_location", () => {
  it("returns places without internal fields", async () => {
    mockFetch(openMeteoRoutes);
    const data = expectOk(
      await call("search_location", { name: "Springfield" }),
      searchLocationResultSchema,
    );
    expect(data.results).toHaveLength(5); // fixture has 5; count is sent upstream
    expect(data.results[0]).not.toHaveProperty("population");
  });

  it("returns LOCATION_NOT_FOUND for no matches", async () => {
    mockFetch(openMeteoRoutes);
    expectError(await call("search_location", { name: "Xyzabc" }), "LOCATION_NOT_FOUND");
  });
});

describe.each([
  ["Jaipur", { city: "Jaipur" }, "Jaipur, Rajasthan, India"],
  ["Noida, India", { city: "Noida, India" }, "Noida, Uttar Pradesh, India"],
  ["coordinates", { latitude: 28.54, longitude: 77.39 }, "28.54, 77.39"],
])("weather tools for %s", (_label, location, placeText) => {
  it("get_current_weather", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_current_weather", location);
    const data = expectOk(r, currentWeatherResultSchema);
    expect(textOf(r).split("\n")[0]).toContain(placeText);
    expect(data.units).toBe("metric");
    expect(data.place.timezone).toBe("Asia/Kolkata");
    expect(data.attribution.url).toBe("https://open-meteo.com");
  });

  it("get_forecast", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_forecast", { ...location, days: 3 });
    const data = expectOk(r, forecastResultSchema);
    expect(data.days).toHaveLength(3);
    expect(data.hourly).toBeUndefined();
    expect(textOf(r).split("\n")[0]).toBe(`${placeText} — 3-day forecast`);
  });

  it("get_air_quality", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_air_quality", { ...location, days: 3 });
    const data = expectOk(r, airQualityResultSchema);
    expect(data.daily).toHaveLength(3);
    expect(textOf(r)).toContain(`US AQI ${data.current.us_aqi} · ${data.current.category}`);
  });

  it("get_historical_weather", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_historical_weather", {
      ...location,
      start_date: "2025-07-01",
      end_date: "2025-07-31",
    });
    const data = expectOk(r, historicalResultSchema);
    expect(data.days).toHaveLength(31);
    expect(data.totals.precipitation_sum).toBeGreaterThan(0);
  });
});

describe("get_forecast details", () => {
  it("fits 16 days into 8 text lines", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_forecast", { city: "Jaipur", days: 16 });
    const data = expectOk(r, forecastResultSchema);
    expect(data.days).toHaveLength(16);
    expect(textOf(r).split("\n")).toHaveLength(8);
  });

  it("adds hourly detail for a date in range", async () => {
    mockFetch(openMeteoRoutes);
    const first = expectOk(
      await call("get_forecast", { city: "Jaipur", days: 3 }),
      forecastResultSchema,
    );
    const date = first.days[1]!.date;
    const r = await call("get_forecast", { city: "Jaipur", days: 3, hourly_for_date: date });
    const data = expectOk(r, forecastResultSchema);
    expect(data.hourly?.date).toBe(date);
    expect(data.hourly?.hours).toHaveLength(24);
    expect(textOf(r)).toContain("Hourly");
  });

  it("uses imperial units when asked", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_current_weather", { city: "Jaipur", units: "imperial" });
    const data = expectOk(r, currentWeatherResultSchema);
    expect(data.units).toBe("imperial");
    expect(textOf(r)).toMatch(/°F/);
  });
});

describe("errors", () => {
  it("AMBIGUOUS_LOCATION lists alternatives in text and structuredContent", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_current_weather", { city: "Springfield" });
    const err = expectError(r, "AMBIGUOUS_LOCATION");
    expect(err.error.alternatives).toHaveLength(3);
    expect(textOf(r)).toContain("Springfield, Missouri, United States");
    expect(textOf(r)).toContain("Springfield, Illinois, United States");
  });

  it("LOCATION_NOT_FOUND for an unknown city", async () => {
    mockFetch(openMeteoRoutes);
    for (const tool of ["get_current_weather", "get_forecast", "get_air_quality"]) {
      expectError(await call(tool, { city: "Xyzabc" }), "LOCATION_NOT_FOUND");
    }
  });

  it.each([
    ["no location", "get_current_weather", {}],
    ["latitude without longitude", "get_current_weather", { latitude: 10 }],
    ["city and coordinates", "get_current_weather", { city: "Jaipur", latitude: 1, longitude: 2 }],
    ["latitude out of range", "get_forecast", { latitude: 91, longitude: 0 }],
    ["days too large", "get_forecast", { city: "Jaipur", days: 20 }],
    ["air quality days too large", "get_air_quality", { city: "Jaipur", days: 6 }],
    ["city too short", "get_forecast", { city: "J" }],
    ["bad units", "get_forecast", { city: "Jaipur", units: "kelvin" }],
    ["bad date", "get_forecast", { city: "Jaipur", hourly_for_date: "2026-02-30" }],
    [
      "range over 366 days",
      "get_historical_weather",
      { city: "Jaipur", start_date: "2024-01-01", end_date: "2025-01-02" },
    ],
    [
      "end before start",
      "get_historical_weather",
      { city: "Jaipur", start_date: "2025-07-10", end_date: "2025-07-01" },
    ],
    [
      "future end date",
      "get_historical_weather",
      { city: "Jaipur", start_date: "2025-07-01", end_date: "2099-01-01" },
    ],
  ])("INVALID_INPUT: %s", async (_label, tool, args) => {
    const fetch = mockFetch(openMeteoRoutes);
    expectError(await call(tool, args), "INVALID_INPUT");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("INVALID_INPUT when hourly_for_date is outside the forecast", async () => {
    mockFetch(openMeteoRoutes);
    const r = await call("get_forecast", {
      city: "Jaipur",
      days: 3,
      hourly_for_date: "2030-01-01",
    });
    expect(expectError(r, "INVALID_INPUT").error.message).toMatch(/forecast range/);
  });

  it("INVALID_INPUT when Open-Meteo rejects the request (400), without leaking its reason", async () => {
    mockFetch((url) =>
      url.host === "archive-api.open-meteo.com"
        ? json({ error: true, reason: "Parameter 'start_date' is out of allowed range" }, 400)
        : undefined,
    );
    const r = await call("get_historical_weather", {
      latitude: 1,
      longitude: 2,
      start_date: "1950-01-01",
      end_date: "1950-01-02",
    });
    expectError(r, "INVALID_INPUT");
    expect(textOf(r)).not.toContain("allowed range");
  });

  it("UPSTREAM_UNAVAILABLE when Open-Meteo is down", async () => {
    mockFetch(() => json({ reason: "Internal Server Error" }, 503));
    const r = await call("get_current_weather", { latitude: 1, longitude: 2 });
    expectError(r, "UPSTREAM_UNAVAILABLE");
    expect(textOf(r)).not.toContain("Internal Server Error");
  });
});
