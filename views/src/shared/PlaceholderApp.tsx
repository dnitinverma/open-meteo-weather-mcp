// Phase 4 placeholder: connects to the host and prints the tool result's structuredContent.
import type { CallToolResult } from "@modelcontextprotocol/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useState } from "react";
import { attribution } from "./attribution";

export function PlaceholderApp({ viewName }: { viewName: string }) {
  const [result, setResult] = useState<CallToolResult | null>(null);

  // useApp registers handlers in onAppCreated, i.e. BEFORE connect().
  const { error, isConnected } = useApp({
    appInfo: { name: `open-meteo-weather-${viewName}`, version: "0.1.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => setResult(params as CallToolResult);
    },
  });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, padding: 12 }}>
      <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>{viewName} (placeholder)</h1>
      {error && <p role="alert">Connection error: {error.message}</p>}
      {!error && !isConnected && <p>Connecting…</p>}
      {isConnected && !result && <p>Waiting for tool result…</p>}
      {result && (
        <pre data-testid="structured-content" style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
          {JSON.stringify(result.structuredContent ?? null, null, 2)}
        </pre>
      )}
      <footer style={{ marginTop: 8, fontSize: 13 }}>
        <a href={attribution.url} target="_blank" rel="noreferrer">
          {attribution.text}
        </a>
      </footer>
    </main>
  );
}
