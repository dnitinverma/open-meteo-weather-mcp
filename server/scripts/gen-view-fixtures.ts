// Calls the real tools (live Open-Meteo) and saves their structuredContent as view fixtures.
// Run: npx tsx scripts/gen-view-fixtures.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";

const stub = "<!doctype html><p>stub</p>";
const server = createServer({
  views: { current: stub, forecast: stub, airQuality: stub, history: stub },
});
const [ct, st] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "fixtures", version: "0" });
await Promise.all([server.connect(st), client.connect(ct)]);

const dir = new URL("../../views/src/fixtures/", import.meta.url);
mkdirSync(dir, { recursive: true });
async function save(file: string, name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  writeFileSync(new URL(`${file}.json`, dir), JSON.stringify(r.structuredContent, null, 2) + "\n");
  console.log(`${file}: ${r.isError ? "error" : "ok"}`);
  return r.structuredContent as Record<string, unknown>;
}

await save("current-jaipur", "get_current_weather", { city: "Jaipur" });
await save("current-jaipur-imperial", "get_current_weather", { city: "Jaipur", units: "imperial" });
await save("current-night-tokyo", "get_current_weather", { latitude: 35.68, longitude: 139.69 });
await save("forecast-3", "get_forecast", { city: "Jaipur", days: 3 });
const f7 = await save("forecast-7", "get_forecast", { city: "Jaipur", days: 7 });
await save("forecast-16", "get_forecast", { city: "Jaipur", days: 16 });
const date = (f7.days as { date: string }[])[1]!.date;
await save("forecast-7-hourly", "get_forecast", { city: "Jaipur", days: 7, hourly_for_date: date });
await save("forecast-7-imperial", "get_forecast", { city: "Jaipur", days: 7, units: "imperial" });
await save("air-quality-delhi", "get_air_quality", { city: "Delhi" });
await save("air-quality-delhi-3", "get_air_quality", { city: "Delhi", days: 3 });
await save("history-mumbai-july", "get_historical_weather", {
  city: "Mumbai",
  start_date: "2025-07-01",
  end_date: "2025-07-31",
});
await save("history-jaipur-year", "get_historical_weather", {
  city: "Jaipur",
  start_date: "2024-11-01",
  end_date: "2025-10-31",
});
await save("error-ambiguous", "get_forecast", { city: "Springfield" });
await save("error-not-found", "get_forecast", { city: "Xyzabc" });
await save("error-invalid", "get_forecast", { city: "Jaipur", days: 40 });
writeFileSync(
  new URL("error-upstream.json", dir),
  JSON.stringify(
    {
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "The weather service is temporarily unavailable. Please try again in a minute.",
      },
    },
    null,
    2,
  ) + "\n",
);
await client.close();
