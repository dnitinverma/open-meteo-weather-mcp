// shared/contracts.ts
// Types shared by the server and the views. Source of truth: docs/BUILD_PLAN.md → "Data contracts".

// ---------- Inputs ----------
// Every weather tool accepts EITHER city OR latitude+longitude (validated with zod refine on the server).
export interface LocationInput {
  city?: string; // 2–100 chars, e.g. "Jaipur" or "Noida, India"
  latitude?: number; // -90..90
  longitude?: number; // -180..180
}
export type Units = "metric" | "imperial"; // default "metric" (°C, km/h, mm)

export interface SearchLocationInput {
  name: string;
  count?: number; // 1–5, default 3
}
export interface CurrentWeatherInput extends LocationInput {
  units?: Units;
}
export interface ForecastInput extends LocationInput {
  days?: number; // 1–16, default 7
  hourly_for_date?: string; // optional YYYY-MM-DD within the forecast range → adds hourly detail
  units?: Units;
}
export interface AirQualityInput extends LocationInput {
  days?: number; // 1–5, default 1
}
export interface HistoricalInput extends LocationInput {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD, >= start_date, range <= 366 days, not in the future
  units?: Units;
}

// ---------- Shared output pieces ----------
export interface Place {
  name: string;
  admin1?: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
export interface Attribution {
  text: "Weather data by Open-Meteo.com";
  url: "https://open-meteo.com";
}

// ---------- structuredContent per tool ----------
export interface SearchLocationResult {
  results: Place[];
}

export interface CurrentWeatherResult {
  place: Place;
  units: Units;
  observed_at: string; // local ISO time
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  precipitation: number;
  weather_code: number;
  condition: string;
  is_day: boolean;
  attribution: Attribution;
}

export interface ForecastDay {
  date: string;
  weather_code: number;
  condition: string;
  temp_max: number;
  temp_min: number;
  precipitation_sum: number;
  precipitation_probability_max: number | null;
  sunrise: string;
  sunset: string;
  uv_index_max: number | null;
}
export interface HourlyPoint {
  time: string;
  temperature: number;
  precipitation_probability: number | null;
  weather_code: number;
  condition: string;
}
export interface ForecastResult {
  place: Place;
  units: Units;
  days: ForecastDay[];
  hourly?: { date: string; hours: HourlyPoint[] };
  attribution: Attribution;
}

export type AqiCategory =
  | "Good"
  | "Moderate"
  | "Unhealthy for sensitive groups"
  | "Unhealthy"
  | "Very unhealthy"
  | "Hazardous";
export interface AirQualityResult {
  place: Place;
  current: { time: string; us_aqi: number; category: AqiCategory; pm2_5: number; pm10: number };
  daily: { date: string; us_aqi_max: number; category: AqiCategory }[]; // from hourly us_aqi
  attribution: Attribution;
}

export interface HistoricalResult {
  place: Place;
  units: Units;
  start_date: string;
  end_date: string;
  days: { date: string; temp_max: number; temp_min: number; precipitation_sum: number }[];
  totals: { precipitation_sum: number; temp_max_avg: number; temp_min_avg: number };
  attribution: Attribution;
}

// ---------- Errors (isError: true) ----------
export type ErrorCode =
  "LOCATION_NOT_FOUND" | "AMBIGUOUS_LOCATION" | "INVALID_INPUT" | "UPSTREAM_UNAVAILABLE";
export interface ToolError {
  error: { code: ErrorCode; message: string; alternatives?: Place[] };
}

// ---------- Shared constants ----------
export const ATTRIBUTION: Attribution = {
  text: "Weather data by Open-Meteo.com",
  url: "https://open-meteo.com",
};

export const TOOL_NAMES = {
  searchLocation: "search_location",
  currentWeather: "get_current_weather",
  forecast: "get_forecast",
  airQuality: "get_air_quality",
  historicalWeather: "get_historical_weather",
} as const;
export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const VIEW_URIS = {
  current: "ui://weather/current.html",
  forecast: "ui://weather/forecast.html",
  airQuality: "ui://weather/air-quality.html",
  history: "ui://weather/history.html",
} as const;
