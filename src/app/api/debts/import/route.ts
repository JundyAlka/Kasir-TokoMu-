import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { debts } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { getOpenSession } from "@/lib/server/shift-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const DebtImportItemSchema = z.object({
  borrowerName: z.string().trim().min(1, "Nama peminjam wajib diisi."),
  amount: z.number().int().positive("Nominal hutang harus lebih dari 0."),
  whatsapp: z.string().trim().default(""),
  dueDate: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  note: z.string().trim().default(""),
});

const DebtImportPayloadSchema = z.object({
  debts: z.array(DebtImportItemSchema).min(1, "Tidak ada data hutang yang dikirim."),
});

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/debts/import", "POST");
    const { userId, workspaceOwnerId } = await getRequestUser();
    const payload = DebtImportPayloadSchema.parse(await request.json());

    const openShift = await getOpenSession(workspaceOwnerId).catch(() => null);
    const now = new Date().toISOString();
    let totalAmount = 0;

    const insertedDebts = await db.transaction(async (tx) => {
      const recordsToInsert = payload.debts.map((item) => {
        totalAmount += item.amount;
        return {
          id: createId("debt"),
          userId: workspaceOwnerId,
          borrowerName: item.borrowerName,
          whatsapp: item.whatsapp || "",
          amount: item.amount,
          paidAmount: 0,
          status: "aktif",
          createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : now,
          dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : null,
          shiftSessionId: openShift?.id ?? null,
          isPaid: 0,
          lastReminderAt: null,
        };
      });

      return tx.insert(debts).values(recordsToInsert).returning();
    });

    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "DEBTS_IMPORTED",
        entityType: "debt",
        entityId: workspaceOwnerId,
        category: "create",
        payload: {
          importedCount: insertedDebts.length,
          totalAmount,
        },
      }
    );

    return NextResponse.json({
      success: true,
      count: insertedDebts.length,
      totalAmount,
      debts: insertedDebts,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengimpor daftar hutang.");
  }
}
