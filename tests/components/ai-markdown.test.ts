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

  it("renders markdown tables cleanly with table, th, and td elements", () => {
    const markdown = "🚨 Produk Stok HABIS (0 unit)\n| Produk | Harga Jual |\n|--------|------------|\n| Topi Anak-anak | Rp25.000 |\n| Pendek Bapak | Rp30.000 |";
    const html = renderToStaticMarkup(parseMarkdown(markdown));

    expect(html).toContain("<table");
    expect(html).toContain("Topi Anak-anak");
    expect(html).toContain("Rp25.000");
    expect(html).toContain("Pendek Bapak");
    expect(html).toContain("Rp30.000");
    expect(html).not.toContain("|--------|");
  });

  it("renders ordered lists as ol with li elements", () => {
    const markdown = "1. Beli beras\n2. Cek stok minyak";
    const html = renderToStaticMarkup(parseMarkdown(markdown));

    expect(html).toContain("<ol");
    expect(html).toContain("Beli beras");
    expect(html).toContain("Cek stok minyak");
  });

  it("handles table rows where the last row has trailing text attached without newline", () => {
    const markdown = "| No | Produk | Harga |\n|---|---|---|\n| 13 | Lanting Slondok | Rp14.000 |\n| 14 | Criping Balado (Berkah) | Rp13.000 |Hai Pimpinan! Terima kasih sudah tunggu.";
    const html = renderToStaticMarkup(parseMarkdown(markdown));

    expect(html).toContain("<table");
    expect(html).toContain("Criping Balado (Berkah)");
    expect(html).toContain("Rp13.000");
    expect(html).toContain("Hai Pimpinan! Terima kasih sudah tunggu.");
    expect(html).not.toContain("| 14 |");
  });
});
