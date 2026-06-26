import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { closeShift } from "@/lib/server/shift-service";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

const CloseShiftSchema = z
  .object({
    closingCash: z.number().int().min(0, "Kas akhir tidak boleh negatif."),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = CloseShiftSchema.parse(await request.json());
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const session = await closeShift(workspaceOwnerId, id, body.closingCash);
    return NextResponse.json({ session });
  } catch (error) {
    return handleRouteError(error, "Gagal menutup shift.");
  }
}
