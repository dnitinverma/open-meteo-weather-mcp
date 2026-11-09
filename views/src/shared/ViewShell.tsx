import type { ReactNode } from "react";
import { AppContext } from "./AppContext";
import { AttributionFooter, Card, ErrorState, LoadingState } from "./components";
import type { SkyName } from "./sky";
import type { WeatherAppState } from "./useWeatherApp";
import "./kit.css";

/**
 * Common frame for every view: connection/loading/error states, the sky card and the footer.
 * `render` draws the data and `sky` picks the ground from it. Waiting is a clear sky, a problem
 * is an overcast one.
 */
export function ViewShell<T>({
  state,
  render,
  sky,
  onPickPlace,
  className,
}: {
  state: Pick<WeatherAppState<T>, "data" | "error" | "loading" | "app" | "connectionError">;
  render: (data: T) => ReactNode;
  sky?: (data: T) => SkyName;
  onPickPlace?: Parameters<typeof ErrorState>[0]["onPickPlace"];
  className?: string;
}) {
  const { data, error, loading, app, connectionError } = state;
  let body: ReactNode;
  let ground: SkyName = "clear";
  if (connectionError) {
    ground = "overcast";
    body = (
      <ErrorState
        error={{ code: "UPSTREAM_UNAVAILABLE", message: "Could not connect to the chat host." }}
      />
    );
  } else if (error) {
    ground = "overcast";
    body = <ErrorState error={error} onPickPlace={onPickPlace} disabled={loading} />;
  } else if (data) {
    ground = sky ? sky(data) : "clear";
    body = render(data);
  } else {
    body = <LoadingState />;
  }
  return (
    <AppContext.Provider value={app}>
      <Card className={className} sky={ground}>
        {body}
        <AttributionFooter />
      </Card>
    </AppContext.Provider>
  );
}
