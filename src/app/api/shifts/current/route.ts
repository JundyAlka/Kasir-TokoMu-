import { NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { getActiveShift, getOpenSession, getShiftCashMovement, getSuggestedOpeningBalances, resolveRecordedBy } from "@/lib/server/shift-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/shifts/current", "GET");
    const [openSession, activeShift, recordedBy, openingSuggestion] = await Promise.all([
      getOpenSession(workspaceOwnerId),
      getActiveShift(workspaceOwnerId),
      resolveRecordedBy(workspaceOwnerId, userId),
      getSuggestedOpeningBalances(workspaceOwnerId),
    ]);
    const isCashierViewingAnotherSession = role === "kasir" && openSession != null && openSession.cashierUserId !== userId;
    const session = isCashierViewingAnotherSession ? null : openSession;
    const cashMovement = session ? await getShiftCashMovement(workspaceOwnerId, session.id) : null;
    return NextResponse.json({
      session,
      openSessionInfo: openSession ? {
        id: openSession.id,
        shiftId: openSession.shiftId,
        shiftName: openSession.shiftName,
        cashierUserId: openSession.cashierUserId,
        cashierName: openSession.cashierName,
        startedAt: openSession.startedAt,
      } : null,
      activeShift,
      recordedBy: session ? recordedBy : null,
      openingSuggestion,
      cashMovement,
      hasOtherOpenShift: isCashierViewingAnotherSession,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil status shift.");
  }
}
