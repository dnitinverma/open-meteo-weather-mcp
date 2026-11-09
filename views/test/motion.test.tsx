/// <reference types="node" />
import { act, fireEvent, render, renderHook } from "@testing-library/react";
import type { ForecastResult } from "@weather/shared";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AqiGauge } from "../src/air-quality/AqiGauge";
import f3 from "../src/fixtures/forecast-3.json";
import f7 from "../src/fixtures/forecast-7.json";
import { ForecastContent } from "../src/forecast/ForecastContent";
import {
  AnimatedNumber,
  easeOutCubic,
  prefersReducedMotion,
  useAnimatedNumber,
  valueAt,
} from "../src/shared/AnimatedNumber";
import { Card } from "../src/shared/components";
import { AMBIENCE, scatter, SkyAmbience } from "../src/shared/SkyAmbience";
import { SKIES, type SkyName } from "../src/shared/sky";

const css = (name: string) => {
  const file = [`views/src/shared/${name}`, `src/shared/${name}`].find((f) => existsSync(f));
  if (!file) throw new Error(`${name} not found`);
  return readFileSync(file, "utf8");
};

describe("easing", () => {
  it("easeOutCubic starts fast and lands exactly", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
  it("valueAt interpolates and clamps", () => {
    expect(valueAt(0, 30, 0.5)).toBeCloseTo(26.25);
    expect(valueAt(10, -10, 1)).toBe(-10);
    expect(valueAt(0, 100, -1)).toBe(0);
    expect(valueAt(0, 100, 2)).toBe(100);
  });
});

describe("useAnimatedNumber", () => {
  let now = 0;
  let frames: FrameRequestCallback[] = [];
  let reduced = false;

  beforeEach(() => {
    now = 0;
    frames = [];
    reduced = false;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  });
  afterEach(() => vi.restoreAllMocks());

  const step = (to: number) => {
    now = to;
    const cb = frames.at(-1);
    act(() => cb?.(now));
  };

  it("counts up from 0 to the target and lands exactly", () => {
    const { result } = renderHook(() => useAnimatedNumber(30, 1000));
    expect(result.current).toBe(0);
    step(500);
    expect(result.current).toBeCloseTo(26.25);
    step(1000);
    expect(result.current).toBe(30);
  });

  it("continues from where it is when the target changes (e.g. °C → °F)", () => {
    const { result, rerender } = renderHook(({ v }) => useAnimatedNumber(v, 1000), {
      initialProps: { v: 30 },
    });
    step(500);
    const midway = result.current;
    rerender({ v: 86 });
    now = 500;
    step(500); // first frame of the new animation starts at the current value
    expect(result.current).toBeGreaterThanOrEqual(midway);
    step(1500);
    expect(result.current).toBe(86);
  });

  it("shows the value immediately for reduced motion", () => {
    reduced = true;
    const { result } = renderHook(() => useAnimatedNumber(42, 1000));
    expect(result.current).toBe(42);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("shows the value immediately when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useAnimatedNumber(7, 1000));
    expect(result.current).toBe(7);
  });

  it("AnimatedNumber renders plain rounded text", () => {
    reduced = true;
    const { container } = render(
      <p>
        <AnimatedNumber value={29.6} /> and <AnimatedNumber value={2.345} digits={1} />
      </p>,
    );
    expect(container.textContent).toBe("30 and 2.3");
  });
});

describe("sky ambience", () => {
  const NAMES = Object.keys(SKIES) as SkyName[];

  it("every sky has a defined ambience", () => {
    expect(Object.keys(AMBIENCE).sort()).toEqual([...NAMES].sort());
  });

  it("is decorative: aria-hidden and not focusable", () => {
    const { container } = render(<SkyAmbience sky="rain" />);
    const amb = container.querySelector(".amb");
    expect(amb?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0);
  });

  it.each([
    ["rain", ".amb-rain i", AMBIENCE.rain.rain],
    ["storm", ".amb-rain i", AMBIENCE.storm.rain],
    ["snow", ".amb-snow i", AMBIENCE.snow.snow],
    ["overcast", ".amb-clouds i", AMBIENCE.overcast.clouds],
    ["fog", ".amb-fog i", AMBIENCE.fog.fog],
    ["night", ".amb-stars i", AMBIENCE.night.stars],
  ] as const)("%s draws its particles", (sky, selector, count) => {
    const { container } = render(<SkyAmbience sky={sky} />);
    expect(container.querySelectorAll(selector)).toHaveLength(count ?? -1);
  });

  it("each sky draws only its own weather", () => {
    const has = (sky: SkyName, sel: string) =>
      render(<SkyAmbience sky={sky} />).container.querySelector(sel) !== null;
    expect(has("clear", ".amb-glow-sun")).toBe(true);
    expect(has("clear", ".amb-rain")).toBe(false);
    expect(has("snow", ".amb-rain")).toBe(false);
    expect(has("night", ".amb-glow-moon")).toBe(true);
    expect(has("storm", ".amb-flash")).toBe(true);
    expect(has("rain", ".amb-flash")).toBe(false);
    expect(has("haze-very", ".amb-fog")).toBe(true);
  });

  it("is deterministic (no Math.random)", () => {
    const a = render(<SkyAmbience sky="snow" />).container.innerHTML;
    const b = render(<SkyAmbience sky="snow" />).container.innerHTML;
    expect(a).toBe(b);
    expect(scatter(5, 3)).toEqual(scatter(5, 3));
    expect(scatter(5, 3)).not.toEqual(scatter(5, 4));
    for (const [x, y, z] of scatter(50, 1))
      for (const v of [x, y, z]) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe("Card", () => {
  it("is a sky with ambience and a pointer sheen", () => {
    const { container } = render(<Card sky="storm">content</Card>);
    const card = container.querySelector(".wx-card");
    expect(card?.getAttribute("data-sky")).toBe("storm");
    expect(card?.querySelector(".amb")).not.toBeNull();
    expect(card?.querySelector(".wx-sheen")?.getAttribute("aria-hidden")).toBe("true");
    expect(card?.querySelector(".wx-inner")?.textContent).toBe("content");
  });

  it("the sheen follows a mouse but not a finger", () => {
    const { container } = render(<Card>content</Card>);
    const card = container.querySelector(".wx-card") as HTMLElement;
    fireEvent.pointerMove(card, { clientX: 40, clientY: 25, pointerType: "mouse" });
    expect(card.style.getPropertyValue("--px")).toBe("40px");
    expect(card.style.getPropertyValue("--py")).toBe("25px");
    fireEvent.pointerMove(card, { clientX: 99, clientY: 99, pointerType: "touch" });
    expect(card.style.getPropertyValue("--px")).toBe("40px");
  });
});

describe("data changes replay the entrance", () => {
  it("a new forecast length rebuilds the list so rows rise in again", () => {
    const noop = () => {};
    const { container, rerender } = render(
      <ForecastContent data={f3 as ForecastResult} loading={false} onRequest={noop} today="x" />,
    );
    const before = container.querySelector("ul.fc-days");
    rerender(
      <ForecastContent data={f7 as ForecastResult} loading={false} onRequest={noop} today="x" />,
    );
    expect(container.querySelector("ul.fc-days")).not.toBe(before);
    expect(container.querySelectorAll("ul.fc-days > li")).toHaveLength(7);
    expect(
      (container.querySelectorAll("ul.fc-days > li")[3] as HTMLElement).style.getPropertyValue(
        "--i",
      ),
    ).toBe("3");
  });
});

describe("gauge needle", () => {
  const sweep = (value: number) =>
    (
      render(<AqiGauge value={value} />).container.querySelector(".aq-needle") as SVGElement
    ).style.getPropertyValue("--sweep");
  it("sweeps from 0 to the reading, clamped to the scale", () => {
    expect(sweep(250)).toBe("90deg");
    expect(sweep(0)).toBe("0deg");
    expect(sweep(650)).toBe("180deg");
  });
});

describe("motion safeguards in the stylesheets", () => {
  it("kit.css resets all motion for prefers-reduced-motion", () => {
    expect(css("kit.css")).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.001ms/,
    );
  });

  it("ambience.css stops moving weather and the flash for reduced motion", () => {
    const text = css("ambience.css");
    const block = text.slice(text.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const cls of [".amb-rain", ".amb-snow", ".amb-clouds", ".amb-fog", ".amb-flash"])
      expect(block).toContain(cls);
    expect(block).toContain("display: none");
  });

  it("lightning stays gentle: at most two brief flashes, never brighter than 35%", () => {
    const text = css("ambience.css");
    const frames = text.slice(
      text.indexOf("@keyframes amb-lightning"),
      text.indexOf("@keyframes wx-fade-in"),
    );
    const opacities = [...frames.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...opacities)).toBeLessThanOrEqual(0.35);
    expect(opacities.filter((o) => o > 0)).toHaveLength(2);
  });

  it("the ambience fades out toward the bottom so text stays calm", () => {
    expect(css("ambience.css")).toMatch(
      /mask-image:\s*linear-gradient\(180deg, #000 0%, #000 45%, transparent 100%\)/,
    );
  });
});
