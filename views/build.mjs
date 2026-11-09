// Builds every view entry (views/*.html) into its own self-contained dist/<name>.html.
// Usage: node build.mjs [--watch]
import { readdirSync, mkdirSync } from "node:fs";
import { build } from "vite";

const watch = process.argv.includes("--watch");
// preview.html is a local dev page (npm run preview:views), not a view.
const entries = readdirSync(".").filter((f) => f.endsWith(".html") && f !== "preview.html");
mkdirSync("dist", { recursive: true });

if (entries.length === 0) {
  console.log("[views] no view entries yet");
  if (watch) setInterval(() => {}, 1 << 30); // keep `npm run dev` alive
} else {
  for (const input of entries) {
    process.env.INPUT = input;
    await build({
      configFile: "vite.config.ts",
      logLevel: "warn",
      build: { rollupOptions: { input }, watch: watch ? {} : null },
    });
    console.log(`[views] built dist/${input}`);
  }
}
