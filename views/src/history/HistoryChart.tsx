import type { Units } from "@weather/shared";
import type { CSSProperties, ReactNode } from "react";
import { formatPrecip, formatTemp, monthLabel, shortDate } from "../shared/format";
import { TempGradient, useGradientId } from "../shared/TempGradient";
import { useWidth } from "../shared/useWidth";
import { labelStep, type Bucket } from "./aggregate";

const H = 170;
const PAD_BASE = { top: 16, right: 12, bottom: 26 };

export type HistoryMode = "rain" | "temperature";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

export function HistoryChart({
  buckets,
  monthly,
  mode,
  units,
}: {
  buckets: Bucket[];
  monthly: boolean;
  mode: HistoryMode;
  units: Units;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const gradient = useGradientId("hc-temp");
  // Room for the longest y-axis label (~7.5 px per character at 13 px) so it is never clipped.
  const maxLabel =
    mode === "rain"
      ? formatPrecip(niceMax(Math.max(...buckets.map((b) => b.precipitation), 0)), units)
      : formatTemp(Math.min(...buckets.map((b) => b.temp_min)) - 10, units);
  const PAD = { ...PAD_BASE, left: Math.ceil(maxLabel.length * 7.5) + 12 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = buckets.length;
  const slot = innerW / Math.max(n, 1);
  const xMid = (i: number) => PAD.left + slot * i + slot / 2;
  const label = (b: Bucket) => (monthly ? monthLabel(b.key) : shortDate(b.key));
  const step = labelStep(n, innerW, monthly ? 64 : 48);

  let body: ReactNode;
  let summary: string;
  let yTicks: { y: number; text: string }[];

  if (mode === "rain") {
    const max = niceMax(Math.max(...buckets.map((b) => b.precipitation), 0));
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    const barW = Math.max(2, Math.min(28, slot * 0.7));
    yTicks = [0, max / 2, max].map((v) => ({ y: y(v), text: formatPrecip(v, units) }));
    summary = `${monthly ? "Monthly" : "Daily"} rainfall bar chart, up to ${formatPrecip(Math.max(...buckets.map((b) => b.precipitation), 0), units)}.`;
    body = (
      <>
        {buckets.map((b, i) => (
          <rect
            key={b.key}
            className="hc-bar"
            style={{ "--i": i } as CSSProperties}
            x={xMid(i) - barW / 2}
            y={y(b.precipitation)}
            width={barW}
            height={Math.max(0, PAD.top + innerH - y(b.precipitation))}
          >
            <title>{`${label(b)}: ${formatPrecip(b.precipitation, units)}`}</title>
          </rect>
        ))}
      </>
    );
  } else {
    const hi = Math.max(...buckets.map((b) => b.temp_max));
    const lo = Math.min(...buckets.map((b) => b.temp_min));
    const span = Math.max(hi - lo, 1);
    const top = hi + span * 0.05;
    const bottom = lo - span * 0.05;
    const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * innerH;
    const path = (vals: number[]) =>
      vals
        .map((v, i) => `${i === 0 ? "M" : "L"}${xMid(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join(" ");
    yTicks = [bottom, (top + bottom) / 2, top].map((v) => ({
      y: y(v),
      text: formatTemp(v, units),
    }));
    summary = `${monthly ? "Monthly average" : "Daily"} temperature line chart: highs up to ${formatTemp(hi, units)}, lows down to ${formatTemp(lo, units)}.`;
    body = (
      <>
        <TempGradient
          id={gradient}
          y1={PAD.top}
          y2={PAD.top + innerH}
          topTemp={top}
          bottomTemp={bottom}
          units={units}
        />
        <path
          d={path(buckets.map((b) => b.temp_max))}
          className="hc-line-max"
          pathLength={1}
          stroke={`url(#${gradient})`}
          fill="none"
        />
        <path
          d={path(buckets.map((b) => b.temp_min))}
          className="hc-line-min"
          stroke={`url(#${gradient})`}
          fill="none"
        />
      </>
    );
  }

  return (
    <div ref={ref} className="hc-wrap">
      <svg
        key={`${mode}-${buckets.length}-${units}-${buckets[0]?.key ?? ""}`}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        className="hc-chart"
      >
        <title>{summary}</title>
        {yTicks.map((t) => (
          <g key={t.text + t.y}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} className="hc-grid" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" className="hc-axis">
              {t.text}
            </text>
          </g>
        ))}
        {body}
        {buckets.map((b, i) =>
          i % step === 0 ? (
            <text key={b.key} x={xMid(i)} y={H - 8} textAnchor="middle" className="hc-axis">
              {label(b)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
