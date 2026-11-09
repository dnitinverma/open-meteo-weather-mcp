// Captures one real Open-Meteo response per endpoint (Jaipur) into test/fixtures/.
// Run: npx tsx scripts/capture-fixtures.ts   (calls the real APIs; re-run to refresh fixtures)
import { writeFileSync } from "node:fs";
import { fetchJson } from "../src/openmeteo/client.js";
import { CURRENT_VARS, DAILY_VARS, HOURLY_VARS } from "../src/openmeteo/forecast.js";
import { buildUrl, ENDPOINTS, weatherParams } from "../src/openmeteo/params.js";

const LAT = 26.91962;
const LON = 75.78781;
const out = (name: string, data: unknown) =>
  writeFileSync(
    new URL(`../test/fixtures/${name}.json`, import.meta.url),
    JSON.stringify(data, null, 2) + "\n",
  );

const geo = (name: string) =>
  buildUrl(
    ENDPOINTS.geocoding,
    new URLSearchParams({ name, count: "5", language: "en", format: "json" }),
  );

out("geocoding-jaipur", await fetchJson(geo("Jaipur")));
out("geocoding-springfield", await fetchJson(geo("Springfield")));
out("geocoding-noida", await fetchJson(geo("Noida")));
out("geocoding-empty", await fetchJson(geo("Xyzabc")));

const cur = weatherParams(LAT, LON);
cur.set("current", CURRENT_VARS.join(","));
out("forecast-current-jaipur", await fetchJson(buildUrl(ENDPOINTS.forecast, cur)));

const curImp = weatherParams(LAT, LON, "imperial");
curImp.set("current", CURRENT_VARS.join(","));
out("forecast-current-jaipur-imperial", await fetchJson(buildUrl(ENDPOINTS.forecast, curImp)));

const daily = weatherParams(LAT, LON);
daily.set("daily", DAILY_VARS.join(","));
daily.set("forecast_days", "16");
const dailyData = await fetchJson<{ daily: { time: string[] } }>(
  buildUrl(ENDPOINTS.forecast, daily),
);
out("forecast-daily-jaipur", dailyData);

const hourly = weatherParams(LAT, LON);
const date = dailyData.daily.time[1]!;
hourly.set("hourly", HOURLY_VARS.join(","));
hourly.set("start_date", date);
hourly.set("end_date", date);
out("forecast-hourly-jaipur", await fetchJson(buildUrl(ENDPOINTS.forecast, hourly)));

const aq = weatherParams(LAT, LON);
aq.set("current", "us_aqi,pm2_5,pm10");
aq.set("hourly", "us_aqi");
aq.set("forecast_days", "5");
out("air-quality-jaipur", await fetchJson(buildUrl(ENDPOINTS.airQuality, aq)));

const ar = weatherParams(LAT, LON);
ar.set("start_date", "2025-07-01");
ar.set("end_date", "2025-07-31");
ar.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
out("archive-jaipur-2025-07", await fetchJson(buildUrl(ENDPOINTS.archive, ar)));

console.log("fixtures written to test/fixtures/");
