import { McpServer } from "@modelcontextprotocol/server";
import { advertise, READ_ONLY_ANNOTATIONS } from "./tools/common.js";
import { ALL_TOOLS } from "./tools/index.js";
import { VERSION } from "./version.js";

export const SERVER_NAME = "open-meteo-weather";

/** Builds a fresh MCP server with all tools (and, from Phase 4, ui:// resources) registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });

  for (const tool of ALL_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: advertise(tool.inputSchema),
        annotations: { title: tool.title, ...READ_ONLY_ANNOTATIONS },
      },
      tool.handler,
    );
  }

  return server;
}
