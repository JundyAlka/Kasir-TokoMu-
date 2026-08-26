import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { openShift } from "@/lib/server/shift-service";

export const runtime = "nodejs";

const OpenShiftSchema = z.object({
  shiftId: z.string().trim().min(1).optional(),
  openingCash: z.number().int().min(0).optional(),
  openingCoins: z.number().int().min(0).optional(),
  openingSavings: z.number().int().min(0).optional(),
  openingOverrideReason: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const body = OpenShiftSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/shifts/open", "POST");
    const session = await openShift(workspaceOwnerId, userId, body.shiftId, {
      cash: body.openingCash ?? 0,
      coins: body.openingCoins ?? 0,
      savings: body.openingSavings ?? 0,
    }, body.openingOverrideReason);
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal membuka shift.");
  }
}
