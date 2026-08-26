import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { closeShift } from "@/lib/server/shift-service";
import { getShiftSummary } from "@/lib/server/shift-service";
import { handleRouteError, notFoundError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const CloseShiftSchema = z
  .object({
    closingCash: z.number().int().min(0, "Kas akhir tidak boleh negatif."),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = CloseShiftSchema.parse(await request.json());
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/shift-sessions/[id]/close", "POST");
    const { id } = await context.params;
    const requestedSession = await getShiftSummary(workspaceOwnerId, id);
    if (!requestedSession || (role === "kasir" && requestedSession.cashierUserId !== userId)) throw notFoundError();
    const session = await closeShift(workspaceOwnerId, id, body.closingCash);
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal menutup shift.");
  }
}
