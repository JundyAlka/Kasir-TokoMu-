import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, investors, products, restockLogs, titipanIntakes } from "@/db/schema";
import { getOpenSession } from "@/lib/server/shift-service";
import {
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  type ExpenseCreateInput,
  type ExpenseUpdateInput,
} from "@/lib/server/validation";
import { notFoundError } from "@/lib/server/route-error";

function createId(prefix: string) { return `${prefix}_${crypto.randomUUID().slice(0, 8)}`; }
function nowIso() { return new Date().toISOString(); }
function formatIdrPlain(amount: number) {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(amount || 0))}`;
}

function buildFormattedExpenseTitle(input: ExpenseCreateInput): string {
  const baseTitle = input.title.trim();
  const partner = input.supplierOrPartnerName?.trim();
  const nota = input.notaNumber?.trim();

  if (input.expenseType === "sales_titipan") {
    const prefix = partner ? `Titipan ${partner}: ` : "";
    const notaPart = nota ? ` [Nota: ${nota}]` : "";
    const gross = input.titipanGrossSales ?? 0;
    const explicitProfit = input.titipanStoreProfit ?? 0;
    const profit =
      explicitProfit > 0
        ? explicitProfit
        : gross > input.amount
          ? gross - input.amount
          : 0;
    if (gross > 0 || profit > 0) {
      const parts = [
        gross > 0 ? `Laku ${formatIdrPlain(gross)}` : "",
        `Setor ${formatIdrPlain(input.amount)}`,
        profit > 0 ? `Untung Toko: ${formatIdrPlain(profit)}` : "",
      ].filter(Boolean);
      return `${prefix}${baseTitle}${notaPart} (${parts.join(" | ")})`;
    }
    return `${prefix}${baseTitle}${notaPart}`;
  }

  if (input.expenseType === "sales_toko") {
    const prefix = partner ? `Nota ${partner}: ` : "";
    const notaPart = nota ? ` [Nota: ${nota}]` : "";
    return `${prefix}${baseTitle}${notaPart}`;
  }

  return nota ? `${baseTitle} [Nota: ${nota}]` : baseTitle;
}

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
  void actorUserId;
  void canManageOtherCashierShift;
  const timestamp = nowIso();
  const isCashMovement = input.expenseType === "setoran_tabungan";
  const finalTitle = buildFormattedExpenseTitle(input);

  return db.transaction(async (tx) => {
    if (input.investorId) {
      const [partner] = await tx.select().from(investors).where(and(eq(investors.id, input.investorId), eq(investors.workspaceOwnerId, workspaceOwnerId), eq(investors.isActive, 1))).limit(1);
      if (!partner) throw notFoundError();
      if (input.expenseType === "sales_titipan" && !["titipan_bagihasil", "sales_harian"].includes(partner.partnerType)) {
        throw new Error("Mitra bukan mitra titipan.");
      }
    }

    if (input.expenseType === "sales_titipan" && input.investorId && input.settleIntakeIds.length > 0) {
      const intakeRows = await tx.select().from(titipanIntakes).where(and(eq(titipanIntakes.userId, workspaceOwnerId), eq(titipanIntakes.investorId, input.investorId), inArray(titipanIntakes.id, input.settleIntakeIds)));
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
      await tx.insert(restockLogs).values({ id: createId("rsl"), workspaceOwnerId, productId: product.id, performedByUserId: actorUserId, source: "manual", quantity: input.restock.quantity, unitCost: input.restock.unitCost ?? product.buyPrice, receiptImageUrl: null, ocrRaw: null, note: `Restok dari kulakan: ${finalTitle}`, createdAt: timestamp });
    }

    const [expense] = await tx.insert(expenses).values({
      id: createId("exp"), userId: workspaceOwnerId, title: finalTitle, amount: input.amount,
      category: input.expenseType, expenseType: input.expenseType, investorId: input.investorId ?? null,
      isCashMovement, shiftSessionId: openShift.id, createdAt: timestamp,
    }).returning();
    if (!expense) throw new Error("Gagal mencatat pengeluaran.");
    return expense;
  });
}

export async function updateShiftExpenseClassification(
  workspaceOwnerId: string,
  draft: ExpenseUpdateInput
) {
  const input = ExpenseUpdateSchema.parse(draft);
  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, input.id), eq(expenses.userId, workspaceOwnerId)))
    .limit(1);
  if (!existing) throw notFoundError();

  const nextExpenseType = input.expenseType ?? existing.expenseType;
  const nextIsCashMovement = nextExpenseType === "setoran_tabungan";

  const [updated] = await db
    .update(expenses)
    .set({
      ...(input.expenseType ? { expenseType: nextExpenseType, category: nextExpenseType, isCashMovement: nextIsCashMovement } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
    })
    .where(and(eq(expenses.id, input.id), eq(expenses.userId, workspaceOwnerId)))
    .returning();

  if (!updated) throw new Error("Gagal memperbarui data pengeluaran.");
  return updated;
}

export async function listUnsettledTitipan(workspaceOwnerId: string, investorId?: string) {
  const filters = [eq(titipanIntakes.userId, workspaceOwnerId)];
  if (investorId) filters.push(eq(titipanIntakes.investorId, investorId));
  const rows = await db.select({ id: titipanIntakes.id, investorId: titipanIntakes.investorId, productId: titipanIntakes.productId, qtyIn: titipanIntakes.qtyIn, qtySold: titipanIntakes.qtySold, unitCost: titipanIntakes.unitCost, unitPrice: titipanIntakes.unitPrice, settledAmount: titipanIntakes.settledAmount, productName: products.name }).from(titipanIntakes).leftJoin(products, and(eq(products.id, titipanIntakes.productId), eq(products.userId, workspaceOwnerId))).where(and(...filters));
  return rows.filter((row) => row.qtySold * row.unitCost > row.settledAmount);
}
