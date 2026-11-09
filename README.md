# Open-Meteo Weather — MCP App

Weather tools for Claude, ChatGPT and other [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) hosts.
Each tool answers in text and shows an interactive card (forecast, current conditions, air quality, history).

Weather data by [Open-Meteo.com](https://open-meteo.com). Free and non-commercial.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3001/mcp  ·  http://localhost:3001/health
```

```bash
npm run build && npm start              # production build over HTTP
node server/dist/index.js --stdio       # or over stdio
```

Configuration (see `.env.example`): `PORT` (3001), `LOG_LEVEL` (info), `DAILY_UPSTREAM_LIMIT` (9000).

## Development

`npm test` · `npm run lint` · `npm run build`. See `CLAUDE.md` for the rules and layout and
`docs/BUILD_PLAN.md` for the full plan.

## test:host — try the views in basic-host

The ext-apps repo ships `basic-host`, a minimal MCP Apps host for local UI testing.

```bash
npm run dev                                   # this server on http://localhost:3001/mcp

git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps && npm install
cd examples/basic-host && npm start           # open http://localhost:8080
```

basic-host connects to `http://localhost:3001/mcp` by default. Pick a tool (e.g. `get_forecast`),
enter input such as `{"city": "Jaipur", "days": 7}` and press **Call Tool**; the view renders below.

> Tip: if the full clone is slow, a sparse checkout of `examples/basic-host` works when you also
> `npm install -D cross-env` there and run `INPUT=index.html npx vite build && INPUT=sandbox.html npx vite build && bun serve.ts`.
