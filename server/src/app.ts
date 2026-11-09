import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import cors from "cors";
import type { ErrorRequestHandler, Express, Request, RequestHandler, Response } from "express";
import { config } from "./config.js";
import { requestContext } from "./context.js";
import { logger } from "./logger.js";
import { createRateLimiter } from "./rateLimit.js";
import { createServer } from "./server.js";
import { VERSION } from "./version.js";

export const MAX_BODY = "100kb";

export interface AppOptions {
  rateLimitPerMinute?: number;
  trustProxy?: number;
  allowedHosts?: string[];
  /** Registers extra routes (e.g. static pages) before the 404 handler. */
  routes?: (app: Express) => void;
}

const rpcError = (res: Response, status: number, message: string) =>
  res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });

/** Express app: POST /mcp (Streamable HTTP, stateless) and GET /health. Everything else is 404. */
export function createApp(options: AppOptions = {}): Express {
  const {
    rateLimitPerMinute = config.RATE_LIMIT_PER_MINUTE,
    trustProxy = config.TRUST_PROXY,
    allowedHosts = config.ALLOWED_HOSTS,
    routes,
  } = options;

  // Binds all interfaces for hosting; Host-header validation is applied when ALLOWED_HOSTS is set.
  const app = createMcpExpressApp({
    host: "0.0.0.0",
    jsonLimit: MAX_BODY,
    ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
  });
  app.disable("x-powered-by");
  if (trustProxy > 0) app.set("trust proxy", trustProxy);

  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      exposedHeaders: ["Mcp-Session-Id", "Mcp-Protocol-Version", "X-Request-Id", "Retry-After"],
    }),
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    res.json({ status: "ok", version: VERSION });
  });

  const limiter = createRateLimiter({ limit: rateLimitPerMinute });
  const mcpHeaders: RequestHandler = (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Request-Id", randomUUID());
    next();
  };

  app.post("/mcp", limiter, mcpHeaders, async (req: Request, res: Response) => {
    const requestId = String(res.getHeader("X-Request-Id"));
    await requestContext.run({ requestId, cacheHits: 0, cacheMisses: 0 }, async () => {
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
        logger.error({ requestId, err }, "MCP request failed");
        if (!res.headersSent) rpcError(res, 500, "Internal server error");
      }
    });
  });

  // Stateless server: no server-initiated SSE stream and no sessions to delete.
  const methodNotAllowed: RequestHandler = (_req, res) => {
    res.set("Allow", "POST");
    rpcError(res, 405, "Method not allowed.");
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  routes?.(app);

  // Anything else is a 404.
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Body-parser and unexpected errors: never leak stack traces.
  const onError: ErrorRequestHandler = (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = (err as { status?: number; statusCode?: number } | null)?.status;
    if (status === 413) return void rpcError(res, 413, "Request body too large (limit 100 KB).");
    if (status === 400) return void rpcError(res, 400, "Invalid JSON in request body.");
    logger.error({ err }, "Unhandled request error");
    rpcError(res, 500, "Internal server error");
  };
  app.use(onError);

  return app;
}
