import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { createInvestor, listInvestors } from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const statusParam = request.nextUrl.searchParams.get("status");
    const status =
      statusParam === "inactive" || statusParam === "all" ? statusParam : "active";
    const investors = await listInvestors(workspaceOwnerId, { status });
    return NextResponse.json({ investors });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar investor.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const investor = await createInvestor(workspaceOwnerId, await request.json());
    return NextResponse.json({ investor });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat investor.");
  }
}
