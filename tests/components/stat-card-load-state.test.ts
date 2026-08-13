import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatCard } from "@/components/stat-card";

describe("StatCard data state", () => {
  const props = {
    title: "Nilai stok",
    value: "Rp0",
    description: "Nilai inventaris.",
    onRetry: () => undefined,
  };

  it("does not render a zero value while data loading", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { ...props, dataState: "loading" }));
    expect(html).toContain("Memuat data...");
    expect(html).not.toContain("Rp0");
  });

  it("shows a retryable error instead of a zero value on failure", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { ...props, dataState: "error" }));
    expect(html).toContain("Gagal memuat data, coba lagi");
    expect(html).toContain("Muat ulang");
    expect(html).not.toContain("Rp0");
  });

  it("only renders zero once the response is genuinely ready", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { ...props, dataState: "ready" }));
    expect(html).toContain("Rp0");
  });
});
