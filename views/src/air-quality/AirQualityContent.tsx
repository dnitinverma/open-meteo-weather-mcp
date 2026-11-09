import type { AirQualityResult } from "@weather/shared";
import { Header, Tabs } from "../shared/components";
import { clockTime, weekday, shortDate, todayIn } from "../shared/format";
import { AqiGauge, BAND_COLORS } from "./AqiGauge";
import "./air-quality.css";

export function AirQualityContent({
  data,
  loading,
  onRequest,
  today,
}: {
  data: AirQualityResult;
  loading: boolean;
  onRequest: (req: { days: number }) => void;
  today?: string;
}) {
  const { current, daily, place } = data;
  const todayDate = today ?? todayIn(place.timezone);
  const range = daily.length > 1 ? 3 : 1;
  return (
    <div className="aq" aria-busy={loading}>
      <Header place={place} subtitle={`Air quality · ${clockTime(current.time)} local time`} />
      <div className="aq-main">
        <AqiGauge value={current.us_aqi} />
        <div className="aq-reading">
          <p className="aq-value">
            <span className="aq-number">{current.us_aqi}</span>
            <span className="aq-unit wx-small wx-muted">US AQI</span>
          </p>
          <p className="aq-category">
            <span
              className="aq-dot"
              style={{ background: BAND_COLORS[current.category] }}
              aria-hidden="true"
            />
            {current.category}
          </p>
          <dl className="aq-pm">
            <div>
              <dt>PM2.5</dt>
              <dd>{current.pm2_5} µg/m³</dd>
            </div>
            <div>
              <dt>PM10</dt>
              <dd>{current.pm10} µg/m³</dd>
            </div>
          </dl>
        </div>
      </div>
      <Tabs
        label="Air quality range"
        options={[
          { value: 1, label: "Today" },
          { value: 3, label: "Next 3 days" },
        ]}
        value={range}
        disabled={loading}
        onChange={(days) => onRequest({ days })}
      />
      {daily.length > 1 && (
        <ul className="aq-days" aria-label="Daily maximum AQI">
          {daily.map((d) => (
            <li key={d.date} className="aq-chip">
              <span className="wx-small">
                <strong>{d.date === todayDate ? "Today" : weekday(d.date)}</strong>{" "}
                <span className="wx-muted">{shortDate(d.date)}</span>
              </span>
              <span className="aq-chip-value">
                <span
                  className="aq-dot"
                  style={{ background: BAND_COLORS[d.category] }}
                  aria-hidden="true"
                />
                Max AQI {d.us_aqi_max}
              </span>
              <span className="wx-small">{d.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
