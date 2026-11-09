import type { ForecastDay, ForecastResult, Units } from "@weather/shared";
import {
  ATTRIBUTION,
  dayLabel,
  formatPercent,
  formatTemp,
  timeOfDay,
  TOOL_NAMES,
} from "@weather/shared";
import { z } from "zod";
import { InvalidInput } from "../openmeteo/errors.js";
import { getDailyForecast, getHourlyForDate } from "../openmeteo/forecast.js";
import { resolveLocation, withTimezone } from "../openmeteo/resolveLocation.js";
import {
  header,
  isoDate,
  locationFields,
  MAX_TEXT_LINES,
  refineLocation,
  toolHandler,
  unitsField,
} from "./common.js";

export const name = TOOL_NAMES.forecast;
export const title = "Weather forecast";
export const description =
  "Daily weather forecast for 1 to 16 days for a city or coordinates, with optional hourly detail for one date. Use for any question about future weather, such as rain this weekend.";

export const inputSchema = z
  .object({
    ...locationFields,
    days: z
      .number()
      .int()
      .min(1)
      .max(16)
      .default(7)
      .describe("Number of forecast days (1–16, default 7)."),
    hourly_for_date: isoDate
      .optional()
      .describe(
        "Optional date (YYYY-MM-DD) within the forecast range; adds hourly detail for that day.",
      ),
    units: unitsField,
  })
  .superRefine(refineLocation);

function dayLine(d: ForecastDay, units: Units): string {
  const chance =
    d.precipitation_probability_max === null
      ? ""
      : `, ${formatPercent(d.precipitation_probability_max)} chance of rain`;
  return `${dayLabel(d.date)}: ${formatTemp(d.temp_max, units)} / ${formatTemp(d.temp_min, units)}, ${d.condition.toLowerCase()}${chance}`;
}

/** Text lines that fit in MAX_TEXT_LINES (header + body + attribution). */
export function forecastLines(result: ForecastResult): string[] {
  const { place, days, units, hourly } = result;
  const lines = [header(place, `${days.length}-day forecast`)];
  const hourlyLine = hourly ? hourlySummary(hourly, units) : undefined;
  const budget = MAX_TEXT_LINES - 2 - (hourlyLine ? 1 : 0); // header + attribution (+ hourly)
  if (days.length <= budget) {
    lines.push(...days.map((d) => dayLine(d, units)));
  } else {
    const shown = days.slice(0, budget - 1);
    const rest = days.slice(budget - 1);
    lines.push(...shown.map((d) => dayLine(d, units)));
    lines.push(restSummary(rest, units));
  }
  if (hourlyLine) lines.push(hourlyLine);
  return lines;
}

/** One line summarising the days that don't get their own line. */
function restSummary(rest: ForecastDay[], units: Units): string {
  const first = rest[0];
  const last = rest[rest.length - 1];
  if (!first || !last) return "";
  const maxes = rest.map((d) => d.temp_max);
  const mins = rest.map((d) => d.temp_min);
  const rain = Math.max(...rest.map((d) => d.precipitation_probability_max ?? 0));
  const t = (n: number) => formatTemp(n, units);
  return `${dayLabel(first.date)} – ${dayLabel(last.date)}: highs ${t(Math.min(...maxes))}–${t(Math.max(...maxes))}, lows ${t(Math.min(...mins))}–${t(Math.max(...mins))}, rain chance up to ${rain}%`;
}

function hourlySummary(hourly: NonNullable<ForecastResult["hourly"]>, units: Units): string {
  const picks = hourly.hours.filter((_, i) => i % 6 === 0); // 00, 06, 12, 18
  const parts = picks.map(
    (h) =>
      `${timeOfDay(h.time)} ${formatTemp(h.temperature, units)}${h.precipitation_probability === null ? "" : ` (${h.precipitation_probability}%)`}`,
  );
  return `Hourly ${dayLabel(hourly.date)}: ${parts.join(", ")}`;
}

export const handler = toolHandler(name, inputSchema, async (input) => {
  const resolved = await resolveLocation(input);
  const { latitude, longitude } = resolved;
  const daily = await getDailyForecast(latitude, longitude, input.days, input.units);
  const place = withTimezone(resolved, daily.timezone);

  const data: ForecastResult = {
    place,
    units: input.units,
    days: daily.days,
    attribution: ATTRIBUTION,
  };

  if (input.hourly_for_date) {
    const date = input.hourly_for_date;
    if (!daily.days.some((d) => d.date === date)) {
      const first = daily.days[0]?.date ?? "";
      const last = daily.days.at(-1)?.date ?? "";
      throw new InvalidInput(
        `hourly_for_date must be within the forecast range (${first} to ${last}).`,
      );
    }
    const hourly = await getHourlyForDate(latitude, longitude, date, input.units);
    data.hourly = { date, hours: hourly.hours };
  }

  return { lines: forecastLines(data), data };
});
