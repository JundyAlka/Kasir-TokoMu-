import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteShift, updateShift } from "@/lib/server/shift-service";
import { requireRole } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const ShiftUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Nama shift wajib diisi.").optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Jam mulai harus HH:mm.").optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Jam selesai harus HH:mm.").optional(),
    assignedUserId: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = ShiftUpdateSchema.parse(await request.json());
    const { workspaceOwnerId } = await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { id } = await context.params;
    const shift = await updateShift(workspaceOwnerId, id, body);
    return NextResponse.json({ shift });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui shift.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceOwnerId } = await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { id } = await context.params;
    const shift = await deleteShift(workspaceOwnerId, id);
    return NextResponse.json({ shift });
  } catch (error) {
    return handleRouteError(error, "Gagal menonaktifkan shift.");
  }
}
