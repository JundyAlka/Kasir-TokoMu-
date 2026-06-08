import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { products, restockLogs } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

type BatchRestockItem = {
  productId?: unknown;
  quantity?: unknown;
  unitCost?: unknown;
  receiptImageUrl?: unknown;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parsePositiveInteger(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${field} harus lebih dari 0.`);
  }

  return Math.round(number);
}

function parseUnitCost(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Harga beli harus valid.");
  }

  return Math.round(number);
}

function parseItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Minimal satu item restok wajib dipilih.");
  }

  return value.map((item, index) => {
    const row = item as BatchRestockItem;
    if (!row || typeof row !== "object" || typeof row.productId !== "string") {
      throw new Error(`Produk baris ${index + 1} wajib dipilih.`);
    }

    return {
      productId: row.productId,
      quantity: parsePositiveInteger(row.quantity, `Qty baris ${index + 1}`),
      unitCost: parseUnitCost(row.unitCost),
      receiptImageUrl: typeof row.receiptImageUrl === "string" ? row.receiptImageUrl : null,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pengelola_keuangan", "pimpinan"]);
    const { userId, workspaceOwnerId } = await getRequestUser();
    const body = (await request.json()) as {
      items?: unknown;
      receiptImageUrl?: unknown;
      ocrRaw?: unknown;
    };
    const items = parseItems(body.items);
    const receiptImageUrl =
      typeof body.receiptImageUrl === "string" ? body.receiptImageUrl : null;
    const timestamp = nowIso();
    const productIds = Array.from(new Set(items.map((item) => item.productId)));

    const logs = await db.transaction(async (tx) => {
      const productRows = await tx
        .select()
        .from(products)
        .where(and(eq(products.userId, workspaceOwnerId), inArray(products.id, productIds)));
      const productById = new Map(productRows.map((product) => [product.id, product]));

      for (const item of items) {
        if (!productById.has(item.productId)) {
          throw new Error("Salah satu produk tidak ditemukan di workspace ini.");
        }
      }

      for (const item of items) {
        const existing = productById.get(item.productId)!;
        const [updated] = await tx
          .update(products)
          .set({
            stock: existing.stock + item.quantity,
            updatedAt: timestamp,
          })
          .where(and(eq(products.userId, workspaceOwnerId), eq(products.id, item.productId)))
          .returning();
        productById.set(item.productId, updated);
      }

      return tx
        .insert(restockLogs)
        .values(
          items.map((item, index) => ({
            id: createId("rsl"),
            workspaceOwnerId,
            productId: item.productId,
            performedByUserId: userId,
            source: "ai_ocr",
            quantity: item.quantity,
            unitCost: item.unitCost,
            receiptImageUrl: index === 0 ? item.receiptImageUrl ?? receiptImageUrl : null,
            ocrRaw: index === 0 ? body.ocrRaw ?? null : null,
            note: "Restok dari scan struk AI",
            createdAt: timestamp,
          }))
        )
        .returning();
    });

    return NextResponse.json({
      restockedCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      logs,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan restok batch.");
  }
}
