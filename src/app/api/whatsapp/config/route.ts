import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import {
  getWhatsAppReportConfig,
  listWhatsAppDispatchLogs,
  updateWhatsAppReportConfig,
  WhatsAppReportConfigUpdateInput,
} from "@/lib/server/whatsapp-report-service";

export async function GET() {
  try {
    await requireRoutePolicy("/api/whatsapp/config", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const [config, logs] = await Promise.all([
      getWhatsAppReportConfig(workspaceOwnerId),
      listWhatsAppDispatchLogs(workspaceOwnerId, 20),
    ]);
    return NextResponse.json({ config, logs });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat pengaturan WhatsApp.");
  }
}

export async function PUT(request: Request) {
  try {
    await requireRoutePolicy("/api/whatsapp/config", "PUT");
    const { userId: actorUserId, workspaceOwnerId } = await getRequestUser();
    const body = (await request.json()) as WhatsAppReportConfigUpdateInput;
    const config = await updateWhatsAppReportConfig(
      workspaceOwnerId,
      actorUserId,
      body
    );
    return NextResponse.json({ config });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan pengaturan WhatsApp.");
  }
}

