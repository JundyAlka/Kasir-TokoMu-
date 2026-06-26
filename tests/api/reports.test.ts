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

describe("profit-loss report", () => {
  it("calculates revenue 10m - cogs 7m - expenses 1m = net profit 2m", async () => {
    const { pool } = await setupTestDb();
    const timestamp = "2026-06-10T00:00:00.000Z";

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at)
       values ('trx_report', $1, 10000000, 'Tunai', $2)`,
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

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, created_at)
       values ('trx_top_a', $1, 10000, 'Tunai', $2)`,
      [WORKSPACE_ID, todayTimestamp]
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
          createdAt: todayTimestamp,
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
        createdAt: todayTimestamp,
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
          createdAt: todayTimestamp,
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
