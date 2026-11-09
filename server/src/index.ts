import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { gracefulShutdown } from "./lifecycle.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";
import { getViews } from "./ui.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startHttp(): Promise<void> {
  const app = createApp();
  const httpServer = app.listen(config.PORT, "0.0.0.0", (err?: Error) => {
    if (err) {
      logger.fatal({ err }, "Failed to start server");
      process.exit(1);
    }
    logger.info(`MCP server listening on http://localhost:${config.PORT}/mcp`);
  });
  httpServer.requestTimeout = 30_000;
  httpServer.headersTimeout = 15_000;

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "Shutting down: no new requests, finishing in-flight ones");
    // Hard stop so the process always exits within the deadline.
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    void gracefulShutdown(httpServer, SHUTDOWN_TIMEOUT_MS - 1_000).then(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function startStdio(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
  logger.info("MCP server running over stdio");
}

const run = process.argv.includes("--stdio") ? startStdio : startHttp;
Promise.resolve()
  .then(() => getViews()) // fail fast if the views have not been built
  .then(run)
  .catch((err: unknown) => {
    logger.fatal({ err }, "Fatal startup error");
    process.exit(1);
  });
