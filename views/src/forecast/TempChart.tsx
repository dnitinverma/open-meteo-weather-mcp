import type { ForecastDay, Units } from "@weather/shared";
import { formatTemp, weekday } from "../shared/format";
import type { CSSProperties } from "react";
import { TempGradient, useGradientId } from "../shared/TempGradient";
import { useWidth } from "../shared/useWidth";

const H = 150;
const PAD = { top: 22, right: 34, bottom: 24, left: 34 };

/** Inline SVG line chart: max (solid) and min (dashed) per day, labels at first and last points. */
export function TempChart({ days, units }: { days: ForecastDay[]; units: Units }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const gradient = useGradientId("fc-temp");
  if (days.length === 0) return null;
  const maxes = days.map((d) => d.temp_max);
  const mins = days.map((d) => d.temp_min);
  const hi = Math.max(...maxes);
  const lo = Math.min(...mins);
  const span = Math.max(hi - lo, 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (days.length === 1 ? innerW / 2 : (i * innerW) / (days.length - 1));
  const y = (t: number) => PAD.top + ((hi - t) / span) * innerH;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  // Keep at least ~40 px per weekday label so they never overlap.
  const labelEvery = Math.max(1, Math.ceil((days.length * 40) / innerW));
  const last = days.length - 1;
  const summary = `Temperature chart: highs ${formatTemp(Math.min(...maxes), units)} to ${formatTemp(hi, units)}, lows ${formatTemp(lo, units)} to ${formatTemp(Math.max(...mins), units)}.`;

  return (
    <div ref={ref} className="fc-chart-wrap">
      <svg
        key={`${days.length}-${units}-${days[0]?.date ?? ""}`}
        className="fc-chart"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
      >
        <title>{summary}</title>
        <TempGradient
          id={gradient}
          y1={PAD.top}
          y2={PAD.top + innerH}
          topTemp={hi}
          bottomTemp={hi - span}
          units={units}
        />
        <path
          d={path(maxes)}
          className="fc-line-max"
          pathLength={1}
          stroke={`url(#${gradient})`}
          fill="none"
        />
        <path d={path(mins)} className="fc-line-min" stroke={`url(#${gradient})`} fill="none" />
        {days.map((d, i) => (
          <g key={d.date}>
            <circle
              cx={x(i)}
              cy={y(d.temp_max)}
              r={3}
              className="fc-dot"
              style={{ "--i": i } as CSSProperties}
              fill={`url(#${gradient})`}
            />
            <circle
              cx={x(i)}
              cy={y(d.temp_min)}
              r={3}
              className="fc-dot"
              style={{ "--i": i } as CSSProperties}
              fill={`url(#${gradient})`}
            />
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" className="fc-axis">
                {weekday(d.date)}
              </text>
            )}
          </g>
        ))}
        {[0, last]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => {
            const d = days[i];
            if (!d) return null;
            const anchor = days.length === 1 ? "middle" : i === 0 ? "end" : "start";
            const dx = days.length === 1 ? 0 : i === 0 ? -6 : 6;
            return (
              <g key={`labels-${i}`}>
                <text x={x(i) + dx} y={y(d.temp_max) + 4} textAnchor={anchor} className="fc-val">
                  {formatTemp(d.temp_max, units)}
                </text>
                <text x={x(i) + dx} y={y(d.temp_min) + 4} textAnchor={anchor} className="fc-val">
                  {formatTemp(d.temp_min, units)}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
