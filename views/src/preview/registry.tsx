// Sections shown on the preview page (fixture data, no host). Each is drawn once per theme.
import type {
  AirQualityResult,
  CurrentWeatherResult,
  ForecastResult,
  HistoricalResult,
} from "@weather/shared";
import { aqiCategory } from "@weather/shared";
import type { ReactNode } from "react";
import { AirQualityContent } from "../air-quality/AirQualityContent";
import { CurrentContent } from "../current/CurrentContent";
import aq1 from "../fixtures/air-quality-delhi.json";
import aq3 from "../fixtures/air-quality-delhi-3.json";
import cur from "../fixtures/current-jaipur.json";
import curNight from "../fixtures/current-night-tokyo.json";
import f16 from "../fixtures/forecast-16.json";
import f3 from "../fixtures/forecast-3.json";
import f7h from "../fixtures/forecast-7-hourly.json";
import f7i from "../fixtures/forecast-7-imperial.json";
import hy from "../fixtures/history-jaipur-year.json";
import hj from "../fixtures/history-mumbai-july.json";
import { ForecastContent } from "../forecast/ForecastContent";
import { AttributionFooter, Card } from "../shared/components";
import { skyForAqi, skyForRainfall, skyForWeather, type SkyName } from "../shared/sky";
import { HistoryContent } from "../history/HistoryContent";

export interface PreviewSection {
  title: string;
  /** Rendered once per theme. */
  render: () => ReactNode;
}

const noop = () => {};
const card = (sky: SkyName, node: ReactNode) => (
  <Card sky={sky}>
    {node}
    <AttributionFooter />
  </Card>
);

const CUR = cur as CurrentWeatherResult;
const NIGHT = curNight as CurrentWeatherResult;
const AQ1 = aq1 as AirQualityResult;
const AQ3 = aq3 as AirQualityResult;
const HJ = hj as HistoricalResult;
const HY = hy as HistoricalResult;

const forecast = (f: unknown, loading = false) => {
  const data = f as ForecastResult;
  const day = data.days.find((d) => d.date === data.hourly?.date) ?? data.days[0];
  return card(
    skyForWeather(day?.weather_code ?? 0),
    <ForecastContent
      data={data}
      loading={loading}
      onRequest={noop}
      today={data.days[0]?.date ?? ""}
    />,
  );
};

const current = (over: Partial<CurrentWeatherResult>) => {
  const data = { ...CUR, ...over };
  return card(
    skyForWeather(data.weather_code, data.is_day),
    <CurrentContent data={data} loading={false} onRequest={noop} />,
  );
};

const air = (data: AirQualityResult, us_aqi?: number) => {
  const aqi = us_aqi ?? data.current.us_aqi;
  const category = aqiCategory(aqi);
  const shown = { ...data, current: { ...data.current, us_aqi: aqi, category } };
  return card(
    skyForAqi(category),
    <AirQualityContent
      data={shown}
      loading={false}
      onRequest={noop}
      today={data.daily[0]?.date ?? ""}
    />,
  );
};

const history = (data: HistoricalResult) =>
  card(
    skyForRainfall(data.totals.precipitation_sum / Math.max(data.days.length, 1), data.units),
    <HistoryContent data={data} />,
  );

export const sections: PreviewSection[] = [
  { title: "Current · clear day", render: () => current({}) },
  { title: "Current · night", render: () => current({ ...NIGHT, is_day: false }) },
  {
    title: "Current · partly cloudy",
    render: () => current({ weather_code: 2, condition: "Partly cloudy" }),
  },
  {
    title: "Current · overcast",
    render: () => current({ weather_code: 3, condition: "Overcast" }),
  },
  { title: "Current · fog", render: () => current({ weather_code: 45, condition: "Fog" }) },
  {
    title: "Current · rain",
    render: () => current({ weather_code: 63, condition: "Moderate rain", precipitation: 2.4 }),
  },
  {
    title: "Current · snow",
    render: () =>
      current({
        weather_code: 73,
        condition: "Moderate snowfall",
        temperature: -3,
        apparent_temperature: -8,
      }),
  },
  {
    title: "Current · thunderstorm",
    render: () => current({ weather_code: 95, condition: "Thunderstorm", precipitation: 5.1 }),
  },
  { title: "Forecast · 7 days with hours", render: () => forecast(f7h) },
  { title: "Forecast · 3 days", render: () => forecast(f3) },
  { title: "Forecast · 16 days, loading", render: () => forecast(f16, true) },
  { title: "Forecast · 7 days in °F", render: () => forecast(f7i) },
  { title: "Air quality · Good", render: () => air(AQ1, 32) },
  { title: "Air quality · Moderate", render: () => air(AQ1, 78) },
  { title: "Air quality · Unhealthy for sensitive groups", render: () => air(AQ3, 124) },
  { title: "Air quality · Unhealthy, next 3 days", render: () => air(AQ3, 175) },
  { title: "Air quality · Very unhealthy", render: () => air(AQ3, 232) },
  { title: "Air quality · Hazardous", render: () => air(AQ1, 342) },
  { title: "History · Mumbai July (wet, daily)", render: () => history(HJ) },
  { title: "History · Jaipur 12 months (dry, monthly)", render: () => history(HY) },
];
