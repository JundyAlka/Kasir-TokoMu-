import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, updateStoreSettings } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
import { Settings } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const settings = (await request.json()) as Settings;
    const nextSettings = await updateStoreSettings(workspaceOwnerId, settings);
    return NextResponse.json({ settings: nextSettings });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan pengaturan.");
  }
}
