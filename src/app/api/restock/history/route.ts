import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { products, restockLogs } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

/**
 * GET /api/restock/history
 *
 * Returns the most recent restock log entries, grouped by batch (createdAt).
 * Each batch includes the receipt image URL, product details, and OCR data.
 */
export async function GET() {
  try {
    await requireRole(["pengelola_keuangan", "pimpinan"]);
    const { workspaceOwnerId } = await getRequestUser();

    const logs = await db
      .select({
        id: restockLogs.id,
        productId: restockLogs.productId,
        quantity: restockLogs.quantity,
        unitCost: restockLogs.unitCost,
        source: restockLogs.source,
        receiptImageUrl: restockLogs.receiptImageUrl,
        ocrRaw: restockLogs.ocrRaw,
        note: restockLogs.note,
        createdAt: restockLogs.createdAt,
        productName: products.name,
        productStock: products.stock,
      })
      .from(restockLogs)
      .leftJoin(products, eq(restockLogs.productId, products.id))
      .where(eq(restockLogs.workspaceOwnerId, workspaceOwnerId))
      .orderBy(desc(restockLogs.createdAt))
      .limit(100);

    // Group by batch (same createdAt timestamp = same batch)
    const batches = new Map<
      string,
      {
        batchId: string;
        createdAt: string;
        receiptImageUrl: string | null;
        ocrRaw: unknown;
        items: Array<{
          id: string;
          productId: string;
          productName: string | null;
          quantity: number;
          unitCost: number | null;
          source: string;
        }>;
      }
    >();

    for (const log of logs) {
      const key = log.createdAt;
      if (!batches.has(key)) {
        batches.set(key, {
          batchId: log.id,
          createdAt: log.createdAt,
          receiptImageUrl: log.receiptImageUrl ?? null,
          ocrRaw: log.ocrRaw ?? null,
          items: [],
        });
      }

      const batch = batches.get(key)!;
      if (log.receiptImageUrl && !batch.receiptImageUrl) {
        batch.receiptImageUrl = log.receiptImageUrl;
      }
      if (log.ocrRaw && !batch.ocrRaw) {
        batch.ocrRaw = log.ocrRaw;
      }

      batch.items.push({
        id: log.id,
        productId: log.productId,
        productName: log.productName ?? null,
        quantity: log.quantity,
        unitCost: log.unitCost ?? null,
        source: log.source,
      });
    }

    return NextResponse.json({
      batches: Array.from(batches.values()).slice(0, 20),
    });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat riwayat restok.");
  }
}
