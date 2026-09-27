import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { deleteShiftSession, updateShiftSession } from "@/lib/server/shift-service";

export const runtime = "nodejs";

const UpdateShiftSessionSchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  openingCash: z.number().int().min(0).nullable().optional(),
  openingCoins: z.number().int().min(0).nullable().optional(),
  openingSavings: z.number().int().min(0).nullable().optional(),
  closingCash: z.number().int().min(0).nullable().optional(),
  closingCoins: z.number().int().min(0).nullable().optional(),
  closingSavings: z.number().int().min(0).nullable().optional(),
  variance: z.number().int().nullable().optional(),
  varianceNote: z.string().trim().max(1000).nullable().optional(),
  action: z.enum(["close", "update"]).optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = UpdateShiftSessionSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/shift-sessions/[id]", "PATCH");
    const { id } = await context.params;
    const session = await updateShiftSession(workspaceOwnerId, id, body, userId);
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui sesi shift.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/shift-sessions/[id]", "DELETE");
    const { id } = await context.params;
    const result = await deleteShiftSession(workspaceOwnerId, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus sesi shift.");
  }
}
