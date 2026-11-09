# Open-Meteo Weather MCP App

An MCP App: an MCP server whose weather tools return text + `structuredContent` and also point to
`ui://` views (React, single-file HTML) that hosts like Claude and ChatGPT render inline.
Full plan: `docs/BUILD_PLAN.md` (phases, data contracts, done-when checks).

## Rules for Claude Code

1. TypeScript strict mode everywhere; Node.js 20+; ES modules.
2. All Open-Meteo HTTP calls go through `server/src/openmeteo/client.ts`; nothing else calls `fetch` to Open-Meteo.
3. Views never call the network directly; all data reaches a view through tool results or `callServerTool`.
4. Every tool returns both a short text summary (for Claude and for hosts without UI) and `structuredContent` matching "Data contracts" (`shared/contracts.ts`).
5. Every text output and every view shows "Weather data by Open-Meteo.com" with a link to https://open-meteo.com.
6. Never return stack traces or raw Open-Meteo responses to the client.
7. Units: °C, km/h, mm by default; times in the place's local timezone (`timezone=auto`).
8. Each phase ends with passing `npm test`, `npm run build` and `npm run lint`.
9. If the plan conflicts with the current SDK docs, follow the docs and say what changed.
10. This is a free, non-commercial app; do not add analytics, ads or user tracking.

## Commands

| Command                             | What it does                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`                       | Views build in watch mode + server (`tsx watch`) on http://localhost:3001                  |
| `npm run build`                     | Build views (`views/dist/*.html`), then typecheck + bundle server (`server/dist/index.js`) |
| `npm start`                         | Run the built server over HTTP (`node server/dist/index.js`)                               |
| `node server/dist/index.js --stdio` | Run over stdio instead of HTTP                                                             |
| `npm test`                          | Vitest (all projects)                                                                      |
| `npm run lint`                      | ESLint + Prettier check (`npm run format` to fix)                                          |
| `npm run typecheck`                 | `tsc --noEmit` in every workspace                                                          |

## Layout

```
├── CLAUDE.md
├── docs/BUILD_PLAN.md       # the build plan (source of truth)
├── shared/contracts.ts      # @weather/shared — types + constants shared by server and views
├── server/                  # @weather/server
│   ├── src/
│   │   ├── index.ts         # entry: HTTP (default) or --stdio
│   │   ├── app.ts           # Express: POST /mcp (stateless Streamable HTTP), GET /health
│   │   ├── server.ts        # createServer(): registers tools + ui:// resources
│   │   ├── config.ts        # zod-validated env (PORT, LOG_LEVEL, limits, TRUST_PROXY, ALLOWED_HOSTS)
│   │   ├── openmeteo/       # client, geocoding, weather codes, cache
│   │   └── tools/           # one file per tool
│   ├── test/                # vitest; fixtures in test/fixtures
│   └── build.mjs            # esbuild bundle → dist/index.js (npm deps external, @weather/shared inlined)
├── views/                   # @weather/views
│   ├── <name>.html          # one entry per view
│   ├── src/{current,forecast,air-quality,history,shared}/
│   ├── build.mjs            # runs Vite once per entry → dist/<name>.html (vite-plugin-singlefile)
│   └── vite.config.ts
├── Dockerfile               # multi-stage, non-root runtime
├── render.yaml              # Render Blueprint
└── README.md
```

## Notes

- SDK: `@modelcontextprotocol/server` v2 (MCP spec 2026-07-28) with `/node` + `/express` adapters;
  `@modelcontextprotocol/ext-apps` v2 (Apps spec 2026-01-26). ext-apps needs `@modelcontextprotocol/client@^2` as a peer.
- `registerTool` takes `inputSchema: z.object({...})` (raw shapes are deprecated in v2).
- TypeScript 6: `@types/*` aren't auto-included; `server/tsconfig.json` sets `"types": ["node"]`.
- Logs go to stderr (pino) so stdout stays clean for `--stdio`.
- Views: every card is a sky (`views/src/shared/sky.ts`: palette, which sky for which data, temperature colour scale). Ambient weather lives in `SkyAmbience.tsx` / `ambience.css`. Any colour change must keep `views/test/sky.test.ts` green (contrast against every sky, both themes), and every animation must stop under `prefers-reduced-motion`.
