import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";

async function startHttp(): Promise<void> {
  const app = createApp();
  const httpServer = app.listen(config.PORT, "0.0.0.0", (err?: Error) => {
    if (err) {
      logger.fatal({ err }, "Failed to start server");
      process.exit(1);
    }
    logger.info(`MCP server listening on http://localhost:${config.PORT}/mcp`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function startStdio(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
  logger.info("MCP server running over stdio");
}

const run = process.argv.includes("--stdio") ? startStdio : startHttp;
run().catch((err: unknown) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
