# Open-Meteo Weather MCP App (with UI) — Build Plan

Nov 9, 2026 · Nitin Verma

## Overview

You will build an MCP App: the same Open-Meteo weather server, but each tool also shows its own interactive UI inside the chat, like a plugin in ChatGPT.

**What changes from the plain connector**

- Tools return text for Claude **and** a visual card for the user (forecast cards, AQI gauge, charts)
- The UI is a small web page (HTML + JS) served by your server as a `ui://` resource
- Buttons in the UI can call your tools again, e.g. switch from 3 to 7 days without typing

**Where it runs**

- **Claude** web and desktop, **ChatGPT**, VS Code, Goose and other MCP Apps hosts, from one codebase ([MCP Apps README](https://github.com/modelcontextprotocol/ext-apps))
- ChatGPT announced full support for the MCP Apps open standard, so you do not need separate ChatGPT-only UI code
- Clients without UI support (Cursor, Claude Code) still work, using the text output

**Unchanged from the connector guide:** Open-Meteo APIs, city-to-coordinates geocoding, no user login, non-commercial use with attribution.

## How to use this doc with Claude Code

Export this doc as Markdown, save it in an empty folder as `docs/BUILD_PLAN.md`, then run Claude Code there one phase at a time.

**Start each phase with this prompt** (change the phase number):

```
Read docs/BUILD_PLAN.md fully. Implement Phase 1 only.
Follow "Rules for Claude Code" and the "Data contracts" section exactly.
Before writing code, read the current docs or READMEs the phase names, and
tell me if any API differs from this plan.
When finished, run every check under "Done when", show me the results, and
stop. Do not start the next phase.
```

Then review the changes, test them yourself, and commit before the next phase. Use plan mode (Shift+Tab) on Phases 4–7.

**Rules for Claude Code** (copy these into `CLAUDE.md` in Phase 1)

1. TypeScript strict mode everywhere; Node.js 20+; ES modules.
2. All Open-Meteo HTTP calls go through `server/src/openmeteo/client.ts`; nothing else calls `fetch` to Open-Meteo.
3. Views never call the network directly; all data reaches a view through tool results or `callServerTool`.
4. Every tool returns both a short text summary (for Claude and for hosts without UI) and `structuredContent` matching "Data contracts".
5. Every text output and every view shows "Weather data by Open-Meteo.com" with a link to https://open-meteo.com.
6. Never return stack traces or raw Open-Meteo responses to the client.
7. Units: °C, km/h, mm by default; times in the place's local timezone (`timezone=auto`).
8. Each phase ends with passing `npm test`, `npm run build` and `npm run lint`.
9. If the plan conflicts with the current SDK docs, follow the docs and tell me what changed.
10. This is a free, non-commercial app; do not add analytics, ads or user tracking.

## How an MCP App works

An MCP App is a normal MCP server whose tool also points to a `ui://` resource; the host loads that HTML into a sandboxed iframe next to Claude's reply and feeds it the tool's data.

```
Claude or ChatGPT                    Your MCP App server
┌──────────────────────┐   1   ┌─────────────────────────┐  2  ┌─────────────┐
│ Chat (Claude's reply)│──────▶│ Tool: get_forecast      │────▶│ Open-Meteo  │
│          │4          │       │ text + structured data  │     │ weather APIs│
│ Sandboxed iframe     │   3   │ UI resource             │     └─────────────┘
│ (your Forecast view) │──────▶│ ui://weather/forecast.html│
└──────────────────────┘       └─────────────────────────┘
        └── 5: a button in the view calls the tool again ──┘
```

1. The host calls your tool, e.g. `get_forecast` for Jaipur
2. Your server fetches Open-Meteo and returns text plus structured data
3. The tool's `_meta.ui.resourceUri` tells the host which `ui://` page to load; your server returns it as one bundled HTML file
4. The host passes the tool result into the view, which draws the cards
5. When the user taps "7 days", the view calls the tool again through the host; no direct network calls from the view

Source: MCP Apps README; the spec is stable as of 2026-01-26.

## UI screens

Build four views, one per main tool; `search_location` needs no UI because Claude simply asks which place you meant. Start with the Forecast view, since it is the one users will see most.

| View | Shown by tool | What the user sees | Interactions |
|---|---|---|---|
| Current weather card | `get_current_weather` | Place name, big temperature, condition icon, feels-like, humidity, wind | Refresh button; °C / °F toggle |
| Forecast view | `get_forecast` | One row or card per day: icon, max/min, rain chance; small temperature line chart | 3 / 7 / 16 day tabs (calls the tool again); tap a day for hourly detail |
| Air quality gauge | `get_air_quality` | AQI number on a coloured gauge with category label, PM2.5 and PM10 | Today / next 3 days switch |
| History chart | `get_historical_weather` | Bar chart of daily rain or line chart of temperature for the chosen dates | Rain / temperature toggle |

**Design rules for every view**

- Fit the chat: about 600 px wide, readable on mobile, no page scroll inside the card
- Follow the host's light or dark theme
- Never say good or bad with colour alone; always print the label ("AQI 182 · Unhealthy")
- Footer on every view: "Weather data by Open-Meteo.com" with a link
- Use emoji or inline SVG icons for weather codes; no external image hosts, to keep the CSP simple

## Tech stack and project structure

Use the official MCP Apps SDK with React for the views; each view builds into one self-contained HTML file the server hands to the host.

| Layer | Choice |
|---|---|
| Server | TypeScript, Node.js 20+, `@modelcontextprotocol/server` 2.x with `/node` and `/express` |
| App extension | `@modelcontextprotocol/ext-apps`: `/server` helpers on the server, `App` class or `/react` hooks in the views |
| Views | React + Vite, bundled with `vite-plugin-singlefile` into one HTML file each |
| Charts | Inline SVG or a small library bundled into the view (no CDN) |
| Validation | zod 4.2+ |
| Tests | vitest, ext-apps `basic-host` for local UI testing |
| Hosting | Docker on Render or Railway, public HTTPS |

```
weather-mcp-app/
├── CLAUDE.md
├── server/
│   ├── src/
│   │   ├── index.ts        # Express, POST /mcp, GET /health
│   │   ├── server.ts       # registers tools + ui:// resources
│   │   ├── openmeteo/      # client, geocoding, weather codes, cache
│   │   └── tools/          # one file per tool
│   └── package.json
├── shared/
│   └── contracts.ts        # types shared by server and views
├── views/
│   ├── src/
│   │   ├── current/        # Current weather card
│   │   ├── forecast/       # Forecast view
│   │   ├── air-quality/    # AQI gauge
│   │   ├── history/        # History chart
│   │   └── shared/         # theme, icons, attribution footer
│   └── vite.config.ts      # singlefile build → dist/*.html
├── Dockerfile
└── README.md
```

If you already followed the connector guide, keep `server/` as it is and add `views/` plus the resource registration.

## Data contracts

These are the exact tool names, inputs and outputs; the server and the views must both follow them, so put the types in one shared file, `shared/contracts.ts`, imported by both.

| Tool | View (`ui://` resource) | Open-Meteo call |
|---|---|---|
| `search_location` | none | `geocoding-api.open-meteo.com/v1/search?name=&count=&language=en` |
| `get_current_weather` | `ui://weather/current.html` | `api.open-meteo.com/v1/forecast` with `current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,is_day` |
| `get_forecast` | `ui://weather/forecast.html` | same endpoint with `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max` and `forecast_days`; hourly detail adds `hourly=temperature_2m,precipitation_probability,weather_code` with `start_date` / `end_date` |
| `get_air_quality` | `ui://weather/air-quality.html` | `air-quality-api.open-meteo.com/v1/air-quality` with `current=us_aqi,pm2_5,pm10` and `hourly=us_aqi` |
| `get_historical_weather` | `ui://weather/history.html` | `archive-api.open-meteo.com/v1/archive` with `daily=temperature_2m_max,temperature_2m_min,precipitation_sum` |

All calls send `timezone=auto`. Verify parameter names against the [Open-Meteo docs](https://open-meteo.com/en/docs) in Phase 2.

```ts
// shared/contracts.ts

// ---------- Inputs ----------
// Every weather tool accepts EITHER city OR latitude+longitude (validate with zod refine).
export interface LocationInput {
  city?: string;          // 2–100 chars, e.g. "Jaipur" or "Noida, India"
  latitude?: number;      // -90..90
  longitude?: number;     // -180..180
}
export type Units = "metric" | "imperial"; // default "metric" (°C, km/h, mm)

export interface SearchLocationInput { name: string; count?: number }
// count 1–5, default 3
export interface CurrentWeatherInput extends LocationInput { units?: Units }
export interface ForecastInput extends LocationInput {
  days?: number;             // 1–16, default 7
  hourly_for_date?: string;  // optional YYYY-MM-DD within the forecast range → adds hourly detail
  units?: Units;
}
export interface AirQualityInput extends LocationInput { days?: number }
// 1–5, default 1
export interface HistoricalInput extends LocationInput {
  start_date: string;        // YYYY-MM-DD
  end_date: string;          // YYYY-MM-DD, >= start_date, range <= 366 days, not in the future
  units?: Units;
}

// ---------- Shared output pieces ----------
export interface Place {
  name: string; admin1?: string; country: string; country_code: string;
  latitude: number; longitude: number; timezone: string;
}
export interface Attribution { text: "Weather data by Open-Meteo.com"; url: "https://open-meteo.com" }

// ---------- structuredContent per tool ----------
export interface SearchLocationResult { results: Place[] }

export interface CurrentWeatherResult {
  place: Place; units: Units; observed_at: string; // local ISO time
  temperature: number; apparent_temperature: number; humidity: number;
  wind_speed: number; wind_direction: number; precipitation: number;
  weather_code: number; condition: string; is_day: boolean;
  attribution: Attribution;
}

export interface ForecastDay {
  date: string; weather_code: number; condition: string;
  temp_max: number; temp_min: number; precipitation_sum: number;
  precipitation_probability_max: number | null;
  sunrise: string; sunset: string; uv_index_max: number | null;
}
export interface HourlyPoint { time: string; temperature: number; precipitation_probability: number | null; weather_code: number; condition: string }
export interface ForecastResult {
  place: Place; units: Units; days: ForecastDay[];
  hourly?: { date: string; hours: HourlyPoint[] };
  attribution: Attribution;
}

export type AqiCategory = "Good" | "Moderate" | "Unhealthy for sensitive groups" | "Unhealthy" | "Very unhealthy" | "Hazardous";
export interface AirQualityResult {
  place: Place;
  current: { time: string; us_aqi: number; category: AqiCategory; pm2_5: number; pm10: number };
  daily: { date: string; us_aqi_max: number; category: AqiCategory }[]; // from hourly us_aqi
  attribution: Attribution;
}

export interface HistoricalResult {
  place: Place; units: Units; start_date: string; end_date: string;
  days: { date: string; temp_max: number; temp_min: number; precipitation_sum: number }[];
  totals: { precipitation_sum: number; temp_max_avg: number; temp_min_avg: number };
  attribution: Attribution;
}

// ---------- Errors (isError: true) ----------
export type ErrorCode = "LOCATION_NOT_FOUND" | "AMBIGUOUS_LOCATION" | "INVALID_INPUT" | "UPSTREAM_UNAVAILABLE";
export interface ToolError { error: { code: ErrorCode; message: string; alternatives?: Place[] } }
```

**Other fixed values**

| Item | Value |
|---|---|
| US AQI bands | 0–50 Good · 51–100 Moderate · 101–150 Unhealthy for sensitive groups · 151–200 Unhealthy · 201–300 Very unhealthy · 301+ Hazardous |
| Ambiguous city rule | If the top two geocoding results are in different countries or regions and the user gave no country, return `AMBIGUOUS_LOCATION` with up to 3 alternatives |
| Cache TTL | Geocoding 7 days · current 10 min · forecast 15 min · air quality 30 min · historical 24 h |
| Tool annotations | `readOnlyHint: true`, `openWorldHint: true` on all five tools |
| Text summary length | At most 8 lines; first line names the resolved place and country |

## Phase 1 — Scaffold the project

**Goal:** an empty but runnable MCP server, with the folder layout, scripts and rules in place.

**Read first:** the README of `@modelcontextprotocol/server` 2.x and the [MCP Apps quickstart](https://apps.extensions.modelcontextprotocol.io/api/documents/quickstart.html) (for the server setup it uses).

**Do:**

1. Create an npm workspaces repo with three packages: `server`, `views`, `shared` (layout in "Tech stack and project structure", plus `shared/contracts.ts` from "Data contracts").
2. Root `package.json` scripts: `dev` (views watch + server watch together), `build` (views first, then server), `test`, `lint`, `start`.
3. Server dependencies: `@modelcontextprotocol/server@^2`, `@modelcontextprotocol/node@^2`, `@modelcontextprotocol/express@^2`, `@modelcontextprotocol/ext-apps`, `express`, `cors`, `zod@^4.2`, `pino`. Dev: `typescript`, `tsx`, `vitest`, `eslint`, `prettier`, type packages.
4. `server/src/config.ts`: zod-validated env — `PORT` (default 3001), `LOG_LEVEL` (default `info`), `DAILY_UPSTREAM_LIMIT` (default 9000). Write `.env.example`.
5. `server/src/index.ts`: Express app; `POST /mcp` using Streamable HTTP in stateless mode with CORS; `GET /health` returning `{ "status": "ok", "version": "<package version>" }`; a `--stdio` flag that runs over stdio instead.
6. `server/src/server.ts`: `createServer()` builds the MCP server named `open-meteo-weather` and registers one tool `ping` returning `pong`.
7. Write `CLAUDE.md` with the "Rules for Claude Code" above, the commands, and the folder layout. Add `.gitignore`, base `tsconfig.json` (strict), ESLint and Prettier configs, `README.md` stub.

**Done when:**

- [ ] `npm run dev` starts the server on port 3001
- [ ] `curl localhost:3001/health` returns status ok
- [ ] `npx @modelcontextprotocol/inspector` connects to `http://localhost:3001/mcp` and `ping` returns `pong`
- [ ] `npm run build`, `npm test`, `npm run lint` all pass

## Phase 2 — Open-Meteo client and location resolver

**Goal:** reliable, cached, tested functions for every Open-Meteo call; no MCP code yet.

**Read first:** [Open-Meteo API docs](https://open-meteo.com/en/docs) for forecast, geocoding, air quality and historical; confirm every parameter in "Data contracts".

**Do (all in `server/src/openmeteo/`):**

1. `client.ts` — `fetchJson(url)`: 10 s timeout (AbortController); 2 retries with 300 ms then 900 ms backoff on network errors, 5xx and 429; no retry on other 4xx; on final failure throw `UpstreamError` (maps to `UPSTREAM_UNAVAILABLE`). Increments the usage counter on every real request.
2. `geocoding.ts`, `forecast.ts`, `airQuality.ts`, `archive.ts` — one typed function per endpoint, building URLs with `URLSearchParams`, always `timezone=auto`. For `units: "imperial"` add `temperature_unit=fahrenheit`, `wind_speed_unit=mph`, `precipitation_unit=inch`.
3. `resolveLocation.ts` — input `LocationInput`; output `Place`. City: geocode with `count=5`, apply the ambiguous-city rule, throw `LocationNotFound` when empty. Coordinates: skip geocoding; name = `"28.54, 77.39"` style, country and country_code empty strings, timezone from the weather response.
4. `weatherCodes.ts` — map every WMO code Open-Meteo uses (0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99) to `{ condition: string, icon: string }`; unknown codes → "Unknown".
5. `aqi.ts` — `aqiCategory(n)` using the bands in "Data contracts".
6. `cache.ts` — in-memory TTL cache, max 1,000 entries, least-recently-used eviction; TTLs from "Data contracts"; key = full request URL.
7. `usage.ts` — daily upstream request counter, resets at 00:00 UTC; logs a warning at 80% of `DAILY_UPSTREAM_LIMIT`.
8. Tests in `server/test/` with mocked `fetch` and JSON fixtures in `server/test/fixtures/` (capture one real response per endpoint for Jaipur).
9. `npm run smoke` — script that calls the real APIs for Jaipur and prints a one-line result per endpoint.

**Done when:**

- [ ] Unit tests cover: retry then success, retry exhausted, timeout, no retry on 400, cache hit avoids fetch, ambiguous city, not found, imperial units, every AQI band edge (50, 51, 100, 101, 150, 151, 200, 201, 300, 301)
- [ ] `npm run smoke` prints real data for all four endpoints

## Phase 3 — The five tools (text output, no UI yet)

**Goal:** all five tools working in any MCP client, returning text plus `structuredContent` exactly as in "Data contracts".

**Do (one file per tool in `server/src/tools/`):**

1. Each file exports: the zod input schema (with `.describe()` on every field), the description, and the handler. Register them in `server.ts` with the standard tool registration for now; Phase 4 switches the four UI tools to `registerAppTool`. Remove `ping`.
2. Use these descriptions exactly:
   - `search_location`: "Find places matching a name and return their coordinates. Use when a location is unclear or ambiguous, before calling a weather tool."
   - `get_current_weather`: "Current weather right now for a city or coordinates: temperature, feels-like, humidity, wind, precipitation and conditions."
   - `get_forecast`: "Daily weather forecast for 1 to 16 days for a city or coordinates, with optional hourly detail for one date. Use for any question about future weather, such as rain this weekend."
   - `get_air_quality`: "Current US AQI with PM2.5 and PM10 for a city or coordinates, plus a daily AQI forecast for up to 5 days."
   - `get_historical_weather`: "Past daily temperatures and rainfall for a city or coordinates between two dates, up to 366 days. Use for weather that already happened."
3. Set annotations `readOnlyHint: true`, `openWorldHint: true` and a human `title` on each tool.
4. Text summary rules: first line = place and country; then the key numbers with units; at most 8 lines; last line = "Weather data by Open-Meteo.com". Example for `get_forecast`:
   ```
   Jaipur, Rajasthan, India — 3-day forecast
   Sat 15 Nov: 31°C / 19°C, light rain, 60% chance
   Sun 16 Nov: 29°C / 18°C, clear sky, 5% chance
   Mon 17 Nov: 30°C / 18°C, partly cloudy, 10% chance
   Weather data by Open-Meteo.com
   ```
5. Errors: catch `LocationNotFound`, ambiguity, zod and upstream errors; return `isError: true` with a one-line text message and `structuredContent` shaped as `ToolError`. For `AMBIGUOUS_LOCATION` the text lists the alternatives so Claude can ask the user.
6. Integration tests: connect an in-memory MCP client to `createServer()` and call every tool with mocked Open-Meteo responses, including each error code.

**Done when:**

- [ ] In MCP Inspector each tool works for "Jaipur", "Noida, India" and coordinates 28.54 / 77.39
- [ ] "Springfield" returns `AMBIGUOUS_LOCATION` with alternatives; "Xyzabc" returns `LOCATION_NOT_FOUND`
- [ ] After `claude mcp add --transport http weather http://localhost:3001/mcp`, Claude Code answers all test prompts in "Testing" correctly in text
- [ ] Build, test and lint pass

## Phase 4 — Wire up MCP Apps with placeholder views

**Goal:** prove the full UI pipeline end to end before building real screens: each UI tool opens its own view in a host.

**Read first:** the [MCP Apps quickstart](https://apps.extensions.modelcontextprotocol.io/api/documents/quickstart.html), the server-helpers and `App` API pages, the spec (2026-01-26) and the ext-apps `examples/basic-server-react`. Report any difference from this phase before coding.

**Do:**

1. `views/`: React + Vite + `vite-plugin-singlefile`. One HTML entry per view: `current.html`, `forecast.html`, `air-quality.html`, `history.html`. The build loops over the entries (as the quickstart does with an `INPUT` variable) and writes `views/dist/<name>.html`, each fully self-contained.
2. Each view for now: connect with the `App` class (or the `/react` hook), set the tool-result handler **before** `connect()`, and print the received `structuredContent` as formatted JSON.
3. `server/src/ui.ts`: at startup read the four built HTML files (fail fast with a clear message if any is missing) and register each with `registerAppResource` under its `ui://weather/<name>.html` URI and `RESOURCE_MIME_TYPE`. Declare the strictest content-security settings the spec allows: views load nothing from the network.
4. Switch `get_current_weather`, `get_forecast`, `get_air_quality` and `get_historical_weather` to `registerAppTool`, each with `_meta.ui.resourceUri` set to its view. `search_location` stays a plain tool.
5. Add a `test:host` README section: clone `modelcontextprotocol/ext-apps`, `npm install`, `npm start` in `examples/basic-host`, open `http://localhost:8080`.

**Done when:**

- [ ] In `basic-host`, each of the four tools opens its placeholder view showing the right JSON
- [ ] The server's resource list shows the four `ui://weather/…` resources
- [ ] Claude Code (text-only client) still gets the same text answers as in Phase 3

## Phase 5 — Shared view kit

**Goal:** one set of building blocks so all four views look and behave the same.

**Do (in `views/src/shared/`):**

1. `useWeatherApp<T>()` hook: creates the `App` once, registers the tool-result handler before connecting, validates `structuredContent` against the matching contract type, and returns `{ data, error, loading, callTool(name, args) }`. `callTool` sets `loading` and replaces `data` with the new result.
2. Theme: follow the host's styles and light/dark mode using the SDK's host-style helpers; fall back to `prefers-color-scheme`. Define colours as CSS variables; never hard-code text colours in components.
3. Components: `Card`, `Header` (place name, admin1, country), `Tabs`, `WeatherIcon` (WMO code → emoji with `aria-label` = condition), `UnitToggle` (°C/°F), `LoadingState`, `ErrorState` (shows `message`; for `AMBIGUOUS_LOCATION` renders alternatives as buttons), `AttributionFooter` ("Weather data by Open-Meteo.com", link opens in a new tab via the host if the SDK provides it).
4. `format.ts`: local date and weekday labels, temperatures with unit, wind direction degrees → compass text (N, NE …), percentages.
5. Layout: width 320–600 px, no horizontal page scroll (except the hourly strip), system font stack, text at least 13 px, contrast at least 4.5:1, all buttons keyboard-reachable.
6. `npm run preview:views` — a local page rendering every view with fixture data in light and dark side by side, for fast visual checks without a host.

**Done when:**

- [ ] Unit tests for the hook (result, error, callTool) and every formatter
- [ ] Preview page shows all shared components in both themes

## Phase 6 — Forecast view

**Goal:** the main screen, fully interactive. Uses `ForecastResult`.

**Layout, top to bottom:**

1. `Header` + subtitle "N-day forecast" + `UnitToggle`.
2. `Tabs`: 3 · 7 · 16 days; the active tab equals `days.length`.
3. Inline SVG line chart: max (solid) and min (dashed) temperature per day, value labels at the first and last point, weekday labels on the x-axis.
4. Day list, one row per day: weekday and date, `WeatherIcon`, condition, max / min, rain chance as a number plus a small bar. Today's row is highlighted and labelled "Today".
5. Hourly strip (only when `hourly` is present): horizontally scrolling items for each hour — time, icon, temperature, rain chance.
6. `AttributionFooter`.

**Interactions** (always call with the resolved `latitude` / `longitude` from `place`, never the city name, to skip re-geocoding):

- Tab click → `get_forecast` with the new `days`; tabs disabled while loading
- Day row click → `get_forecast` with `hourly_for_date` = that date; the row stays selected
- Unit toggle → `get_forecast` with the other `units`
- Error → `ErrorState`; alternatives buttons call `get_forecast` with that place's coordinates

**Done when:**

- [ ] Component tests with fixtures for 3, 7 and 16 days, hourly present and absent, and each error code
- [ ] In `basic-host`: every tab, day click and unit toggle works; looks right at 320 px and 600 px, light and dark

## Phase 7 — Current weather, air quality and history views

**Goal:** the remaining three views, built with the shared kit and the same quality bar as Phase 6. One view per Claude Code session.

**Current weather card** (`CurrentWeatherResult`)

- Big temperature and `WeatherIcon`; condition; "Feels like"; humidity; wind speed with compass direction; precipitation; "Updated <local time>"
- Night styling when `is_day` is false
- Refresh button and unit toggle → `get_current_weather` with the same coordinates

**Air quality gauge** (`AirQualityResult`)

- Semicircle SVG gauge from 0 to 500 with the six AQI bands; needle at `us_aqi`
- Large AQI number with its category printed next to it (never colour alone)
- PM2.5 and PM10 values with units (µg/m³)
- "Next 3 days" button → `get_air_quality` with `days: 3`; then show one chip per day with max AQI and category

**History chart** (`HistoricalResult`)

- Default: bar chart of daily rainfall; toggle to a line chart of max/min temperature
- Ranges over 62 days: show monthly totals (rain) or monthly averages (temperature) instead of daily marks
- Totals row: total rain, average max, average min
- Date axis labels thinned so they never overlap

**Done when:**

- [ ] Component tests with fixtures for each view and each error code
- [ ] In `basic-host`, every control works; 320 px and 600 px; light and dark
- [ ] Claude web or desktop (via a tunnel such as `cloudflared` to your local server, added as a custom connector) renders all four views for the test prompts

## Phase 8 — Hardening

**Goal:** safe to leave running in public.

**Do:**

1. Rate limit `POST /mcp` per IP: 60 requests per minute, 429 with a clear message.
2. Request body limit 100 KB; reject anything else on unknown routes with 404.
3. Structured logs (pino) per tool call: request ID, tool name, latency, cache hit or miss, error code. Never log full request bodies.
4. Graceful shutdown on SIGTERM: stop accepting requests, finish in-flight ones, exit within 10 s.
5. When the daily upstream counter reaches `DAILY_UPSTREAM_LIMIT`, serve cached data only and return `UPSTREAM_UNAVAILABLE` for cache misses until midnight UTC.
6. Check each view's built HTML size (report it; aim under 300 KB) and run an accessibility pass: labels, contrast, focus order.
7. Security review of the server and views; list findings and fix them.

**Done when:**

- [ ] Tests for rate limiting, body limit, daily limit fallback
- [ ] A findings list with every item fixed or explicitly accepted by me

## Phase 9 — Deploy

**Goal:** a stable public HTTPS URL that hosts can reach.

**Do:**

1. Multi-stage `Dockerfile`: install, build views, build server, then a slim runtime image running as a non-root user; `CMD node server/dist/index.js`.
2. `render.yaml` (or Railway config) with health check `/health` and the env vars from `.env.example`.
3. README section "Deploy": exact dashboard steps for connecting the GitHub repo, setting env vars and adding a custom domain such as `weather-mcp.yourdomain.com`.
4. Note in README: free hosting tiers may sleep when idle; the first request can then take 30–60 s.

**Done when:**

- [ ] `docker build` and `docker run` work locally; `/health` returns ok from the container
- [ ] The deployed `https://…/mcp` works in Claude (Customize → Connectors → Add custom connector) and renders all four views
- [ ] The same URL works in ChatGPT developer mode and renders the views

## Phase 10 — Submission package

**Goal:** everything needed to list the app publicly; follow the current OpenAI and Anthropic docs, as requirements change.

**Do:**

1. `docs/listing.md`: display name ("Open-Meteo Weather"), one-line and long descriptions, category, developer name, 4 default prompts, tool list with descriptions.
2. `docs/test-cases.md`: exactly 5 positive and 3 negative cases, each with prompt, expected tool, and what the reviewer should see. Use the prompts in "Testing" for positives; negatives: unknown city, a date range over 366 days, a non-weather request ("book a flight") that should not call any tool.
3. Draft `plugin.json` and `mcp.json` for the ChatGPT ZIP from OpenAI's current docs; no secrets in either.
4. Static pages served by the same server: `/privacy` (no personal data stored, no tracking), `/terms` (free, non-commercial, data as-is), `/support` (contact email placeholder), plus the Open-Meteo attribution.
5. If asked for domain verification, serve the token as plain text at `/.well-known/openai-apps-challenge`, read from an env var.
6. `docs/video-script.md`: a 2-minute walkthrough covering all four views.
7. App icon: a simple 512×512 PNG placeholder I will replace.

**Done when:**

- [ ] All files above exist and `/privacy`, `/terms`, `/support` load on the deployed URL
- [ ] A checklist of anything I must do by hand (verification, screenshots, video, submission)

## Testing in Claude, ChatGPT and other hosts

Test the UI in `basic-host` first, then in real hosts from the most to the least forgiving; a view that works in two hosts usually works everywhere.

| Host | How to connect | Check |
|---|---|---|
| ext-apps `basic-host` | Clone the ext-apps repo, `npm start` in `examples/basic-host`, open `localhost:8080` | View renders, buttons call tools |
| Claude web / desktop | Customize → Connectors → Add custom connector → your `/mcp` URL | Cards appear inline; theme matches; Claude's text answer agrees with the card |
| ChatGPT | Enable Developer mode, then add the `/mcp` URL as a custom app connection (for development only) | Same views render; tool scan shows no warnings |
| VS Code or Goose | Add the server URL in MCP settings | Fallback text is clear where UI is limited |
| Cursor / Claude Code | `claude mcp add --transport http weather <url>` | Text-only output still answers the question |

**Test prompts for every host**

- "Show me the 7-day forecast for Jaipur" → Forecast view, then tap the 16-day tab
- "What's the weather in Noida right now?" → Current weather card
- "How bad is the air in Delhi today?" → AQI gauge with label
- "Chart the rain in Mumbai for July 2025" → History chart
- "Weather in Springfield" → Claude asks which one, no broken card
- "Weather in Xyzabc" → friendly not-found message, no empty card

## Publishing

You can use the app privately in Claude and ChatGPT as soon as it is deployed; public listing needs a review in each store, which you start after the app has run reliably for a week or two.

**ChatGPT (public listing)** — per a July 2026 walkthrough, submission now starts from a plugin ZIP; check OpenAI's current docs before you submit.

- [ ] Verified publisher identity (individual or business) with Owner or Apps Management Write permission
- [ ] ZIP with `plugin.json` (listing details) and `mcp.json` (server name, transport, URL) at its root
- [ ] Listing: display name, descriptions, developer name, category, default prompts, app icon
- [ ] Working HTTPS website, support, privacy policy and terms URLs
- [ ] Stable public HTTPS MCP endpoint; auth none or OAuth only (none fits this app)
- [ ] Domain verification token at `/.well-known/openai-apps-challenge` if asked
- [ ] Tool scan issues resolved
- [ ] Exactly 5 positive and 3 negative test cases with expected tools and visible results
- [ ] Video walkthrough and release notes
- [ ] After approval, click **Publish plugin**; the server is scanned daily afterwards

**Claude (public listing)**

- [ ] Same app works privately as a custom connector first
- [ ] Submit to Anthropic's Connectors Directory and follow its current review requirements

**Before either store**

- [ ] Commercial use: Open-Meteo is free only for non-commercial use, so keep the app free or contact Open-Meteo first
- [ ] Attribution visible in every view

## Risks

| Risk | Fallback |
|---|---|
| SDK APIs change (ext-apps 2.x is new) | Ask Claude Code to read the latest quickstart and examples in Phases 4–7; the wire protocol is stable across 1.x and 2.x |
| A view looks different in ChatGPT vs Claude | Test both after every view; keep layout simple, follow host theme |
| Store review asks for changes | Prepare test cases and video in Phase 10; fix and resubmit quickly |
| Usage grows past Open-Meteo fair use | Caching first; then contact Open-Meteo or self-host it |

## Sources

- [MCP Apps README (ext-apps 2.0.0)](https://github.com/modelcontextprotocol/ext-apps) — packages, supported hosts, basic-host
- [MCP Apps quickstart](https://apps.extensions.modelcontextprotocol.io/api/documents/quickstart.html) — registerAppTool, registerAppResource, App class, singlefile build
- ChatGPT full support for MCP Apps
- Submitting a ChatGPT app as a plugin — ZIP, checklist, test cases
- [Open-Meteo GitHub](https://github.com/open-meteo/open-meteo) — terms and attribution
