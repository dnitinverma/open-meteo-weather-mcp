// npm run package:chatgpt -- [--strict]
// Builds dist/open-meteo-weather-chatgpt-plugin.zip from submission/chatgpt-plugin/.
// Env: PUBLIC_URL (https://your-domain), DEVELOPER_NAME, SUPPORT_EMAIL replace the template placeholders.
// --strict fails while any placeholder remains (use it for the real submission).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyVars, remainingPlaceholders, validateSubmission, type Vars } from "./submission.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = path.join(root, "submission/chatgpt-plugin");
const out = path.join(root, "dist/open-meteo-weather-chatgpt-plugin.zip");
const strict = process.argv.includes("--strict");
const vars: Vars = {
  PUBLIC_URL: process.env.PUBLIC_URL,
  DEVELOPER_NAME: process.env.DEVELOPER_NAME,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
};

const work = mkdtempSync(path.join(tmpdir(), "chatgpt-plugin-"));
try {
  cpSync(src, work, { recursive: true });
  for (const f of ["plugin.json", "mcp.json"]) {
    const file = path.join(work, f);
    writeFileSync(file, applyVars(readFileSync(file, "utf8"), vars));
  }

  const problems = validateSubmission(work);
  const placeholders = ["plugin.json", "mcp.json"].flatMap((f) =>
    remainingPlaceholders(readFileSync(path.join(work, f), "utf8")),
  );
  for (const p of problems) console.error(`✗ ${p}`);
  const unique = [...new Set(placeholders)];
  for (const p of unique) console.warn(`${strict ? "✗" : "!"} placeholder still present: ${p}`);
  if (problems.length > 0 || (strict && unique.length > 0)) {
    console.error(
      `\nNot packaged: ${problems.length} problem(s)${strict ? `, ${unique.length} placeholder(s)` : ""}.`,
    );
    process.exit(1);
  }

  mkdirSync(path.dirname(out), { recursive: true });
  rmSync(out, { force: true });
  // Files at the archive root (exactly one plugin root, no sibling directory).
  execFileSync("zip", ["-r", "-X", "-q", out, "plugin.json", "mcp.json", "assets"], { cwd: work });
  console.log(`✓ ${path.relative(root, out)}`);
  console.log(execFileSync("unzip", ["-l", out], { encoding: "utf8" }).trim());
  if (unique.length > 0)
    console.log(
      "\nNote: placeholders remain; set PUBLIC_URL, DEVELOPER_NAME, SUPPORT_EMAIL and use --strict for the real submission.",
    );
} finally {
  rmSync(work, { recursive: true, force: true });
}
