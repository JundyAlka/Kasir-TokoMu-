import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { closeShift } from "@/lib/server/shift-service";
import { getShiftSummary } from "@/lib/server/shift-service";
import { notFoundError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const CloseShiftSchema = z.object({
  sessionId: z.string().trim().min(1),
  closingCash: z.number().int().min(0),
  closingCoins: z.number().int().min(0),
  closingSavings: z.number().int().min(0),
  varianceNote: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const body = CloseShiftSchema.parse(await request.json());
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/shifts/close", "POST");
    const requestedSession = await getShiftSummary(workspaceOwnerId, body.sessionId);
    if (!requestedSession || (role === "kasir" && requestedSession.cashierUserId !== userId)) throw notFoundError();
    const session = await closeShift(
      workspaceOwnerId,
      body.sessionId,
      { cash: body.closingCash, coins: body.closingCoins, savings: body.closingSavings },
      body.varianceNote,
      userId
    );
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal menutup shift.");
  }
}
