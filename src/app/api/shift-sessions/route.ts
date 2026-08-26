import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { getActiveShift, getOpenSession, openShift, resolveRecordedBy } from "@/lib/server/shift-service";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const OpenShiftSchema = z
  .object({
    shiftId: z.string().trim().min(1, "Shift wajib dipilih."),
    cashierUserId: z.string().trim().optional(),
    openingCash: z.number().int().min(0).nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/shift-sessions", "GET");
    const [openSession, activeShift, recordedBy] = await Promise.all([
      getOpenSession(workspaceOwnerId),
      getActiveShift(workspaceOwnerId),
      resolveRecordedBy(workspaceOwnerId, userId),
    ]);
    const hasOtherOpenShift = role === "kasir" && openSession?.cashierUserId !== userId;
    return NextResponse.json({
      session: hasOtherOpenShift ? null : openSession,
      activeShift,
      recordedBy: hasOtherOpenShift ? null : recordedBy,
      hasOtherOpenShift,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil sesi shift.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = OpenShiftSchema.parse(await request.json());
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/shift-sessions", "POST");
    const session = await openShift(
      workspaceOwnerId,
      role === "kasir" ? userId : body.cashierUserId || userId,
      body.shiftId,
      body.openingCash
    );
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal membuka shift.");
  }
}
