import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { escapeHtml, homePage, privacyPage, supportPage, termsPage } from "../src/pages.js";

const servers: Server[] = [];
async function listen(options: Parameters<typeof createApp>[0] = {}): Promise<string> {
  const server = createApp(options).listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((r) => server.once("listening", () => r()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe("static pages", () => {
  it.each(["/", "/privacy", "/terms", "/support"])(
    "%s loads with attribution, nav and a strict CSP",
    async (path) => {
      const base = await listen();
      const res = await fetch(base + path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      const html = await res.text();
      expect(html).toContain("Weather data by Open-Meteo.com");
      expect(html).toContain('href="https://open-meteo.com"');
      for (const link of ['href="/privacy"', 'href="/terms"', 'href="/support"'])
        expect(html).toContain(link);
    },
  );

  it("pages load nothing external and run no scripts", () => {
    for (const html of [homePage(), privacyPage("a@b.co"), termsPage(), supportPage("a@b.co")]) {
      expect(html).not.toMatch(/<script|<img|<iframe|<link |@import|src=/i);
    }
  });

  it("privacy says no personal data / tracking; terms say free, non-commercial, as is", () => {
    const privacy = privacyPage("a@b.co");
    expect(privacy).toMatch(/no accounts, no cookies, no analytics/);
    expect(privacy).toMatch(/do not log IP addresses/);
    const terms = termsPage();
    expect(terms).toMatch(/free of charge/);
    expect(terms).toMatch(/non-commercial/);
    expect(terms).toMatch(/<strong>as is<\/strong>/);
  });

  it("shows the configured support email, HTML-escaped", async () => {
    const base = await listen({ supportEmail: "help@example.org" });
    expect(await (await fetch(base + "/support")).text()).toContain("help@example.org");
    expect(supportPage('"><b>x</b>@e.co')).not.toContain("<b>x</b>");
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("does not shadow /mcp or /health", async () => {
    const base = await listen();
    expect((await fetch(base + "/health")).status).toBe(200);
    expect((await fetch(base + "/mcp")).status).toBe(405);
  });
});

describe("/.well-known/openai-apps-challenge", () => {
  it("serves exactly the configured token as plain text", async () => {
    const base = await listen({ challenge: "tok_ABC-123" });
    const res = await fetch(base + "/.well-known/openai-apps-challenge");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toBe("tok_ABC-123");
  });

  it("is 404 when no token is configured", async () => {
    const base = await listen({ challenge: "" });
    expect((await fetch(base + "/.well-known/openai-apps-challenge")).status).toBe(404);
  });
});
