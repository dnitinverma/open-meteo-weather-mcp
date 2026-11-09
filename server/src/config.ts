import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  /** Real requests to Open-Meteo per UTC day; after that only cached data is served. */
  DAILY_UPSTREAM_LIMIT: z.coerce.number().int().positive().default(9000),
  /** POST /mcp requests per IP per minute. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  /** Reverse-proxy hops to trust for the client IP (Render/Railway: 1). 0 = use the socket address. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  /** Contact address shown on /support and /privacy. Replace the placeholder before publishing. */
  SUPPORT_EMAIL: z.email().default("support@example.com"),
  /** OpenAI domain-verification token, served as plain text at /.well-known/openai-apps-challenge. "" = off. */
  OPENAI_APPS_CHALLENGE: z
    .string()
    .default("")
    .transform((s) => s.trim())
    .refine(
      (s) => s === "" || /^[\x21-\x7e]{1,512}$/.test(s),
      "must be 1-512 visible ASCII characters",
    ),
  /** Optional comma-separated Host allow-list (DNS-rebinding protection), e.g. "weather-mcp.example.com". */
  ALLOWED_HOSTS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
    ),
});

export type Config = z.infer<typeof configSchema>;

/** Parses and validates environment variables. Throws a readable error on bad input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  return parsed.data;
}

export const config: Config = loadConfig();
