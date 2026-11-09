# Phase 8 — security and accessibility review

Scope: `server/` and `views/` at the end of Phase 8. Method: code review, targeted greps
(network/DOM-injection APIs, `fetch`, external URLs, `console.*`, `process.env`), `npm audit`,
automated tests, axe-core and a real-browser keyboard pass in `basic-host`.

## Findings

| #   | Finding                                                                                     | Severity | Status                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | No request-size limit on `POST /mcp`                                                        | Medium   | **Fixed** — 100 KB limit, clean `413` JSON error (test)                                                                                                                                                                                       |
| F2  | No rate limiting                                                                            | Medium   | **Fixed** — 60 req/min/IP, `429` + `Retry-After`; in-memory, key count bounded; IPs never logged                                                                                                                                              |
| F3  | `X-Powered-By` exposed; no `nosniff` / `Referrer-Policy`                                    | Low      | **Fixed**                                                                                                                                                                                                                                     |
| F4  | Body-parser errors would fall to Express's default handler (stack traces in non-production) | Medium   | **Fixed** — JSON-RPC error handler returns generic messages only (test)                                                                                                                                                                       |
| F5  | Slow or hung requests could hold connections                                                | Low      | **Fixed** — `requestTimeout` 30 s, `headersTimeout` 15 s                                                                                                                                                                                      |
| F6  | Upstream budget could be exhausted by traffic                                               | Medium   | **Fixed** — at `DAILY_UPSTREAM_LIMIT` only cached data is served; misses return `UPSTREAM_UNAVAILABLE` until 00:00 UTC; no retries (tests)                                                                                                    |
| F7  | Abrupt shutdown dropped in-flight requests                                                  | Low      | **Fixed** — SIGTERM stops accepting, finishes in-flight, force-closes after the deadline; built server exits in ~14 ms idle                                                                                                                   |
| F8  | Logs lacked a per-call trail                                                                | Info     | **Fixed** — one structured line per tool call: request id, tool, latency, cache hit/miss/partial/none, error code. Arguments, bodies and IPs are never logged (test)                                                                          |
| F9  | Host-header (DNS-rebinding) protection unavailable on the public bind                       | Low      | **Fixed (opt-in)** — `ALLOWED_HOSTS` env enables it. See A2                                                                                                                                                                                   |
| F10 | Upstream error text could reach clients                                                     | Medium   | **Verified** — only generic messages are returned; reasons are logged server-side (tests since Phase 3)                                                                                                                                       |
| F11 | Views: XSS / network / storage access                                                       | —        | **Verified clean** — no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `fetch`, `XMLHttpRequest`, `WebSocket`, storage or cookies in `views/src`; no external URLs; resource CSP declares no origins; place names are rendered as React text |
| F12 | SSRF                                                                                        | —        | **Verified clean** — Open-Meteo URLs are built from four fixed hosts with `URLSearchParams`; only `openmeteo/client.ts` calls `fetch`                                                                                                         |
| F13 | Dependencies                                                                                | —        | **0 vulnerabilities in production dependencies** (`npm audit --omit=dev`). See A3                                                                                                                                                             |

## Needs your decision

These are not fixed on purpose. Each is proposed as **accepted**; reply to confirm or ask for a change.

| #   | Item                                                                                                                     | Why it is proposed as acceptable                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `Access-Control-Allow-Origin: *`                                                                                         | The server has no cookies, sessions or auth and serves public, read-only data, so a cross-origin page gains nothing it could not fetch directly.                                                                                                                                                                       |
| A2  | Host-header validation is **off by default**                                                                             | The public hostname is only known at deploy time, and a platform health check may send an internal `Host` (validation also applies to `/health`). With no auth or cookies, DNS rebinding exposes nothing. Set `ALLOWED_HOSTS` once the domain is fixed if you want it. The SDK prints a warning about this at startup. |
| A3  | `npm audit` lists 10 _moderate_ issues, all in the **ESLint toolchain** (`minimatch` via `eslint` / `typescript-eslint`) | Dev-only; none ship in the Docker image or the views. The suggested fix downgrades ESLint (breaking). Revisit when ESLint updates.                                                                                                                                                                                     |
| A4  | Built views are ~470 KB each (~134 KB gzipped), over the 300 KB aim                                                      | Dominated by `zod` and `@modelcontextprotocol/client`, which `ext-apps` itself requires, plus `react-dom`. Reducing it needs dropping React or the SDK's `App` class.                                                                                                                                                  |
| A5  | Rate limiter, cache and usage counter are **per process**                                                                | A single Render instance is assumed. Several instances would each allow 60/min per IP and keep separate caches and budgets.                                                                                                                                                                                            |
| A6  | Client IP relies on `TRUST_PROXY`                                                                                        | Too low behind a proxy puts all users in one bucket; too high lets clients spoof `X-Forwarded-For`. Phase 9 sets it to `1` for Render.                                                                                                                                                                                 |

## Accessibility pass

- **Labels / roles / ARIA** — axe-core (jsdom) reports 0 violations for current (day, night), forecast with hourly,
  air quality (3 days), history (daily and monthly), the ambiguous-location error and the loading state.
  Charts are `role="img"` with a text summary; icons carry `aria-label` = condition; tab-like controls use `aria-pressed`;
  errors use `role="alert"`; loading uses `role="status"`; day rows have full spoken labels.
- **Contrast** — computed from the fallback palette in `kit.css`, light and dark: every text pair is at least 4.5:1
  (tests fail if a token changes below that). When a host supplies its own style variables, contrast is the host's.
  Status is never conveyed by colour alone (AQI category and "Unhealthy" are printed; rain chance is a number).
- **Focus order** (real browser, forecast view): `°C → °F → 3 days → 7 days → 16 days → day rows → attribution link`,
  with a visible 2 px focus ring. The hourly strip is a focusable scroll region.
- **Not covered:** screen-reader testing with real assistive technology, and colour contrast under host-supplied themes.

## View sizes (built, single-file)

| View             | Size    | Gzipped |
| ---------------- | ------- | ------- |
| current.html     | ~471 KB | ~133 KB |
| air-quality.html | ~471 KB | ~133 KB |
| forecast.html    | ~476 KB | ~135 KB |
| history.html     | ~472 KB | ~134 KB |
