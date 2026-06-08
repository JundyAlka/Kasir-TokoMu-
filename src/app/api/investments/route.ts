import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import {
  createInvestment,
  listInvestments,
} from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const investorId = request.nextUrl.searchParams.get("investorId") ?? undefined;
    const investments = await listInvestments(workspaceOwnerId, investorId);
    return NextResponse.json({ investments });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar investasi.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const body = await request.json();

    if (!body || typeof body !== "object" || typeof body.investorId !== "string") {
      return NextResponse.json({ error: "Investor wajib diisi." }, { status: 400 });
    }

    const investment = await createInvestment(workspaceOwnerId, body.investorId, body);
    return NextResponse.json({ investment });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat investasi.");
  }
}
