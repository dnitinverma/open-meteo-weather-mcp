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

Configuration (see `.env.example`):

| Variable                | Default | Meaning                                                    |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `PORT`                  | 3001    | HTTP port                                                  |
| `LOG_LEVEL`             | info    | pino level                                                 |
| `DAILY_UPSTREAM_LIMIT`  | 9000    | Real Open-Meteo requests per UTC day; then cache-only      |
| `RATE_LIMIT_PER_MINUTE` | 60      | `POST /mcp` requests per IP per minute                     |
| `TRUST_PROXY`           | 0       | Reverse-proxy hops to trust for the client IP (hosting: 1) |
| `ALLOWED_HOSTS`         | –       | Optional Host allow-list (also applies to `/health`)       |

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

## Deploy

The repo ships a `Dockerfile` (multi-stage: install, build views, build server, slim non-root runtime
running `node server/dist/index.js`) and a `render.yaml` Blueprint for [Render](https://render.com).
Hosts need a public **HTTPS** URL; Render provides TLS automatically.

### Render, step by step

1. Push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com) click **New +** → **Blueprint**.
3. Connect your GitHub account if asked, select the repository, and click **Connect**.
4. Render reads `render.yaml` and shows one web service, `open-meteo-weather-mcp`. Click **Deploy Blueprint**.
   (Manual alternative: **New +** → **Web Service** → pick the repo → **Language: Docker** → set **Health Check Path** to `/health`.)
5. **Environment variables** — they come from `render.yaml`. To change one later: open the service →
   **Environment** → edit → **Save, rebuild, and deploy**. Do not set `PORT`; Render provides it (default 10000).
   Keep `TRUST_PROXY=1` so the per-IP rate limit sees real client IPs.
6. Wait for the first deploy to go **Live**, then open `https://<your-service>.onrender.com/health`.
   It returns `{"status":"ok","version":"…"}`. Your MCP endpoint is `https://<your-service>.onrender.com/mcp`.
7. **Custom domain** (e.g. `weather-mcp.yourdomain.com`): open the service → **Settings** → scroll to
   **Custom Domains** → **+ Add Custom Domain** → enter the domain → **Save**. At your DNS provider add a
   `CNAME` record: name `weather-mcp`, value `<your-service>.onrender.com`. Back in Render click **Verify**.
   Render issues the TLS certificate automatically; use `https://weather-mcp.yourdomain.com/mcp` from then on.
8. Add it to a host: Claude → **Customize → Connectors → Add custom connector** → paste the `/mcp` URL.
   ChatGPT: enable Developer mode, then add the URL as a custom app connection.

> **Free tier note:** free hosting tiers may sleep when idle. On Render a free web service spins down after
> 15 minutes without traffic, and the first request afterwards can take 30–60 s while it starts. Hosts may show
> a timeout on that first call; retrying works. A paid instance stays awake.

Dashboard labels change over time; if a step differs, follow Render's
[custom domains](https://render.com/docs/custom-domains) and [Blueprint](https://render.com/docs/blueprint-spec) docs.
Railway also works with the same `Dockerfile`: create a project from the GitHub repo, set `TRUST_PROXY=1`,
generate a domain under **Settings → Networking**, and use `/health` as the health check path.

### Run the image locally

```bash
docker build -t open-meteo-weather-mcp .
docker run --rm -p 3001:3001 open-meteo-weather-mcp
# http://localhost:3001/health  ·  http://localhost:3001/mcp
```
