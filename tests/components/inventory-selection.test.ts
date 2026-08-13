import { describe, expect, it } from "vitest";
import {
  areAllIdsSelected,
  toggleAllIds,
  toggleSelectedId,
} from "@/lib/inventory-selection";

describe("inventory table selection", () => {
  it("toggles one product without changing the other selected products", () => {
    expect([...toggleSelectedId(new Set(["product-a"]), "product-b")]).toEqual([
      "product-a",
      "product-b",
    ]);
    expect([...toggleSelectedId(new Set(["product-a", "product-b"]), "product-a")]).toEqual([
      "product-b",
    ]);
  });

  it("selects every visible product and preserves selections outside the current filter", () => {
    expect([...toggleAllIds(new Set(["outside-filter"]), ["product-a", "product-b"])]).toEqual([
      "outside-filter",
      "product-a",
      "product-b",
    ]);
  });

  it("clears only visible products when all visible products are already selected", () => {
    const selected = new Set(["outside-filter", "product-a", "product-b"]);

    expect(areAllIdsSelected(selected, ["product-a", "product-b"])).toBe(true);
    expect([...toggleAllIds(selected, ["product-a", "product-b"])]).toEqual(["outside-filter"]);
  });

  it("does not report an empty table as fully selected", () => {
    expect(areAllIdsSelected(new Set(), [])).toBe(false);
  });
});
