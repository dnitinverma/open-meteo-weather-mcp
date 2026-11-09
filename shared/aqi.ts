import type { AqiCategory } from "./contracts.ts";

/** US AQI bands (EPA) from "Data contracts". `max` is inclusive; the last band is open-ended. */
export const AQI_BANDS: readonly { category: AqiCategory; min: number; max: number }[] = [
  { category: "Good", min: 0, max: 50 },
  { category: "Moderate", min: 51, max: 100 },
  { category: "Unhealthy for sensitive groups", min: 101, max: 150 },
  { category: "Unhealthy", min: 151, max: 200 },
  { category: "Very unhealthy", min: 201, max: 300 },
  { category: "Hazardous", min: 301, max: 500 },
];

/** US AQI category for a value. */
export function aqiCategory(n: number): AqiCategory {
  if (n <= 50) return "Good";
  if (n <= 100) return "Moderate";
  if (n <= 150) return "Unhealthy for sensitive groups";
  if (n <= 200) return "Unhealthy";
  if (n <= 300) return "Very unhealthy";
  return "Hazardous";
}
