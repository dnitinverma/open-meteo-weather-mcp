import type { AirQualityResult } from "@weather/shared";
import { ATTRIBUTION, dayLabel, timeOfDay, TOOL_NAMES } from "@weather/shared";
import { z } from "zod";
import { getAirQuality } from "../openmeteo/airQuality.js";
import { resolveLocation, withTimezone } from "../openmeteo/resolveLocation.js";
import { header, locationFields, refineLocation, toolHandler } from "./common.js";

export const name = TOOL_NAMES.airQuality;
export const title = "Air quality";
export const description =
  "Current US AQI with PM2.5 and PM10 for a city or coordinates, plus a daily AQI forecast for up to 5 days.";

export const inputSchema = z
  .object({
    ...locationFields,
    days: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(1)
      .describe("Days of daily max AQI to include, starting today (1–5, default 1)."),
  })
  .superRefine(refineLocation);

export const handler = toolHandler(name, inputSchema, async (input) => {
  const resolved = await resolveLocation(input);
  const aq = await getAirQuality(resolved.latitude, resolved.longitude, input.days);
  const place = withTimezone(resolved, aq.timezone);
  const data: AirQualityResult = {
    place,
    current: aq.current,
    daily: aq.daily,
    attribution: ATTRIBUTION,
  };

  const c = aq.current;
  const lines = [
    header(place, `air quality (${timeOfDay(c.time)} local time)`),
    `US AQI ${c.us_aqi} · ${c.category}`,
    `PM2.5 ${c.pm2_5} µg/m³ · PM10 ${c.pm10} µg/m³`,
  ];
  if (aq.daily.length > 0) {
    lines.push(
      `Daily max AQI: ${aq.daily.map((d) => `${dayLabel(d.date)} ${d.us_aqi_max} (${d.category})`).join("; ")}`,
    );
  }
  return { lines, data };
});
