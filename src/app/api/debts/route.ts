import { NextRequest, NextResponse } from "next/server";
import { createDebt, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { DebtDraft } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const draft = (await request.json()) as DebtDraft;
    const debt = await createDebt(workspaceOwnerId, draft);
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan kasbon.");
  }
}
