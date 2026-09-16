import { NextResponse } from "next/server";
import { getBootstrapState, getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireRoutePolicy("/api/bootstrap", "GET");
    const appState = await getBootstrapState(user.workspaceOwnerId);
    return NextResponse.json({ appState });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat data aplikasi.", 500);
  }
}
