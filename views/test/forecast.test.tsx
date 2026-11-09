import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ForecastResult } from "@weather/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForecastApp } from "../src/forecast/ForecastApp";
import { ForecastContent } from "../src/forecast/ForecastContent";
import ambiguous from "../src/fixtures/error-ambiguous.json";
import invalid from "../src/fixtures/error-invalid.json";
import notFound from "../src/fixtures/error-not-found.json";
import upstream from "../src/fixtures/error-upstream.json";
import f16 from "../src/fixtures/forecast-16.json";
import f3 from "../src/fixtures/forecast-3.json";
import f7 from "../src/fixtures/forecast-7.json";
import f7h from "../src/fixtures/forecast-7-hourly.json";
import { deliver, fail, fake, newFakeApp, ok } from "./mockApp";

vi.mock("@modelcontextprotocol/ext-apps/react", async () =>
  (await import("./mockApp")).extAppsReactMock(),
);

const F3 = f3 as ForecastResult;
const F7 = f7 as ForecastResult;
const F7H = f7h as ForecastResult;
const F16 = f16 as ForecastResult;
const { latitude, longitude } = F7.place;

beforeEach(() => {
  fake.app = null;
  newFakeApp();
});

function renderApp(result = ok(F7)) {
  render(<ForecastApp />);
  act(() => deliver(result));
}
const dayRows = () =>
  within(screen.getByRole("list", { name: "Daily forecast" })).getAllByRole("button");

describe("ForecastContent", () => {
  it.each([
    [F3, 3],
    [F7, 7],
    [F16, 16],
  ])("renders %#: one row per day, subtitle and active tab", (data, n) => {
    render(
      <ForecastContent
        data={data}
        loading={false}
        onRequest={() => {}}
        today={data.days[0]!.date}
      />,
    );
    expect(dayRows()).toHaveLength(n);
    expect(screen.getByText(`${n}-day forecast`)).toBeTruthy();
    expect(screen.getByRole("button", { name: `${n} days` }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("img", { name: /Temperature chart/ })).toBeTruthy();
  });

  it("highlights and labels today", () => {
    render(
      <ForecastContent data={F7} loading={false} onRequest={() => {}} today={F7.days[2]!.date} />,
    );
    const rows = dayRows();
    expect(rows[2]!.className).toContain("fc-today");
    expect(rows[2]!.textContent).toContain("Today");
    expect(rows[0]!.textContent).not.toContain("Today");
  });

  it("shows every day's max/min, condition and rain chance", () => {
    render(<ForecastContent data={F3} loading={false} onRequest={() => {}} today="x" />);
    const d = F3.days[0]!;
    const row = dayRows()[0]!;
    expect(row.textContent).toContain(`${Math.round(d.temp_max)}°C`);
    expect(row.textContent).toContain(`${Math.round(d.temp_min)}°C`);
    expect(row.textContent).toContain(d.condition);
    expect(row.textContent).toContain(`${Math.round(d.precipitation_probability_max ?? 0)}%`);
  });

  it("hourly strip appears only when hourly is present", () => {
    const { unmount } = render(<ForecastContent data={F7} loading={false} onRequest={() => {}} />);
    expect(screen.queryByRole("region", { name: /Hourly forecast/ })).toBeNull();
    unmount();
    render(<ForecastContent data={F7H} loading={false} onRequest={() => {}} />);
    const strip = screen.getByRole("region", { name: /Hourly forecast/ });
    expect(within(strip).getAllByRole("listitem")).toHaveLength(F7H.hourly!.hours.length);
    // the hourly date's row is selected
    const selected = dayRows().find((r) => r.getAttribute("aria-pressed") === "true");
    expect(selected?.getAttribute("aria-label")).toContain("Show hourly");
  });

  it("disables tabs, toggle and rows while loading", () => {
    render(<ForecastContent data={F7} loading onRequest={() => {}} />);
    for (const b of screen.getAllByRole("button"))
      expect((b as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ForecastApp interactions (always by coordinates)", () => {
  it("tab click calls get_forecast with the new days", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "16 days" }));
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_forecast",
      arguments: { latitude, longitude, days: 16, units: "metric" },
    });
  });

  it("day row click asks for hourly detail for that date", () => {
    renderApp();
    fireEvent.click(dayRows()[1]!);
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_forecast",
      arguments: {
        latitude,
        longitude,
        days: 7,
        units: "metric",
        hourly_for_date: F7.days[1]!.date,
      },
    });
  });

  it("unit toggle calls get_forecast with the other units", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "°F" }));
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_forecast",
      arguments: { latitude, longitude, days: 7, units: "imperial" },
    });
  });

  it("replaces the view with the new result", async () => {
    fake.app!.callServerTool.mockResolvedValue(ok(F16));
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "16 days" }));
    });
    expect(dayRows()).toHaveLength(16);
  });

  it.each([
    ["LOCATION_NOT_FOUND", notFound, "Place not found"],
    ["INVALID_INPUT", invalid, "Can't show that"],
    ["UPSTREAM_UNAVAILABLE", upstream, "Weather service unavailable"],
    ["AMBIGUOUS_LOCATION", ambiguous, "Which place did you mean?"],
  ])("%s renders ErrorState with the footer", (_code, fixture, title) => {
    renderApp(fail(fixture));
    expect(screen.getByRole("alert").textContent).toContain(title);
    expect(screen.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeTruthy();
  });

  it("an alternative button calls get_forecast with that place's coordinates", () => {
    renderApp(fail(ambiguous));
    fireEvent.click(screen.getByRole("button", { name: /Illinois/ }));
    const alt = (
      ambiguous as {
        error: { alternatives: { admin1: string; latitude: number; longitude: number }[] };
      }
    ).error.alternatives.find((p) => p.admin1 === "Illinois")!;
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_forecast",
      arguments: { latitude: alt.latitude, longitude: alt.longitude, days: 7, units: "metric" },
    });
  });

  it("shows a loading state before the first result", () => {
    render(<ForecastApp />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });
});
