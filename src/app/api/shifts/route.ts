import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createShift, listShiftSettings } from "@/lib/server/shift-service";
import { requireRole } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const ShiftSchema = z
  .object({
    name: z.string().trim().min(1, "Nama shift wajib diisi."),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Jam mulai harus HH:mm."),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Jam selesai harus HH:mm."),
    assignedUserId: z.string().trim().nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const { workspaceOwnerId } = await requireRole(["pimpinan", "pengelola_keuangan"]);
    const data = await listShiftSettings(workspaceOwnerId);
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil pengaturan shift.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = ShiftSchema.parse(await request.json());
    const { workspaceOwnerId } = await requireRole(["pimpinan", "pengelola_keuangan"]);
    const shift = await createShift(workspaceOwnerId, body);
    return NextResponse.json({ shift });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan shift.");
  }
}
