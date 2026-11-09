import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { describe, expect, it } from "vitest";
import { loadViews, VIEW_UI_META } from "../src/ui.js";
import { connectClient } from "./helpers.js";

const URIS = [
  "ui://weather/air-quality.html",
  "ui://weather/current.html",
  "ui://weather/forecast.html",
  "ui://weather/history.html",
];

describe("ui:// resources", () => {
  it("lists the four views with the MCP Apps MIME type and strict CSP", async () => {
    const { client, close } = await connectClient();
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(URIS);
    for (const r of resources) {
      expect(r.mimeType).toBe(RESOURCE_MIME_TYPE);
      expect(r._meta?.ui).toEqual(VIEW_UI_META);
    }
    await close();
  });

  it("reads each view as HTML with CSP metadata on the content item", async () => {
    const { client, close } = await connectClient();
    for (const uri of URIS) {
      const { contents } = await client.readResource({ uri });
      const item = contents[0] as { uri: string; mimeType: string; text: string; _meta?: unknown };
      expect(item.uri).toBe(uri);
      expect(item.mimeType).toBe("text/html;profile=mcp-app");
      expect(item.text).toContain(`${path.basename(uri, ".html")} view stub`);
      expect(item._meta).toEqual({ ui: VIEW_UI_META });
    }
    await close();
  });

  it("declares no network origins for views", () => {
    expect(VIEW_UI_META.csp).toEqual({
      connectDomains: [],
      resourceDomains: [],
      frameDomains: [],
      baseUriDomains: [],
    });
  });

  it("links the four UI tools to their views; search_location has none", async () => {
    const { client, close } = await connectClient();
    const { tools } = await client.listTools();
    const uriOf = (name: string) =>
      (tools.find((t) => t.name === name)?._meta as { ui?: { resourceUri?: string } } | undefined)
        ?.ui?.resourceUri;
    expect(uriOf("get_current_weather")).toBe("ui://weather/current.html");
    expect(uriOf("get_forecast")).toBe("ui://weather/forecast.html");
    expect(uriOf("get_air_quality")).toBe("ui://weather/air-quality.html");
    expect(uriOf("get_historical_weather")).toBe("ui://weather/history.html");
    expect(uriOf("search_location")).toBeUndefined();
    await close();
  });

  it("fails fast with a clear message when views are missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "views-"));
    writeFileSync(path.join(dir, "forecast.html"), "<p>ok</p>");
    expect(() => loadViews(dir)).toThrow(
      /Missing built view HTML \(3\): .*current\.html.*Run "npm run build -w views"/,
    );
  });
});
