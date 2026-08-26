import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { listUnsettledTitipan } from "@/lib/server/expense-service";
import { createTitipanIntake } from "@/lib/server/investor-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";
const IntakeSchema = z.object({ investorId: z.string().trim().min(1), productId: z.string().trim().min(1).nullable().optional(), intakeDate: z.string().trim().min(10), qtyIn: z.number().int().positive(), unitCost: z.number().int().min(0), unitPrice: z.number().int().min(0) }).strict();

export async function GET(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/titipan-intakes", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const investorId = request.nextUrl.searchParams.get("investorId") ?? undefined;
    return NextResponse.json({ intakes: await listUnsettledTitipan(workspaceOwnerId, investorId) });
  } catch (error) { return handleRouteError(error, "Gagal memuat barang titipan."); }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/titipan-intakes", "POST");
    const { workspaceOwnerId } = await getRequestUser();
    const intake = await createTitipanIntake(workspaceOwnerId, IntakeSchema.parse(await request.json()));
    return NextResponse.json({ intake });
  } catch (error) { return handleRouteError(error, "Gagal mencatat barang titipan."); }
}
