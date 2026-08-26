import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createShift, listShiftSettings, listShifts } from "@/lib/server/shift-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
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

export async function GET(request: NextRequest) {
  try {
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/shifts", "GET");
    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");

    if (start && end) {
      const shifts = await listShifts(
        workspaceOwnerId,
        { start, end },
        role === "kasir" ? userId : undefined
      );
      return NextResponse.json({ shifts });
    }

    if (role === "kasir") {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 31 * 24 * 60 * 60 * 1000);
      const shifts = await listShifts(
        workspaceOwnerId,
        { start: startDate.toISOString(), end: endDate.toISOString() },
        userId
      );
      return NextResponse.json({ shifts });
    }

    const data = await listShiftSettings(workspaceOwnerId);
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil pengaturan shift.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = ShiftSchema.parse(await request.json());
    const { workspaceOwnerId } = await requireRoutePolicy("/api/shifts", "POST");
    const shift = await createShift(workspaceOwnerId, body);
    return NextResponse.json({ shift });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan shift.");
  }
}
