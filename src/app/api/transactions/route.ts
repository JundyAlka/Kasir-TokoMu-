import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { getOpenSession, resolveRecordedBy } from "@/lib/server/shift-service";
import {
  exportTransactionsCsv,
  queryTransactions,
  type TransactionQueryFilters,
  type TransactionSortOption,
} from "@/lib/server/transaction-query-service";
import { TransactionCheckoutSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

function parseTransactionFilters(searchParams: URLSearchParams): TransactionQueryFilters {
  const sortRaw = searchParams.get("sort");
  const sort: TransactionSortOption =
    sortRaw === "oldest" || sortRaw === "highest" || sortRaw === "lowest"
      ? sortRaw
      : "newest";

  const minRaw = searchParams.get("minTotal");
  const maxRaw = searchParams.get("maxTotal");
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");

  const minTotal = minRaw !== null && minRaw.trim() !== "" ? Number(minRaw) : null;
  const maxTotal = maxRaw !== null && maxRaw.trim() !== "" ? Number(maxRaw) : null;

  return {
    q: searchParams.get("q") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    paymentMethod: searchParams.get("paymentMethod") ?? undefined,
    recordedBy: searchParams.get("recordedBy") ?? undefined,
    entrySource: searchParams.get("entrySource") ?? undefined,
    shiftSessionId: searchParams.get("shiftSessionId") ?? undefined,
    minTotal: minTotal !== null && Number.isFinite(minTotal) ? minTotal : null,
    maxTotal: maxTotal !== null && Number.isFinite(maxTotal) ? maxTotal : null,
    sort,
    page: pageRaw ? Number(pageRaw) || 1 : 1,
    pageSize: pageSizeRaw ? Number(pageSizeRaw) || 25 : 25,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { role, workspaceOwnerId } = await requireRoutePolicy("/api/transactions", "GET");
    const searchParams = request.nextUrl.searchParams;
    const filters = parseTransactionFilters(searchParams);
    const includeProfit = role !== "kasir";

    if (searchParams.get("export") === "csv") {
      const csv = await exportTransactionsCsv(workspaceOwnerId, filters, { includeProfit });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="riwayat-transaksi.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const result = await queryTransactions(workspaceOwnerId, filters, { includeProfit });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar transaksi.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/transactions", "POST");
    const body = TransactionCheckoutSchema.parse(await request.json());
    const openShift = await getOpenSession(workspaceOwnerId);
    if (!openShift) throw new Error("SHIFT_NOT_OPEN");
    const recordedBy = await resolveRecordedBy(workspaceOwnerId, userId);
    const result = await createTransaction(workspaceOwnerId, {
      ...body,
      recordedByUserId: recordedBy.userId,
      recordedByName: recordedBy.name,
      shiftSessionId: recordedBy.shiftSessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("stok")) {
      return handleRouteError(error, "Stok tidak cukup.", 409);
    }

    return handleRouteError(error, "Gagal menyimpan transaksi.");
  }
}
