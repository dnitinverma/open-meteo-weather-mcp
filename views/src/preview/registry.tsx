// Sections shown on the preview page (fixture data, no host). Views add entries as they are built.
import type {
  AirQualityResult,
  CurrentWeatherResult,
  ForecastResult,
  HistoricalResult,
} from "@weather/shared";
import { AirQualityContent } from "../air-quality/AirQualityContent";
import { CurrentContent } from "../current/CurrentContent";
import { HistoryContent } from "../history/HistoryContent";
import aq1 from "../fixtures/air-quality-delhi.json";
import aq3 from "../fixtures/air-quality-delhi-3.json";
import cur from "../fixtures/current-jaipur.json";
import curNight from "../fixtures/current-night-tokyo.json";
import hy from "../fixtures/history-jaipur-year.json";
import hj from "../fixtures/history-mumbai-july.json";
import type { ReactNode } from "react";
import { ForecastContent } from "../forecast/ForecastContent";
import f16 from "../fixtures/forecast-16.json";
import f3 from "../fixtures/forecast-3.json";
import f7h from "../fixtures/forecast-7-hourly.json";
import f7i from "../fixtures/forecast-7-imperial.json";

export interface PreviewSection {
  title: string;
  /** Rendered once per theme. */
  render: () => ReactNode;
}

const noop = () => {};
const today = (f: ForecastResult) => f.days[0]?.date ?? "";

const card = (node: ReactNode) => <div className="wx-card">{node}</div>;

export const sections: PreviewSection[] = [
  {
    title: "Current · day",
    render: () =>
      card(<CurrentContent data={cur as CurrentWeatherResult} loading={false} onRequest={noop} />),
  },
  {
    title: "Current · night",
    render: () =>
      card(
        <CurrentContent data={curNight as CurrentWeatherResult} loading={false} onRequest={noop} />,
      ),
  },
  {
    title: "Air quality · today",
    render: () =>
      card(<AirQualityContent data={aq1 as AirQualityResult} loading={false} onRequest={noop} />),
  },
  {
    title: "Air quality · next 3 days",
    render: () =>
      card(<AirQualityContent data={aq3 as AirQualityResult} loading={false} onRequest={noop} />),
  },
  {
    title: "History · Mumbai, July 2025 (daily)",
    render: () => card(<HistoryContent data={hj as HistoricalResult} />),
  },
  {
    title: "History · Jaipur, 12 months (monthly)",
    render: () => card(<HistoryContent data={hy as HistoricalResult} />),
  },
  {
    title: "Forecast · 7 days with hourly detail",
    render: () => (
      <div className="wx-card">
        <ForecastContent
          data={f7h as ForecastResult}
          loading={false}
          onRequest={noop}
          today={today(f7h as ForecastResult)}
        />
      </div>
    ),
  },
  {
    title: "Forecast · 3 days",
    render: () => (
      <div className="wx-card">
        <ForecastContent
          data={f3 as ForecastResult}
          loading={false}
          onRequest={noop}
          today={today(f3 as ForecastResult)}
        />
      </div>
    ),
  },
  {
    title: "Forecast · 16 days, imperial loading state",
    render: () => (
      <div className="wx-card">
        <ForecastContent
          data={f16 as ForecastResult}
          loading
          onRequest={noop}
          today={today(f16 as ForecastResult)}
        />
      </div>
    ),
  },
  {
    title: "Forecast · 7 days imperial",
    render: () => (
      <div className="wx-card">
        <ForecastContent
          data={f7i as ForecastResult}
          loading={false}
          onRequest={noop}
          today={today(f7i as ForecastResult)}
        />
      </div>
    ),
  },
];
