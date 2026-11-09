import type { HistoricalResult } from "@weather/shared";
import { useMemo, useState } from "react";
import { Header, Tabs } from "../shared/components";
import { formatPrecip, formatTemp, longDate } from "../shared/format";
import { bucketize } from "./aggregate";
import { HistoryChart, type HistoryMode } from "./HistoryChart";
import "./history.css";

export function HistoryContent({ data }: { data: HistoricalResult }) {
  const [mode, setMode] = useState<HistoryMode>("rain");
  const { monthly, buckets } = useMemo(() => bucketize(data.days), [data.days]);
  const u = data.units;
  const n = data.days.length;
  return (
    <div className="hc">
      <Header
        place={data.place}
        subtitle={`${longDate(data.start_date)} – ${longDate(data.end_date)} · ${n} day${n === 1 ? "" : "s"}`}
      />
      <Tabs<HistoryMode>
        label="Chart"
        options={[
          { value: "rain", label: "Rain" },
          { value: "temperature", label: "Temperature" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <p className="wx-small wx-muted hc-legend">
        {mode === "rain" ? (
          monthly ? (
            "Monthly rainfall totals"
          ) : (
            "Daily rainfall"
          )
        ) : (
          <>
            <span className="hc-key hc-key-max" aria-hidden="true" />{" "}
            {monthly ? "Average high" : "High"}{" "}
            <span className="hc-key hc-key-min" aria-hidden="true" />{" "}
            {monthly ? "Average low" : "Low"}
          </>
        )}
      </p>
      <HistoryChart buckets={buckets} monthly={monthly} mode={mode} units={u} />
      <dl className="hc-totals">
        <div>
          <dt>Total rain</dt>
          <dd>{formatPrecip(data.totals.precipitation_sum, u)}</dd>
        </div>
        <div>
          <dt>Average high</dt>
          <dd>{formatTemp(data.totals.temp_max_avg, u)}</dd>
        </div>
        <div>
          <dt>Average low</dt>
          <dd>{formatTemp(data.totals.temp_min_avg, u)}</dd>
        </div>
      </dl>
    </div>
  );
}
