import { NextRequest, NextResponse } from "next/server";
import {
  createShiftExpense,
  updateShiftExpenseClassification,
} from "@/lib/server/expense-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { ExpenseCreateSchema, ExpenseUpdateSchema } from "@/lib/server/validation";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const draft = ExpenseCreateSchema.parse(await request.json());
    const { userId, workspaceOwnerId, role } = await requireRoutePolicy("/api/expenses", "POST");
    const expense = await createShiftExpense(workspaceOwnerId, draft, userId, role !== "kasir");
    
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "EXPENSE_CREATED",
        entityType: "expense",
        entityId: expense.id,
        category: "create",
        payload: {
          title: expense.title,
          amount: expense.amount,
          expenseCategory: expense.expenseType,
        },
      }
    );
    
    return NextResponse.json({ expense });
  } catch (error) {
    return handleRouteError(error, "Gagal mencatat pengeluaran.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/expenses", "GET");
    
    // Fetch recent expenses (up to 500)
    const list = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, workspaceOwnerId))
      .orderBy(desc(expenses.createdAt))
      .limit(500);

    return NextResponse.json({ expenses: list });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil daftar pengeluaran.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const draft = ExpenseUpdateSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/expenses", "PATCH");
    const updated = await updateShiftExpenseClassification(workspaceOwnerId, draft);

    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "EXPENSE_UPDATED",
        entityType: "expense",
        entityId: updated.id,
        category: "update",
        payload: {
          title: updated.title,
          amount: updated.amount,
          expenseType: updated.expenseType,
        },
      }
    );

    return NextResponse.json({ expense: updated });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui klasifikasi pengeluaran.");
  }
}
