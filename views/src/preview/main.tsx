import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../shared/kit.css";
import { KitPreview } from "./KitPreview";
import { sections, type PreviewSection } from "./registry";

const all: PreviewSection[] = [{ title: "Shared kit", render: () => <KitPreview /> }, ...sections];

function Preview() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 32 }}>
      {all.map((s) => (
        <section key={s.title}>
          <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>{s.title}</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {(["light", "dark"] as const).map((theme) => (
              <div
                key={theme}
                className={`wx-theme-${theme}`}
                data-theme={theme}
                style={{
                  width: 600,
                  maxWidth: "100%",
                  background: "var(--wx-bg)",
                  color: "var(--wx-text)",
                  border: "1px solid var(--wx-border)",
                  borderRadius: 12,
                }}
              >
                {s.render()}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Preview />
    </StrictMode>,
  );
}
