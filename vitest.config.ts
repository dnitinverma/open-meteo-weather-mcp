import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          root: "./server",
          include: ["test/**/*.test.ts"],
          environment: "node",
          setupFiles: ["test/setup.ts"],
          env: { LOG_LEVEL: "silent", VIEWS_DIST_DIR: abs("./server/test/fixtures/views") },
        },
      },
    ],
  },
});
