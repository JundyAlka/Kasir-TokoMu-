import { describe, expect, it, vi } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("transaction occurred_at", () => {
  it("reports a backdated sale on its occurrence day, not on its entry day", async () => {
    const { pool } = await setupTestDb();
    const occurredAt = "2026-08-03T03:00:00.000Z";
    const createdAt = "2026-08-10T03:00:00.000Z";
    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_backdated', $1, 25500, 'Tunai', $2, $3)`,
      [WORKSPACE_ID, createdAt, occurredAt]
    );

    const originalQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation(async (query: unknown, ...args: unknown[]) => {
      if (typeof query === "string" && query.includes("extract(hour")) return { rows: [] } as never;
      return (originalQuery as (...callArgs: unknown[]) => Promise<unknown>)(query, ...args) as never;
    });
    const { getOmzetDetail } = await import("@/lib/server/reporting");

    expect(await getOmzetDetail(WORKSPACE_ID, new Date(occurredAt))).toMatchObject({ revenue: 25500, txnCount: 1 });
    expect(await getOmzetDetail(WORKSPACE_ID, new Date(createdAt))).toMatchObject({ revenue: 0, txnCount: 0 });
  });

  it("rejects a duplicate external import reference", async () => {
    const { pool } = await setupTestDb();
    const values = [WORKSPACE_ID, "2026-08-03T03:00:00.000Z", "BF-20260803-01"];
    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at, entry_source, external_ref)
       values ('trx_import_1', $1, 1000, 'Tunai', $2, $2, 'import', $3)`,
      values
    );

    await expect(
      pool.query(
        `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at, entry_source, external_ref)
         values ('trx_import_2', $1, 2000, 'Tunai', $2, $2, 'import', $3)`,
        values
      )
    ).rejects.toThrow();
  });

  it("keeps all legacy report metrics identical when occurred_at equals created_at", async () => {
    const { pool } = await setupTestDb();
    const { getJakartaDayRange } = await import("@/lib/server/timezone");
    const today = getJakartaDayRange();
    const legacyTimestamp = new Date(new Date(today.start).getTime() + 60_000).toISOString();
    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_legacy', $1, 25500, 'Tunai', $2, $2)`,
      [WORKSPACE_ID, legacyTimestamp]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values
         ('itm_legacy_1', 'trx_legacy', 'prd_beras', 'Beras', 1, 10000, 7000),
         ('itm_legacy_2', 'trx_legacy', 'prd_kopi', 'Kopi', 1, 8500, 5000),
         ('itm_legacy_3', 'trx_legacy', 'prd_roti', 'Roti', 1, 7000, 4000)`
    );
    const result = await pool.query(
      "select created_at, occurred_at from transactions where id = 'trx_legacy'"
    );
    const legacyRow = result.rows[0] as { created_at: Date; occurred_at: Date } | undefined;
    expect(legacyRow?.created_at.toISOString()).toBe(legacyTimestamp);
    expect(legacyRow?.occurred_at.toISOString()).toBe(legacyTimestamp);

    const originalQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation(async (query: unknown, ...args: unknown[]) => {
      if (typeof query === "string" && query.includes("extract(hour")) return { rows: [] } as never;
      return (originalQuery as (...callArgs: unknown[]) => Promise<unknown>)(query, ...args) as never;
    });
    const { getOmzetDetail, getTransaksiDetail } = await import("@/lib/server/reporting");
    const { calculatePeriodProfit } = await import("@/lib/server/profit-sharing");
    const { buildSeries } = await import("@/lib/reporting");
    const expected = {
      omzet: 25500,
      hpp: 16000,
      labaKotor: 9500,
      transaksi: 1,
      trenHarian: 25500,
    };

    const [omzet, transaksi, laba] = await Promise.all([
      getOmzetDetail(WORKSPACE_ID, new Date(legacyTimestamp)),
      getTransaksiDetail(WORKSPACE_ID, new Date(legacyTimestamp)),
      calculatePeriodProfit(WORKSPACE_ID, today.start, today.end),
    ]);
    const trend = buildSeries("harian", [
      {
        id: "trx_legacy",
        paymentMethod: "Tunai",
        occurredAt: legacyTimestamp,
        createdAt: legacyTimestamp,
        entrySource: "pos",
        total: expected.omzet,
        paidAmount: expected.omzet,
        changeAmount: 0,
        items: [
          { productId: "prd_beras", productName: "Beras", quantity: 1, unitPrice: 10000, costPrice: 7000 },
          { productId: "prd_kopi", productName: "Kopi", quantity: 1, unitPrice: 8500, costPrice: 5000 },
          { productId: "prd_roti", productName: "Roti", quantity: 1, unitPrice: 7000, costPrice: 4000 },
        ],
      },
    ]);

    expect(omzet).toMatchObject({ revenue: expected.omzet, grossProfit: expected.labaKotor, txnCount: expected.transaksi });
    expect(transaksi).toMatchObject({ txnCount: expected.transaksi });
    expect(laba).toMatchObject({ revenue: expected.omzet, cogs: expected.hpp, grossProfit: expected.labaKotor });
    expect(trend.at(-1)?.revenue).toBe(expected.trenHarian);
  });
});
