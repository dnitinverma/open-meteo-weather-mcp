import {
  currentWeatherResultSchema,
  TOOL_NAMES,
  type CurrentWeatherResult,
  type Place,
  type Units,
} from "@weather/shared";
import { useRef } from "react";
import { useWeatherApp } from "../shared/useWeatherApp";
import { ViewShell } from "../shared/ViewShell";
import { CurrentContent } from "./CurrentContent";

export function CurrentApp() {
  const state = useWeatherApp<CurrentWeatherResult>("current", currentWeatherResultSchema);
  const units = useRef<Units>("metric");
  if (state.data) units.current = state.data.units;

  const request = (place: Place, u: Units) =>
    void state.callTool(
      TOOL_NAMES.currentWeather,
      { latitude: place.latitude, longitude: place.longitude, units: u },
      place,
    );

  return (
    <ViewShell
      state={state}
      onPickPlace={(p) => request(p, units.current)}
      render={(data) => (
        <CurrentContent
          data={data}
          loading={state.loading}
          onRequest={(r) => request(data.place, r.units)}
        />
      )}
    />
  );
}
