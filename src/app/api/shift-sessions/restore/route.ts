import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { restoreShiftSession } from "@/lib/server/shift-service";

export const runtime = "nodejs";

const RestoreShiftSessionSchema = z.object({
  id: z.string().min(1),
  shiftId: z.string().optional(),
  cashierUserId: z.string().optional(),
  startedAt: z.string().min(1),
  endedAt: z.string().nullable().optional(),
  openingCash: z.number().int().min(0).nullable().optional(),
  openingCoins: z.number().int().min(0).nullable().optional(),
  openingSavings: z.number().int().min(0).nullable().optional(),
  closingCash: z.number().int().min(0).nullable().optional(),
  closingCoins: z.number().int().min(0).nullable().optional(),
  closingSavings: z.number().int().min(0).nullable().optional(),
  expectedClosing: z.number().int().nullable().optional(),
  variance: z.number().int().nullable().optional(),
  varianceNote: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["open", "closed"]).default("open"),
});

export async function POST(request: NextRequest) {
  try {
    const body = RestoreShiftSessionSchema.parse(await request.json());
    const { workspaceOwnerId } = await requireRoutePolicy("/api/shift-sessions/restore", "POST");
    const session = await restoreShiftSession(workspaceOwnerId, body);
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal memulihkan sesi shift.");
  }
}
