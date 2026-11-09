import { act, render } from "@testing-library/react";
import axe from "axe-core";
import { existsSync, readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AirQualityApp } from "../src/air-quality/AirQualityApp";
import { CurrentApp } from "../src/current/CurrentApp";
import { ForecastApp } from "../src/forecast/ForecastApp";
import { HistoryApp } from "../src/history/HistoryApp";
import aq3 from "../src/fixtures/air-quality-delhi-3.json";
import ambiguous from "../src/fixtures/error-ambiguous.json";
import cur from "../src/fixtures/current-jaipur.json";
import curNight from "../src/fixtures/current-night-tokyo.json";
import f7h from "../src/fixtures/forecast-7-hourly.json";
import hy from "../src/fixtures/history-jaipur-year.json";
import hj from "../src/fixtures/history-mumbai-july.json";
import { deliver, fail, fake, newFakeApp, ok } from "./mockApp";

vi.mock("@modelcontextprotocol/ext-apps/react", async () =>
  (await import("./mockApp")).extAppsReactMock(),
);

beforeEach(() => {
  fake.app = null;
  newFakeApp();
});

/** Everything except colour-contrast (jsdom has no layout/colours; see contrast.test.ts). */
async function violations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

const CASES: [string, () => ReactElement, unknown][] = [
  ["current (day)", () => <CurrentApp />, ok(cur)],
  ["current (night)", () => <CurrentApp />, ok(curNight)],
  ["forecast with hourly", () => <ForecastApp />, ok(f7h)],
  ["air quality 3 days", () => <AirQualityApp />, ok(aq3)],
  ["history daily", () => <HistoryApp />, ok(hj)],
  ["history monthly", () => <HistoryApp />, ok(hy)],
  ["ambiguous location", () => <ForecastApp />, fail(ambiguous)],
];

describe("accessibility (axe: names, roles, labels, ARIA, lists)", () => {
  it.each(CASES)("%s has no violations", async (_name, view, result) => {
    const { container } = render(view());
    act(() => deliver(result as never));
    expect(await violations(container)).toEqual([]);
  });

  it("loading state has no violations", async () => {
    const { container } = render(<ForecastApp />);
    expect(await violations(container)).toEqual([]);
  });

  it("every view has one level-1 heading and keyboard-reachable buttons", () => {
    for (const [view, result] of [
      [<ForecastApp key="f" />, ok(f7h)],
      [<CurrentApp key="c" />, ok(cur)],
      [<AirQualityApp key="a" />, ok(aq3)],
      [<HistoryApp key="h" />, ok(hj)],
    ] as const) {
      fake.app = null;
      newFakeApp();
      const { container, unmount } = render(view);
      act(() => deliver(result as never));
      expect(container.querySelectorAll("h1")).toHaveLength(1);
      for (const b of container.querySelectorAll("button"))
        expect(b.tabIndex).toBeGreaterThanOrEqual(0);
      unmount();
    }
  });
});

// ---- WCAG contrast for the fallback palette (used when the host sends no style variables) ----
function lum(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** Parses `--wx-x: ... light-dark(#aaa, #bbb)` fallbacks from kit.css. */
function palette() {
  // Vitest returns empty CSS for imports, so read the file (cwd is the repo root or views/).
  const file = ["views/src/shared/kit.css", "src/shared/kit.css"].find((f) => existsSync(f));
  if (!file) throw new Error("kit.css not found");
  const css = readFileSync(file, "utf8");
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const m of css.matchAll(
    /--wx-([a-z-]+):[^;]*?light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/g,
  )) {
    light[m[1]!] = m[2]!;
    dark[m[1]!] = m[3]!;
  }
  return { light, dark };
}

describe("contrast (WCAG AA 4.5:1 for text)", () => {
  const { light, dark } = palette();
  const PAIRS: [string, string][] = [
    ["text", "bg"],
    ["text", "bg-subtle"],
    ["text", "bg-highlight"],
    ["text", "night-bg"],
    ["text-muted", "bg"],
    ["text-muted", "bg-subtle"],
    ["text-muted", "bg-highlight"],
    ["text-muted", "night-bg"],
    ["text-danger", "bg"],
    ["accent-text", "accent"],
    ["max", "bg"],
    ["max", "bg-highlight"],
    ["min", "bg"],
    ["min", "bg-highlight"],
    ["rain", "bg"],
    ["rain", "bg-subtle"],
    ["rain", "bg-highlight"],
  ];
  it.each(PAIRS)("%s on %s", (fg, bg) => {
    for (const [name, p] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      const a = p[fg];
      const b = p[bg];
      if (!a || !b) continue;
      expect(ratio(a, b), `${name}: ${fg} ${a} on ${bg} ${b}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("reads the palette", () => {
    expect(Object.keys(light).length).toBeGreaterThan(8);
    expect(Object.keys(dark)).toEqual(Object.keys(light));
  });
});
