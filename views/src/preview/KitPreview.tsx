import type { Place } from "@weather/shared";
import { useState } from "react";
import {
  AttributionFooter,
  Card,
  ErrorState,
  Header,
  LoadingState,
  Tabs,
  UnitToggle,
  WeatherIcon,
} from "../shared/components";
import ambiguous from "../fixtures/error-ambiguous.json";
import notFound from "../fixtures/error-not-found.json";
import upstream from "../fixtures/error-upstream.json";
import type { ViewError } from "../shared/useWeatherApp";

const jaipur: Place = {
  name: "Jaipur",
  admin1: "Rajasthan",
  country: "India",
  country_code: "IN",
  latitude: 26.91962,
  longitude: 75.78781,
  timezone: "Asia/Kolkata",
};
const CODES = [0, 1, 2, 3, 45, 51, 61, 65, 71, 75, 80, 82, 95, 99];

export function KitPreview() {
  const [days, setDays] = useState(7);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  return (
    <Card>
      <Header
        place={jaipur}
        subtitle="Header + UnitToggle"
        right={<UnitToggle units={units} onChange={setUnits} />}
      />
      <Tabs
        label="Forecast length"
        options={[
          { value: 3, label: "3 days" },
          { value: 7, label: "7 days" },
          { value: 16, label: "16 days" },
        ]}
        value={days}
        onChange={setDays}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CODES.map((c) => (
          <WeatherIcon key={c} code={c} />
        ))}
        <WeatherIcon code={0} isDay={false} />
      </div>
      <LoadingState />
      <ErrorState error={(ambiguous as { error: ViewError }).error} onPickPlace={() => {}} />
      <ErrorState error={(notFound as { error: ViewError }).error} />
      <ErrorState error={(upstream as { error: ViewError }).error} />
      <AttributionFooter />
    </Card>
  );
}
