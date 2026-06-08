import { NextResponse } from "next/server";
import { getRequestUser, remindDebt } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const debt = await remindDebt(workspaceOwnerId, id);
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal menandai pengingat hutang.");
  }
}
