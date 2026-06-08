import { NextResponse } from "next/server";
import { getBootstrapState, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const appState = await getBootstrapState(workspaceOwnerId);
    return NextResponse.json({ appState });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat data aplikasi.", 500);
  }
}
