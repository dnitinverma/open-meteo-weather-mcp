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
