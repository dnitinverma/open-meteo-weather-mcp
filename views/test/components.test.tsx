import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ambiguous from "../src/fixtures/error-ambiguous.json";
import { AppContext } from "../src/shared/AppContext";
import {
  AttributionFooter,
  ErrorState,
  Header,
  Tabs,
  UnitToggle,
  WeatherIcon,
} from "../src/shared/components";
import type { ViewError } from "../src/shared/useWeatherApp";
import { newFakeApp } from "./mockApp";

const place = {
  name: "Jaipur",
  admin1: "Rajasthan",
  country: "India",
  country_code: "IN",
  latitude: 26.9,
  longitude: 75.8,
  timezone: "Asia/Kolkata",
};

describe("shared components", () => {
  it("Header shows place, region and country", () => {
    render(<Header place={place} subtitle="7-day forecast" />);
    expect(screen.getByRole("heading", { name: "Jaipur" })).toBeTruthy();
    expect(screen.getByText("Rajasthan, India")).toBeTruthy();
    expect(screen.getByText("7-day forecast")).toBeTruthy();
  });

  it("WeatherIcon labels the emoji with the condition", () => {
    render(<WeatherIcon code={61} />);
    expect(screen.getByRole("img", { name: "Slight rain" })).toBeTruthy();
    render(<WeatherIcon code={0} isDay={false} />);
    expect(screen.getByRole("img", { name: "Clear sky" }).textContent).toBe("🌙");
  });

  it("Tabs mark the active option and call onChange", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Days"
        options={[
          { value: 3, label: "3 days" },
          { value: 7, label: "7 days" },
        ]}
        value={7}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "7 days" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "3 days" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("Tabs can be disabled", () => {
    render(<UnitToggle units="metric" onChange={() => {}} disabled />);
    expect((screen.getByRole("button", { name: "°F" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("ErrorState renders alternatives as buttons", () => {
    const onPick = vi.fn();
    render(<ErrorState error={(ambiguous as { error: ViewError }).error} onPickPlace={onPick} />);
    expect(screen.getByRole("alert").textContent).toContain("Which place did you mean?");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Illinois/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ admin1: "Illinois" }));
  });

  it("ErrorState without alternatives shows only the message", () => {
    render(<ErrorState error={{ code: "LOCATION_NOT_FOUND", message: "No place found." }} />);
    expect(screen.getByText("No place found.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("AttributionFooter links to Open-Meteo and opens via the host when supported", () => {
    const app = newFakeApp();
    render(
      <AppContext.Provider value={app as never}>
        <AttributionFooter />
      </AppContext.Provider>,
    );
    const link = screen.getByRole("link", { name: "Weather data by Open-Meteo.com" });
    expect(link.getAttribute("href")).toBe("https://open-meteo.com");
    fireEvent.click(link);
    expect(app.openLink).toHaveBeenCalledWith({ url: "https://open-meteo.com" });
  });

  it("AttributionFooter is a plain link without a host", () => {
    render(<AttributionFooter />);
    expect(screen.getByRole("link").getAttribute("target")).toBe("_blank");
  });
});
