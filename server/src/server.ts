import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import { TOOL_NAMES, VIEW_URIS } from "@weather/shared";
import { advertise, READ_ONLY_ANNOTATIONS } from "./tools/common.js";
import { ALL_TOOLS } from "./tools/index.js";
import { registerViews, type ViewHtml } from "./ui.js";
import { VERSION } from "./version.js";

export const SERVER_NAME = "open-meteo-weather";

/** Which ui:// view each UI tool opens. search_location has no view. */
export const TOOL_VIEWS: Partial<Record<string, string>> = {
  [TOOL_NAMES.currentWeather]: VIEW_URIS.current,
  [TOOL_NAMES.forecast]: VIEW_URIS.forecast,
  [TOOL_NAMES.airQuality]: VIEW_URIS.airQuality,
  [TOOL_NAMES.historicalWeather]: VIEW_URIS.history,
};

export interface CreateServerOptions {
  /** Pre-loaded view HTML (tests); defaults to reading views/dist once. */
  views?: ViewHtml;
}

/** Builds a fresh MCP server with all tools and ui:// resources registered. */
export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });

  for (const tool of ALL_TOOLS) {
    const config = {
      title: tool.title,
      description: tool.description,
      inputSchema: advertise(tool.inputSchema),
      annotations: { title: tool.title, ...READ_ONLY_ANNOTATIONS },
    };
    const resourceUri = TOOL_VIEWS[tool.name];
    if (resourceUri) {
      registerAppTool(
        server,
        tool.name,
        { ...config, _meta: { ui: { resourceUri } } },
        tool.handler,
      );
    } else {
      server.registerTool(tool.name, config, tool.handler);
    }
  }

  registerViews(server, options.views);
  return server;
}
