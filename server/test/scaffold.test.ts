import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { VERSION } from "../src/version.js";
import { connectClient } from "./helpers.js";

describe("config", () => {
  it("applies defaults", () => {
    expect(loadConfig({})).toEqual({ PORT: 3001, LOG_LEVEL: "info", DAILY_UPSTREAM_LIMIT: 9000 });
  });
  it("coerces numbers from strings", () => {
    expect(loadConfig({ PORT: "8080", DAILY_UPSTREAM_LIMIT: "10" })).toMatchObject({
      PORT: 8080,
      DAILY_UPSTREAM_LIMIT: 10,
    });
  });
  it("rejects invalid values with a readable message", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/Invalid environment configuration — PORT/);
    expect(() => loadConfig({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});

describe("MCP server (in-memory)", () => {
  it("connects and lists tools", async () => {
    const { client, close } = await connectClient();
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    await close();
  });
});

describe("HTTP app", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("GET /health returns status ok and the package version", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: VERSION });
  });

  it("POST /mcp serves tools over Streamable HTTP (stateless)", async () => {
    const client = new Client({ name: "http-test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain("get_forecast");
    await client.close();
  });

  it("sends CORS headers", async () => {
    const res = await fetch(`${base}/health`, { headers: { Origin: "https://claude.ai" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("GET /mcp is 405 in stateless mode", async () => {
    const res = await fetch(`${base}/mcp`);
    expect(res.status).toBe(405);
  });
});
