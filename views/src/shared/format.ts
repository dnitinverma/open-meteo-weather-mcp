// View formatters. Builds on the shared formatters used by the server's text summaries.
export {
  compass,
  dayLabel,
  formatPercent,
  formatPrecip,
  formatSpeed,
  formatTemp,
  longDate,
  placeLabel,
  timeOfDay,
  unitSymbols,
} from "@weather/shared";

/** "2026-11-15" → "Sat". */
export function weekday(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

/** "2026-11-15" → "15 Nov". */
export function shortDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "2025-07" → "Jul 2025". */
export function monthLabel(yearMonth: string): string {
  const d = new Date(`${yearMonth.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Today's date (YYYY-MM-DD) in an IANA timezone; falls back to UTC for unknown zones. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  try {
    return now.toLocaleDateString("en-CA", { timeZone: timezone || "UTC" });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** "2026-11-09T16:00" → "16:00" (local time as given; no timezone conversion). */
export function clockTime(isoLocal: string): string {
  const [h = "0", m = "00"] = isoLocal.slice(11, 16).split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

/** Hour label for hourly strips: "2026-11-10T15:00" → "15:00". */
export const hourLabel = clockTime;
