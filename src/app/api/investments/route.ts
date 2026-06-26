import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import {
  createInvestment,
  listInvestments,
} from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

const moneyAkads = ["murabahah_bil_wakalah", "mudharabah", "musyarakah", "pinjaman_qardh"] as const;
const goodsAkads = ["barang_titip_jual", "sales_titipan"] as const;
const akadTypes = [...moneyAkads, ...goodsAkads] as const;

const InvestmentCreateSchema = z
  .object({
    investorId: z.string().trim().min(1, "Investor wajib diisi."),
    type: z.enum(["uang", "barang_titip_jual"]).optional(),
    akadType: z.enum(akadTypes).optional(),
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
    const akadType =
      data.akadType ??
      (data.type === "barang_titip_jual" ? "barang_titip_jual" : "murabahah_bil_wakalah");
    const type = goodsAkads.includes(akadType as (typeof goodsAkads)[number])
      ? "barang_titip_jual"
      : "uang";

    return {
      ...data,
      type,
      akadType,
    };
  })
  .superRefine((data, ctx) => {
    if (data.type === "uang" && data.amount === undefined) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Nominal modal wajib diisi." });
    }

    if (
      (data.akadType === "mudharabah" || data.akadType === "musyarakah") &&
      data.profitSharePct === undefined
    ) {
      ctx.addIssue({ code: "custom", path: ["profitSharePct"], message: "Persentase bagi hasil wajib diisi." });
    }

    if (data.type === "barang_titip_jual") {
      for (const field of ["productId", "unitCount", "unitCost", "profitSharePerUnitPct"] as const) {
        if (data[field] === undefined || data[field] === "") {
          ctx.addIssue({ code: "custom", path: [field], message: `${field} wajib diisi.` });
        }
      }
    }
  });

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
    const { userId, workspaceOwnerId } = await getRequestUser();
    const body = InvestmentCreateSchema.parse(await request.json());
    const investment = await createInvestment(workspaceOwnerId, body.investorId, body);

    await logEvent({ workspaceOwnerId, actorUserId: userId }, {
      eventType: "INVESTMENT_CREATED",
      entityType: "investment",
      entityId: investment.id,
      category: "create",
      payload: {
        investorId: investment.investorId,
        type: investment.type,
        akadType: investment.akadType,
        amount: investment.amount,
        productId: investment.productId,
        unitCount: investment.unitCount,
      },
    });

    return NextResponse.json({ investment });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat investasi.");
  }
}
