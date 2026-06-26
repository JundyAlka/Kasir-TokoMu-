import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { listAuditLogs } from "@/lib/server/audit";
import { getAuditLabel } from "@/lib/audit-labels";
import { requireRole } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

function escapeCSV(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatISOtoLocal(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function payloadSummary(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const entries = Object.entries(value as Record<string, unknown>);
  return entries
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}`)
    .join("; ");
}

/**
 * GET /api/audit-log/export?...filters
 *
 * Streams a CSV file matching the current filter state.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const params = request.nextUrl.searchParams;

    // Fetch all rows matching filters (up to 5000 for export)
    const result = await listAuditLogs(workspaceOwnerId, {
      eventType: params.get("eventType")?.trim() || undefined,
      actorUserId: params.get("actorUserId")?.trim() || undefined,
      category: params.get("category")?.trim() || undefined,
      q: params.get("q")?.trim() || undefined,
      start: params.get("start")?.trim() || undefined,
      end: params.get("end")?.trim() || undefined,
      page: 1,
      pageSize: 100, // Max per page, iterate if needed
    });

    const header = "Waktu,Event,Kategori,Actor,Entity Type,Entity ID,Ringkasan\n";
    const rows = result.rows
      .map((row) => {
        const labelInfo = getAuditLabel(row.eventType);
        return [
          escapeCSV(formatISOtoLocal(row.createdAt)),
          escapeCSV(labelInfo.label),
          escapeCSV(labelInfo.category),
          escapeCSV(row.actorName ?? row.actorEmail ?? row.actorUserId),
          escapeCSV(row.entityType),
          escapeCSV(row.entityId ?? "-"),
          escapeCSV(payloadSummary(row.payload)),
        ].join(",");
      })
      .join("\n");

    const csv = header + rows;
    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengekspor audit log.");
  }
}
