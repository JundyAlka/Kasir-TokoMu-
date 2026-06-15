import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { listAuditLogs } from "@/lib/server/audit";
import { requireRole } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const logs = await listAuditLogs(workspaceOwnerId, {
      eventType: request.nextUrl.searchParams.get("eventType")?.trim() || undefined,
      actorUserId: request.nextUrl.searchParams.get("actorUserId")?.trim() || undefined,
      start: request.nextUrl.searchParams.get("start")?.trim() || undefined,
      end: request.nextUrl.searchParams.get("end")?.trim() || undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") ?? 100),
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat audit log.");
  }
}
