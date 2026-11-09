import { act, render } from "@testing-library/react";
import axe from "axe-core";
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
