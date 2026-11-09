// Registers the four ui:// view resources (single-file HTML built by views/).
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { McpUiResourceMeta } from "@modelcontextprotocol/ext-apps";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { VIEW_URIS } from "@weather/shared";

export type ViewKey = keyof typeof VIEW_URIS;
export type ViewHtml = Record<ViewKey, string>;

const VIEW_TITLES: Record<ViewKey, string> = {
  current: "Current weather card",
  forecast: "Forecast view",
  airQuality: "Air quality gauge",
  history: "History chart",
};

/**
 * Strictest content-security settings the MCP Apps spec allows: views load nothing from the
 * network (no connect/resource/frame/base-uri domains) and request no extra permissions.
 */
export const VIEW_UI_META: McpUiResourceMeta = {
  csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] },
  permissions: {},
  prefersBorder: true,
};

/** views/dist, from both server/src (tsx) and server/dist (bundled). Override with VIEWS_DIST_DIR. */
export function defaultViewsDir(): string {
  if (process.env.VIEWS_DIST_DIR) return path.resolve(process.env.VIEWS_DIST_DIR);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../views/dist");
}

/** File name of a view: "ui://weather/air-quality.html" → "air-quality.html". */
export function viewFileName(key: ViewKey): string {
  return VIEW_URIS[key].slice("ui://weather/".length);
}

/** Reads all four built views. Throws one clear error listing every missing file. */
export function loadViews(dir = defaultViewsDir()): ViewHtml {
  const missing: string[] = [];
  const out: Partial<ViewHtml> = {};
  for (const key of Object.keys(VIEW_URIS) as ViewKey[]) {
    const file = path.join(dir, viewFileName(key));
    try {
      out[key] = readFileSync(file, "utf8");
    } catch {
      missing.push(file);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing built view HTML (${missing.length}): ${missing.join(", ")}. Run "npm run build -w views" (or "npm run build") first.`,
    );
  }
  return out as ViewHtml;
}

let cached: { html: ViewHtml; stamp: string } | undefined;

/** Modification times of the built views; changes when `npm run dev` rebuilds them. */
function viewsStamp(dir: string): string {
  return (Object.keys(VIEW_URIS) as ViewKey[])
    .map((key) => {
      try {
        return statSync(path.join(dir, viewFileName(key))).mtimeMs;
      } catch {
        return 0;
      }
    })
    .join(",");
}

/** Built views, re-read only when a file changes (so dev rebuilds show up without a restart). */
export function getViews(): ViewHtml {
  const dir = defaultViewsDir();
  const stamp = viewsStamp(dir);
  if (!cached || cached.stamp !== stamp) cached = { html: loadViews(dir), stamp };
  return cached.html;
}

/** Registers the four views. Without `views`, each read serves the current build (getViews). */
export function registerViews(server: McpServer, views?: ViewHtml): void {
  for (const key of Object.keys(VIEW_URIS) as ViewKey[]) {
    const uri = VIEW_URIS[key];
    registerAppResource(
      server,
      VIEW_TITLES[key],
      uri,
      {
        description: `${VIEW_TITLES[key]} for the Open-Meteo weather tools`,
        mimeType: RESOURCE_MIME_TYPE,
        _meta: { ui: VIEW_UI_META },
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: (views ?? getViews())[key],
            _meta: { ui: VIEW_UI_META },
          },
        ],
      }),
    );
  }
}
