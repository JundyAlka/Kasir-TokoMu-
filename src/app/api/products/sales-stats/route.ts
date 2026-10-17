import { NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRoutePolicy("/api/products/sales-stats", "GET");
    const { workspaceOwnerId } = await getRequestUser();

    // Query 30-day product sales velocity scoped to workspace owner
    const result = await pool.query(
      `
      WITH user_tx AS (
        SELECT id, occurred_at 
        FROM transactions 
        WHERE user_id = $1 
          AND occurred_at >= NOW() - INTERVAL '30 days'
      ),
      date_range AS (
        SELECT GREATEST(1, COUNT(DISTINCT DATE(occurred_at))) as active_days
        FROM user_tx
      )
      SELECT 
        ti.product_id as "productId",
        ti.product_name as "productName",
        SUM(ti.quantity)::int as "totalQty",
        COUNT(DISTINCT t.id)::int as "txCount",
        COALESCE(SUM(ti.quantity * ti.unit_price), 0)::bigint as "totalRevenue",
        ROUND((SUM(ti.quantity)::numeric / (SELECT active_days FROM date_range)), 1)::float as "avgPerDay",
        ROUND(
          (
            COUNT(DISTINCT t.id) * 10.0 + 
            SQRT(COALESCE(SUM(ti.quantity * ti.unit_price), 0) / 100.0) + 
            SUM(ti.quantity) * 0.5
          )::numeric, 
          1
        )::float as "popularityScore",
        MAX(t.occurred_at) as "lastSoldAt"
      FROM transaction_items ti
      JOIN user_tx t ON ti.transaction_id = t.id
      WHERE ti.is_adjustment IS NOT TRUE
      GROUP BY ti.product_id, ti.product_name
      ORDER BY "popularityScore" DESC
      `,
      [workspaceOwnerId]
    );

    return NextResponse.json({
      stats: result.rows,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat statistik penjualan produk.");
  }
}
