import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  normalizeAssistantMarkdown,
  parseMarkdown,
} from "@/components/warung/ai-assistant-panel";

describe("assistant markdown cleanup", () => {
  it("removes horizontal rules and heading markers without changing content", () => {
    expect(
      normalizeAssistantMarkdown(
        "Berikut rekomendasi:\n\n---\n\n### 🛍️ Prioritas Restok Segera\n(Laku & Stok Menipis)",
      ),
    ).toBe("Berikut rekomendasi:\n\n🛍️ Prioritas Restok Segera\n(Laku & Stok Menipis)");
  });

  it("keeps list markers and bold text intact", () => {
    expect(normalizeAssistantMarkdown("1. **Detergen**\n- **Sisa Stok:** 1 unit")).toBe(
      "1. **Detergen**\n- **Sisa Stok:** 1 unit",
    );
  });

  it("renders single-star emphasis without showing the star characters", () => {
    const html = renderToStaticMarkup(parseMarkdown("- *Sisa Stok:* 12 unit"));

    expect(html).toContain("Sisa Stok:");
    expect(html).toContain("12 unit");
    expect(html).not.toContain("*");
  });
});
