import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, updateStoreSettings } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
import { SettingsUpdateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  try {
    const settings = SettingsUpdateSchema.parse(await request.json());
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const nextSettings = await updateStoreSettings(workspaceOwnerId, settings);
    return NextResponse.json({ settings: nextSettings });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan pengaturan.");
  }
}
