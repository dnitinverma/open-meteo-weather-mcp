import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import cors from "cors";
import type { Express, Request, Response } from "express";
import { logger } from "./logger.js";
import { createServer } from "./server.js";
import { VERSION } from "./version.js";

/** Express app: POST /mcp (Streamable HTTP, stateless) and GET /health. */
export function createApp(): Express {
  // Bind-all host: DNS-rebinding protection is not applied (public server, no auth, read-only tools).
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      exposedHeaders: ["Mcp-Session-Id", "Mcp-Protocol-Version"],
    }),
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", version: VERSION });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    // Stateless mode: a fresh server + transport per request.
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err }, "MCP request failed");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Stateless server: no server-initiated SSE stream and no sessions to delete.
  const methodNotAllowed = (_req: Request, res: Response) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}
