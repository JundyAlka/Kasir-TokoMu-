import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import {
  deleteInvestor,
  getInvestor,
  purgeInactiveInvestor,
  updateInvestor,
} from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

const InvestorUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Nama investor wajib diisi.").optional(),
    whatsapp: z.string().trim().optional(),
    address: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/investors/[id]", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const investor = await getInvestor(workspaceOwnerId, id);
    return NextResponse.json(investor);
  } catch (error) {
    return handleRouteError(error, "Gagal memuat detail investor.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/investors/[id]", "PATCH");
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const draft = InvestorUpdateSchema.parse(await request.json());
    const investor = await updateInvestor(workspaceOwnerId, id, draft);
    return NextResponse.json({ investor });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui investor.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/investors/[id]", "DELETE");
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const mode = request.nextUrl.searchParams.get("mode");
    const investor =
      mode === "purge"
        ? await purgeInactiveInvestor(workspaceOwnerId, id)
        : await deleteInvestor(workspaceOwnerId, id);
    return NextResponse.json({ investor });
  } catch (error) {
    return handleRouteError(error, "Gagal memproses investor.");
  }
}
