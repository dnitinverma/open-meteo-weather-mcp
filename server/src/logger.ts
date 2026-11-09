import { pino } from "pino";
import { config } from "./config.js";

// Logs go to stderr so stdout stays free for the MCP stdio transport.
export const logger = pino(
  { level: config.LOG_LEVEL, base: { app: "open-meteo-weather" } },
  pino.destination(2),
);
