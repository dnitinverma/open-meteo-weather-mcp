import { afterEach, beforeEach, vi } from "vitest";
import { responseCache } from "../src/openmeteo/cache.js";
import { resetHostCooldowns } from "../src/openmeteo/client.js";
import { usage } from "../src/openmeteo/usage.js";

beforeEach(() => {
  responseCache.clear();
  resetHostCooldowns();
  usage.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
