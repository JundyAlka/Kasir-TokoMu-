import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { createInvestor, listInvestors } from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

const InvestorCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nama investor wajib diisi."),
    whatsapp: z.string().trim().default(""),
    address: z.string().trim().default(""),
    notes: z.string().trim().default(""),
    partnerType: z.enum(["investor_uang", "titipan_bagihasil", "sales_harian"]).default("investor_uang"),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/investors", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const statusParam = request.nextUrl.searchParams.get("status");
    const status =
      statusParam === "inactive" || statusParam === "all" ? statusParam : "active";
    const partnerTypeParam = request.nextUrl.searchParams.get("partnerType");
    const partnerType = partnerTypeParam === "titipan_bagihasil" || partnerTypeParam === "sales_harian" || partnerTypeParam === "investor_uang" ? partnerTypeParam : undefined;
    const investors = await listInvestors(workspaceOwnerId, { status, partnerType });
    return NextResponse.json({ investors });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar investor.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/investors", "POST");
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
