import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { lockDailyReport } from "@/lib/server/daily-report-service";

export const runtime = "nodejs";

const LockDailyReportSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const body = LockDailyReportSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports/lock", "POST");
    const report = await lockDailyReport(workspaceOwnerId, body.reportDate, userId);
    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error, "Gagal mengunci laporan harian.");
  }
}
