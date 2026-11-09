import type { HistoricalResult } from "@weather/shared";
import {
  ATTRIBUTION,
  dayLabel,
  formatPrecip,
  formatTemp,
  longDate,
  TOOL_NAMES,
} from "@weather/shared";
import { z } from "zod";
import { getArchive } from "../openmeteo/archive.js";
import { InvalidInput } from "../openmeteo/errors.js";
import { resolveLocation, withTimezone } from "../openmeteo/resolveLocation.js";
import {
  header,
  isoDate,
  locationFields,
  refineLocation,
  toolHandler,
  unitsField,
} from "./common.js";

export const name = TOOL_NAMES.historicalWeather;
export const title = "Historical weather";
export const description =
  "Past daily temperatures and rainfall for a city or coordinates between two dates, up to 366 days. Use for weather that already happened.";

export const MAX_RANGE_DAYS = 366;
export const EARLIEST_DATE = "1940-01-01";
const DAY_MS = 86_400_000;

/** Latest calendar date anywhere on Earth (UTC+14), so "today" in any timezone is allowed. */
function latestDateOnEarth(now = Date.now()): string {
  return new Date(now + 14 * 3_600_000).toISOString().slice(0, 10);
}

export const inputSchema = z
  .object({
    ...locationFields,
    start_date: isoDate.describe("First day, YYYY-MM-DD (from 1940-01-01)."),
    end_date: isoDate.describe(
      "Last day, YYYY-MM-DD; on or after start_date, at most 366 days in total, not in the future.",
    ),
    units: unitsField,
  })
  .superRefine(refineLocation)
  .superRefine((v, ctx) => {
    if (v.end_date < v.start_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "end_date must be on or after start_date.",
      });
      return;
    }
    const days = (Date.parse(v.end_date) - Date.parse(v.start_date)) / DAY_MS + 1;
    if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: `The date range is ${days} days; the maximum is ${MAX_RANGE_DAYS}.`,
      });
    }
    if (v.end_date > latestDateOnEarth()) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "end_date is in the future; use get_forecast for future weather.",
      });
    }
    if (v.start_date < EARLIEST_DATE) {
      ctx.addIssue({
        code: "custom",
        path: ["start_date"],
        message: `Data starts on ${EARLIEST_DATE}.`,
      });
    }
  });

const round1 = (n: number) => Math.round(n * 10) / 10;

export const handler = toolHandler(name, inputSchema, async (input) => {
  const resolved = await resolveLocation(input);
  const ar = await getArchive(
    resolved.latitude,
    resolved.longitude,
    input.start_date,
    input.end_date,
    input.units,
  );
  if (ar.days.length === 0) {
    throw new InvalidInput(
      "No archived data for these dates yet (the archive lags a few days). Try earlier dates, or get_forecast for recent days.",
    );
  }
  const place = withTimezone(resolved, ar.timezone);
  const n = ar.days.length;
  const totals = {
    precipitation_sum: round1(ar.days.reduce((s, d) => s + d.precipitation_sum, 0)),
    temp_max_avg: round1(ar.days.reduce((s, d) => s + d.temp_max, 0) / n),
    temp_min_avg: round1(ar.days.reduce((s, d) => s + d.temp_min, 0) / n),
  };
  const data: HistoricalResult = {
    place,
    units: input.units,
    start_date: input.start_date,
    end_date: input.end_date,
    days: ar.days,
    totals,
    attribution: ATTRIBUTION,
  };

  const u = input.units;
  const wettest = ar.days.reduce((a, b) => (b.precipitation_sum > a.precipitation_sum ? b : a));
  const warmest = ar.days.reduce((a, b) => (b.temp_max > a.temp_max ? b : a));
  const coolest = ar.days.reduce((a, b) => (b.temp_min < a.temp_min ? b : a));
  const lines = [
    header(
      place,
      `${longDate(input.start_date)} to ${longDate(input.end_date)} (${n} day${n === 1 ? "" : "s"})`,
    ),
    `Total rain ${formatPrecip(totals.precipitation_sum, u)} · wettest day ${dayLabel(wettest.date)} (${formatPrecip(wettest.precipitation_sum, u)})`,
    `Average high ${formatTemp(totals.temp_max_avg, u)} · average low ${formatTemp(totals.temp_min_avg, u)}`,
    `Warmest ${dayLabel(warmest.date)} ${formatTemp(warmest.temp_max, u)} · coolest ${dayLabel(coolest.date)} ${formatTemp(coolest.temp_min, u)}`,
  ];
  return { lines, data };
});
