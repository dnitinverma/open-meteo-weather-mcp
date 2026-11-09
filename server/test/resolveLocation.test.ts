import { describe, expect, it } from "vitest";
import { AmbiguousLocation, LocationNotFound } from "../src/openmeteo/errors.js";
import { parseCityQuery, resolveLocation, withTimezone } from "../src/openmeteo/resolveLocation.js";
import { mockFetch, openMeteoRoutes } from "./mockFetch.js";

describe("resolveLocation", () => {
  it("resolves Jaipur to India (top result clearly dominant by population)", async () => {
    mockFetch(openMeteoRoutes);
    const place = await resolveLocation({ city: "Jaipur" });
    expect(place).toEqual({
      name: "Jaipur",
      admin1: "Rajasthan",
      country: "India",
      country_code: "IN",
      latitude: 26.91962,
      longitude: 75.78781,
      timezone: "Asia/Kolkata",
    });
    expect(place).not.toHaveProperty("population");
  });

  it("geocodes with count=5 and language=en", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    await resolveLocation({ city: "Jaipur" });
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.searchParams.get("count")).toBe("5");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("name")).toBe("Jaipur");
  });

  it("throws AmbiguousLocation for Springfield with up to 3 alternatives", async () => {
    mockFetch(openMeteoRoutes);
    const err = (await resolveLocation({ city: "Springfield" }).catch(
      (e: unknown) => e,
    )) as AmbiguousLocation;
    expect(err).toBeInstanceOf(AmbiguousLocation);
    expect(err.code).toBe("AMBIGUOUS_LOCATION");
    expect(err.alternatives).toHaveLength(3);
    expect(err.alternatives.map((p) => p.admin1)).toEqual([
      "Missouri",
      "Illinois",
      "Massachusetts",
    ]);
  });

  it("uses a country qualifier to pick a match", async () => {
    mockFetch(openMeteoRoutes);
    const place = await resolveLocation({ city: "Noida, India" });
    expect(place).toMatchObject({ name: "Noida", admin1: "Uttar Pradesh", country_code: "IN" });
  });

  it("accepts a region qualifier for an otherwise ambiguous name", async () => {
    mockFetch(openMeteoRoutes);
    const place = await resolveLocation({ city: "Springfield, Illinois" });
    expect(place).toMatchObject({ name: "Springfield", admin1: "Illinois" });
  });

  it("throws LocationNotFound when nothing matches", async () => {
    mockFetch(openMeteoRoutes);
    await expect(resolveLocation({ city: "Xyzabc" })).rejects.toBeInstanceOf(LocationNotFound);
  });

  it("throws LocationNotFound when the qualifier matches nothing", async () => {
    mockFetch(openMeteoRoutes);
    await expect(resolveLocation({ city: "Jaipur, Peru" })).rejects.toBeInstanceOf(
      LocationNotFound,
    );
  });

  it("skips geocoding for coordinates", async () => {
    const fetch = mockFetch(openMeteoRoutes);
    const place = await resolveLocation({ latitude: 28.5355, longitude: 77.391 });
    expect(fetch).not.toHaveBeenCalled();
    expect(place).toEqual({
      name: "28.54, 77.39",
      country: "",
      country_code: "",
      latitude: 28.5355,
      longitude: 77.391,
      timezone: "",
    });
    expect(withTimezone(place, "Asia/Kolkata").timezone).toBe("Asia/Kolkata");
  });

  it("parses city qualifiers", () => {
    expect(parseCityQuery("Noida, India")).toEqual({ name: "Noida", qualifier: "India" });
    expect(parseCityQuery("Paris")).toEqual({ name: "Paris" });
    expect(parseCityQuery("Portland, Maine, US")).toEqual({
      name: "Portland",
      qualifier: "Maine, US",
    });
  });
});
