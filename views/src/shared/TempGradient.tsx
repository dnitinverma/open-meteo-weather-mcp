import type { Units } from "@weather/shared";
import { useId } from "react";
import { tempColor } from "./sky";

/** An id that is safe inside `url(#…)` (React's useId contains colons). */
export function useGradientId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

const STOPS = 7;

/**
 * Vertical SVG gradient that maps height to temperature on the shared scale: `topTemp` at `y1`,
 * `bottomTemp` at `y2`. Strokes and dots that use it take the colour of the temperature at their
 * own height, so 30° looks the same in every card.
 */
export function TempGradient({
  id,
  y1,
  y2,
  topTemp,
  bottomTemp,
  units,
}: {
  id: string;
  y1: number;
  y2: number;
  topTemp: number;
  bottomTemp: number;
  units: Units;
}) {
  return (
    <defs>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
        {Array.from({ length: STOPS }, (_, i) => {
          const t = i / (STOPS - 1);
          const temp = topTemp + (bottomTemp - topTemp) * t;
          return (
            <stop
              key={i}
              offset={`${(t * 100).toFixed(1)}%`}
              style={{ stopColor: tempColor(temp, units) }}
            />
          );
        })}
      </linearGradient>
    </defs>
  );
}
