import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("payout calculation", () => {
  it("calculates 2.5% murabahah payouts for four investors", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T00:00:00.000Z";
    const investors = [
      ["inv_a", "Investor A", 1_000_000],
      ["inv_b", "Investor B", 2_000_000],
      ["inv_c", "Investor C", 1_000_000],
      ["inv_d", "Investor D", 3_000_000],
    ] as const;

    for (const [id, name, amount] of investors) {
      await pool.query(
        `insert into investors (id, workspace_owner_id, name, whatsapp, address, notes, is_active, created_at, updated_at)
         values ($1, $2, $3, '0812', 'Alamat', '', 1, $4, $4)`,
        [id, WORKSPACE_ID, name, timestamp]
      );
      await pool.query(
        `insert into investments (
          id, investor_id, workspace_owner_id, type, akad_type, amount, monthly_return_rate_pct, start_date,
          is_active, created_at, updated_at
        )
        values ($1, $2, $3, 'uang', 'murabahah_bil_wakalah', $4, 2.5, $5, 1, $5, $5)`,
        [`ivt_${id}`, id, WORKSPACE_ID, amount, timestamp]
      );
    }

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at)
       values ('trx_profit', $1, 7000000, 'Tunai', $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('itm_profit', 'trx_profit', 'prd_kopi', 'Kopi Sachet', 1, 7000000, 0)`,
    );

    const { calculatePayouts, saveDraftPayouts, updatePayoutStatus } = await import("@/lib/server/profit-sharing");
    const result = await calculatePayouts(WORKSPACE_ID, 2026, 6);

    expect(result.baseProfit).toBe(7000000);
    expect(result.totalInvestorPayout).toBe(175000);
    expect(result.pcmShare).toBe(2047500);
    expect(result.storeShare).toBe(4777500);
    expect(result.payouts.map((payout) => payout.amount)).toEqual([25000, 50000, 25000, 75000]);
    expect(result.payouts[1]).toMatchObject({
      akadType: "murabahah_bil_wakalah",
      baseAmount: 2_000_000,
      ratePct: 2.5,
      amount: 50_000,
    });

    await saveDraftPayouts(WORKSPACE_ID, 2026, 6);
    const saved = await pool.query(
      "select id, status, amount from investor_payouts where workspace_owner_id = $1 order by amount asc",
      [WORKSPACE_ID]
    );
    const savedRows = saved.rows as Array<{ id: string; status: string; amount: number }>;
    expect(saved.rows).toHaveLength(4);
    expect(savedRows.map((row) => row.amount)).toEqual([25000, 25000, 50000, 75000]);

    const approved = await updatePayoutStatus(WORKSPACE_ID, savedRows[0].id, "disetujui");
    expect(approved.status).toBe("disetujui");
    const paid = await updatePayoutStatus(
      WORKSPACE_ID,
      savedRows[0].id,
      "dibayar",
      "2026-06-30T10:00:00.000Z"
    );
    expect(paid.status).toBe("dibayar");
    expect(paid.paidAt).toBeTruthy();

    await expect(
      saveDraftPayouts(WORKSPACE_ID, 2026, 6)
    ).rejects.toThrow("PAYOUTS_ALREADY_EXIST");
  });

  it("calculates consignment payout from product margin", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T00:00:00.000Z";

    await pool.query(
      `insert into investors (id, workspace_owner_id, name, whatsapp, address, notes, is_active, created_at, updated_at)
       values ('inv_barang', $1, 'Investor Barang', '0812', 'Alamat', '', 1, $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into investments (
        id, investor_id, workspace_owner_id, type, akad_type, product_id, unit_count, unit_cost,
        profit_share_per_unit_pct, start_date, is_active, created_at, updated_at
      )
      values ('ivt_barang', 'inv_barang', $1, 'barang_titip_jual', 'barang_titip_jual', 'prd_roti', 10, 3000, 15, $2, 1, $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at)
       values ('trx_barang', $1, 10000, 'Tunai', $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('itm_barang', 'trx_barang', 'prd_roti', 'Roti', 2, 5000, 3000)`
    );

    const { calculatePayouts } = await import("@/lib/server/profit-sharing");
    const result = await calculatePayouts(WORKSPACE_ID, 2026, 6);

    expect(result.payouts[0]).toMatchObject({
      investorName: "Investor Barang",
      akadType: "barang_titip_jual",
      baseAmount: 4000,
      amount: 600,
    });
  });

  it("previews, stores, lists, approves, and pays payout drafts via API", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T00:00:00.000Z";

    await pool.query(
      `insert into investors (id, workspace_owner_id, name, whatsapp, address, notes, is_active, created_at, updated_at)
       values ('inv_api', $1, 'Investor API', '0812', 'Alamat', '', 1, $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into investments (
        id, investor_id, workspace_owner_id, type, akad_type, amount, monthly_return_rate_pct,
        start_date, is_active, created_at, updated_at
      )
      values ('ivt_api', 'inv_api', $1, 'uang', 'murabahah_bil_wakalah', 2000000, 2.5, $2, 1, $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );

    const calculateRoute = await import("@/app/api/payouts/calculate/route");
    const payoutsRoute = await import("@/app/api/payouts/route");
    const payoutRoute = await import("@/app/api/payouts/[id]/route");

    const previewResponse = await calculateRoute.POST(
      jsonRequest("http://localhost/api/payouts/calculate", { year: 2026, month: 6 })
    );
    const previewBody = await previewResponse.json();
    expect(previewResponse.status).toBe(200);
    expect(previewBody.calculation.payouts[0]).toMatchObject({
      investorName: "Investor API",
      akadType: "murabahah_bil_wakalah",
      baseAmount: 2_000_000,
      ratePct: 2.5,
      amount: 50_000,
    });

    const beforeSave = await pool.query("select count(*)::int as count from investor_payouts");
    expect(beforeSave.rows[0].count).toBe(0);

    const saveResponse = await payoutsRoute.POST(
      jsonRequest("http://localhost/api/payouts", { year: 2026, month: 6 })
    );
    expect(saveResponse.status).toBe(200);

    const duplicate = await payoutsRoute.POST(
      jsonRequest("http://localhost/api/payouts", { year: 2026, month: 6 })
    );
    expect(duplicate.status).toBe(409);

    const listResponse = await payoutsRoute.GET(
      new NextRequest("http://localhost/api/payouts?year=2026&month=6")
    );
    const listBody = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listBody.payouts).toHaveLength(1);
    expect(listBody.payouts[0]).toMatchObject({
      investorName: "Investor API",
      status: "draft",
      amount: 50_000,
    });

    const payoutId = listBody.payouts[0].id as string;
    const approved = await payoutRoute.PATCH(
      jsonRequest(`http://localhost/api/payouts/${payoutId}`, { status: "disetujui" }, "PATCH"),
      { params: Promise.resolve({ id: payoutId }) }
    );
    expect(approved.status).toBe(200);

    const paid = await payoutRoute.PATCH(
      jsonRequest(`http://localhost/api/payouts/${payoutId}`, { status: "dibayar" }, "PATCH"),
      { params: Promise.resolve({ id: payoutId }) }
    );
    const paidBody = await paid.json();
    expect(paid.status).toBe(200);
    expect(paidBody.payout).toMatchObject({ status: "dibayar" });
    expect(paidBody.payout.paidAt).toBeTruthy();
  });
});
