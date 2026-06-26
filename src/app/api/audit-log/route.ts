import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { getAuditFacets, listAuditLogs } from "@/lib/server/audit";
import { requireRole } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

/**
 * GET /api/audit-log
 *
 * Query params:
 * - eventType, actorUserId, category, q (search)
 * - start, end (ISO date strings)
 * - page (1-based), pageSize (default 25, max 100)
 * - facets=1 → return dropdown options instead of rows
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const params = request.nextUrl.searchParams;

    // Facets mode: return dropdown options
    if (params.get("facets") === "1") {
      const facets = await getAuditFacets(workspaceOwnerId);
      return NextResponse.json({ facets });
    }

    // List mode: return filtered + paginated rows
    const result = await listAuditLogs(workspaceOwnerId, {
      eventType: params.get("eventType")?.trim() || undefined,
      actorUserId: params.get("actorUserId")?.trim() || undefined,
      category: params.get("category")?.trim() || undefined,
      q: params.get("q")?.trim() || undefined,
      start: params.get("start")?.trim() || undefined,
      end: params.get("end")?.trim() || undefined,
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 25),
    });

    return NextResponse.json({
      logs: result.rows,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat audit log.");
  }
}
