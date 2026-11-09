// Sections shown on the preview page (fixture data, no host). Views add entries as they are built.
import type { ForecastResult } from "@weather/shared";
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

export const sections: PreviewSection[] = [
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
