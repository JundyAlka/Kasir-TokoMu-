import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import {
  deactivateInvestment,
  updateInvestment,
} from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

const InvestmentUpdateSchema = z
  .object({
    type: z.enum(["uang", "barang_titip_jual"]).optional(),
    akadType: z
      .enum([
        "murabahah_bil_wakalah",
        "mudharabah",
        "musyarakah",
        "barang_titip_jual",
        "sales_titipan",
        "pinjaman_qardh",
      ])
      .optional(),
    amount: z.unknown().optional(),
    monthlyReturnRatePct: z.unknown().optional(),
    profitSharePct: z.unknown().optional(),
    productId: z.unknown().optional(),
    unitCount: z.unknown().optional(),
    unitCost: z.unknown().optional(),
    profitSharePerUnitPct: z.unknown().optional(),
    startDate: z.unknown().optional(),
    endDate: z.unknown().optional(),
  })
  .strict()
  .transform((data) => {
    if (
      data.akadType === "barang_titip_jual" ||
      data.akadType === "sales_titipan"
    ) {
      return { ...data, type: "barang_titip_jual" as const };
    }

    if (data.akadType) {
      return { ...data, type: "uang" as const };
    }

    return data;
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const draft = InvestmentUpdateSchema.parse(await request.json());
    const investment = await updateInvestment(workspaceOwnerId, id, draft);
    return NextResponse.json({ investment });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui investasi.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const investment = await deactivateInvestment(workspaceOwnerId, id);
    return NextResponse.json({ investment });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus investasi.");
  }
}
