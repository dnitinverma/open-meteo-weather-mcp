import {
  airQualityResultSchema,
  TOOL_NAMES,
  type AirQualityResult,
  type Place,
} from "@weather/shared";
import { useRef } from "react";
import { skyForAqi } from "../shared/sky";
import { useWeatherApp } from "../shared/useWeatherApp";
import { ViewShell } from "../shared/ViewShell";
import { AirQualityContent } from "./AirQualityContent";

export function AirQualityApp() {
  const state = useWeatherApp<AirQualityResult>("air-quality", airQualityResultSchema);
  const days = useRef(1);
  if (state.data) days.current = state.data.daily.length > 1 ? 3 : 1;

  const request = (place: Place, d: number) =>
    void state.callTool(
      TOOL_NAMES.airQuality,
      { latitude: place.latitude, longitude: place.longitude, days: d },
      place,
    );

  return (
    <ViewShell
      state={state}
      sky={(d) => skyForAqi(d.current.category)}
      onPickPlace={(p) => request(p, days.current)}
      render={(data) => (
        <AirQualityContent
          data={data}
          loading={state.loading}
          onRequest={(r) => request(data.place, r.days)}
        />
      )}
    />
  );
}
