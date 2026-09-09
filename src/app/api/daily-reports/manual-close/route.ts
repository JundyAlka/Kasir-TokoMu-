import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import {
  deleteManualClosing,
  getManualClosingForDate,
  getPreviousDayClosing,
  listManualClosings,
  saveManualClosing,
} from "@/lib/server/manual-daily-closing-service";

export const runtime = "nodejs";

const ExpenseLineSchema = z.object({
  name: z.string().min(1, "Nama pengeluaran harus diisi"),
  amount: z.number().min(0, "Nominal pengeluaran tidak boleh negatif"),
});

const SaveManualClosingSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  openingCash: z.number().min(0, "Kas awal tidak boleh negatif"),
  openingCoins: z.number().min(0).default(0),
  openingSavings: z.number().min(0).default(0),
  revenue: z.number().min(0, "Total pemasukan tidak boleh negatif"),
  cashierIncome: z.number().min(0).optional(),
  otherIncome: z.number().min(0).optional(),
  storeExpenses: z.array(ExpenseLineSchema).default([]),
  titipanExpenses: z.array(ExpenseLineSchema).default([]),
  closingCash: z.number().min(0, "Kas tutup tidak boleh negatif"),
  closingCoins: z.number().min(0).default(0),
  closingSavings: z.number().min(0).default(0),
  note: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports/manual-close", "GET");
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // Mode 1: Jika meminta detail tanggal tertentu & kas awal hari kemarin
    if (date) {
      const [current, previous] = await Promise.all([
        getManualClosingForDate(workspaceOwnerId, date),
        getPreviousDayClosing(workspaceOwnerId, date),
      ]);

      return NextResponse.json({
        reportDate: date,
        closing: current,
        previousClosing: previous,
      });
    }

    // Mode 2: Jika meminta list range tanggal (misal bulan ini)
    const today = new Date().toISOString().slice(0, 10);
    const rangeStart = start ?? `${today.slice(0, 8)}01`;
    const rangeEnd = end ?? today;

    const list = await listManualClosings(workspaceOwnerId, rangeStart, rangeEnd);
    return NextResponse.json({
      start: rangeStart,
      end: rangeEnd,
      closings: list,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil data tutup buku harian.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports/manual-close", "POST");
    const json = await request.json();
    const payload = SaveManualClosingSchema.parse(json);

    const saved = await saveManualClosing(workspaceOwnerId, userId, payload);
    return NextResponse.json({
      success: true,
      closing: saved,
      message: `Tutup buku tanggal ${payload.reportDate} berhasil disimpan.`,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan tutup buku harian.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports/manual-close", "DELETE");
    const reportDate = request.nextUrl.searchParams.get("date");
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
    }

    const res = await deleteManualClosing(workspaceOwnerId, userId, reportDate);
    return NextResponse.json({
      success: true,
      message: `Tutup buku tanggal ${reportDate} berhasil dihapus.`,
      result: res,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus data tutup buku harian.");
  }
}
