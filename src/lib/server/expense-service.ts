import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, investors, products, restockLogs, titipanIntakes } from "@/db/schema";
import { getOpenSession } from "@/lib/server/shift-service";
import { ExpenseCreateSchema, type ExpenseCreateInput } from "@/lib/server/validation";
import { notFoundError } from "@/lib/server/route-error";

function createId(prefix: string) { return `${prefix}_${crypto.randomUUID().slice(0, 8)}`; }
function nowIso() { return new Date().toISOString(); }

/** Records a cash outflow only inside the active workspace shift. */
export async function createShiftExpense(
  workspaceOwnerId: string,
  draft: ExpenseCreateInput,
  actorUserId: string,
  canManageOtherCashierShift = false
) {
  const input = ExpenseCreateSchema.parse(draft);
  const openShift = await getOpenSession(workspaceOwnerId);
  if (!openShift) throw new Error("Buka shift terlebih dahulu sebelum mencatat pengeluaran.");
  if (!canManageOtherCashierShift && openShift.cashierUserId !== actorUserId) throw notFoundError();
  const timestamp = nowIso();
  const isCashMovement = input.expenseType === "setoran_tabungan" || input.expenseType === "sales_titipan";

  return db.transaction(async (tx) => {
    if (input.investorId) {
      const [partner] = await tx.select().from(investors).where(and(eq(investors.id, input.investorId), eq(investors.workspaceOwnerId, workspaceOwnerId), eq(investors.isActive, 1))).limit(1);
      if (!partner) throw notFoundError();
      if (input.expenseType === "sales_titipan" && !["titipan_bagihasil", "sales_harian"].includes(partner.partnerType)) {
        throw new Error("Mitra bukan mitra titipan.");
      }
    }

    if (input.expenseType === "sales_titipan") {
      const intakeRows = await tx.select().from(titipanIntakes).where(and(eq(titipanIntakes.userId, workspaceOwnerId), eq(titipanIntakes.investorId, input.investorId!), inArray(titipanIntakes.id, input.settleIntakeIds)));
      if (intakeRows.length !== input.settleIntakeIds.length) throw notFoundError();
      for (const intake of intakeRows) {
        const due = Math.max(0, intake.qtySold * intake.unitCost - intake.settledAmount);
        await tx.update(titipanIntakes).set({ settledAmount: intake.settledAmount + due }).where(and(eq(titipanIntakes.id, intake.id), eq(titipanIntakes.userId, workspaceOwnerId)));
      }
    }

    if (input.restock) {
      const [product] = await tx.select().from(products).where(and(eq(products.id, input.restock.productId), eq(products.userId, workspaceOwnerId))).limit(1);
      if (!product) throw notFoundError();
      await tx.update(products).set({ stock: product.stock + input.restock.quantity, updatedAt: timestamp }).where(and(eq(products.id, product.id), eq(products.userId, workspaceOwnerId)));
      await tx.insert(restockLogs).values({ id: createId("rsl"), workspaceOwnerId, productId: product.id, performedByUserId: actorUserId, source: "manual", quantity: input.restock.quantity, unitCost: input.restock.unitCost ?? product.buyPrice, receiptImageUrl: null, ocrRaw: null, note: `Restok dari pengeluaran: ${input.title}`, createdAt: timestamp });
    }

    const [expense] = await tx.insert(expenses).values({
      id: createId("exp"), userId: workspaceOwnerId, title: input.title, amount: input.amount,
      category: input.expenseType, expenseType: input.expenseType, investorId: input.investorId ?? null,
      isCashMovement, shiftSessionId: openShift.id, createdAt: timestamp,
    }).returning();
    if (!expense) throw new Error("Gagal mencatat pengeluaran.");
    return expense;
  });
}

export async function listUnsettledTitipan(workspaceOwnerId: string, investorId?: string) {
  const filters = [eq(titipanIntakes.userId, workspaceOwnerId)];
  if (investorId) filters.push(eq(titipanIntakes.investorId, investorId));
  const rows = await db.select({ id: titipanIntakes.id, investorId: titipanIntakes.investorId, productId: titipanIntakes.productId, qtyIn: titipanIntakes.qtyIn, qtySold: titipanIntakes.qtySold, unitCost: titipanIntakes.unitCost, unitPrice: titipanIntakes.unitPrice, settledAmount: titipanIntakes.settledAmount, productName: products.name }).from(titipanIntakes).leftJoin(products, and(eq(products.id, titipanIntakes.productId), eq(products.userId, workspaceOwnerId))).where(and(...filters));
  return rows.filter((row) => row.qtySold * row.unitCost > row.settledAmount);
}
