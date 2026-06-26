import { NextRequest, NextResponse } from "next/server";
import { createDebt, getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { DebtCreateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const draft = DebtCreateSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await getRequestUser();
    const debt = await createDebt(workspaceOwnerId, draft);
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "DEBT_CREATED",
        entityType: "debt",
        entityId: debt.id,
        category: "create",
        payload: {
          borrowerName: debt.borrowerName,
          amount: debt.amount,
          dueDate: debt.dueDate,
        },
      }
    );
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan kasbon.");
  }
}
