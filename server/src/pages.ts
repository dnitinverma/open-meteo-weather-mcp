// Static pages served by the same server: landing page, /privacy, /terms, /support, plus the
// optional OpenAI domain-verification token. No scripts, no external resources, no cookies.
import type { Express, Request, Response } from "express";
import { ATTRIBUTION } from "@weather/shared";
import { config } from "./config.js";

export interface PagesOptions {
  supportEmail?: string;
  /** Token for /.well-known/openai-apps-challenge; "" disables the route. */
  challenge?: string;
}

export const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

/** Locked-down CSP for static pages: inline styles only, nothing else loads or runs. */
const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#18181b;--muted:#52525b;--link:#1d4ed8;--line:#d4d4d8}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1f;--fg:#f4f4f5;--muted:#a1a1aa;--link:#93c5fd;--line:#3f3f46}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:42rem;margin:0 auto;padding:2rem 1.25rem 3rem}
h1{font-size:1.75rem;line-height:1.25;margin:0 0 .5rem}h2{font-size:1.2rem;margin:2rem 0 .5rem}
a{color:var(--link)}nav{display:flex;flex-wrap:wrap;gap:1rem;margin:0 0 1.5rem;font-size:.95rem}
code{background:rgba(127,127,127,.18);padding:.1rem .35rem;border-radius:4px;font-size:.9em}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
footer a{color:var(--muted)}ul{padding-left:1.25rem}.muted{color:var(--muted)}
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${escapeHtml(title)} · Open-Meteo Weather</title>
<style>${STYLE}</style></head><body><main>
<nav aria-label="Pages"><a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></nav>
${body}
<footer><a href="${ATTRIBUTION.url}" rel="noopener noreferrer">${ATTRIBUTION.text}</a> · Free, non-commercial app.</footer>
</main></body></html>`;
}

export function homePage(): string {
  return layout(
    "Home",
    `<h1>Open-Meteo Weather</h1>
<p>Weather, air quality and history for any place, inside your AI chat. Each answer comes with an interactive card:
forecast, current conditions, air-quality gauge and rainfall or temperature charts.</p>
<h2>What it can do</h2>
<ul>
<li><strong>Forecast</strong>: 1 to 16 days, with hourly detail for any day.</li>
<li><strong>Current weather</strong>: temperature, feels-like, humidity, wind, precipitation.</li>
<li><strong>Air quality</strong>: US AQI with PM2.5 and PM10, up to 5 days ahead.</li>
<li><strong>History</strong>: daily temperatures and rainfall for any period up to 366 days.</li>
</ul>
<h2>Use it</h2>
<p>This is an MCP server. Add <code>/mcp</code> on this site's address as a custom connector in Claude, or as a custom app in
ChatGPT. No sign-in is needed.</p>
<p class="muted">Free and non-commercial. No accounts, no tracking. See the <a href="/privacy">privacy policy</a>
and <a href="/terms">terms</a>.</p>`,
  );
}

export function privacyPage(email: string): string {
  return layout(
    "Privacy policy",
    `<h1>Privacy policy</h1>
<p class="muted">Short version: we do not store personal data and we do not track you.</p>
<h2>What we collect</h2>
<p>Nothing that identifies you. There are no accounts, no cookies, no analytics, no advertising and no tracking.</p>
<h2>What happens when you ask for weather</h2>
<ul>
<li>The place name or coordinates in your request are sent to <a href="https://open-meteo.com" rel="noopener noreferrer">Open-Meteo.com</a>
to look up the weather. Open-Meteo has its own <a href="https://open-meteo.com/en/terms" rel="noopener noreferrer">terms and privacy practices</a>.</li>
<li>Results are cached in the server's memory for a short time (minutes to days) to reduce load. The cache is keyed by the
request, not by who asked, and is lost whenever the server restarts.</li>
<li>Server logs record only a random request ID, the tool name, how long it took, whether the cache was used and any error code.
They do not contain what you asked for, and we do not log IP addresses.</li>
<li>To enforce a rate limit, the server briefly counts requests per IP address in memory. These counts are never written to disk
and expire within a minute.</li>
</ul>
<h2>Hosting provider</h2>
<p>The server runs on a hosting platform. The platform's infrastructure may process technical data such as IP addresses in its own logs,
under its own policies. We do not have access to a user profile or any link between those logs and who you are.</p>
<h2>Children</h2>
<p>The service collects no personal data from anyone, including children.</p>
<h2>Contact</h2>
<p>Questions: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>. We will update this page if anything changes.</p>`,
  );
}

export function termsPage(): string {
  return layout(
    "Terms of use",
    `<h1>Terms of use</h1>
<h2>Free, non-commercial service</h2>
<p>Open-Meteo Weather is offered free of charge for personal, non-commercial use. It depends on the free
<a href="https://open-meteo.com/en/features#terms" rel="noopener noreferrer">Open-Meteo API</a>, which is free for non-commercial use only.
Please do not use this service for commercial purposes.</p>
<h2>Data as is</h2>
<p>Weather, air-quality and historical data are provided <strong>as is</strong>, without warranty of any kind. Forecasts can be wrong and the service
can be unavailable. Do not rely on it for decisions involving safety, health, travel or property. Check official local sources for warnings.</p>
<h2>Attribution</h2>
<p>Weather data by <a href="https://open-meteo.com" rel="noopener noreferrer">Open-Meteo.com</a>, used under
<a href="https://open-meteo.com/en/license" rel="noopener noreferrer">CC BY 4.0</a>.</p>
<h2>Fair use</h2>
<p>Requests are rate limited. Automated or excessive use may be blocked to keep the service available for everyone.</p>
<h2>Liability and changes</h2>
<p>To the extent permitted by law, we are not liable for any loss arising from use of the service. We may change or stop the service,
and these terms, at any time.</p>`,
  );
}

export function supportPage(email: string): string {
  return layout(
    "Support",
    `<h1>Support</h1>
<p>Questions, problems or feedback: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>.</p>
<h2>Common questions</h2>
<ul>
<li><strong>"Which place did you mean?"</strong> Several places share that name. Add a region or country, for example "Springfield, Illinois".</li>
<li><strong>The first answer is slow.</strong> On free hosting the server can sleep when idle; the first request may take up to a minute.</li>
<li><strong>"Weather service unavailable".</strong> The data provider or our daily request budget is temporarily unavailable. Try again later.</li>
<li><strong>No card appears.</strong> Some chat apps show text only. The text answer contains the same information.</li>
</ul>`,
  );
}

function sendHtml(res: Response, html: string): void {
  res.set("Content-Security-Policy", PAGE_CSP);
  res.set("Cache-Control", "public, max-age=3600");
  res.type("html").send(html);
}

export function registerPages(app: Express, options: PagesOptions = {}): void {
  const email = options.supportEmail ?? config.SUPPORT_EMAIL;
  const challenge = options.challenge ?? config.OPENAI_APPS_CHALLENGE;
  const pages: [string, string][] = [
    ["/", homePage()],
    ["/privacy", privacyPage(email)],
    ["/terms", termsPage()],
    ["/support", supportPage(email)],
  ];
  for (const [path, html] of pages)
    app.get(path, (_req: Request, res: Response) => sendHtml(res, html));

  if (challenge) {
    // Exactly the token, as plain text, nothing else.
    app.get("/.well-known/openai-apps-challenge", (_req: Request, res: Response) => {
      res.set("Cache-Control", "no-store");
      res.type("text/plain").send(challenge);
    });
  }
}
