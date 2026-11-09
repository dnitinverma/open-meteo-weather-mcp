/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FOCUS,
  INK,
  INK_MUTED,
  RAIN,
  schemeOf,
  skyForAqi,
  skyForRainfall,
  skyForWeather,
  SKIES,
  skyStyle,
  TEMP_STOPS,
  tempColor,
  type SkyName,
} from "../src/shared/sky";
import { ratio, rgbToHex } from "./contrast";

const NAMES = Object.keys(SKIES) as SkyName[];
const THEMES = ["light", "dark"] as const;

describe("every sky is readable in both themes", () => {
  it.each(NAMES.flatMap((n) => THEMES.map((t) => [n, t] as const)))("%s in %s", (name, theme) => {
    const scheme = schemeOf(name, theme);
    const [top, bottom] = SKIES[name][theme];
    for (const ground of [top, bottom]) {
      // Text: WCAG AA 4.5:1.
      expect(ratio(INK[scheme], ground), `ink on ${ground}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(INK_MUTED[scheme], ground), `muted ink on ${ground}`).toBeGreaterThanOrEqual(
        4.5,
      );
      // Graphics (bars, focus ring, chart lines): 3:1.
      expect(ratio(RAIN[scheme], ground), `rain on ${ground}`).toBeGreaterThanOrEqual(3);
      expect(ratio(FOCUS[scheme], ground), `focus ring on ${ground}`).toBeGreaterThanOrEqual(3);
      for (const [celsius, rgb] of TEMP_STOPS[scheme]) {
        expect(ratio(rgbToHex(rgb), ground), `${celsius}°C on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("night is dusk in both themes", () => {
    expect(SKIES.night.light).toEqual(SKIES.night.dark);
    expect(schemeOf("night", "light")).toBe("dark");
    expect(schemeOf("clear", "light")).toBe("light");
  });
});

describe("kit.css repeats the colours in sky.ts", () => {
  const file = ["views/src/shared/kit.css", "src/shared/kit.css"].find((f) => existsSync(f));
  const css = file ? readFileSync(file, "utf8") : "";
  const pair = (name: string) =>
    css.match(new RegExp(`--${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`));

  it.each([
    ["ink", INK],
    ["ink-muted", INK_MUTED],
    ["rain", RAIN],
    ["focus", FOCUS],
  ])("--%s", (name, colours) => {
    const m = pair(name);
    expect(m, `--${name} in kit.css`).not.toBeNull();
    expect(m?.[1]).toBe(colours.light);
    expect(m?.[2]).toBe(colours.dark);
  });
});

describe("which sky for which data", () => {
  it.each([
    [0, true, "clear"],
    [1, true, "clear"],
    [2, true, "partly"],
    [3, true, "overcast"],
    [45, true, "fog"],
    [48, true, "fog"],
    [53, true, "rain"],
    [66, true, "rain"],
    [81, true, "rain"],
    [73, true, "snow"],
    [86, true, "snow"],
    [95, true, "storm"],
    [99, true, "storm"],
    [0, false, "night"],
    [63, false, "night"],
    [42, true, "overcast"],
  ] as const)("code %i day=%s → %s", (code, isDay, sky) => {
    expect(skyForWeather(code, isDay)).toBe(sky);
  });

  it("the air gets hazier with the AQI category, in words and in colour", () => {
    expect(skyForAqi("Good")).toBe("clear");
    expect(skyForAqi("Moderate")).toBe("haze-moderate");
    expect(skyForAqi("Unhealthy for sensitive groups")).toBe("haze-usg");
    expect(skyForAqi("Unhealthy")).toBe("haze-unhealthy");
    expect(skyForAqi("Very unhealthy")).toBe("haze-very");
    expect(skyForAqi("Hazardous")).toBe("haze-hazardous");
  });

  it("rainfall decides a period's sky (mm or inches)", () => {
    expect(skyForRainfall(0.1, "metric")).toBe("clear");
    expect(skyForRainfall(1, "metric")).toBe("overcast");
    expect(skyForRainfall(5, "metric")).toBe("rain");
    expect(skyForRainfall(0.2, "imperial")).toBe("rain"); // 0.2 in ≈ 5 mm
  });

  it("skyStyle exposes theme-aware gradient variables", () => {
    const style = skyStyle("rain") as Record<string, string>;
    expect(style["--sky-top"]).toBe(`light-dark(${SKIES.rain.light[0]}, ${SKIES.rain.dark[0]})`);
    expect(style["--sky-bottom"]).toContain("light-dark(");
  });
});

describe("one absolute temperature scale", () => {
  it("30°C and 86°F get the same colour", () => {
    expect(tempColor(86, "imperial")).toBe(tempColor(30, "metric"));
  });
  it("hits the stop colours and clamps beyond them", () => {
    const [cold, , , , , hot] = TEMP_STOPS.light;
    const rgb = (c: readonly number[]) => `rgb(${c.join(", ")})`;
    expect(tempColor(-10, "metric")).toContain(rgb(cold?.[1] ?? []));
    expect(tempColor(-40, "metric")).toBe(tempColor(-10, "metric"));
    expect(tempColor(40, "metric")).toContain(rgb(hot?.[1] ?? []));
    expect(tempColor(55, "metric")).toBe(tempColor(40, "metric"));
  });
  it("is theme-aware and varies smoothly", () => {
    expect(tempColor(25, "metric")).toMatch(
      /^light-dark\(rgb\(\d+, \d+, \d+\), rgb\(\d+, \d+, \d+\)\)$/,
    );
    expect(tempColor(24, "metric")).not.toBe(tempColor(26, "metric"));
  });
});
