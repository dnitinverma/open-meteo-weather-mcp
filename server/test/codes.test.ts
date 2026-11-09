import { describe, expect, it } from "vitest";
import { aqiCategory } from "../src/openmeteo/aqi.js";
import { describeWeatherCode, WEATHER_CODES } from "../src/openmeteo/weatherCodes.js";

describe("aqiCategory", () => {
  it.each([
    [0, "Good"],
    [50, "Good"],
    [51, "Moderate"],
    [100, "Moderate"],
    [101, "Unhealthy for sensitive groups"],
    [150, "Unhealthy for sensitive groups"],
    [151, "Unhealthy"],
    [200, "Unhealthy"],
    [201, "Very unhealthy"],
    [300, "Very unhealthy"],
    [301, "Hazardous"],
    [500, "Hazardous"],
  ])("%i → %s", (n, category) => {
    expect(aqiCategory(n)).toBe(category);
  });
});

describe("weather codes", () => {
  const CODES = [
    0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
    95, 96, 99,
  ];
  it("maps every WMO code Open-Meteo uses", () => {
    expect(
      Object.keys(WEATHER_CODES)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(CODES);
    for (const code of CODES) {
      const info = describeWeatherCode(code);
      expect(info.condition).not.toBe("Unknown");
      expect(info.icon.length).toBeGreaterThan(0);
    }
  });
  it("maps unknown codes to Unknown", () => {
    expect(describeWeatherCode(42).condition).toBe("Unknown");
    expect(describeWeatherCode(-1).condition).toBe("Unknown");
  });
});
