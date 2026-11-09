import {
  historicalResultSchema,
  TOOL_NAMES,
  type HistoricalResult,
  type Place,
} from "@weather/shared";
import { useRef } from "react";
import { useWeatherApp } from "../shared/useWeatherApp";
import { ViewShell } from "../shared/ViewShell";
import { HistoryContent } from "./HistoryContent";

export function HistoryApp() {
  const state = useWeatherApp<HistoricalResult>("history", historicalResultSchema);
  // Remember the requested range so an ambiguous-place pick can re-run it.
  const range = useRef<{ start_date: string; end_date: string } | null>(null);
  if (state.data) {
    range.current = { start_date: state.data.start_date, end_date: state.data.end_date };
  } else if (
    typeof state.input?.start_date === "string" &&
    typeof state.input.end_date === "string"
  ) {
    range.current = { start_date: state.input.start_date, end_date: state.input.end_date };
  }

  const pick = (place: Place) => {
    if (!range.current) return;
    void state.callTool(
      TOOL_NAMES.historicalWeather,
      { latitude: place.latitude, longitude: place.longitude, ...range.current },
      place,
    );
  };

  return (
    <ViewShell
      state={state}
      onPickPlace={range.current ? pick : undefined}
      render={(data) => <HistoryContent data={data} />}
    />
  );
}
