import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { AirQualityResult, CurrentWeatherResult, HistoricalResult } from "@weather/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AirQualityApp } from "../src/air-quality/AirQualityApp";
import { AirQualityContent } from "../src/air-quality/AirQualityContent";
import { CurrentApp } from "../src/current/CurrentApp";
import { CurrentContent } from "../src/current/CurrentContent";
import ambiguous from "../src/fixtures/error-ambiguous.json";
import aq1 from "../src/fixtures/air-quality-delhi.json";
import aq3 from "../src/fixtures/air-quality-delhi-3.json";
import cur from "../src/fixtures/current-jaipur.json";
import curImp from "../src/fixtures/current-jaipur-imperial.json";
import curNight from "../src/fixtures/current-night-tokyo.json";
import invalid from "../src/fixtures/error-invalid.json";
import notFound from "../src/fixtures/error-not-found.json";
import upstream from "../src/fixtures/error-upstream.json";
import histYear from "../src/fixtures/history-jaipur-year.json";
import histJuly from "../src/fixtures/history-mumbai-july.json";
import { bucketize, labelStep } from "../src/history/aggregate";
import { HistoryApp } from "../src/history/HistoryApp";
import { HistoryContent } from "../src/history/HistoryContent";
import { deliver, fail, fake, newFakeApp, ok } from "./mockApp";

vi.mock("@modelcontextprotocol/ext-apps/react", async () =>
  (await import("./mockApp")).extAppsReactMock(),
);

const CUR = cur as CurrentWeatherResult;
const AQ1 = aq1 as AirQualityResult;
const AQ3 = aq3 as AirQualityResult;
const HJ = histJuly as HistoricalResult;
const HY = histYear as HistoricalResult;

beforeEach(() => {
  fake.app = null;
  newFakeApp();
});

const ERRORS = [
  ["LOCATION_NOT_FOUND", notFound, "Place not found"],
  ["INVALID_INPUT", invalid, "Can't show that"],
  ["UPSTREAM_UNAVAILABLE", upstream, "Weather service unavailable"],
  ["AMBIGUOUS_LOCATION", ambiguous, "Which place did you mean?"],
] as const;

// ---------------- Current weather ----------------
describe("Current weather card", () => {
  it("shows temperature, condition, feels like, humidity, wind with compass, precipitation, updated time", () => {
    render(<CurrentContent data={CUR} loading={false} onRequest={() => {}} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain(`${Math.round(CUR.temperature)}°C`);
    expect(text).toContain(CUR.condition);
    expect(text).toContain(`Feels like ${Math.round(CUR.apparent_temperature)}°C`);
    expect(text).toContain(`${Math.round(CUR.humidity)}%`);
    expect(text).toMatch(/\d+ km\/h (N|NE|E|SE|S|SW|W|NW)/);
    expect(text).toMatch(/\d+(\.\d)? mm/);
    expect(text).toContain(`Updated ${CUR.observed_at.slice(11, 16)}`);
    expect(screen.getByRole("img", { name: CUR.condition })).toBeTruthy();
  });

  it("imperial units", () => {
    render(
      <CurrentContent data={curImp as CurrentWeatherResult} loading={false} onRequest={() => {}} />,
    );
    expect(document.body.textContent).toMatch(/°F.*mph/s);
  });

  it("night styling when is_day is false", () => {
    const night = curNight as CurrentWeatherResult;
    const { container } = render(
      <CurrentContent data={{ ...night, is_day: false }} loading={false} onRequest={() => {}} />,
    );
    expect(container.querySelector(".cw-night")).not.toBeNull();
    const { container: day } = render(
      <CurrentContent data={{ ...CUR, is_day: true }} loading={false} onRequest={() => {}} />,
    );
    expect(day.querySelector(".cw-day")).not.toBeNull();
  });

  it.each([
    ["Refresh", "metric"],
    ["°F", "imperial"],
  ])("%s calls get_current_weather with the same coordinates (%s)", (button, units) => {
    fake.app!.callServerTool.mockReturnValue(new Promise(() => {}));
    render(<CurrentApp />);
    act(() => deliver(ok(CUR)));
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_current_weather",
      arguments: { latitude: CUR.place.latitude, longitude: CUR.place.longitude, units },
    });
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeTruthy();
  });

  it.each(ERRORS)("%s → ErrorState", (_c, fixture, title) => {
    render(<CurrentApp />);
    act(() => deliver(fail(fixture)));
    expect(screen.getByRole("alert").textContent).toContain(title);
    expect(screen.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeTruthy();
  });
});

// ---------------- Air quality ----------------
describe("Air quality gauge", () => {
  it("prints the AQI number with its category (never colour alone) and PM values", () => {
    render(<AirQualityContent data={AQ1} loading={false} onRequest={() => {}} />);
    expect(
      screen.getByRole("img", {
        name: `AQI gauge: ${AQ1.current.us_aqi}, ${AQ1.current.category}`,
      }),
    ).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toContain(String(AQ1.current.us_aqi));
    expect(text).toContain(AQ1.current.category);
    expect(text).toContain(`${AQ1.current.pm2_5} µg/m³`);
    expect(text).toContain(`${AQ1.current.pm10} µg/m³`);
    expect(screen.queryByRole("list", { name: "Daily maximum AQI" })).toBeNull();
  });

  it("gauge draws six bands and clamps the needle at 500", () => {
    const { container } = render(
      <AirQualityContent
        data={{ ...AQ1, current: { ...AQ1.current, us_aqi: 650, category: "Hazardous" } }}
        loading={false}
        onRequest={() => {}}
      />,
    );
    expect(container.querySelectorAll(".aq-gauge path")).toHaveLength(6);
    const needle = container.querySelector(".aq-needle")!;
    expect(Number(needle.getAttribute("y2"))).toBeCloseTo(112, 0); // horizontal → right end
    expect(Number(needle.getAttribute("x2"))).toBeGreaterThan(120);
  });

  it("Next 3 days calls get_air_quality with days: 3, then shows one chip per day", async () => {
    fake.app!.callServerTool.mockResolvedValue(ok(AQ3));
    render(<AirQualityApp />);
    act(() => deliver(ok(AQ1)));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Next 3 days" }));
    });
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_air_quality",
      arguments: { latitude: AQ1.place.latitude, longitude: AQ1.place.longitude, days: 3 },
    });
    const chips = within(screen.getByRole("list", { name: "Daily maximum AQI" })).getAllByRole(
      "listitem",
    );
    expect(chips).toHaveLength(3);
    for (const [i, chip] of chips.entries()) {
      expect(chip.textContent).toContain(`Max AQI ${AQ3.daily[i]!.us_aqi_max}`);
      expect(chip.textContent).toContain(AQ3.daily[i]!.category);
    }
    expect(screen.getByRole("button", { name: "Next 3 days" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it.each(ERRORS)("%s → ErrorState", (_c, fixture, title) => {
    render(<AirQualityApp />);
    act(() => deliver(fail(fixture)));
    expect(screen.getByRole("alert").textContent).toContain(title);
  });
});

// ---------------- History ----------------
describe("History chart", () => {
  it("defaults to a daily rain bar chart and toggles to temperature lines", () => {
    const { container } = render(<HistoryContent data={HJ} />);
    expect(screen.getByRole("button", { name: "Rain" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".hc-bar")).toHaveLength(31);
    expect(screen.getByRole("img", { name: /Daily rainfall bar chart/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Temperature" }));
    expect(container.querySelectorAll(".hc-bar")).toHaveLength(0);
    expect(container.querySelector(".hc-line-max")).not.toBeNull();
    expect(container.querySelector(".hc-line-min")).not.toBeNull();
  });

  it("shows the totals row", () => {
    render(<HistoryContent data={HJ} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain(`Total rain${HJ.totals.precipitation_sum} mm`);
    expect(text).toContain(`Average high${Math.round(HJ.totals.temp_max_avg)}°C`);
    expect(text).toContain(`Average low${Math.round(HJ.totals.temp_min_avg)}°C`);
  });

  it("ranges over 62 days show monthly totals / averages", () => {
    const { container } = render(<HistoryContent data={HY} />);
    expect(container.querySelectorAll(".hc-bar")).toHaveLength(12);
    expect(screen.getByText("Monthly rainfall totals")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Temperature" }));
    expect(screen.getByRole("img", { name: /Monthly average temperature/ })).toBeTruthy();
  });

  it("thins date labels so they never overlap", () => {
    const { container } = render(<HistoryContent data={HJ} />);
    const labels = [...container.querySelectorAll("text.hc-axis")].filter((t) =>
      /\d+ \w{3}$/.test(t.textContent ?? ""),
    );
    expect(labels.length).toBeLessThan(31);
    expect(labels.length).toBeGreaterThan(3);
    expect(labelStep(31, 504, 48)).toBe(3);
    expect(labelStep(12, 260, 64)).toBe(3);
    expect(labelStep(5, 500, 48)).toBe(1);
  });

  it("bucketize: daily up to 62 days, monthly totals/averages above", () => {
    expect(bucketize(HJ.days)).toMatchObject({ monthly: false });
    const m = bucketize(HY.days);
    expect(m.monthly).toBe(true);
    expect(m.buckets).toHaveLength(12);
    const sum = m.buckets.reduce((s, b) => s + b.precipitation, 0);
    expect(sum).toBeCloseTo(HY.totals.precipitation_sum, 0);
    expect(m.buckets.reduce((s, b) => s + b.days, 0)).toBe(HY.days.length);
  });

  it.each(ERRORS)("%s → ErrorState", (_c, fixture, title) => {
    render(<HistoryApp />);
    act(() => deliver(fail(fixture)));
    expect(screen.getByRole("alert").textContent).toContain(title);
  });

  it("picking an alternative re-runs the requested dates by coordinates", () => {
    render(<HistoryApp />);
    act(() =>
      fake.app!.ontoolinput?.({
        arguments: { city: "Springfield", start_date: "2025-07-01", end_date: "2025-07-31" },
      }),
    );
    act(() => deliver(fail(ambiguous)));
    fireEvent.click(screen.getByRole("button", { name: /Missouri/ }));
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_historical_weather",
      arguments: expect.objectContaining({
        start_date: "2025-07-01",
        end_date: "2025-07-31",
        latitude: expect.any(Number),
      }),
    });
  });
});
