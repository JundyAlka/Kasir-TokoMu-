import { NextRequest, NextResponse } from "next/server";
import { createKasMovement, listShiftKasMovements, type KasMovementDraft } from "@/lib/server/kas-movement-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceOwnerId, role } = await requireRoutePolicy("/api/kas-movements", "POST");
    const movement = await createKasMovement(workspaceOwnerId, await request.json() as KasMovementDraft, userId, role !== "kasir");
    return NextResponse.json({ movement });
  } catch (error) {
    return handleRouteError(error, "Gagal mencatat mutasi kas.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceOwnerId, role } = await requireRoutePolicy("/api/kas-movements", "GET");
    const shiftSessionId = new URL(request.url).searchParams.get("shiftSessionId");
    if (!shiftSessionId) throw new Error("ID shift wajib diisi.");
    return NextResponse.json({ movements: await listShiftKasMovements(workspaceOwnerId, shiftSessionId, userId, role !== "kasir") });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil mutasi kas.");
  }
}
