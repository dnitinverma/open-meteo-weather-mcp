import type { CallToolResult } from "@modelcontextprotocol/client";
import type { App } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { toolErrorSchema, type ToolError, type ToolName } from "@weather/shared";
import { useCallback, useRef, useState } from "react";
import type { z } from "zod";

export type ViewError = ToolError["error"];

export type Interpreted<T> =
  { data: T; error?: undefined } | { data?: undefined; error: ViewError };

/** Turns a tool result into validated data or a ToolError-shaped error. */
export function interpretResult<T>(
  result: Pick<CallToolResult, "isError" | "structuredContent" | "content">,
  schema: z.ZodType<T>,
): Interpreted<T> {
  if (result.isError) {
    const parsed = toolErrorSchema.safeParse(result.structuredContent);
    if (parsed.success) return { error: parsed.data.error };
    const text = result.content?.find((c) => c.type === "text");
    return {
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: text && "text" in text ? text.text : "The tool returned an error.",
      },
    };
  }
  const parsed = schema.safeParse(result.structuredContent);
  if (parsed.success) return { data: parsed.data };
  return {
    error: {
      code: "UPSTREAM_UNAVAILABLE",
      message: "Received unexpected data from the weather server.",
    },
  };
}

export interface WeatherAppState<T> {
  data: T | null;
  error: ViewError | null;
  loading: boolean;
  /** Calls a server tool through the host and replaces data (or error) with its result. */
  callTool: (name: ToolName, args: Record<string, unknown>) => Promise<void>;
  app: App | null;
  connectionError: Error | null;
}

/**
 * Creates the App once, registers tool handlers BEFORE connect (via onAppCreated), applies host
 * styles/theme, and validates every structuredContent against `schema`.
 */
export function useWeatherApp<T>(viewName: string, schema: z.ZodType<T>): WeatherAppState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ViewError | null>(null);
  const [loading, setLoading] = useState(true);
  const schemaRef = useRef(schema);

  const apply = useCallback((result: CallToolResult) => {
    const r = interpretResult(result, schemaRef.current);
    if (r.error) {
      setError(r.error);
    } else {
      setData(r.data);
      setError(null);
    }
    setLoading(false);
  }, []);

  const { app, error: connectionError } = useApp({
    appInfo: { name: `open-meteo-weather-${viewName}`, version: "0.1.0" },
    capabilities: {},
    onAppCreated: (created) => {
      created.ontoolinput = () => setLoading(true);
      created.ontoolresult = (params) => apply(params as CallToolResult);
      created.ontoolcancelled = () => setLoading(false);
    },
  });

  useHostStyles(app, app?.getHostContext());

  const callTool = useCallback(
    async (name: ToolName, args: Record<string, unknown>) => {
      if (!app) return;
      setLoading(true);
      try {
        apply(await app.callServerTool({ name, arguments: args }));
      } catch {
        setError({
          code: "UPSTREAM_UNAVAILABLE",
          message: "Could not reach the weather server. Please try again.",
        });
        setLoading(false);
      }
    },
    [app, apply],
  );

  return { data, error, loading, callTool, app, connectionError };
}
