import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("restock history", () => {
  it("does not join product details from another workspace", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T00:00:00.000Z";
    await pool.query(
      `insert into products (
        id, user_id, name, category, buy_price, sell_price, stock, minimum_stock,
        description, created_at, updated_at
      ) values ('prd_other', 'usr_other', 'Produk Rahasia', 'Makanan', 9000, 10000, 3, 1, '', $1, $1)`,
      [timestamp]
    );
    await pool.query(
      `insert into restock_logs (
        id, workspace_owner_id, product_id, performed_by_user_id, source, quantity,
        unit_cost, note, created_at
      ) values ('rsl_cross_workspace', $1, 'prd_other', $1, 'manual', 1, 9000, 'cross-workspace fixture', $2)`,
      [WORKSPACE_ID, timestamp]
    );

    const { GET } = await import("@/app/api/restock/history/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.batches[0].items[0].productName).toBeNull();
  });
});
