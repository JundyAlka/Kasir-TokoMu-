import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { processScheduledWhatsAppReports } from "@/lib/server/whatsapp-report-service";

export const runtime = "nodejs";

async function authorizeCronOrAdmin(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") ?? "";
  const cronHeader = request.headers.get("x-cron-secret") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (
    configuredSecret &&
    (bearerToken === configuredSecret || cronHeader === configuredSecret)
  ) {
    return;
  }

  const user = await getRequestUser();
  if (user.role !== "pimpinan") {
    throw new Error("Akses ditolak. Hanya pimpinan atau cron resmi yang dapat menjalankan scheduler.");
  }
}

async function handleRun(method: "GET" | "POST", request: Request) {
  try {
    await requireRoutePolicy("/api/cron/whatsapp-reports", method);
    await authorizeCronOrAdmin(request);
    const result = await processScheduledWhatsAppReports();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error, "Gagal menjalankan scheduler laporan WhatsApp.");
  }
}

export async function GET(request: Request) {
  return handleRun("GET", request);
}

export async function POST(request: Request) {
  return handleRun("POST", request);
}

