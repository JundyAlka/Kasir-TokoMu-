import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { monthlyReports } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    
    const monthlyList = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.workspaceOwnerId, workspaceOwnerId))
      .orderBy(desc(monthlyReports.periodYear), desc(monthlyReports.periodMonth))
      .limit(5);

    const pcmList = monthlyList.filter(r => r.status === "final" && (r.data as any)?.financial !== undefined);

    return NextResponse.json({ 
      latestMonthly: monthlyList[0],
      monthlyList, 
      pcmList,
      hasPendingPcm: monthlyList[0] ? !pcmList.some(pcm => pcm.periodYear === monthlyList[0].periodYear && pcm.periodMonth === monthlyList[0].periodMonth) : false
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
