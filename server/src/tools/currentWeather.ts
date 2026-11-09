import type { CurrentWeatherResult } from "@weather/shared";
import {
  ATTRIBUTION,
  compass,
  formatPrecip,
  formatSpeed,
  formatTemp,
  timeOfDay,
  TOOL_NAMES,
} from "@weather/shared";
import { z } from "zod";
import { getCurrent } from "../openmeteo/forecast.js";
import { resolveLocation, withTimezone } from "../openmeteo/resolveLocation.js";
import { header, locationFields, refineLocation, toolHandler, unitsField } from "./common.js";

export const name = TOOL_NAMES.currentWeather;
export const title = "Current weather";
export const description =
  "Current weather right now for a city or coordinates: temperature, feels-like, humidity, wind, precipitation and conditions.";

export const inputSchema = z
  .object({ ...locationFields, units: unitsField })
  .superRefine(refineLocation);

export const handler = toolHandler(name, inputSchema, async (input) => {
  const resolved = await resolveLocation(input);
  const c = await getCurrent(resolved.latitude, resolved.longitude, input.units);
  const place = withTimezone(resolved, c.timezone);
  const { timezone: _tz, ...now } = c;
  const data: CurrentWeatherResult = {
    place,
    units: input.units,
    ...now,
    attribution: ATTRIBUTION,
  };

  const u = input.units;
  const lines = [
    header(place, `current weather (${timeOfDay(c.observed_at)} local time)`),
    `${formatTemp(c.temperature, u)}, ${c.condition.toLowerCase()}, feels like ${formatTemp(c.apparent_temperature, u)}`,
    `Humidity ${Math.round(c.humidity)}% · Wind ${formatSpeed(c.wind_speed, u)} ${compass(c.wind_direction)} · Precipitation ${formatPrecip(c.precipitation, u)}`,
    c.is_day ? "Daytime" : "Night-time",
  ];
  return { lines, data };
});
