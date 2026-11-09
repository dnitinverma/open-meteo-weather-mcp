import { AQI_BANDS, aqiCategory } from "@weather/shared";
import type { CSSProperties } from "react";

export const GAUGE_MAX = 500;

/** EPA AQI band colours. Always shown with the printed category, never alone. */
export const BAND_COLORS: Record<string, string> = {
  Good: "#00a63e",
  Moderate: "#e6c200",
  "Unhealthy for sensitive groups": "#ff7e00",
  Unhealthy: "#e7000b",
  "Very unhealthy": "#8f3f97",
  Hazardous: "#7e0023",
};

const CX = 120;
const CY = 112;
const R = 96;
const STROKE = 14;

/** Angle in radians for a value: 0 → left (π), 500 → right (0). */
function angle(v: number): number {
  return Math.PI * (1 - Math.min(Math.max(v, 0), GAUGE_MAX) / GAUGE_MAX);
}
function point(v: number, r = R): [number, number] {
  const a = angle(v);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}
function arc(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

/** Semicircle 0–500 with the six AQI bands and a needle at `value`. */
export function AqiGauge({ value }: { value: number }) {
  const [nx, ny] = point(value, R - STROKE / 2 - 6);
  const category = aqiCategory(value);
  return (
    <svg
      className="aq-gauge"
      viewBox="0 0 240 128"
      role="img"
      aria-label={`AQI gauge: ${value}, ${category}`}
    >
      {AQI_BANDS.map((b, i) => (
        <path
          key={b.category}
          d={arc(i === 0 ? 0 : b.min - 1, b.max)}
          stroke={BAND_COLORS[b.category]}
          strokeWidth={STROKE}
          fill="none"
        />
      ))}
      <line
        x1={CX}
        y1={CY}
        x2={nx}
        y2={ny}
        key={value}
        className="aq-needle"
        style={
          {
            "--sweep": `${(Math.min(Math.max(value, 0), GAUGE_MAX) / GAUGE_MAX) * 180}deg`,
          } as CSSProperties
        }
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r={6} className="aq-hub" />
      <text x={CX - R} y={CY + 14} textAnchor="middle" className="aq-tick">
        0
      </text>
      <text x={CX + R} y={CY + 14} textAnchor="middle" className="aq-tick">
        500
      </text>
    </svg>
  );
}
