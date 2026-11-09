import { act, renderHook, waitFor } from "@testing-library/react";
import { forecastResultSchema } from "@weather/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import forecast3 from "../src/fixtures/forecast-3.json";
import forecast7 from "../src/fixtures/forecast-7.json";
import ambiguous from "../src/fixtures/error-ambiguous.json";
import { interpretResult, useWeatherApp } from "../src/shared/useWeatherApp";
import { deliver, fail, fake, newFakeApp, ok } from "./mockApp";

vi.mock("@modelcontextprotocol/ext-apps/react", async () =>
  (await import("./mockApp")).extAppsReactMock(),
);

beforeEach(() => {
  fake.app = null;
  newFakeApp();
});

describe("interpretResult", () => {
  it("validates data against the contract schema", () => {
    expect(interpretResult(ok(forecast3), forecastResultSchema).data?.days).toHaveLength(3);
  });
  it("returns ToolError errors", () => {
    expect(interpretResult(fail(ambiguous), forecastResultSchema).error?.code).toBe(
      "AMBIGUOUS_LOCATION",
    );
  });
  it("rejects data that does not match the contract", () => {
    const r = interpretResult(ok({ place: "nope" }), forecastResultSchema);
    expect(r.error?.code).toBe("UPSTREAM_UNAVAILABLE");
  });
  it("handles error results without structuredContent", () => {
    const r = interpretResult(
      { isError: true, content: [{ type: "text", text: "Input validation error" }] },
      forecastResultSchema,
    );
    expect(r.error?.message).toBe("Input validation error");
  });
});

describe("useWeatherApp", () => {
  it("registers handlers before connecting and starts loading", () => {
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    expect(fake.app?.ontoolresult).toBeTypeOf("function");
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("sets data from a tool result", () => {
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    act(() => deliver(ok(forecast3)));
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.days).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it("sets error from an error result", () => {
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    act(() => deliver(fail(ambiguous)));
    expect(result.current.error?.code).toBe("AMBIGUOUS_LOCATION");
    expect(result.current.error?.alternatives).toHaveLength(3);
  });

  it("callTool sets loading, calls the host and replaces data", async () => {
    let resolve!: (v: unknown) => void;
    fake.app!.callServerTool.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    act(() => deliver(ok(forecast3)));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.callTool("get_forecast", { latitude: 1, longitude: 2, days: 7 });
    });
    expect(result.current.loading).toBe(true);
    expect(fake.app!.callServerTool).toHaveBeenCalledWith({
      name: "get_forecast",
      arguments: { latitude: 1, longitude: 2, days: 7 },
    });
    await act(async () => {
      resolve(ok(forecast7));
      await pending;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.days).toHaveLength(7);
  });

  it("callTool turns a transport failure into an error", async () => {
    fake.app!.callServerTool.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    await act(() => result.current.callTool("get_forecast", { city: "x" }));
    await waitFor(() => expect(result.current.error?.code).toBe("UPSTREAM_UNAVAILABLE"));
    expect(result.current.loading).toBe(false);
  });

  it("a new successful result clears a previous error", () => {
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    act(() => deliver(fail(ambiguous)));
    act(() => deliver(ok(forecast3)));
    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
  });
});

describe("restorePlace", () => {
  const named = {
    name: "Jaipur",
    admin1: "Rajasthan",
    country: "India",
    country_code: "IN",
    latitude: 26.91962,
    longitude: 75.78781,
    timezone: "Asia/Kolkata",
  };
  const coordPlace = {
    ...named,
    name: "26.92, 75.79",
    admin1: undefined,
    country: "",
    country_code: "",
  };

  it("keeps the known name when a coordinate re-call returns the same spot", async () => {
    const { restorePlace } = await import("../src/shared/useWeatherApp");
    expect(restorePlace({ place: coordPlace }, named).place.name).toBe("Jaipur");
  });

  it("does not rename a different spot or a named result", async () => {
    const { restorePlace } = await import("../src/shared/useWeatherApp");
    const far = { ...coordPlace, latitude: 10 };
    expect(restorePlace({ place: far }, named).place.name).toBe("26.92, 75.79");
    const other = { ...named, name: "Noida" };
    expect(restorePlace({ place: other }, named).place.name).toBe("Noida");
  });

  it("the hook restores the name after a tab re-call", async () => {
    const { result } = renderHook(() => useWeatherApp("forecast", forecastResultSchema));
    act(() => deliver(ok(forecast3)));
    const coords = {
      ...forecast7,
      place: {
        ...forecast7.place,
        name: "26.92, 75.79",
        admin1: undefined,
        country: "",
        country_code: "",
      },
    };
    fake.app!.callServerTool.mockResolvedValue(ok(coords));
    await act(() =>
      result.current.callTool("get_forecast", { latitude: 26.92, longitude: 75.79, days: 7 }),
    );
    expect(result.current.data?.place.name).toBe("Jaipur");
    expect(result.current.data?.place.country).toBe("India");
  });
});
