import { NextRequest } from "next/server";
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

describe("monthly PCM report", () => {
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
});
