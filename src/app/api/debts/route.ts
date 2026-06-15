import { NextRequest, NextResponse } from "next/server";
import { createDebt, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { DebtCreateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const draft = DebtCreateSchema.parse(await request.json());
    const { workspaceOwnerId } = await getRequestUser();
    const debt = await createDebt(workspaceOwnerId, draft);
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan kasbon.");
  }
}
