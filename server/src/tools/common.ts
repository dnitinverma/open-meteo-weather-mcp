import { randomUUID } from "node:crypto";
import type { CallToolResult, StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { ErrorCode, Place, ToolError } from "@weather/shared";
import { ATTRIBUTION, placeLabel } from "@weather/shared";
import { z } from "zod";
import { currentContext, requestContext, type RequestContext } from "../context.js";
import { logger } from "../logger.js";
import { AmbiguousLocation, UpstreamError, WeatherError } from "../openmeteo/errors.js";

export const ATTRIBUTION_LINE = ATTRIBUTION.text;
export const MAX_TEXT_LINES = 8;

// ---------- input fields ----------
export const locationFields = {
  city: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .describe(
      'City or place name, optionally with region/country, e.g. "Jaipur" or "Noida, India". Give either city or latitude+longitude.',
    ),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .describe(
      "Latitude in decimal degrees (-90..90). Use together with longitude instead of city.",
    ),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe(
      "Longitude in decimal degrees (-180..180). Use together with latitude instead of city.",
    ),
};

export const unitsField = z
  .enum(["metric", "imperial"])
  .default("metric")
  .describe('"metric" (°C, km/h, mm; default) or "imperial" (°F, mph, inch).');

/** Exactly one of: city, or latitude + longitude. */
export function refineLocation(
  v: { city?: string | undefined; latitude?: number | undefined; longitude?: number | undefined },
  ctx: z.RefinementCtx,
): void {
  const hasCity = v.city !== undefined;
  const hasLat = v.latitude !== undefined;
  const hasLon = v.longitude !== undefined;
  if (hasLat !== hasLon) {
    ctx.addIssue({ code: "custom", message: "Give both latitude and longitude, not just one." });
  } else if (hasCity && hasLat) {
    ctx.addIssue({
      code: "custom",
      message: "Give either a city or latitude+longitude, not both.",
    });
  } else if (!hasCity && !hasLat) {
    ctx.addIssue({ code: "custom", message: "Give either a city or latitude+longitude." });
  }
}

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.")
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
      new Date(`${s}T00:00:00Z`).toISOString().startsWith(s),
    {
      message: "Not a valid calendar date.",
    },
  );

/**
 * Advertise a zod schema's JSON Schema to clients, but let every argument object through to the
 * handler, which validates with zod itself. This way invalid input becomes an INVALID_INPUT
 * ToolError (with structuredContent) instead of the SDK's plain-text validation error.
 */
export function advertise<S extends z.ZodType>(
  schema: S,
): StandardSchemaWithJSON<unknown, unknown> {
  const std = schema["~standard"];
  return {
    "~standard": {
      ...std,
      validate: (value: unknown) => ({ value }),
    },
  } as StandardSchemaWithJSON<unknown, unknown>;
}

// ---------- results ----------
export interface ToolOutput<T> {
  /** Lines of the text summary (attribution line is appended automatically). */
  lines: string[];
  data: T;
}

export function okResult<T extends object>({ lines, data }: ToolOutput<T>): CallToolResult {
  const all = [...lines.slice(0, MAX_TEXT_LINES - 1), ATTRIBUTION_LINE];
  return {
    content: [{ type: "text", text: all.join("\n") }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function errorResult(
  code: ErrorCode,
  message: string,
  alternatives?: Place[],
): CallToolResult {
  const error: ToolError["error"] = { code, message };
  if (alternatives?.length) error.alternatives = alternatives;
  let text = message;
  if (alternatives?.length) {
    const list = alternatives
      .map(
        (p, i) =>
          `${i + 1}) ${placeLabel(p)} (${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)})`,
      )
      .join("; ");
    text = `${message} Options: ${list}.`;
  }
  return {
    content: [{ type: "text", text }],
    structuredContent: { error } satisfies ToolError,
    isError: true,
  };
}

function zodMessage(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "Invalid input.";
  const path = first.path.join(".");
  return path ? `Invalid ${path}: ${first.message}` : first.message;
}

/** Maps any thrown error to a ToolError result. Never leaks stack traces or upstream bodies. */
export function toErrorResult(err: unknown, tool: string): CallToolResult {
  if (err instanceof z.ZodError) return errorResult("INVALID_INPUT", zodMessage(err));
  if (err instanceof AmbiguousLocation) {
    return errorResult(err.code, err.message, err.alternatives);
  }
  if (
    err instanceof UpstreamError &&
    err.status !== null &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 429
  ) {
    logger.warn({ tool, status: err.status, reason: err.reason }, "Open-Meteo rejected request");
    return errorResult(
      "INVALID_INPUT",
      "Open-Meteo could not answer this request. Check the dates and location and try again.",
    );
  }
  if (err instanceof WeatherError) return errorResult(err.code, err.message);
  logger.error({ tool, err }, "Unexpected tool error");
  return errorResult(
    "UPSTREAM_UNAVAILABLE",
    "Something went wrong while fetching the weather. Please try again.",
  );
}

/** hit = every upstream lookup came from cache, miss = none did, partial = mixed, none = no lookups. */
export function cacheLabel(hits: number, misses: number): "hit" | "miss" | "partial" | "none" {
  if (hits > 0 && misses > 0) return "partial";
  if (hits > 0) return "hit";
  if (misses > 0) return "miss";
  return "none";
}

function errorCodeOf(result: CallToolResult): ErrorCode | undefined {
  if (!result.isError) return undefined;
  const code = (result.structuredContent as Partial<ToolError> | undefined)?.error?.code;
  return code;
}

/**
 * Wrap a handler: zod-parse the raw args, run, and convert failures into ToolError results.
 * Logs one structured line per call: request id, tool, latency, cache hit/miss, error code.
 * Arguments and bodies are never logged.
 */
export function toolHandler<S extends z.ZodType, T extends object>(
  name: string,
  schema: S,
  run: (input: z.output<S>) => Promise<ToolOutput<T>>,
): (args: unknown) => Promise<CallToolResult> {
  return async (args: unknown) => {
    const started = performance.now();
    const ctx: RequestContext = {
      requestId: currentContext()?.requestId ?? randomUUID(),
      cacheHits: 0,
      cacheMisses: 0,
    };
    return requestContext.run(ctx, async () => {
      let result: CallToolResult;
      try {
        const input = schema.parse(args ?? {});
        result = okResult(await run(input));
      } catch (err) {
        result = toErrorResult(err, name);
      }
      const errorCode = errorCodeOf(result);
      logger.info(
        {
          requestId: ctx.requestId,
          tool: name,
          latencyMs: Math.round(performance.now() - started),
          cache: cacheLabel(ctx.cacheHits, ctx.cacheMisses),
          ...(errorCode ? { errorCode } : {}),
        },
        "tool call",
      );
      return result;
    });
  };
}

/** Header line: "Jaipur, Rajasthan, India — 3-day forecast". */
export function header(place: Place, what: string): string {
  return `${placeLabel(place)} — ${what}`;
}

export const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, openWorldHint: true } as const;
