import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { unlockDailyReport } from "@/lib/server/daily-report-service";

export const runtime = "nodejs";

const UnlockDailyReportSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const body = UnlockDailyReportSchema.parse(await request.json());
    const { workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports/unlock", "POST");
    const report = await unlockDailyReport(workspaceOwnerId, body.reportDate);
    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error, "Gagal membuka kunci laporan harian.");
  }
}
