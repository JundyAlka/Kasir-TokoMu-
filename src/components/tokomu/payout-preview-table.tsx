"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save, Search, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

type PayoutType = "uang" | "barang_titip_jual";
type PayoutStatus = "draft" | "disetujui" | "dibayar";

type PayoutRow = {
  id?: string;
  investmentId: string;
  investorId: string;
  investorName?: string;
  type: PayoutType;
  baseProfit: number;
  sharePct: number;
  amount: number;
  status?: PayoutStatus;
  paidAt?: string | null;
  note: string;
};

type PayoutCalculation = {
  periodStart: string;
  periodEnd: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
  totalInvestorPayout: number;
  pcmShare: number;
  reserveShare: number;
  storeShare: number;
  payouts: PayoutRow[];
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Periode bulan tidak valid.");
  }

  return { periodYear: year, periodMonth: month };
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Permintaan gagal.");
  }
  return data as T;
}

export function PayoutPreviewTable({
  rows,
  mode = "preview",
  onApprove,
  onPaid,
}: Readonly<{
  rows: PayoutRow[];
  mode?: "preview" | "saved";
  onApprove?: (id: string) => void;
  onPaid?: (id: string) => void;
}>) {
  return (
    <Table className="min-w-[920px]">
      <TableHeader>
        <TableRow>
          <TableHead>Investor</TableHead>
          <TableHead>Tipe</TableHead>
          <TableHead>Base profit</TableHead>
          <TableHead>Share</TableHead>
          <TableHead>Payout</TableHead>
          <TableHead>Catatan</TableHead>
          {mode === "saved" ? <TableHead className="text-right">Status</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id ?? row.investmentId}>
            <TableCell className="font-medium">{row.investorName ?? row.investorId}</TableCell>
            <TableCell>
              <Badge variant="outline">{row.type === "uang" ? "Uang" : "Barang titip jual"}</Badge>
            </TableCell>
            <TableCell>{formatCurrency(row.baseProfit)}</TableCell>
            <TableCell>{row.sharePct}%</TableCell>
            <TableCell className="font-medium">{formatCurrency(row.amount)}</TableCell>
            <TableCell className="max-w-sm whitespace-normal text-muted-foreground">{row.note}</TableCell>
            {mode === "saved" ? (
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Badge variant={row.status === "dibayar" ? "default" : "secondary"}>
                    {row.status ?? "draft"}
                  </Badge>
                  {row.status === "draft" && row.id ? (
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => onApprove?.(row.id!)}>
                      Setujui
                    </Button>
                  ) : null}
                  {row.status === "disetujui" && row.id ? (
                    <Button size="sm" className="rounded-full" onClick={() => onPaid?.(row.id!)}>
                      Tandai Dibayar
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={mode === "saved" ? 7 : 6} className="h-28 text-center text-muted-foreground">
              Belum ada payout untuk periode ini.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

export function BagiHasilClient() {
  const [period, setPeriod] = useState(currentMonthValue());
  const [calculation, setCalculation] = useState<PayoutCalculation | null>(null);
  const [savedRows, setSavedRows] = useState<PayoutRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const periodPayload = useMemo(() => parseMonthValue(period), [period]);
  const hasSavedDraft = savedRows.length > 0;
  const summary = calculation;

  async function loadSavedRows() {
    const data = await requestJson<{ payouts: PayoutRow[] }>(
      `/api/payouts?periodYear=${periodPayload.periodYear}&periodMonth=${periodPayload.periodMonth}`
    );
    setSavedRows(data.payouts);
    return data.payouts;
  }

  async function handleCalculate() {
    setIsLoading(true);
    try {
      const existing = await loadSavedRows();
      const data = await requestJson<{ calculation: PayoutCalculation }>("/api/payouts/calculate", {
        method: "POST",
        body: JSON.stringify(periodPayload),
      });
      setCalculation(data.calculation);
      toast.success(
        existing.length > 0
          ? "Periode ini sudah punya draft. Preview tetap diperbarui."
          : "Preview bagi hasil berhasil dihitung."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghitung preview.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      await requestJson<{ calculation: PayoutCalculation }>("/api/payouts", {
        method: "POST",
        body: JSON.stringify(periodPayload),
      });
      const rows = await loadSavedRows();
      toast.success(`${rows.length} draft payout berhasil disimpan.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan draft payout.");
      await loadSavedRows().catch(() => undefined);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(id: string, status: "disetujui" | "dibayar") {
    try {
      await requestJson(`/api/payouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadSavedRows();
      toast.success(status === "dibayar" ? "Payout ditandai dibayar." : "Payout disetujui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui payout.");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl">Distribusi bagi hasil periode</CardTitle>
            <CardDescription>
              Hitung investor, PCM, cadangan, dan bagian toko dari laba periode.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="period-month">Bulan</Label>
              <Input
                id="period-month"
                type="month"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  setCalculation(null);
                  setSavedRows([]);
                }}
                className="h-11 rounded-2xl"
              />
            </div>
            <Button className="h-11 rounded-2xl" onClick={() => void handleCalculate()} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Hitung Preview
            </Button>
          </div>
        </CardHeader>
      </Card>

      {summary ? (
        <section className="grid gap-3 md:grid-cols-5">
          <Card><CardHeader><CardDescription>Laba bersih bulan</CardDescription><CardTitle>{formatCurrency(summary.netProfit)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Total investor</CardDescription><CardTitle>{formatCurrency(summary.totalInvestorPayout)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Bagian PCM</CardDescription><CardTitle>{formatCurrency(summary.pcmShare)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Cadangan</CardDescription><CardTitle>{formatCurrency(summary.reserveShare)}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Bagian toko</CardDescription><CardTitle>{formatCurrency(summary.storeShare)}</CardTitle></CardHeader></Card>
        </section>
      ) : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5" />
              {hasSavedDraft ? "Draft payout tersimpan" : "Preview payout"}
            </CardTitle>
            <CardDescription>
              {hasSavedDraft
                ? "Periode ini sudah tersimpan. Gunakan aksi status per baris."
                : "Preview tidak menyimpan data sampai tombol draft ditekan."}
            </CardDescription>
          </div>
          {calculation && !hasSavedDraft ? (
            <Button className="rounded-2xl" onClick={() => void handleSaveDraft()} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan sebagai Draft
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <PayoutPreviewTable
            rows={hasSavedDraft ? savedRows : calculation?.payouts ?? []}
            mode={hasSavedDraft ? "saved" : "preview"}
            onApprove={(id) => void updateStatus(id, "disetujui")}
            onPaid={(id) => void updateStatus(id, "dibayar")}
          />
          {hasSavedDraft ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/8 p-3 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              Draft periode ini sudah ada, sehingga tombol simpan dinonaktifkan.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
