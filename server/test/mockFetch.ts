import { readFileSync } from "node:fs";
import { vi } from "vitest";

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")) as T;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (url: URL) => Response | Promise<Response> | undefined;

/**
 * Stubs global fetch. Each route gets the parsed URL and may return a Response; unmatched URLs fail
 * the test. Returns the mock so tests can inspect calls.
 */
export function mockFetch(...routes: Route[]) {
  const fn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input : input.url,
    );
    for (const route of routes) {
      const res = await route(url);
      if (res) return res;
    }
    throw new Error(`Unexpected fetch: ${url.toString()}`);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Default Open-Meteo routes backed by the Jaipur fixtures. */
export const openMeteoRoutes: Route = (url) => {
  const p = url.searchParams;
  switch (url.host) {
    case "geocoding-api.open-meteo.com": {
      const name = (p.get("name") ?? "").toLowerCase();
      if (name.startsWith("jaipur")) return json(fixture("geocoding-jaipur"));
      if (name.startsWith("springfield")) return json(fixture("geocoding-springfield"));
      if (name.startsWith("noida")) return json(fixture("geocoding-noida"));
      return json(fixture("geocoding-empty"));
    }
    case "api.open-meteo.com":
      if (p.has("current"))
        return json(
          fixture(
            p.get("temperature_unit") === "fahrenheit"
              ? "forecast-current-jaipur-imperial"
              : "forecast-current-jaipur",
          ),
        );
      if (p.has("daily")) {
        const data = fixture<{ daily: Record<string, unknown[]> }>("forecast-daily-jaipur");
        const n = Number(p.get("forecast_days") ?? 7);
        for (const k of Object.keys(data.daily)) data.daily[k] = data.daily[k]!.slice(0, n);
        return json(data);
      }
      if (p.has("hourly")) return json(fixture("forecast-hourly-jaipur"));
      return undefined;
    case "air-quality-api.open-meteo.com":
      return json(fixture("air-quality-jaipur"));
    case "archive-api.open-meteo.com":
      return json(fixture("archive-jaipur-2025-07"));
    default:
      return undefined;
  }
};
