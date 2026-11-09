import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { VERSION } from "./version.js";

export const SERVER_NAME = "open-meteo-weather";

/** Builds a fresh MCP server with all tools and ui:// resources registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Health check. Returns pong.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({ content: [{ type: "text", text: "pong" }] }),
  );

  return server;
}
