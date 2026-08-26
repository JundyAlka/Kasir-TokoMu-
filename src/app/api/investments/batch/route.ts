import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { createInvestmentBatch } from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

const moneyAkads = ["murabahah_bil_wakalah", "mudharabah", "musyarakah", "pinjaman_qardh"] as const;
const goodsAkads = ["barang_titip_jual", "sales_titipan"] as const;
const akadTypes = [...moneyAkads, ...goodsAkads] as const;

const SingleInvestmentSchema = z
  .object({
    type: z.enum(["uang", "barang_titip_jual"]).optional(),
    akadType: z.enum(akadTypes).optional(),
    amount: z.unknown().optional(),
    monthlyReturnRatePct: z.unknown().optional(),
    profitSharePct: z.unknown().optional(),
    productId: z.unknown().optional(),
    unitCount: z.unknown().optional(),
    unitCost: z.unknown().optional(),
    profitSharePerUnitPct: z.unknown().optional(),
    profitSharePerUnitAmount: z.unknown().optional(),
    startDate: z.unknown().optional(),
    endDate: z.unknown().optional(),
  })
  .strict();


const BatchInvestmentSchema = z.object({
  investorId: z.string().trim().min(1, "Investor wajib diisi."),
  investments: z.array(SingleInvestmentSchema).min(1, "Minimal pilih 1 produk investasi."),
});

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/investments/batch", "POST");
    const { userId, workspaceOwnerId } = await getRequestUser();
    const body = BatchInvestmentSchema.parse(await request.json());
    const investments = await createInvestmentBatch(workspaceOwnerId, body.investorId, body.investments);

    await logEvent({ workspaceOwnerId, actorUserId: userId }, {
      eventType: "INVESTMENT_CREATED",
      entityType: "investment",
      entityId: investments.map((i) => i.id).join(","),
      category: "create",
      payload: {
        investorId: body.investorId,
        count: investments.length,
        types: investments.map((i) => i.type),
      },
    });

    return NextResponse.json({ investments });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan investasi massal.");
  }
}
