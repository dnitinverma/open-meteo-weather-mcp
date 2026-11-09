import type { ReactNode } from "react";
import { AppContext } from "./AppContext";
import { AttributionFooter, Card, ErrorState, LoadingState } from "./components";
import type { WeatherAppState } from "./useWeatherApp";
import "./kit.css";

/**
 * Common frame for every view: connection/loading/error states, the card and the footer.
 * `render` draws the data; errors with alternatives call `onPickPlace`.
 */
export function ViewShell<T>({
  state,
  render,
  onPickPlace,
  className,
}: {
  state: Pick<WeatherAppState<T>, "data" | "error" | "loading" | "app" | "connectionError">;
  render: (data: T) => ReactNode;
  onPickPlace?: Parameters<typeof ErrorState>[0]["onPickPlace"];
  className?: string;
}) {
  const { data, error, loading, app, connectionError } = state;
  let body: ReactNode;
  if (connectionError) {
    body = (
      <ErrorState
        error={{ code: "UPSTREAM_UNAVAILABLE", message: "Could not connect to the chat host." }}
      />
    );
  } else if (error) {
    body = <ErrorState error={error} onPickPlace={onPickPlace} disabled={loading} />;
  } else if (data) {
    body = render(data);
  } else {
    body = <LoadingState />;
  }
  return (
    <AppContext.Provider value={app}>
      <Card className={className}>
        {body}
        <AttributionFooter />
      </Card>
    </AppContext.Provider>
  );
}
