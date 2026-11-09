import { ATTRIBUTION, describeWeatherCode, type Place, type Units } from "@weather/shared";
import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { useAppInstance } from "./AppContext";
import { placeLabel } from "./format";
import { SkyAmbience } from "./SkyAmbience";
import { skyStyle, type SkyName } from "./sky";
import type { ViewError } from "./useWeatherApp";

/** The card is a sky: `sky` picks its ground and the weather drifting in it (see sky.ts). */
export function Card({
  children,
  className,
  sky = "clear",
}: {
  children: ReactNode;
  className?: string;
  sky?: SkyName;
}) {
  const ref = useRef<HTMLElement>(null);
  // The sheen follows the pointer; touch has no hover, so it is ignored there.
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const box = el.getBoundingClientRect();
    el.style.setProperty("--px", `${e.clientX - box.left}px`);
    el.style.setProperty("--py", `${e.clientY - box.top}px`);
  };
  return (
    <section
      ref={ref}
      className={["wx-card", className].filter(Boolean).join(" ")}
      data-sky={sky}
      style={skyStyle(sky)}
      onPointerMove={onPointerMove}
    >
      <SkyAmbience sky={sky} />
      <div className="wx-sheen" aria-hidden="true" />
      <div className="wx-inner">{children}</div>
    </section>
  );
}

export function Header({
  place,
  subtitle,
  right,
}: {
  place: Place;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  const region = [place.admin1 !== place.name ? place.admin1 : undefined, place.country]
    .filter(Boolean)
    .join(", ");
  return (
    <header className="wx-header">
      <div>
        <h1>{place.name}</h1>
        {region && <p className="wx-sub">{region}</p>}
        {subtitle && <p className="wx-sub">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export interface TabOption<V extends string | number> {
  value: V;
  label: string;
}

/** Choices as words with an underline under the active one. Buttons use aria-pressed. */
export function Tabs<V extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: TabOption<V>[];
  value: V;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  return (
    <div className="wx-tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NIGHT_ICONS: Record<number, string> = { 0: "🌙", 1: "🌙", 2: "☁️" };

/** WMO code → emoji with aria-label = condition. */
export function WeatherIcon({
  code,
  isDay = true,
  size = 24,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
}) {
  const info = describeWeatherCode(code);
  const icon = (!isDay && NIGHT_ICONS[code]) || info.icon;
  return (
    <span className="wx-icon" role="img" aria-label={info.condition} style={{ fontSize: size }}>
      {icon}
    </span>
  );
}

export function UnitToggle({
  units,
  onChange,
  disabled,
}: {
  units: Units;
  onChange: (u: Units) => void;
  disabled?: boolean;
}) {
  return (
    <Tabs<Units>
      label="Units"
      options={[
        { value: "metric", label: "°C" },
        { value: "imperial", label: "°F" },
      ]}
      value={units}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function LoadingState({ label = "Loading weather…" }: { label?: string }) {
  return (
    <div className="wx-status" role="status" aria-live="polite">
      <span className="wx-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

const ERROR_TITLES: Record<ViewError["code"], string> = {
  LOCATION_NOT_FOUND: "Place not found",
  AMBIGUOUS_LOCATION: "Which place did you mean?",
  INVALID_INPUT: "Can't show that",
  UPSTREAM_UNAVAILABLE: "Weather service unavailable",
};

export function ErrorState({
  error,
  onPickPlace,
  disabled,
}: {
  error: ViewError;
  onPickPlace?: (place: Place) => void;
  disabled?: boolean;
}) {
  return (
    <div className="wx-error" role="alert">
      <p className="wx-error-title">{ERROR_TITLES[error.code]}</p>
      <p>{error.message}</p>
      {error.alternatives && error.alternatives.length > 0 && onPickPlace && (
        <ul aria-label="Matching places">
          {error.alternatives.map((p) => (
            <li key={`${p.latitude},${p.longitude}`}>
              <button
                type="button"
                className="wx-btn"
                disabled={disabled}
                onClick={() => onPickPlace(p)}
              >
                {placeLabel(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Weather data by Open-Meteo.com", opened through the host when it supports openLink. */
export function AttributionFooter() {
  const app = useAppInstance();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (app?.getHostCapabilities()?.openLinks) {
      e.preventDefault();
      void app.openLink({ url: ATTRIBUTION.url });
    }
  };
  return (
    <footer className="wx-footer">
      <a href={ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {ATTRIBUTION.text}
      </a>
    </footer>
  );
}
