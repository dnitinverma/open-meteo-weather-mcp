import type { SearchLocationResult } from "@weather/shared";
import { placeLabel, TOOL_NAMES } from "@weather/shared";
import { z } from "zod";
import { LocationNotFound } from "../openmeteo/errors.js";
import { searchPlaces, toPlace } from "../openmeteo/geocoding.js";
import { toolHandler } from "./common.js";

export const name = TOOL_NAMES.searchLocation;
export const title = "Search location";
export const description =
  "Find places matching a name and return their coordinates. Use when a location is unclear or ambiguous, before calling a weather tool.";

export const inputSchema = z.object({
  name: z.string().trim().min(2).max(100).describe('Place name to look up, e.g. "Springfield".'),
  count: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(3)
    .describe("How many matches to return (1–5, default 3)."),
});

export const handler = toolHandler(name, inputSchema, async (input) => {
  const results = (await searchPlaces(input.name, input.count)).map(toPlace);
  if (results.length === 0) throw new LocationNotFound(input.name);
  const data: SearchLocationResult = { results };
  const lines = [
    `${results.length} place${results.length === 1 ? "" : "s"} match "${input.name}":`,
    ...results.map(
      (p, i) =>
        `${i + 1}. ${placeLabel(p)} (${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)}), ${p.timezone}`,
    ),
  ];
  return { lines, data };
});
