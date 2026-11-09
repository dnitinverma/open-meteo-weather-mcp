// Bundles the server into dist/index.js. npm packages stay external (installed at runtime);
// the workspace package @weather/shared (TypeScript source) is inlined.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "externalize-npm-deps",
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith("@weather/") ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
