import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

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
          id, investor_id, workspace_owner_id, type, amount, profit_share_pct, start_date,
          is_active, created_at, updated_at
        )
        values ($1, $2, $3, 'uang', $4, 2.5, $5, 1, $5, $5)`,
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
    const result = await calculatePayouts(
      WORKSPACE_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    );

    expect(result.totalInvestorPayout).toBe(175000);
    expect(result.payouts.map((payout) => payout.amount)).toEqual([25000, 50000, 25000, 75000]);

    await saveDraftPayouts(
      WORKSPACE_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    );
    const saved = await pool.query(
      "select id, status, amount from investor_payouts where workspace_owner_id = $1 order by amount asc",
      [WORKSPACE_ID]
    );
    expect(saved.rows).toHaveLength(4);
    expect(saved.rows.map((row) => row.amount)).toEqual([25000, 25000, 50000, 75000]);

    const approved = await updatePayoutStatus(WORKSPACE_ID, saved.rows[0].id, "disetujui");
    expect(approved.status).toBe("disetujui");
    const paid = await updatePayoutStatus(
      WORKSPACE_ID,
      saved.rows[0].id,
      "dibayar",
      "2026-06-30T10:00:00.000Z"
    );
    expect(paid.status).toBe("dibayar");
    expect(paid.paidAt).toBeTruthy();

    await expect(
      saveDraftPayouts(WORKSPACE_ID, "2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z")
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
        id, investor_id, workspace_owner_id, type, product_id, unit_count, unit_cost,
        profit_share_per_unit_pct, start_date, is_active, created_at, updated_at
      )
      values ('ivt_barang', 'inv_barang', $1, 'barang_titip_jual', 'prd_roti', 10, 3000, 15, $2, 1, $2, $2)`,
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
    const result = await calculatePayouts(
      WORKSPACE_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    );

    expect(result.payouts[0]).toMatchObject({
      investorName: "Investor Barang",
      baseProfit: 4000,
      amount: 600,
    });
  });
});
