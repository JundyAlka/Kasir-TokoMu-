import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { updateDailyReport } from "@/lib/server/daily-report-service";

export const runtime = "nodejs";

const UpdateDailyReportSchema = z.object({
  revenue: z.number().int().min(0).optional(),
  cogs: z.number().int().min(0).optional(),
  expenseTotal: z.number().int().min(0).optional(),
  status: z.enum(["draft", "locked"]).optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ date: string }> }
) {
  try {
    const body = UpdateDailyReportSchema.parse(await request.json());
    const { workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports/[date]", "PATCH");
    const { date } = await context.params;
    const report = await updateDailyReport(workspaceOwnerId, date, body);
    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui laporan harian.");
  }
}
