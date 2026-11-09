import type { ForecastDay, ForecastResult, Units } from "@weather/shared";
import { useState, type CSSProperties } from "react";
import { Header, Tabs, UnitToggle, WeatherIcon } from "../shared/components";
import {
  formatPercent,
  formatPrecip,
  formatTemp,
  hourLabel,
  shortDate,
  todayIn,
  weekday,
} from "../shared/format";
import { TempChart } from "./TempChart";
import "./forecast.css";

export interface ForecastRequest {
  days: number;
  units: Units;
  hourly_for_date?: string;
}

export const DAY_TABS = [
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 16, label: "16 days" },
];

export function ForecastContent({
  data,
  loading,
  onRequest,
  today,
}: {
  data: ForecastResult;
  loading: boolean;
  /** Re-run get_forecast for the same place with these options. */
  onRequest: (req: ForecastRequest) => void;
  /** Override "today" (tests/preview); defaults to today in the place's timezone. */
  today?: string;
}) {
  const { place, days, units, hourly } = data;
  const todayDate = today ?? todayIn(place.timezone);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const selected = loading && pendingDate ? pendingDate : (hourly?.date ?? null);
  const hourlyDay = hourly ? days.find((d) => d.date === hourly.date) : undefined;
  // Local ISO strings compare lexically; without sunrise/sunset assume 06:00–18:00 daylight.
  const isDayAt = (time: string) =>
    hourlyDay?.sunrise && hourlyDay.sunset
      ? time >= hourlyDay.sunrise.slice(0, 13) && time < hourlyDay.sunset
      : time.slice(11, 13) >= "06" && time.slice(11, 13) < "18";

  const pickDay = (date: string) => {
    setPendingDate(date);
    onRequest({ days: days.length, units, hourly_for_date: date });
  };

  return (
    <div className="fc" aria-busy={loading}>
      <Header
        place={place}
        subtitle={`${days.length}-day forecast`}
        right={
          <UnitToggle
            units={units}
            disabled={loading}
            onChange={(u) =>
              onRequest({
                days: days.length,
                units: u,
                ...(hourly ? { hourly_for_date: hourly.date } : {}),
              })
            }
          />
        }
      />
      <Tabs
        label="Forecast length"
        options={DAY_TABS}
        value={days.length}
        disabled={loading}
        onChange={(n) => onRequest({ days: n, units })}
      />
      <TempChart days={days} units={units} />
      <ul
        className="fc-days"
        aria-label="Daily forecast"
        key={`${days.length}-${units}-${days[0]?.date ?? ""}`}
      >
        {days.map((d, i) => (
          <li key={d.date} style={{ "--i": i } as CSSProperties}>
            <DayRow
              day={d}
              units={units}
              isToday={d.date === todayDate}
              selected={d.date === selected}
              disabled={loading}
              onClick={() => pickDay(d.date)}
            />
          </li>
        ))}
      </ul>
      {hourly && hourly.hours.length > 0 && (
        <section
          className="fc-hourly"
          aria-label={`Hourly forecast for ${weekday(hourly.date)} ${shortDate(hourly.date)}`}
        >
          <h2 className="fc-hourly-title">
            Hour by hour on {weekday(hourly.date)} {shortDate(hourly.date)}
          </h2>
          <ol className="fc-hours" tabIndex={0}>
            {hourly.hours.map((h) => (
              <li key={h.time} className="fc-hour">
                <span className="wx-small wx-muted">{hourLabel(h.time)}</span>
                <WeatherIcon code={h.weather_code} isDay={isDayAt(h.time)} size={20} />
                <span className="fc-hour-temp">{formatTemp(h.temperature, units)}</span>
                <span className="wx-small fc-rain-text">
                  <span className="wx-visually-hidden">Rain chance </span>
                  {formatPercent(h.precipitation_probability)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function DayRow({
  day,
  units,
  isToday,
  selected,
  disabled,
  onClick,
}: {
  day: ForecastDay;
  units: Units;
  isToday: boolean;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const p = day.precipitation_probability_max;
  return (
    <button
      type="button"
      className={["fc-day", isToday ? "fc-today" : "", selected ? "fc-selected" : ""].join(" ")}
      aria-pressed={selected}
      aria-label={`${isToday ? "Today, " : ""}${weekday(day.date)} ${shortDate(day.date)}: ${day.condition}, high ${formatTemp(day.temp_max, units)}, low ${formatTemp(day.temp_min, units)}, rain chance ${formatPercent(p)}. Show hourly forecast.`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="fc-date">
        <strong>{isToday ? "Today" : weekday(day.date)}</strong>
        <span className="wx-small wx-muted">{shortDate(day.date)}</span>
      </span>
      <WeatherIcon code={day.weather_code} />
      <span className="fc-cond wx-small">{day.condition}</span>
      <span className="fc-temps">
        <span className="fc-max">{formatTemp(day.temp_max, units)}</span>
        <span className="wx-muted"> / {formatTemp(day.temp_min, units)}</span>
      </span>
      <span
        className="fc-rain"
        title={day.precipitation_sum > 0 ? formatPrecip(day.precipitation_sum, units) : undefined}
      >
        <span className="fc-rain-text wx-small">{formatPercent(p)}</span>
        <span className="fc-rain-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, p ?? 0))}%` }} />
        </span>
      </span>
    </button>
  );
}
