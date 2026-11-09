import type { LocationInput, Place } from "@weather/shared";
import { AmbiguousLocation, InvalidInput, LocationNotFound } from "./errors.js";
import { searchPlaces, toPlace, type GeoPlace } from "./geocoding.js";

/**
 * When the top result's population is at least this many times the runner-up's (or the runner-up
 * has no population), the top result is treated as the obvious match. Without this, "Jaipur"
 * (3M, India) would be ambiguous with a Bangladeshi village of the same name.
 */
export const DOMINANCE_RATIO = 5;
const MAX_ALTERNATIVES = 3;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

/** "Noida, India" → { name: "Noida", qualifier: "India" }. */
export function parseCityQuery(city: string): { name: string; qualifier?: string } {
  const [name = "", ...rest] = city.split(",").map((s) => s.trim());
  const qualifier = rest.filter(Boolean).join(", ");
  return qualifier ? { name, qualifier } : { name };
}

/** Does a geocoding hit match a user qualifier such as "India", "IN", "Texas" or "Texas, US"? */
function matchesQualifier(p: GeoPlace, qualifier: string): boolean {
  const parts = qualifier.split(",").map(norm).filter(Boolean);
  const fields = [p.country, p.country_code, p.admin1 ?? ""].map(norm);
  return parts.every((q) => fields.some((f) => f === q || (q.length > 2 && f.startsWith(q))));
}

function isDominant(top: GeoPlace, runnerUp: GeoPlace): boolean {
  if (!top.population) return false;
  if (!runnerUp.population) return true;
  return top.population >= DOMINANCE_RATIO * runnerUp.population;
}

function sameRegion(a: GeoPlace, b: GeoPlace): boolean {
  return a.country_code === b.country_code && (a.admin1 ?? "") === (b.admin1 ?? "");
}

/** Up to 3 distinct places (by name + region + country). */
function alternatives(results: GeoPlace[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const r of results) {
    const key = `${norm(r.name)}|${norm(r.admin1 ?? "")}|${r.country_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toPlace(r));
    if (out.length === MAX_ALTERNATIVES) break;
  }
  return out;
}

/** "28.54, 77.39" — the display name used for raw coordinates. */
export function coordinateName(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

/**
 * Resolve a city or coordinates to a Place.
 * - City: geocode (count=5); a ", Country/Region" qualifier filters results. Without one, if the top
 *   two results are in different countries or regions (and the top one is not clearly dominant by
 *   population), throws AmbiguousLocation with up to 3 alternatives. Throws LocationNotFound if empty.
 * - Coordinates: no geocoding. Country fields are empty and `timezone` is "" — callers fill it in
 *   from the weather response (see withTimezone).
 */
export async function resolveLocation(input: LocationInput): Promise<Place> {
  const { city, latitude, longitude } = input;

  if (latitude !== undefined && longitude !== undefined) {
    return {
      name: coordinateName(latitude, longitude),
      country: "",
      country_code: "",
      latitude,
      longitude,
      timezone: "",
    };
  }
  if (!city) throw new InvalidInput("Give either a city or both latitude and longitude.");

  const { name, qualifier } = parseCityQuery(city);
  if (!name) throw new LocationNotFound(city);

  const results = await searchPlaces(name, 5);

  if (qualifier) {
    const matching = results.filter((r) => matchesQualifier(r, qualifier));
    if (matching[0]) return toPlace(matching[0]);
    // Fall back to letting the geocoder interpret the full string ("Noida, India").
    const full = (await searchPlaces(city, 5)).filter((r) => matchesQualifier(r, qualifier));
    if (full[0]) return toPlace(full[0]);
    throw new LocationNotFound(city);
  }

  const [top, runnerUp] = results;
  if (!top) throw new LocationNotFound(city);
  if (runnerUp && !sameRegion(top, runnerUp) && !isDominant(top, runnerUp)) {
    throw new AmbiguousLocation(city, alternatives(results));
  }
  return toPlace(top);
}

/** Fill in the timezone for coordinate-only places from a weather response. */
export function withTimezone(place: Place, timezone: string): Place {
  return place.timezone ? place : { ...place, timezone };
}
