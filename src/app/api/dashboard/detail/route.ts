import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";
import {
  getKasbonDetail,
  getOmzetDetail,
  getStokMenipisDetail,
  getTransaksiDetail,
} from "@/lib/server/reporting";

export const runtime = "nodejs";

const VALID_METRICS = ["omzet", "transaksi", "stok", "kasbon"] as const;
type Metric = (typeof VALID_METRICS)[number];

function isValidMetric(value: string | null): value is Metric {
  return VALID_METRICS.includes(value as Metric);
}

/**
 * GET /api/dashboard/detail?metric=omzet|transaksi|stok|kasbon&date=YYYY-MM-DD
 *
 * Role access:
 * - pimpinan / pengelola_keuangan: all metrics
 * - kasir: omzet, transaksi, stok only (kasbon hidden)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
    const { workspaceOwnerId } = await getRequestUser();

    const metric = request.nextUrl.searchParams.get("metric");
    if (!isValidMetric(metric)) {
      return NextResponse.json(
        { error: "Parameter metric harus salah satu: omzet, transaksi, stok, kasbon." },
        { status: 400 }
      );
    }

    // kasir cannot access kasbon details
    if (metric === "kasbon" && context.role === "kasir") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const dateParam = request.nextUrl.searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Format tanggal tidak valid. Gunakan YYYY-MM-DD." },
        { status: 400 }
      );
    }

    let data: unknown;

    switch (metric) {
      case "omzet":
        data = await getOmzetDetail(workspaceOwnerId, date);
        break;
      case "transaksi":
        data = await getTransaksiDetail(workspaceOwnerId, date);
        break;
      case "stok":
        data = await getStokMenipisDetail(workspaceOwnerId, date);
        break;
      case "kasbon":
        data = await getKasbonDetail(workspaceOwnerId, date);
        break;
    }

    return NextResponse.json({ metric, data });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat detail metrik dashboard.");
  }
}
