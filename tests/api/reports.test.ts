import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("profit-loss report", () => {
  it("keeps the live monthly snapshot values when no daily reports exist yet", async () => {
    await setupTestDb();
    const route = await import("@/app/api/reports/monthly/route");
    const liveSummary = {
      revenue: 7_665_000,
      cogs: 6_330_300,
      grossProfit: 1_334_700,
      expenseTotal: 665_300,
      netProfit: 669_400,
      profitDistribution: 0,
      transactionCount: 122,
    };

    const response = await route.POST(jsonRequest("http://localhost/api/reports/monthly", {
      periodYear: 2026,
      periodMonth: 8,
      data: liveSummary,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ report: { data: liveSummary } });
  });

  it("reports a finalized snapshot as stale after a later transaction, then flags PCM after refresh", async () => {
    const { pool } = await setupTestDb();
    const occurredAt = "2026-06-10T03:00:00.000Z";
    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_after_close', $1, 25000, 'Tunai', $2, $2)`,
      [WORKSPACE_ID, occurredAt]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('itm_after_close', 'trx_after_close', 'prd_roti', 'Roti', 1, 25000, 10000)`
    );
    const timestamp = "2026-06-11T03:00:00.000Z";
    const staleSnapshot = { revenue: 0, cogs: 0, grossProfit: 0, expenseTotal: 0, netProfit: 0, profitDistribution: 0, transactionCount: 0 };
    await pool.query(
      `insert into monthly_reports (id, workspace_owner_id, period_year, period_month, data, status, finalized_at, created_at, updated_at)
       values ('mrep_stale', $1, 2026, 6, $2::jsonb, 'final', $3, $3, $3)`,
      [WORKSPACE_ID, JSON.stringify(staleSnapshot), timestamp]
    );

    const route = await import("@/app/api/reports/monthly/route");
    const stale = await (await route.GET(new NextRequest("http://localhost/api/reports/monthly"))).json();
    expect(stale.notifications.snapshotOutdatedPeriods).toEqual(["2026-06"]);
    expect(stale.notifications.pcmOutdatedPeriods).toEqual([]);

    const { getReportRollupByMode } = await import("@/lib/server/monthly-report-service");
    const live = await getReportRollupByMode(WORKSPACE_ID, "bulanan", "2026-06");
    await pool.query(
      `update monthly_reports set data = $2::jsonb where id = 'mrep_stale' and workspace_owner_id = $1`,
      [WORKSPACE_ID, JSON.stringify({ ...live, financial: { ...live, revenue: live.revenue - 1 } })]
    );
    const pcm = await (await route.GET(new NextRequest("http://localhost/api/reports/monthly"))).json();
    expect(pcm.notifications.snapshotOutdatedPeriods).toEqual([]);
    expect(pcm.notifications.pcmOutdatedPeriods).toEqual(["2026-06"]);
  });

  it("uses live transactions for a monthly report when no daily report exists", async () => {
    const { pool } = await setupTestDb();
    const occurredAt = "2026-08-12T03:00:00.000Z";
    const transactionAmounts = Array.from({ length: 122 }, (_, index) => index === 121 ? 62_933 : 62_827);
    expect(transactionAmounts.reduce((sum, amount) => sum + amount, 0)).toBe(7_665_000);

    for (const [index, amount] of transactionAmounts.entries()) {
      await pool.query(
        `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
         values ($1, $2, $3, 'Tunai', $4, $4)`,
        [`trx_august_${index}`, WORKSPACE_ID, amount, occurredAt]
      );
      await pool.query(
        `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
         values ($1, $2, 'prd_roti', 'Roti', 1, $3, $4)`,
        [`itm_august_${index}`, `trx_august_${index}`, amount, Math.floor(amount / 2)]
      );
    }

    const dailyReports = await pool.query("select count(*)::int as count from daily_reports where user_id = $1", [WORKSPACE_ID]);
    expect(dailyReports.rows[0]?.count).toBe(0);

    const route = await import("@/app/api/reports/profit-loss/route");
    const response = await route.GET(new NextRequest("http://localhost/api/reports/profit-loss?range=bulanan&period=2026-08"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ revenue: 7_665_000, transactionCount: 122, source: "live_transactions" });
    expect(body.revenue).not.toBe(0);
  });

  it("counts a three-item transaction once in the omzet detail", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T03:00:00.000Z";

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_three_items', $1, 25500, 'Tunai', $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values
         ('itm_three_1', 'trx_three_items', 'prd_beras', 'Beras', 1, 10000, 7000),
         ('itm_three_2', 'trx_three_items', 'prd_kopi', 'Kopi', 1, 8500, 5000),
         ('itm_three_3', 'trx_three_items', 'prd_roti', 'Roti', 1, 7000, 4000)`
    );

    const originalQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation(async (query: unknown, ...args: unknown[]) => {
      if (typeof query === "string" && query.includes("extract(hour")) {
        return { rows: [] } as never;
      }
      return (originalQuery as (...callArgs: unknown[]) => Promise<unknown>)(query, ...args) as never;
    });
    const { getOmzetDetail } = await import("@/lib/server/reporting");
    const detail = await getOmzetDetail(WORKSPACE_ID, new Date(timestamp));

    expect(detail.revenue).toBe(25500);
    expect(detail.txnCount).toBe(1);
    expect(detail.grossProfit).toBe(9500);
  });

  it("does not aggregate another workspace transaction into bottom products", async () => {
    const { pool } = await setupTestDb();
    const start = "2026-06-01T00:00:00.000Z";
    const end = "2026-07-01T00:00:00.000Z";

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_other_workspace', 'usr_other', 50000, 'Tunai', '2026-06-10T03:00:00.000Z', '2026-06-10T03:00:00.000Z')`
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('itm_other_workspace', 'trx_other_workspace', 'prd_roti', 'Roti', 9, 5000, 3000)`
    );

    const { getBottomProductsForPeriod } = await import("@/lib/server/reporting");
    const rows = await getBottomProductsForPeriod(WORKSPACE_ID, start, end, 10);
    const roti = rows.find((row) => row.productId === "prd_roti");

    expect(roti).toMatchObject({ productId: "prd_roti", sold: 0, revenue: 0 });
  });

  it("calculates revenue 10m - cogs 7m - expenses 1m = net profit 2m", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T00:00:00.000Z";

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_report', $1, 10000000, 'Tunai', $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('itm_report', 'trx_report', 'prd_beras', 'Beras 5kg', 1, 10000000, 7000000)`,
    );
    await pool.query(
      `insert into expenses (id, user_id, title, amount, created_at, category)
       values ('exp_report', $1, 'Operasional', 1000000, $2, 'Operasional')`,
      [WORKSPACE_ID, timestamp]
    );

    const { calculatePeriodProfit } = await import("@/lib/server/profit-sharing");
    const summary = await calculatePeriodProfit(
      WORKSPACE_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    );

    expect(summary.revenue).toBe(10000000);
    expect(summary.cogs).toBe(7000000);
    expect(summary.expenseTotal).toBe(1000000);
    expect(summary.netProfit).toBe(2000000);
  });

  it("summarizes report ranges, series, velocity, and top products", async () => {
    const { pool } = await setupTestDb();
    const { getJakartaDayRange } = await import("@/lib/server/timezone");
    const today = getJakartaDayRange();
    const todayTimestamp = new Date(new Date(today.start).getTime() + 60_000).toISOString();
    const juneTimestamp = "2026-06-10T03:00:00.000Z";

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at, occurred_at)
       values ('trx_top_a', $1, 10000, 'Tunai', $2, $2)`,
      [WORKSPACE_ID, juneTimestamp]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('itm_top_a', 'trx_top_a', 'prd_roti', 'Roti', 2, 5000, 3000)`
    );

    const reporting = await import("@/lib/server/reporting");
    const month = reporting.getPeriodRange(2026, 6);
    const summary = reporting.summarizeReport(
      "harian",
      [
        {
          occurredAt: todayTimestamp,
          total: 10000,
          items: [{ productId: "prd_roti", productName: "Roti", quantity: 2, unitPrice: 5000, costPrice: 3000 }],
        },
      ],
      [{ createdAt: todayTimestamp, amount: 1000 }]
    );
    expect(month).toMatchObject({
      start: "2026-05-31T17:00:00.000Z",
      end: "2026-06-30T17:00:00.000Z",
    });
    expect(summary).toMatchObject({ revenue: 10000, cogs: 6000, expenseTotal: 1000, netProfit: 3000 });

    const dailySeries = reporting.buildSeries("harian", [
      {
        occurredAt: todayTimestamp,
        total: 10000,
        items: [],
      },
    ]);
    const weeklySeries = reporting.buildSeries("mingguan", []);
    const monthlySeries = reporting.buildSeries("bulanan", []);
    expect(dailySeries).toHaveLength(7);
    expect(weeklySeries).toHaveLength(6);
    expect(monthlySeries).toHaveLength(6);
    expect(dailySeries.at(-1)?.revenue).toBe(10000);

    const velocity = reporting.estimateProductVelocity(
      [
        {
          id: "prd_roti",
          name: "Roti",
          category: "Makanan",
          buyPrice: 3000,
          sellPrice: 5000,
          stock: 15,
          minimumStock: 4,
          description: "",
        },
      ],
      [
        {
          occurredAt: todayTimestamp,
          total: 10000,
          items: [{ productId: "prd_roti", productName: "Roti", quantity: 2, unitPrice: 5000, costPrice: 3000 }],
        },
      ]
    );
    expect(velocity[0]).toMatchObject({ productId: "prd_roti", sold: 2, revenue: 10000 });

    const topProducts = await reporting.getTopProductsForPeriod(
      WORKSPACE_ID,
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    );
    expect(topProducts[0]).toMatchObject({ productId: "prd_roti", sold: 2, revenue: 10000 });
  });
});

describe("partner type backfill", () => {
  it("restores legacy consignment capital without treating sales_harian as capital", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-08-01T00:00:00.000Z";
    const legacyPartners = [
      ["inv_arif", "H. Arif", "nitip roti seribuan", 70, 1_000],
      ["inv_siti", "Bu Siti Aminah", "Barang titip jual mi instan 50 dus @ Rp80.000 bagi hasil 15% per unit", 50, 80_000],
      ["inv_koperasi", "Koperasi Aisyiyah Grabag", "Titip jual kebutuhan harian", 54, 10_000],
      ["inv_jundyy", "jundyy", "", 183, 1_000],
    ] as const;
    for (const [id, name, notes, unitCount, unitCost] of legacyPartners) {
      await pool.query(
        `insert into investors (id, workspace_owner_id, name, whatsapp, address, notes, is_active, partner_type, created_at, updated_at)
         values ($1, $2, $3, '', '', $4, 1, 'investor_uang', $5, $5)`,
        [id, WORKSPACE_ID, name, notes, timestamp]
      );
      await pool.query(
        `insert into investments (id, investor_id, workspace_owner_id, type, akad_type, amount, unit_count, unit_cost, start_date, is_active, created_at, updated_at)
         values ($1, $2, $3, 'barang_titip_jual', 'barang_titip_jual', null, $4, $5, $6, 1, $6, $6)`,
        [`ivt_${id}`, id, WORKSPACE_ID, unitCount, unitCost, timestamp]
      );
    }
    await pool.query(
      `insert into investors (id, workspace_owner_id, name, whatsapp, address, notes, is_active, partner_type, created_at, updated_at)
       values ('inv_uang', $1, 'Investor Uang', '', '', 'Modal uang', 1, 'investor_uang', $2, $2),
              ('inv_sales_harian', $1, 'Sales Harian', '', '', '', 1, 'sales_harian', $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into investments (id, investor_id, workspace_owner_id, type, akad_type, amount, start_date, is_active, created_at, updated_at)
       values ('ivt_uang', 'inv_uang', $1, 'uang', 'murabahah_bil_wakalah', 8000000, $2, 1, $2, $2)`,
      [WORKSPACE_ID, timestamp]
    );
    await pool.query(
      `insert into titipan_intakes (id, user_id, investor_id, product_id, intake_date, qty_in, qty_sold, unit_cost, unit_price, settled_amount, shift_session_id, created_at)
       values ('intake_sales', $1, 'inv_sales_harian', 'prd_roti', '2026-08-01', 10, 4, 1000, 1500, 0, null, $2)`,
      [WORKSPACE_ID, timestamp]
    );

    const migration = readFileSync(join(process.cwd(), "migrations", "20260813153001_partner-type-backfill.sql"), "utf8");
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
      await pool.query(statement);
    }

    const { getAssetCapitalSummary } = await import("@/lib/server/reporting");
    const assets = await getAssetCapitalSummary(WORKSPACE_ID);
    expect(assets.consignmentCapital).toBe(4_793_000);
    expect(assets.investorMoneyCapital).toBe(8_000_000);
    expect(assets.investorMoneyCapital + assets.consignmentCapital).toBe(12_793_000);
    expect(assets.dailyConsignmentLiability).toBe(4_000);
  });
});

describe("monthly PCM report", () => {
  it("sums locked daily reports into the monthly close and rejects draft dates with their list", async () => {
    const { pool } = await setupTestDb();
    const stamp = "2026-06-18T00:00:00.000Z";
    for (const [id, date, revenue, cogs, expense, transactions, status] of [
      ["daily_1", "2026-06-01", 10000, 6000, 1000, 2, "locked"],
      ["daily_2", "2026-06-02", 20000, 12000, 2000, 3, "locked"],
      ["daily_draft", "2026-06-03", 5000, 3000, 500, 1, "draft"],
    ] as const) {
      await pool.query(`insert into daily_reports (id, user_id, report_date, opening_total, revenue, cogs, expense_total, gross_profit, net_profit, closing_total, transaction_count, profit_distribution, status, created_at, updated_at) values ($1, $2, $3::date, 0, $4, $5, $6, $4 - $5, $4 - $5 - $6, 0, $7, 0, $8, $9, $9)`, [id, WORKSPACE_ID, date, revenue, cogs, expense, transactions, status, stamp]);
    }
    const route = await import("@/app/api/reports/monthly/route");
    const blocked = await route.POST(jsonRequest("http://localhost/api/reports/monthly", { periodYear: 2026, periodMonth: 6, data: { ignored: true } }));
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).unlockedDates).toEqual(["2026-06-03"]);
    await pool.query("update daily_reports set status = 'locked' where id = 'daily_draft'");
    const closed = await route.POST(jsonRequest("http://localhost/api/reports/monthly", { periodYear: 2026, periodMonth: 6, data: { revenue: 999999 } }));
    expect(closed.status).toBe(200);
    const result = await closed.json();
    expect(result.report.data).toMatchObject({ revenue: 35000, cogs: 21000, expenseTotal: 3500, grossProfit: 14000, netProfit: 10500, transactionCount: 6 });
  });

  it("does not overwrite another workspace monthly report with the same period", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-18T00:00:00.000Z";

    await pool.query(
      `insert into monthly_reports (
        id, workspace_owner_id, period_year, period_month, data, status,
        finalized_at, created_at, updated_at
      ) values ('mrep_other', 'usr_other', 2026, 6, $1::jsonb, 'final', $2, $2, $2)`,
      [JSON.stringify({ owner: "other" }), timestamp]
    );
    await pool.query(
      `insert into monthly_reports (
        id, workspace_owner_id, period_year, period_month, data, status,
        finalized_at, created_at, updated_at
      ) values ('mrep_current', $1, 2026, 6, $2::jsonb, 'draft', null, $3, $3)`,
      [WORKSPACE_ID, JSON.stringify({ owner: "current-before" }), timestamp]
    );

    const updateSql: string[] = [];
    const originalQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation(async (query: unknown, ...args: unknown[]) => {
      const text = typeof query === "string" ? query : (query as { text?: string }).text ?? "";
      if (text.startsWith('update "monthly_reports"')) updateSql.push(text);
      return (originalQuery as (...callArgs: unknown[]) => Promise<unknown>)(query, ...args) as never;
    });

    const route = await import("@/app/api/reports/monthly/route");
    const response = await route.POST(
      jsonRequest("http://localhost/api/reports/monthly", {
        periodYear: 2026,
        periodMonth: 6,
        data: { owner: "current" },
      })
    );
    expect(response.status).toBe(200);

    const other = await pool.query(
      "select data from monthly_reports where id = 'mrep_other'"
    );
    expect(other.rows[0]?.data).toEqual({ owner: "other" });
    expect(updateSql).toHaveLength(1);
    expect(updateSql[0]).toContain('"workspace_owner_id"');
  });

  it("scopes the monthly PCM draft update by workspace", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-18T00:00:00.000Z";
    await pool.query(
      `insert into monthly_reports (
        id, workspace_owner_id, period_year, period_month, data, status,
        finalized_at, created_at, updated_at
      ) values ('mrp_draft', $1, 2026, 6, $2::jsonb, 'draft', null, $3, $3)`,
      [WORKSPACE_ID, JSON.stringify({ version: 1 }), timestamp]
    );

    const updateSql: string[] = [];
    const originalQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation(async (query: unknown, ...args: unknown[]) => {
      const text = typeof query === "string" ? query : (query as { text?: string }).text ?? "";
      if (text.startsWith('update "monthly_reports"')) updateSql.push(text);
      return (originalQuery as (...callArgs: unknown[]) => Promise<unknown>)(query, ...args) as never;
    });
    const reportRoute = await import("@/app/api/reports/monthly-pcm/route");
    const response = await reportRoute.POST(
      jsonRequest("http://localhost/api/reports/monthly-pcm", {
        periodYear: 2026,
        periodMonth: 6,
        note: "Uji scope",
      })
    );

    expect(response.status).toBe(200);
    expect(updateSql).toHaveLength(1);
    expect(updateSql[0]).toContain('"workspace_owner_id"');
  });

  it("reopens a final report as draft and allows finalizing it again", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-18T00:00:00.000Z";

    await pool.query(
      `insert into monthly_reports (
        id, workspace_owner_id, period_year, period_month, data, status,
        finalized_at, created_at, updated_at
      ) values ($1, $2, 2026, 6, $3::jsonb, 'final', $4, $4, $4)`,
      [
        "mrp_reopen",
        WORKSPACE_ID,
        JSON.stringify({ version: 1, note: "Catatan awal" }),
        timestamp,
      ]
    );

    const reportRoute = await import("@/app/api/reports/monthly-pcm/route");
    const reopenedResponse = await reportRoute.PATCH(
      jsonRequest(
        "http://localhost/api/reports/monthly-pcm",
        { id: "mrp_reopen", status: "draft" },
        "PATCH"
      )
    );
    const reopenedBody = await reopenedResponse.json();

    expect(reopenedResponse.status).toBe(200);
    expect(reopenedBody.report).toMatchObject({
      id: "mrp_reopen",
      status: "draft",
      finalizedAt: null,
    });

    const finalizedResponse = await reportRoute.PATCH(
      jsonRequest(
        "http://localhost/api/reports/monthly-pcm",
        { id: "mrp_reopen", status: "final" },
        "PATCH"
      )
    );
    const finalizedBody = await finalizedResponse.json();

    expect(finalizedResponse.status).toBe(200);
    expect(finalizedBody.report.status).toBe("final");
    expect(finalizedBody.report.finalizedAt).toEqual(expect.any(String));

    const auditEvents = await pool.query(
      `select event_type from audit_logs
       where workspace_owner_id = $1 and entity_id = 'mrp_reopen'
       order by created_at asc`,
      [WORKSPACE_ID]
    );
    expect(
      (auditEvents.rows as Array<{ event_type: string }>).map((row) => row.event_type)
    ).toEqual([
      "REPORT_REOPENED",
      "REPORT_FINALIZED",
    ]);
  });

  it("generates and streams a monthly profit-loss PDF document", async () => {
    await setupTestDb();
    const pdfRoute = await import("@/app/api/reports/profit-loss/pdf/route");
    const response = await pdfRoute.GET(new NextRequest("http://localhost/api/reports/profit-loss/pdf?period=2026-08"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("laporan-keuangan-bulanan-agustus-2026.pdf");
    expect(response.body).toBeDefined();
  });
});
