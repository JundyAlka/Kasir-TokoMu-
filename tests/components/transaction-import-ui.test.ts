import { describe, expect, it } from "vitest";
import {
  canContinueTransactionImport,
  importIssueLabel,
  isCashierRestrictedPath,
} from "@/lib/transaction-import-ui";

describe("transaction import UI rules", () => {
  it("locks continuation while the preview has an unknown product", () => {
    expect(canContinueTransactionImport(1, 0, false)).toBe(false);
    expect(importIssueLabel.PRODUK_TIDAK_DITEMUKAN).toBe(
      "Nama produk tidak ada di daftar barang."
    );
  });

  it("requires warning acknowledgement but permits a warning-only preview", () => {
    expect(canContinueTransactionImport(0, 1, false)).toBe(false);
    expect(canContinueTransactionImport(0, 1, true)).toBe(true);
  });

  it("marks finance URLs as restricted for cashier while keeping POS and laporan paths available", () => {
    expect(isCashierRestrictedPath("kasir", "/laporan")).toBe(false);
    expect(isCashierRestrictedPath("kasir", "/laporan-pcm")).toBe(true);
    expect(isCashierRestrictedPath("kasir", "/investor/inv_1")).toBe(true);
    expect(isCashierRestrictedPath("kasir", "/kasir")).toBe(false);
    expect(isCashierRestrictedPath("pimpinan", "/laporan")).toBe(false);
  });
});
