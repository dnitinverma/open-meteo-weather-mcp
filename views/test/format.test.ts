import { describe, expect, it } from "vitest";
import {
  clockTime,
  compass,
  dayLabel,
  formatPercent,
  formatPrecip,
  formatSpeed,
  formatTemp,
  longDate,
  monthLabel,
  placeLabel,
  shortDate,
  timeOfDay,
  todayIn,
  unitSymbols,
  weekday,
} from "../src/shared/format";

describe("formatters", () => {
  it("dayLabel / weekday / shortDate / longDate / monthLabel", () => {
    expect(dayLabel("2026-11-15")).toBe("Sun 15 Nov");
    expect(weekday("2026-11-15")).toBe("Sun");
    expect(shortDate("2026-11-15")).toBe("15 Nov");
    expect(longDate("2025-07-01")).toBe("1 Jul 2025");
    expect(monthLabel("2025-07-15")).toBe("Jul 2025");
    expect(dayLabel("nope")).toBe("nope");
  });

  it("dates do not shift with the viewer's timezone", () => {
    expect(dayLabel("2026-01-01T23:00")).toBe("Thu 1 Jan");
  });

  it("times", () => {
    expect(timeOfDay("2026-11-09T15:45")).toBe("15:45");
    expect(clockTime("2026-11-09T07:00")).toBe("07:00");
  });

  it("todayIn uses the place's timezone", () => {
    const now = new Date("2026-11-09T20:00:00Z");
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-11-10");
    expect(todayIn("America/Chicago", now)).toBe("2026-11-09");
    expect(todayIn("Not/AZone", now)).toBe("2026-11-09");
  });

  it("temperatures, speeds, precipitation with units", () => {
    expect(formatTemp(30.6, "metric")).toBe("31°C");
    expect(formatTemp(-0.4, "imperial")).toBe("0°F");
    expect(formatSpeed(12.4, "metric")).toBe("12 km/h");
    expect(formatSpeed(7.6, "imperial")).toBe("8 mph");
    expect(formatPrecip(3.25, "metric")).toBe("3.3 mm");
    expect(formatPrecip(0.126, "imperial")).toBe("0.13 in");
    expect(formatPrecip(0, "metric")).toBe("0 mm");
    expect(unitSymbols("imperial")).toEqual({ temp: "°F", speed: "mph", precip: "in" });
  });

  it("percentages", () => {
    expect(formatPercent(42.4)).toBe("42%");
    expect(formatPercent(null)).toBe("–");
  });

  it.each([
    [0, "N"],
    [22, "N"],
    [23, "NE"],
    [90, "E"],
    [180, "S"],
    [232, "SW"],
    [270, "W"],
    [315, "NW"],
    [338, "N"],
    [360, "N"],
    [-45, "NW"],
  ])("compass(%i) = %s", (deg, dir) => {
    expect(compass(deg)).toBe(dir);
  });

  it("placeLabel skips empty parts and duplicate region", () => {
    expect(placeLabel({ name: "Jaipur", admin1: "Rajasthan", country: "India" })).toBe(
      "Jaipur, Rajasthan, India",
    );
    expect(placeLabel({ name: "28.54, 77.39", country: "" })).toBe("28.54, 77.39");
    expect(placeLabel({ name: "Delhi", admin1: "Delhi", country: "India" })).toBe("Delhi, India");
  });
});
