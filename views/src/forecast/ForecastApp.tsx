import { forecastResultSchema, TOOL_NAMES, type ForecastResult, type Place } from "@weather/shared";
import { useRef } from "react";
import { useWeatherApp } from "../shared/useWeatherApp";
import { ViewShell } from "../shared/ViewShell";
import { ForecastContent, type ForecastRequest } from "./ForecastContent";

export function ForecastApp() {
  const state = useWeatherApp<ForecastResult>("forecast", forecastResultSchema);
  const last = useRef<{ days: number; units: ForecastResult["units"] }>({
    days: 7,
    units: "metric",
  });
  if (state.data) last.current = { days: state.data.days.length, units: state.data.units };

  // Always call with resolved coordinates, never the city name (skips re-geocoding).
  const request = (place: Place, req: ForecastRequest) =>
    void state.callTool(
      TOOL_NAMES.forecast,
      { latitude: place.latitude, longitude: place.longitude, ...req },
      place,
    );

  return (
    <ViewShell
      state={state}
      onPickPlace={(p) => request(p, last.current)}
      render={(data) => (
        <ForecastContent
          data={data}
          loading={state.loading}
          onRequest={(req) => request(data.place, req)}
        />
      )}
    />
  );
}
