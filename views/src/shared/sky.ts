// The look of every card comes from here: "the card is the sky it describes".
// Each card gets a sky ground chosen from its own data (condition and time of day for weather,
// haze for air quality, how wet the period was for history). Colour never carries meaning alone:
// conditions, categories and numbers are always printed as words.
import type { AqiCategory, Units } from "@weather/shared";
import type { CSSProperties } from "react";

export type SkyName =
  | "clear"
  | "partly"
  | "overcast"
  | "fog"
  | "rain"
  | "snow"
  | "storm"
  | "night"
  | "haze-moderate"
  | "haze-usg"
  | "haze-unhealthy"
  | "haze-very"
  | "haze-hazardous";

type Pair = readonly [top: string, bottom: string];

/**
 * Ground gradients, top to bottom, per colour scheme. In a dark host every sky becomes its dusk
 * version; "night" is dusk in both schemes (the card forces `color-scheme: dark`, see kit.css).
 */
export const SKIES: Record<SkyName, { light: Pair; dark: Pair }> = {
  clear: { light: ["#d6e8f8", "#f2f8fd"], dark: ["#1b2440", "#2b3a63"] },
  partly: { light: ["#dce6f0", "#f3f6fa"], dark: ["#202a41", "#323f5c"] },
  overcast: { light: ["#d9dee5", "#eef0f3"], dark: ["#23283a", "#353b4e"] },
  fog: { light: ["#e0e2df", "#f1f1ef"], dark: ["#2a2d35", "#3b3f49"] },
  rain: { light: ["#c8d5e2", "#e4eaf0"], dark: ["#1a2638", "#2a3a52"] },
  snow: { light: ["#e6edf5", "#f7fafc"], dark: ["#28324a", "#3c4a66"] },
  storm: { light: ["#c4cddc", "#e0e5ee"], dark: ["#1b1f33", "#2d2f4d"] },
  night: { light: ["#1b2440", "#2b3a63"], dark: ["#1b2440", "#2b3a63"] },
  "haze-moderate": { light: ["#f1e9cf", "#faf6e8"], dark: ["#38321f", "#4a4128"] },
  "haze-usg": { light: ["#f1ddbf", "#f9eedc"], dark: ["#402f22", "#54402c"] },
  "haze-unhealthy": { light: ["#ebcbb9", "#f6e4da"], dark: ["#432b2a", "#583936"] },
  "haze-very": { light: ["#ddb8c4", "#f0dce2"], dark: ["#3f2638", "#54364b"] },
  "haze-hazardous": { light: ["#d4b2c0", "#ecd6df"], dark: ["#381f2c", "#4d2d3e"] },
};

/** Text colours (kit.css repeats these; a test keeps the two in step). */
export const INK = { light: "#172033", dark: "#e8eefc" } as const;
export const INK_MUTED = { light: "#2f3b52", dark: "#b7c3e0" } as const;
/** Rain / precipitation accent and keyboard focus ring (graphics, at least 3:1 on every sky). */
export const RAIN = { light: "#1f5a99", dark: "#8cb8f2" } as const;
export const FOCUS = { light: "#1b4f9c", dark: "#a9c7ff" } as const;

/** Which colour scheme a sky is actually drawn in: "night" is always dark. */
export const schemeOf = (sky: SkyName, theme: "light" | "dark"): "light" | "dark" =>
  sky === "night" ? "dark" : theme;

export function skyStyle(sky: SkyName): CSSProperties {
  const { light, dark } = SKIES[sky];
  return {
    "--sky-top": `light-dark(${light[0]}, ${dark[0]})`,
    "--sky-bottom": `light-dark(${light[1]}, ${dark[1]})`,
  } as CSSProperties;
}

// ---------- which sky for which data ----------

/** WMO weather code and time of day → sky. */
export function skyForWeather(code: number, isDay = true): SkyName {
  if (!isDay) return "night";
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "overcast";
}

/** The air gets hazier as the AQI category rises; "Good" is a clear sky. */
export function skyForAqi(category: AqiCategory): SkyName {
  switch (category) {
    case "Good":
      return "clear";
    case "Moderate":
      return "haze-moderate";
    case "Unhealthy for sensitive groups":
      return "haze-usg";
    case "Unhealthy":
      return "haze-unhealthy";
    case "Very unhealthy":
      return "haze-very";
    case "Hazardous":
      return "haze-hazardous";
  }
}

/** A period's sky from its average daily rainfall: dry → clear, damp → overcast, wet → rain. */
export function skyForRainfall(avgPerDay: number, units: Units): SkyName {
  const mm = units === "imperial" ? avgPerDay * 25.4 : avgPerDay;
  if (mm >= 3) return "rain";
  if (mm >= 0.5) return "overcast";
  return "clear";
}

// ---------- one absolute temperature scale, used by every chart ----------

type RGB = readonly [number, number, number];
type Stops = readonly (readonly [celsius: number, rgb: RGB])[];

/** Cold to hot. Light stops are dark enough for pale skies, dark stops light enough for dusk. */
export const TEMP_STOPS: Record<"light" | "dark", Stops> = {
  light: [
    [-10, [36, 66, 150]],
    [0, [38, 95, 163]],
    [10, [28, 108, 120]],
    [20, [64, 108, 34]],
    [30, [164, 76, 12]],
    [40, [160, 34, 20]],
  ],
  dark: [
    [-10, [134, 166, 245]],
    [0, [125, 180, 242]],
    [10, [111, 207, 208]],
    [20, [165, 212, 106]],
    [30, [242, 184, 75]],
    [40, [255, 138, 92]],
  ],
};

const toCelsius = (value: number, units: Units) =>
  units === "imperial" ? ((value - 32) * 5) / 9 : value;

function interpolate(stops: Stops, celsius: number): RGB {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return [0, 0, 0];
  if (celsius <= first[0]) return first[1];
  if (celsius >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (a && b && celsius <= b[0]) {
      const t = (celsius - a[0]) / (b[0] - a[0]);
      return [0, 1, 2].map((k) =>
        Math.round((a[1][k] ?? 0) + ((b[1][k] ?? 0) - (a[1][k] ?? 0)) * t),
      ) as unknown as RGB;
    }
  }
  return last[1];
}

export const rgbCss = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Colour for a temperature in either unit, as a theme-aware `light-dark()` value. */
export function tempColor(value: number, units: Units): string {
  const c = toCelsius(value, units);
  return `light-dark(${rgbCss(interpolate(TEMP_STOPS.light, c))}, ${rgbCss(interpolate(TEMP_STOPS.dark, c))})`;
}
