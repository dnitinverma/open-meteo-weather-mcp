import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// One build per view: build.mjs sets INPUT to e.g. "forecast.html" and runs Vite once per entry,
// so each dist/<name>.html is fully self-contained (JS + CSS inlined).
const INPUT = process.env.INPUT;
const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : false,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: INPUT ? { input: INPUT } : undefined,
    outDir: "dist",
    emptyOutDir: false,
  },
});
