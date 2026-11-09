// Sections shown on the preview page. Views register themselves here as they are built.
import type { ReactNode } from "react";

export interface PreviewSection {
  title: string;
  /** Rendered once per theme. */
  render: () => ReactNode;
}

export const sections: PreviewSection[] = [];
