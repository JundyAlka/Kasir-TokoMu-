import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import {
  getOpenWaSessionQr,
  getOpenWaSessionStatus,
  startOpenWaSession,
} from "@/lib/server/openwa-client";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { getRawWhatsAppReportConfig } from "@/lib/server/whatsapp-report-service";

export async function GET(request: Request) {
  try {
    await requireRoutePolicy("/api/whatsapp/session", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const cfg = await getRawWhatsAppReportConfig(workspaceOwnerId);
    const connection = {
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      sessionId: cfg.sessionId,
    };

    const session = await getOpenWaSessionStatus(connection);
    const url = new URL(request.url);
    const includeQr = url.searchParams.get("includeQr") === "1";

    const qr =
      includeQr && !session.connected
        ? await getOpenWaSessionQr(connection).catch(() => null)
        : null;

    return NextResponse.json({ session, qr });
  } catch (error) {
    return handleRouteError(error, "Gagal memeriksa status session OpenWA.");
  }
}

export async function POST(request: Request) {
  try {
    await requireRoutePolicy("/api/whatsapp/session", "POST");
    const { workspaceOwnerId } = await getRequestUser();
    const cfg = await getRawWhatsAppReportConfig(workspaceOwnerId);
    const body = (await request.json().catch(() => ({}))) as {
      action?: "status" | "start" | "qr";
      baseUrl?: string;
      apiKey?: string;
      sessionId?: string;
    };

    const connection = {
      baseUrl: body.baseUrl?.trim() || cfg.baseUrl,
      apiKey:
        typeof body.apiKey === "string" &&
        body.apiKey.trim() &&
        body.apiKey.trim() !== "__KEEP__"
          ? body.apiKey.trim()
          : cfg.apiKey,
      sessionId: body.sessionId?.trim() || cfg.sessionId,
    };

    const action = body.action ?? "status";

    if (action === "start") {
      const session = await startOpenWaSession(connection);
      const qr = !session.connected
        ? await getOpenWaSessionQr(connection).catch(() => null)
        : null;
      return NextResponse.json({ session, qr });
    }

    if (action === "qr") {
      const [session, qr] = await Promise.all([
        getOpenWaSessionStatus(connection),
        getOpenWaSessionQr(connection),
      ]);
      return NextResponse.json({ session, qr });
    }

    const session = await getOpenWaSessionStatus(connection);
    return NextResponse.json({ session, qr: null });
  } catch (error) {
    return handleRouteError(error, "Gagal menjalankan aksi session OpenWA.");
  }
}

