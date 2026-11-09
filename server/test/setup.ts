import { afterEach, beforeEach, vi } from "vitest";
import { responseCache } from "../src/openmeteo/cache.js";
import { usage } from "../src/openmeteo/usage.js";

beforeEach(() => {
  responseCache.clear();
  usage.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
