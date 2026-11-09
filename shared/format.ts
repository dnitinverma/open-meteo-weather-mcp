// Small formatting helpers shared by the server's text summaries and the views.

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Wind direction in degrees → 8-point compass text (N, NE, …). */
export function compass(degrees: number): string {
  const i = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return COMPASS[i] ?? "N";
}

/**
 * "2026-11-15" → "Sat 15 Nov". Dates from Open-Meteo are already local to the place, so they are
 * formatted as calendar dates (UTC) to avoid shifting by the viewer's timezone.
 */
export function dayLabel(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const dayMonth = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${dayMonth}`;
}

/** "2026-11-15" → "15 Nov 2026". */
export function longDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Local ISO time "2026-11-09T15:45" → "15:45". */
export function timeOfDay(isoLocal: string): string {
  return isoLocal.slice(11, 16);
}

export type UnitsKind = "metric" | "imperial";

export const unitSymbols = (units: UnitsKind) =>
  units === "imperial"
    ? ({ temp: "°F", speed: "mph", precip: "in" } as const)
    : ({ temp: "°C", speed: "km/h", precip: "mm" } as const);

export function formatTemp(n: number, units: UnitsKind): string {
  return `${Math.round(n)}${unitSymbols(units).temp}`;
}

export function formatSpeed(n: number, units: UnitsKind): string {
  return `${Math.round(n)} ${unitSymbols(units).speed}`;
}

export function formatPrecip(n: number, units: UnitsKind): string {
  const digits = units === "imperial" ? 2 : 1;
  return `${Number(n.toFixed(digits))} ${unitSymbols(units).precip}`;
}

export function formatPercent(n: number | null): string {
  return n === null ? "–" : `${Math.round(n)}%`;
}

/** "Jaipur, Rajasthan, India" — skips empty parts (coordinates have no admin1/country). */
export function placeLabel(place: { name: string; admin1?: string; country: string }): string {
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.join(", ");
}
