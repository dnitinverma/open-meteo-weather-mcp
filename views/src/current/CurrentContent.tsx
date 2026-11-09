import type { CurrentWeatherResult, Units } from "@weather/shared";
import { Header, UnitToggle, WeatherIcon } from "../shared/components";
import {
  clockTime,
  compass,
  formatPrecip,
  formatSpeed,
  formatTemp,
  shortDate,
} from "../shared/format";
import "./current.css";

export interface CurrentRequest {
  units: Units;
}

export function CurrentContent({
  data,
  loading,
  onRequest,
}: {
  data: CurrentWeatherResult;
  loading: boolean;
  onRequest: (req: CurrentRequest) => void;
}) {
  const u = data.units;
  return (
    <div className={`cw ${data.is_day ? "cw-day" : "cw-night"}`} aria-busy={loading}>
      <Header
        place={data.place}
        subtitle={data.is_day ? "Current weather" : "Current weather · night"}
        right={
          <UnitToggle units={u} disabled={loading} onChange={(units) => onRequest({ units })} />
        }
      />
      <div className="cw-main">
        <WeatherIcon code={data.weather_code} isDay={data.is_day} size={56} />
        <div>
          <p className="cw-temp">{formatTemp(data.temperature, u)}</p>
          <p className="cw-cond">{data.condition}</p>
          <p className="wx-small wx-muted">Feels like {formatTemp(data.apparent_temperature, u)}</p>
        </div>
      </div>
      <dl className="cw-stats">
        <div>
          <dt>Humidity</dt>
          <dd>{Math.round(data.humidity)}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {formatSpeed(data.wind_speed, u)} {compass(data.wind_direction)}
          </dd>
        </div>
        <div>
          <dt>Precipitation</dt>
          <dd>{formatPrecip(data.precipitation, u)}</dd>
        </div>
      </dl>
      <div className="cw-foot">
        <span className="wx-small wx-muted">
          Updated {clockTime(data.observed_at)} local time, {shortDate(data.observed_at)}
        </span>
        <button
          type="button"
          className="wx-btn"
          disabled={loading}
          onClick={() => onRequest({ units: u })}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
