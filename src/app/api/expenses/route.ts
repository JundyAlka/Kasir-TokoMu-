import { NextRequest, NextResponse } from "next/server";
import { createExpense, getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { ExpenseCreateSchema } from "@/lib/server/validation";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const draft = ExpenseCreateSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await getRequestUser();
    const expense = await createExpense(workspaceOwnerId, draft);
    
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
          expenseCategory: expense.category,
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
    const { workspaceOwnerId } = await getRequestUser();
    
    // Fetch last 50 expenses
    const list = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, workspaceOwnerId))
      .orderBy(desc(expenses.createdAt))
      .limit(50);

    return NextResponse.json({ expenses: list });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil daftar pengeluaran.");
  }
}
