import type { Place } from "@weather/shared";
import { TTL } from "./cache.js";
import { fetchJson } from "./client.js";
import { buildUrl, ENDPOINTS } from "./params.js";

interface RawGeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  population?: number;
}
interface RawGeoResponse {
  results?: RawGeoResult[];
}

/** A geocoding hit: a Place plus population (used only for disambiguation, never returned). */
export interface GeoPlace extends Place {
  population?: number;
}

/** Search places by name. Returns [] when nothing matches. */
export async function searchPlaces(name: string, count = 5): Promise<GeoPlace[]> {
  const params = new URLSearchParams({
    name,
    count: String(count),
    language: "en",
    format: "json",
  });
  const data = await fetchJson<RawGeoResponse>(buildUrl(ENDPOINTS.geocoding, params), {
    ttlMs: TTL.geocoding,
  });
  return (data.results ?? []).map((r) => {
    const place: GeoPlace = {
      name: r.name,
      country: r.country ?? "",
      country_code: r.country_code ?? "",
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone ?? "",
    };
    if (r.admin1) place.admin1 = r.admin1;
    if (r.population !== undefined) place.population = r.population;
    return place;
  });
}

/** Strip internal fields so only the Place contract leaves the server. */
export function toPlace(p: GeoPlace): Place {
  const place: Place = {
    name: p.name,
    country: p.country,
    country_code: p.country_code,
    latitude: p.latitude,
    longitude: p.longitude,
    timezone: p.timezone,
  };
  if (p.admin1) place.admin1 = p.admin1;
  return place;
}
