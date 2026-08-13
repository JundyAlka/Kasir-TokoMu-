import { describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../setup";

describe("receipt vision fallback", () => {
  it("uses products from the requesting workspace only", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into products (
        id, user_id, name, category, buy_price, sell_price, stock, minimum_stock,
        description, created_at, updated_at
      ) values ('prd_other_only', 'usr_other', 'Produk Rahasia', 'Makanan', 1234, 2000, 1, 0, '', now(), now())`
    );

    vi.doMock("@/lib/server/ai/gemini", () => ({
      callGemini: vi.fn(async () => ({ choices: [{ message: { content: "[]" } }] })),
    }));
    const { extractReceiptItems } = await import("@/lib/server/ai/vision");

    const rows = await extractReceiptItems("data:image/png;base64,AA==", "usr_other");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rawName: "Produk Rahasia", unitPrice: 1234 });
  });
});
