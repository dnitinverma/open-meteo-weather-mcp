// Mocks @modelcontextprotocol/ext-apps/react so views run without a host.
import type { CallToolResult } from "@modelcontextprotocol/client";
import { vi } from "vitest";

export interface FakeApp {
  ontoolresult?: (r: CallToolResult) => void;
  ontoolinput?: (p: unknown) => void;
  ontoolcancelled?: (p: unknown) => void;
  callServerTool: ReturnType<typeof vi.fn>;
  openLink: ReturnType<typeof vi.fn>;
  getHostCapabilities: () => { openLinks?: object };
  getHostContext: () => undefined;
}

export const fake: { app: FakeApp | null } = { app: null };

export function newFakeApp(): FakeApp {
  const app: FakeApp = {
    callServerTool: vi.fn(),
    openLink: vi.fn(async () => ({})),
    getHostCapabilities: () => ({ openLinks: {} }),
    getHostContext: () => undefined,
  };
  fake.app = app;
  return app;
}

/** Module factory for vi.mock("@modelcontextprotocol/ext-apps/react", ...). */
export const extAppsReactMock = () => ({
  useApp: ({ onAppCreated }: { onAppCreated?: (a: unknown) => void }) => {
    const app = fake.app ?? newFakeApp();
    if (!(app as { __created?: boolean }).__created) {
      (app as { __created?: boolean }).__created = true;
      onAppCreated?.(app);
    }
    return { app, isConnected: true, error: null };
  },
  useHostStyles: () => {},
});

/** Deliver a tool result to the view as the host would. */
export function deliver(result: CallToolResult): void {
  fake.app?.ontoolresult?.(result);
}

export const ok = (structuredContent: unknown): CallToolResult => ({
  content: [{ type: "text", text: "summary" }],
  structuredContent: structuredContent as Record<string, unknown>,
});
export const fail = (structuredContent: unknown): CallToolResult => ({
  content: [{ type: "text", text: "error" }],
  structuredContent: structuredContent as Record<string, unknown>,
  isError: true,
});
