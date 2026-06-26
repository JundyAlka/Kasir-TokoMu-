import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { createInvestor, listInvestors } from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

const InvestorCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nama investor wajib diisi."),
    whatsapp: z.string().trim().default(""),
    address: z.string().trim().default(""),
    notes: z.string().trim().default(""),
  })
  .strict();

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
    const { userId, workspaceOwnerId } = await getRequestUser();
    const draft = InvestorCreateSchema.parse(await request.json());
    const investor = await createInvestor(workspaceOwnerId, draft);

    await logEvent({ workspaceOwnerId, actorUserId: userId }, {
      eventType: "INVESTOR_CREATED",
      entityType: "investor",
      entityId: investor.id,
      category: "create",
      payload: {
        name: investor.name,
        whatsapp: investor.whatsapp,
      },
    });

    return NextResponse.json({ investor });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat investor.");
  }
}
