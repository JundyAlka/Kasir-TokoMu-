import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import {
  dispatchWhatsAppReport,
  getJakartaNowParts,
  sendWhatsAppTestMessage,
} from "@/lib/server/whatsapp-report-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireRoutePolicy("/api/whatsapp/send-report", "POST");
    const { userId: actorUserId, workspaceOwnerId } = await getRequestUser();
    const body = (await request.json().catch(() => ({}))) as {
      action?: "test" | "report";
      mode?: "mingguan" | "bulanan";
      period?: string;
      attachPdf?: boolean;
      recipients?: string[] | string;
    };

    if (body.action === "test") {
      const target = Array.isArray(body.recipients)
        ? body.recipients.join(",")
        : body.recipients;
      const log = await sendWhatsAppTestMessage(
        workspaceOwnerId,
        actorUserId,
        target
      );
      return NextResponse.json({ ok: true, log });
    }

    const mode = body.mode === "mingguan" ? "mingguan" : "bulanan";
    const parts = getJakartaNowParts();
    const defaultPeriod =
      mode === "mingguan"
        ? parts.dateKey
        : `${parts.year}-${String(parts.month).padStart(2, "0")}`;

    const log = await dispatchWhatsAppReport({
      workspaceOwnerId,
      actorUserId,
      mode,
      periodValue: body.period?.trim() || defaultPeriod,
      triggerType: "manual",
      attachPdf: body.attachPdf,
      overrideRecipients: body.recipients,
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    return handleRouteError(error, "Gagal mengirim laporan ke WhatsApp.");
  }
}

