import type { ErrorCode, Place } from "@weather/shared";

/** Base class for errors that map to a ToolError code. Messages are safe to show to users. */
export abstract class WeatherError extends Error {
  abstract readonly code: ErrorCode;
}

export class LocationNotFound extends WeatherError {
  readonly code = "LOCATION_NOT_FOUND" as const;
  constructor(query: string) {
    super(
      `No place found matching "${query}". Check the spelling or add a country, e.g. "Paris, France".`,
    );
    this.name = "LocationNotFound";
  }
}

export class AmbiguousLocation extends WeatherError {
  readonly code = "AMBIGUOUS_LOCATION" as const;
  constructor(
    query: string,
    readonly alternatives: Place[],
  ) {
    super(`"${query}" matches several places. Say which one you mean.`);
    this.name = "AmbiguousLocation";
  }
}

export class InvalidInput extends WeatherError {
  readonly code = "INVALID_INPUT" as const;
  constructor(message: string) {
    super(message);
    this.name = "InvalidInput";
  }
}

/**
 * Open-Meteo could not be reached or answered with an error.
 * `status` / `reason` are for logs only; never send `reason` to the client.
 */
export class UpstreamError extends WeatherError {
  readonly code = "UPSTREAM_UNAVAILABLE" as const;
  constructor(
    readonly status: number | null,
    readonly reason: string,
    /** Whether another attempt could help (network errors, 5xx and 429 by default). */
    readonly retryable: boolean = status === null || status === 429 || status >= 500,
  ) {
    super("The weather service is temporarily unavailable. Please try again in a minute.");
    this.name = "UpstreamError";
  }
}

/** The daily budget of upstream requests is used up; only cached data can be served until 00:00 UTC. */
export class DailyLimitReached extends UpstreamError {
  constructor() {
    super(null, "daily upstream request limit reached", false);
    this.name = "DailyLimitReached";
  }
}

/** Open-Meteo reported its per-IP daily cap for a host; further requests wait out a cooldown. */
export class UpstreamDailyCap extends UpstreamError {
  constructor(reason: string) {
    super(429, reason, false);
    this.name = "UpstreamDailyCap";
  }
}

/** A host is in cooldown after UpstreamDailyCap: no network request was made. */
export class UpstreamCooldown extends UpstreamError {
  constructor(host: string) {
    super(429, `${host} is cooling down after its daily request cap`, false);
    this.name = "UpstreamCooldown";
  }
}
