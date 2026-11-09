// Placeholder used until a view gets its real UI: prints the validated structuredContent.
import { z } from "zod";
import { useWeatherApp } from "./useWeatherApp";
import { ViewShell } from "./ViewShell";

const anyObject = z.record(z.string(), z.unknown());

export function PlaceholderApp({ viewName }: { viewName: string }) {
  const state = useWeatherApp(viewName, anyObject);
  return (
    <ViewShell
      state={state}
      render={(data) => (
        <>
          <h1 style={{ fontSize: 16, margin: 0 }}>{viewName} (placeholder)</h1>
          <pre data-testid="structured-content" style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </>
      )}
    />
  );
}
