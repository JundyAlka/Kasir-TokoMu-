import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("cashier ledger API (/api/reports/cashier-ledger)", () => {
  it("returns comprehensive ledger data for the selected period", async () => {
    const { pool } = await setupTestDb();
    
    // Seed an expense
    await pool.query(
      `insert into expenses (id, user_id, title, amount, category, created_at)
       values ('exp_atk_1', $1, 'Kertas Nota ATK', 46000, 'ATK', '2026-07-15T08:00:00.000Z')
       on conflict (id) do nothing`,
      [WORKSPACE_ID]
    );

    // Seed a debt
    await pool.query(
      `insert into debts (id, user_id, borrower_name, whatsapp, amount, paid_amount, is_paid, created_at)
       values ('dbt_nining_1', $1, 'Mba Nining', '08123456789', 41500, 0, 0, '2026-07-10T08:00:00.000Z')
       on conflict (id) do nothing`,
      [WORKSPACE_ID]
    );

    const route = await import("@/app/api/reports/cashier-ledger/route");
    const req = new NextRequest("http://localhost/api/reports/cashier-ledger?period=2026-07");
    const response = await route.GET(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toHaveProperty("period", "2026-07");
    expect(json).toHaveProperty("cekStok");
    expect(json.cekStok).toHaveProperty("inventoryCapital");
    expect(json.cekStok).toHaveProperty("totalProducts");
    expect(json.cekStok).toHaveProperty("categories");
    expect(Array.isArray(json.cekStok.categories)).toBe(true);

    expect(json).toHaveProperty("pemasukan");
    expect(json.pemasukan).toHaveProperty("revenue");

    expect(json).toHaveProperty("pengeluaran");
    expect(json.pengeluaran).toHaveProperty("total");
    expect(Array.isArray(json.pengeluaran.categories)).toBe(true);

    expect(json).toHaveProperty("piutangToko");
    expect(json.piutangToko.total).toBeGreaterThanOrEqual(41500);
    expect(Array.isArray(json.piutangToko.list)).toBe(true);
    expect(json.piutangToko.list.some((d: any) => d.borrowerName === "Mba Nining")).toBe(true);

    expect(json).toHaveProperty("hutangToko");
    expect(json.hutangToko).toHaveProperty("total");

    expect(json).toHaveProperty("neraca");
    expect(json.neraca).toHaveProperty("stokBarang");
    expect(json.neraca).toHaveProperty("piutang");
    expect(json.neraca).toHaveProperty("totalHutang");
  });

  it("rejects invalid period parameter", async () => {
    await setupTestDb();
    const route = await import("@/app/api/reports/cashier-ledger/route");
    const req = new NextRequest("http://localhost/api/reports/cashier-ledger?period=invalid");
    const response = await route.GET(req);

    expect(response.status).toBe(400);
  });
});
