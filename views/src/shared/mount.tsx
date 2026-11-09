import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

/** Render a view into #root. */
export function mount(node: ReactNode): void {
  const root = document.getElementById("root");
  if (!root) throw new Error("#root element not found");
  createRoot(root).render(<StrictMode>{node}</StrictMode>);
}
