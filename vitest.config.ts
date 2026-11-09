import { defineConfig } from "vitest/config";

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
          env: { LOG_LEVEL: "silent" },
        },
      },
    ],
  },
});
