// Zod mirrors of the structuredContent contracts in contracts.ts. Used by server tests and by the
// views to validate tool results. Type-level checks at the bottom keep them in sync.
import { z } from "zod";
import type {
  AirQualityResult,
  CurrentWeatherResult,
  ForecastResult,
  HistoricalResult,
  Place,
  SearchLocationResult,
  ToolError,
} from "./contracts.ts";

export const unitsSchema = z.enum(["metric", "imperial"]);

export const placeSchema = z.object({
  name: z.string(),
  admin1: z.string().optional(),
  country: z.string(),
  country_code: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
});

export const attributionSchema = z.object({
  text: z.literal("Weather data by Open-Meteo.com"),
  url: z.literal("https://open-meteo.com"),
});

export const aqiCategorySchema = z.enum([
  "Good",
  "Moderate",
  "Unhealthy for sensitive groups",
  "Unhealthy",
  "Very unhealthy",
  "Hazardous",
]);

export const searchLocationResultSchema = z.object({ results: z.array(placeSchema) });

export const currentWeatherResultSchema = z.object({
  place: placeSchema,
  units: unitsSchema,
  observed_at: z.string(),
  temperature: z.number(),
  apparent_temperature: z.number(),
  humidity: z.number(),
  wind_speed: z.number(),
  wind_direction: z.number(),
  precipitation: z.number(),
  weather_code: z.number(),
  condition: z.string(),
  is_day: z.boolean(),
  attribution: attributionSchema,
});

export const forecastDaySchema = z.object({
  date: z.string(),
  weather_code: z.number(),
  condition: z.string(),
  temp_max: z.number(),
  temp_min: z.number(),
  precipitation_sum: z.number(),
  precipitation_probability_max: z.number().nullable(),
  sunrise: z.string(),
  sunset: z.string(),
  uv_index_max: z.number().nullable(),
});

export const hourlyPointSchema = z.object({
  time: z.string(),
  temperature: z.number(),
  precipitation_probability: z.number().nullable(),
  weather_code: z.number(),
  condition: z.string(),
});

export const forecastResultSchema = z.object({
  place: placeSchema,
  units: unitsSchema,
  days: z.array(forecastDaySchema),
  hourly: z.object({ date: z.string(), hours: z.array(hourlyPointSchema) }).optional(),
  attribution: attributionSchema,
});

export const airQualityResultSchema = z.object({
  place: placeSchema,
  current: z.object({
    time: z.string(),
    us_aqi: z.number(),
    category: aqiCategorySchema,
    pm2_5: z.number(),
    pm10: z.number(),
  }),
  daily: z.array(
    z.object({ date: z.string(), us_aqi_max: z.number(), category: aqiCategorySchema }),
  ),
  attribution: attributionSchema,
});

export const historicalResultSchema = z.object({
  place: placeSchema,
  units: unitsSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      temp_max: z.number(),
      temp_min: z.number(),
      precipitation_sum: z.number(),
    }),
  ),
  totals: z.object({
    precipitation_sum: z.number(),
    temp_max_avg: z.number(),
    temp_min_avg: z.number(),
  }),
  attribution: attributionSchema,
});

export const toolErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "LOCATION_NOT_FOUND",
      "AMBIGUOUS_LOCATION",
      "INVALID_INPUT",
      "UPSTREAM_UNAVAILABLE",
    ]),
    message: z.string(),
    alternatives: z.array(placeSchema).optional(),
  }),
});

// ---------- compile-time sync checks (schema ⇔ interface) ----------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
export type _SchemaChecks = [
  Assert<Equal<z.infer<typeof placeSchema>, Place>>,
  Assert<Equal<z.infer<typeof searchLocationResultSchema>, SearchLocationResult>>,
  Assert<Equal<z.infer<typeof currentWeatherResultSchema>, CurrentWeatherResult>>,
  Assert<Equal<z.infer<typeof forecastResultSchema>, ForecastResult>>,
  Assert<Equal<z.infer<typeof airQualityResultSchema>, AirQualityResult>>,
  Assert<Equal<z.infer<typeof historicalResultSchema>, HistoricalResult>>,
  Assert<Equal<z.infer<typeof toolErrorSchema>, ToolError>>,
];
