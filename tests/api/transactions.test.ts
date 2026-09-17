import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CASHIER_ID, setupTestDb, WORKSPACE_ID } from "../setup";

describe("POS transactions", () => {
  it("checks out two items, reduces stock, and calculates total", async () => {
    const { pool } = await setupTestDb();
    const { createTransaction } = await import("@/lib/server/app-service");

    const result = await createTransaction(WORKSPACE_ID, {
      paymentMethod: "Tunai",
      paidAmount: 10000,
      items: [{ productId: "prd_kopi", quantity: 2 }],
    });

    expect(result.transaction.total).toBe(4000);
    expect(result.transaction.paidAmount).toBe(10000);
    expect(result.transaction.changeAmount).toBe(6000);
    expect(result.transaction.items[0]).toMatchObject({
      productId: "prd_kopi",
      quantity: 2,
      unitPrice: 2000,
    });

    const stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(18);
  });

  it("rejects cash checkout when paid amount is less than total", async () => {
    const { pool } = await setupTestDb();
    const { createShift, openShift } = await import("@/lib/server/shift-service");
    const shift = await createShift(WORKSPACE_ID, { name: "Seharian", startTime: "00:00", endTime: "00:00" });
    await openShift(WORKSPACE_ID, CASHIER_ID, shift.id, 0);
    const { POST } = await import("@/app/api/transactions/route");
    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "Tunai",
        paidAmount: 1000,
        items: [{ productId: "prd_kopi", quantity: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(20);
  });

  it("blocks POS checkout until a shift has been opened", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    const { POST } = await import("@/app/api/transactions/route");

    const response = await POST(new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "Tunai",
        paidAmount: 2000,
        items: [{ productId: "prd_kopi", quantity: 1 }],
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "SHIFT_NOT_OPEN",
      error: "Buka shift dulu sebelum mulai jualan.",
    });
    const stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(20);
  });

  it("returns 409 when stock is insufficient and keeps stock unchanged", async () => {
    const { pool } = await setupTestDb();
    const { createShift, openShift } = await import("@/lib/server/shift-service");
    const shift = await createShift(WORKSPACE_ID, { name: "Seharian", startTime: "00:00", endTime: "00:00" });
    await openShift(WORKSPACE_ID, CASHIER_ID, shift.id, 0);
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

  it("records transaction under the opened shift cashier", async () => {
    const { pool } = await setupTestDb();
    const { createShift, openShift } = await import("@/lib/server/shift-service");
    const { POST } = await import("@/app/api/transactions/route");

    const shift = await createShift(WORKSPACE_ID, {
      name: "Seharian",
      startTime: "00:00",
      endTime: "00:00",
      assignedUserId: CASHIER_ID,
    });
    await openShift(WORKSPACE_ID, CASHIER_ID, shift.id, 0);

    const request = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "Tunai",
        items: [{ productId: "prd_kopi", quantity: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      transaction: {
        id: string;
        recordedByUserId: string;
        recordedByName: string;
        shiftSessionId: string | null;
      };
    };

    expect(data.transaction.recordedByUserId).toBe(CASHIER_ID);
    expect(data.transaction.recordedByName).toBe("Kasir");
    expect(data.transaction.shiftSessionId).not.toBeNull();

    const row = await pool.query(
      "select recorded_by_user_id, recorded_by_name, shift_session_id from transactions where id = $1",
      [data.transaction.id]
    );
    expect(row.rows[0]).toMatchObject({
      recorded_by_user_id: CASHIER_ID,
      recorded_by_name: "Kasir",
      shift_session_id: data.transaction.shiftSessionId,
    });
  });

  it("handles idempotent checkout with externalRef without duplicating transactions or stock deduction", async () => {
    const { pool } = await setupTestDb();
    const { createTransaction } = await import("@/lib/server/app-service");

    const idempotencyKey = "pos_test_dedup_123";
    const firstCall = await createTransaction(WORKSPACE_ID, {
      paymentMethod: "Tunai",
      paidAmount: 10000,
      externalRef: idempotencyKey,
      items: [{ productId: "prd_kopi", quantity: 2 }],
    });

    const secondCall = await createTransaction(WORKSPACE_ID, {
      paymentMethod: "Tunai",
      paidAmount: 10000,
      externalRef: idempotencyKey,
      items: [{ productId: "prd_kopi", quantity: 2 }],
    });

    expect(secondCall.transaction.id).toBe(firstCall.transaction.id);
    expect(secondCall.transaction.externalRef).toBe(idempotencyKey);

    // Stock was 20 initially, reduced by 2 once = 18. Must NOT be 16.
    const stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(18);

    // Transactions count for this externalRef must be exactly 1
    const trxCount = await pool.query("select count(*) from transactions where external_ref = $1", [idempotencyKey]);
    expect(Number(trxCount.rows[0].count)).toBe(1);
  });

  it("allows pimpinan to delete a transaction and restores product stock", async () => {
    const { pool } = await setupTestDb();
    const { createTransaction } = await import("@/lib/server/app-service");
    const { DELETE } = await import("@/app/api/transactions/[id]/route");

    // Initially stock is 20
    const created = await createTransaction(WORKSPACE_ID, {
      paymentMethod: "Tunai",
      paidAmount: 10000,
      items: [{ productId: "prd_kopi", quantity: 3 }],
    });

    // Stock after checkout should be 17
    let stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(17);

    // Pimpinan deletes the transaction
    const response = await DELETE(new NextRequest(`http://localhost/api/transactions/${created.transaction.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: created.transaction.id }),
    });

    expect(response.status).toBe(200);

    // Transaction must no longer exist
    const trxRow = await pool.query("select * from transactions where id = $1", [created.transaction.id]);
    expect(trxRow.rows.length).toBe(0);

    // Stock must be restored back to 20
    stock = await pool.query("select stock from products where id = 'prd_kopi'");
    expect(stock.rows[0].stock).toBe(20);
  });

  it("rejects non-pimpinan (kasir) from deleting a transaction", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    const { DELETE } = await import("@/app/api/transactions/[id]/route");

    const response = await DELETE(new NextRequest("http://localhost/api/transactions/trx_random", { method: "DELETE" }), {
      params: Promise.resolve({ id: "trx_random" }),
    });

    expect(response.status).toBe(403);
  });
});
