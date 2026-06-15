import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("POS transactions", () => {
  it("checks out two items, reduces stock, and calculates total", async () => {
    const { pool } = await setupTestDb();
    const { createTransaction } = await import("@/lib/server/app-service");

    const result = await createTransaction(WORKSPACE_ID, {
      paymentMethod: "Tunai",
      items: [{ productId: "prd_kopi", quantity: 2 }],
    });

    expect(result.transaction.total).toBe(4000);
    expect(result.transaction.items[0]).toMatchObject({
      productId: "prd_kopi",
      quantity: 2,
      unitPrice: 2000,
    });

    const stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(18);
  });

  it("returns 409 when stock is insufficient and keeps stock unchanged", async () => {
    const { pool } = await setupTestDb();
    const { POST } = await import("@/app/api/transactions/route");
    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "Tunai",
        items: [{ productId: "prd_beras", quantity: 99 }],
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(409);

    const stock = await pool.query("select stock from products where id = 'prd_beras'");
    expect(stock.rows[0].stock).toBe(10);
  });
});
