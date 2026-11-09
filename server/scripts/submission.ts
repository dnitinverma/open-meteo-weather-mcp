// Validation and packaging helpers for the ChatGPT plugin ZIP (see submission/chatgpt-plugin/).
// Limits come from OpenAI's plugin submission docs (checked 2026-11-09); re-check them before submitting.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { TOOL_NAMES } from "@weather/shared";

export const PLACEHOLDERS = {
  baseUrl: "https://weather-mcp.yourdomain.com",
  developerName: "YOUR NAME",
  supportEmail: "support@example.com",
} as const;

export interface Vars {
  PUBLIC_URL?: string | undefined;
  DEVELOPER_NAME?: string | undefined;
  SUPPORT_EMAIL?: string | undefined;
}

/** Replace the template placeholders with real values (unset variables keep the placeholder). */
export function applyVars(text: string, vars: Vars): string {
  let out = text;
  if (vars.PUBLIC_URL)
    out = out.replaceAll(PLACEHOLDERS.baseUrl, vars.PUBLIC_URL.replace(/\/+$/, ""));
  if (vars.DEVELOPER_NAME) out = out.replaceAll(PLACEHOLDERS.developerName, vars.DEVELOPER_NAME);
  if (vars.SUPPORT_EMAIL) out = out.replaceAll(PLACEHOLDERS.supportEmail, vars.SUPPORT_EMAIL);
  return out;
}

/** Placeholders still present, i.e. things you must replace before submitting. */
export function remainingPlaceholders(text: string): string[] {
  return Object.values(PLACEHOLDERS).filter((p) => text.includes(p));
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
}
export function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Width/height of a PNG from its IHDR, or null if it is not a PNG. */
export function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const SECRET_KEY = /secret|password|passwd|api[_-]?key|bearer|credential|access[_-]?token/i;
function secretKeys(v: unknown, trail = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => secretKeys(x, `${trail}[${i}]`));
  if (!isObj(v)) return [];
  return Object.entries(v).flatMap(([k, x]) => [
    ...(SECRET_KEY.test(k) ? [`${trail}.${k}`] : []),
    ...secretKeys(x, `${trail}.${k}`),
  ]);
}

const httpsUrl = (v: unknown, max = 1024) => {
  if (typeof v !== "string" || v.length > max) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** Returns a list of problems (empty = the package meets the documented limits). */
export function validateSubmission(dir: string, vars: Vars = {}): string[] {
  const problems: string[] = [];
  const bad = (msg: string) => problems.push(msg);

  const read = (name: string): Json | null => {
    const file = path.join(dir, name);
    if (!existsSync(file)) {
      bad(`${name} is missing`);
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(applyVars(readFileSync(file, "utf8"), vars));
      if (isObj(parsed)) return parsed;
      bad(`${name} must contain a JSON object`);
    } catch (e) {
      bad(`${name} is not valid JSON: ${(e as Error).message}`);
    }
    return null;
  };
  const plugin = read("plugin.json");
  const mcp = read("mcp.json");

  // ---- layout: manifest + mcp.json + assets only, at the archive root
  for (const entry of existsSync(dir) ? readdirSync(dir) : []) {
    if (!["plugin.json", "mcp.json", "assets"].includes(entry))
      bad(`unexpected file in package root: ${entry}`);
  }

  // ---- mcp.json
  if (mcp) {
    const servers = isObj(mcp.mcpServers) ? Object.entries(mcp.mcpServers) : [];
    if (servers.length !== 1) bad("mcp.json must declare exactly one server");
    const server = servers[0]?.[1];
    if (isObj(server)) {
      if (server.type !== "streamable-http") bad('mcp.json server type must be "streamable-http"');
      if (!httpsUrl(server.url, 2048) || !str(server.url).endsWith("/mcp"))
        bad("mcp.json server url must be an https URL ending in /mcp");
      const auth =
        isObj(server.extensions) && isObj(server.extensions["com.openai"])
          ? server.extensions["com.openai"].auth
          : undefined;
      if (!isObj(auth) || auth.type !== "none")
        bad('mcp.json auth.type must be "none" (this app has no login)');
    }
    for (const k of secretKeys(mcp)) bad(`mcp.json contains a secret-like key: ${k}`);
  }

  if (!plugin) return problems;
  for (const k of secretKeys(plugin)) bad(`plugin.json contains a secret-like key: ${k}`);

  // ---- identity
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(str(plugin.name)) || str(plugin.name).length > 64)
    bad("name must be lowercase letters/numbers/single hyphens, at most 64 characters");
  if (!/^\d+\.\d+\.\d+$/.test(str(plugin.version))) bad("version must be semantic (1.0.0)");
  if (!str(plugin.description) || str(plugin.description).length > 4000)
    bad("description is required, at most 4000 characters");
  const author = isObj(plugin.author) ? plugin.author : {};
  if (!str(author.name) || str(author.name).length > 120)
    bad("author.name is required, at most 120 characters");
  if (author.url !== undefined && !httpsUrl(author.url, 2048)) bad("author.url must be https");

  // ---- listing
  const ext =
    isObj(plugin.extensions) && isObj(plugin.extensions["com.openai"])
      ? plugin.extensions["com.openai"]
      : undefined;
  if (!ext) {
    bad("extensions.com.openai is missing");
    return problems;
  }
  const ui = isObj(ext.interface) ? ext.interface : {};
  const len = (field: string, max: number, oneLine = false) => {
    const v = str(ui[field]);
    if (!v) bad(`interface.${field} is required`);
    else if (v.length > max)
      bad(`interface.${field} is ${v.length} characters; the limit is ${max}`);
    if (oneLine && /\n/.test(v)) bad(`interface.${field} must be one line`);
  };
  len("displayName", 30);
  len("shortDescription", 30, true);
  len("longDescription", 4000);
  len("developerName", 80);
  if (!str(ui.category)) bad("interface.category is required");
  for (const f of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    if (!httpsUrl(ui[f])) bad(`interface.${f} must be an https URL of at most 1024 characters`);
  }
  const prompts = Array.isArray(ui.defaultPrompt) ? (ui.defaultPrompt as unknown[]).map(str) : [];
  if (prompts.length === 0 || prompts.length > 3)
    bad("interface.defaultPrompt must have 1 to 3 prompts");
  if (new Set(prompts.map((p) => p.normalize("NFKC").trim().toLowerCase())).size !== prompts.length)
    bad("default prompts must be unique");
  for (const p of prompts) {
    if (p.length > 128 || /\n/.test(p))
      bad(`default prompt too long or multi-line: "${p.slice(0, 40)}…"`);
    if (p.includes("@")) bad(`default prompt must not contain an @mention: "${p}"`);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(str(ui.brandColor)) || contrast(str(ui.brandColor), "#ffffff") < 2)
    bad("brandColor must be #RRGGBB with at least 2:1 contrast against white");
  if (
    !/^#[0-9a-fA-F]{6}$/.test(str(ui.brandColorDark)) ||
    contrast(str(ui.brandColorDark), "#212121") < 2
  )
    bad("brandColorDark must be #RRGGBB with at least 2:1 contrast against #212121");

  // ---- icons: square PNG, 48-4096 px, at most 5 MiB
  for (const f of ["logo", "composerIcon"]) {
    const rel = str(ui[f]);
    if (!rel.startsWith("./")) {
      bad(`interface.${f} must be a ./-prefixed relative path`);
      continue;
    }
    const file = path.join(dir, rel);
    if (!existsSync(file)) {
      bad(`interface.${f}: ${rel} does not exist`);
      continue;
    }
    if (statSync(file).size > 5 * 1024 * 1024) bad(`${rel} is larger than 5 MiB`);
    const size = pngSize(readFileSync(file));
    if (!size) bad(`${rel} is not a PNG`);
    else if (size.width !== size.height)
      bad(`${rel} must be square (${size.width}x${size.height})`);
    else if (size.width < 48 || size.width > 4096) bad(`${rel} must be between 48 and 4096 pixels`);
  }

  // ---- review
  const review = isObj(ext.review) ? ext.review : {};
  const cases = isObj(review.test_cases) ? review.test_cases : {};
  const positive = Array.isArray(cases.positive) ? (cases.positive as unknown[]) : [];
  const negative = Array.isArray(cases.negative) ? (cases.negative as unknown[]) : [];
  if (positive.length !== 5)
    bad(`exactly 5 positive test cases are required (found ${positive.length})`);
  if (negative.length !== 3)
    bad(`exactly 3 negative test cases are required (found ${negative.length})`);
  const toolNames = new Set<string>(Object.values(TOOL_NAMES));
  positive.forEach((c, i) => {
    const o = isObj(c) ? c : {};
    for (const f of ["description", "prompt", "tools_triggered", "expected_behavior"])
      if (!str(o[f])) bad(`positive[${i}].${f} is required`);
    for (const t of str(o.tools_triggered)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!toolNames.has(t)) bad(`positive[${i}] names an unknown tool: ${t}`);
    }
  });
  negative.forEach((c, i) => {
    const o = isObj(c) ? c : {};
    for (const f of ["description", "prompt"])
      if (!str(o[f])) bad(`negative[${i}].${f} is required`);
  });
  for (const forbidden of ["test_credentials", "reviewer_instructions"]) {
    if (forbidden in review)
      bad(`review.${forbidden} must not be in the package (enter it in the portal)`);
  }
  if (!str(isObj(ext.publication) ? ext.publication.release_notes : ""))
    bad("publication.release_notes is required");
  return problems;
}
