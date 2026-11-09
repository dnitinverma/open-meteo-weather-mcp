// npm run smoke — calls the real Open-Meteo APIs for Jaipur and prints one line per endpoint.
import { getAirQuality } from "../src/openmeteo/airQuality.js";
import { getArchive } from "../src/openmeteo/archive.js";
import { getCurrent, getDailyForecast, getHourlyForDate } from "../src/openmeteo/forecast.js";
import { resolveLocation } from "../src/openmeteo/resolveLocation.js";

const place = await resolveLocation({ city: "Jaipur" });
console.log(
  `geocoding   ${place.name}, ${place.admin1}, ${place.country} (${place.latitude}, ${place.longitude}) ${place.timezone}`,
);

const { latitude: lat, longitude: lon } = place;
const cur = await getCurrent(lat, lon);
console.log(
  `current     ${cur.observed_at} ${cur.temperature}°C (feels ${cur.apparent_temperature}°C), ${cur.condition}, humidity ${cur.humidity}%, wind ${cur.wind_speed} km/h`,
);

const fc = await getDailyForecast(lat, lon, 3);
console.log(
  `forecast    ${fc.days.map((d) => `${d.date} ${d.temp_max}/${d.temp_min}°C ${d.condition}`).join(" · ")}`,
);

const tomorrow = fc.days[1]?.date ?? fc.days[0]!.date;
const hr = await getHourlyForDate(lat, lon, tomorrow);
console.log(
  `hourly      ${tomorrow}: ${hr.hours.length} hours, 12:00 ${hr.hours[12]?.temperature}°C ${hr.hours[12]?.condition}`,
);

const aq = await getAirQuality(lat, lon, 3);
console.log(
  `air quality ${aq.current.time} US AQI ${aq.current.us_aqi} (${aq.current.category}), PM2.5 ${aq.current.pm2_5}, PM10 ${aq.current.pm10} µg/m³; daily max ${aq.daily.map((d) => d.us_aqi_max).join("/")}`,
);

const ar = await getArchive(lat, lon, "2025-07-01", "2025-07-31");
const rain = ar.days.reduce((s, d) => s + d.precipitation_sum, 0);
console.log(`archive     July 2025: ${ar.days.length} days, total rain ${rain.toFixed(1)} mm`);
console.log("Weather data by Open-Meteo.com");
