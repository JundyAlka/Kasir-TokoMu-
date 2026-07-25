"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save, Search, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { AkadType } from "@/lib/server/profit-sharing";

type PayoutStatus = "draft" | "disetujui" | "dibayar";

type PayoutRow = {
  id?: string;
  investmentId: string;
  investorId: string;
  investorName?: string;
  akadType: AkadType;
  baseAmount: number;
  ratePct: number;
  amount: number;
  status?: PayoutStatus;
  paidAt?: string | null;
  note: string;
  periodStart?: string;
  periodEnd?: string;
  quantitySold?: number;
};

type PayoutCalculation = {
  periodStart: string;
  periodEnd: string;
  revenue: number;
  cogs: number;
  expenses: number;
  baseProfit: number;
  totalInvestorPayout: number;
  remaining: number;
  pcmShare: number;
  storeShare: number;
  payouts: PayoutRow[];
};

const akadLabels: Record<AkadType, string> = {
  murabahah_bil_wakalah: "Murabahah",
  mudharabah: "Mudharabah",
  musyarakah: "Musyarakah",
  barang_titip_jual: "Barang titip jual",
  sales_titipan: "Sales titipan",
  pinjaman_qardh: "Qardh",
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonths(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d);
    options.push({ value, label });
  }
  return options;
}

function parseMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Periode bulan tidak valid.");
  }

  return { year, month };
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
    <Table className="min-w-[980px]">
      <TableHeader>
        <TableRow>
          <TableHead>Investor</TableHead>
          <TableHead>Tipe akad</TableHead>
          <TableHead>Base profit / Qty</TableHead>
          <TableHead>Share/Rate</TableHead>
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
              <Badge variant="outline">{akadLabels[row.akadType]}</Badge>
            </TableCell>
            <TableCell>
              {row.akadType === "barang_titip_jual" || row.akadType === "sales_titipan" ? (
                row.quantitySold ? (
                  <div>
                    <span>{row.quantitySold} pcs</span>
                    <span className="ml-2 text-xs text-muted-foreground block">(Margin: {formatCurrency(row.baseAmount)})</span>
                  </div>
                ) : (
                  formatCurrency(row.baseAmount)
                )
              ) : (
                formatCurrency(row.baseAmount)
              )}
            </TableCell>
            <TableCell>
              {row.akadType === "barang_titip_jual" || row.akadType === "sales_titipan" ? (
                row.quantitySold ? (
                  `${formatCurrency(row.amount / row.quantitySold)} / pcs`
                ) : (
                  `${row.ratePct}%`
                )
              ) : (
                `${row.ratePct}%`
              )}
            </TableCell>
            <TableCell className="font-medium">{formatCurrency(row.amount)}</TableCell>
            <TableCell className="max-w-sm whitespace-normal text-muted-foreground">{row.note}</TableCell>
            {mode === "saved" ? (
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
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
              Belum ada data payout yang ditampilkan. Klik tombol 'Hitung Preview' di atas untuk menghitung simulasi terkini.
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
  const [historyRows, setHistoryRows] = useState<PayoutRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLivePreview, setIsLivePreview] = useState(false);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);

  const periodPayload = useMemo(() => parseMonthValue(period), [period]);
  const hasSavedDraft = savedRows.length > 0;
  const showLive = isLivePreview || !hasSavedDraft;
  const visibleRows = showLive && calculation ? calculation.payouts : (hasSavedDraft ? savedRows : (calculation?.payouts ?? []));
  const tableMode: "preview" | "saved" = showLive && calculation && !hasSavedDraft ? "preview" : (hasSavedDraft && !isLivePreview ? "saved" : "preview");
  const selectedMonthLabel = getRecentMonths().find((m) => m.value === period)?.label ?? period;

  async function loadSavedRows() {
    const data = await requestJson<{ payouts: PayoutRow[] }>(
      `/api/payouts?year=${periodPayload.year}&month=${periodPayload.month}`
    );
    setSavedRows(data.payouts);
    return data.payouts;
  }

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    Promise.all([
      requestJson<{ payouts: PayoutRow[] }>(
        `/api/payouts?year=${periodPayload.year}&month=${periodPayload.month}`
      ).catch(() => ({ payouts: [] as PayoutRow[] })),
      requestJson<{ calculation: PayoutCalculation }>("/api/payouts/calculate", {
        method: "POST",
        body: JSON.stringify(periodPayload),
      }).catch(() => null),
      requestJson<{ payouts: PayoutRow[] }>("/api/payouts").catch(() => ({
        payouts: [] as PayoutRow[],
      })),
    ])
      .then(([savedData, calcData, historyData]) => {
        if (!mounted) return;
        setSavedRows(savedData.payouts);
        if (calcData) {
          setCalculation(calcData.calculation);
          setCalculatedAt(new Date());
        }
        setHistoryRows(historyData.payouts);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [periodPayload.year, periodPayload.month]);

  async function loadHistoryRows() {
    const data = await requestJson<{ payouts: PayoutRow[] }>("/api/payouts");
    setHistoryRows(data.payouts);
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
      setCalculatedAt(new Date());
      setIsLivePreview(true);
      toast.success(
        existing.length > 0
          ? "Periode ini sudah punya draft. Menampilkan simulasi live terbaru."
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
      setIsLivePreview(false);
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
      await loadHistoryRows();
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
              Hitung preview, simpan draft, setujui, lalu tandai payout sebagai dibayar.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid gap-2 min-w-[200px]">
              <Label htmlFor="period-month">Bulan</Label>
              <Select
                value={period}
                onValueChange={(value) => {
                  setPeriod(value || "");
                  setIsLivePreview(false);
                  setCalculation(null);
                  setCalculatedAt(null);
                  setSavedRows([]);
                }}
              >
                <SelectTrigger id="period-month" className="h-11 rounded-2xl bg-card">
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {getRecentMonths().map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="h-11 rounded-2xl" onClick={() => void handleCalculate()} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Hitung Preview
            </Button>
          </div>
        </CardHeader>
      </Card>

      {(() => {
        const displayProfit = calculation?.baseProfit;
        const displayTotalPayout = calculation
          ? calculation.totalInvestorPayout
          : hasSavedDraft
          ? savedRows.reduce((sum, r) => sum + (r.amount || 0), 0)
          : undefined;
        const displayPcm = calculation?.pcmShare;
        const displayStore = calculation?.storeShare;

        return (
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <CardDescription>Laba bersih</CardDescription>
                <CardTitle className="text-xl font-bold">
                  {displayProfit !== undefined ? formatCurrency(displayProfit) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <CardDescription>Total bagi hasil investor</CardDescription>
                <CardTitle className="text-xl font-bold">
                  {displayTotalPayout !== undefined ? formatCurrency(displayTotalPayout) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <CardDescription>Bagian PCM (30%)</CardDescription>
                <CardTitle className="text-xl font-bold">
                  {displayPcm !== undefined ? formatCurrency(displayPcm) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80">
              <CardHeader className="pb-3">
                <CardDescription>Bagian toko (70%)</CardDescription>
                <CardTitle className="text-xl font-bold">
                  {displayStore !== undefined ? formatCurrency(displayStore) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>
          </section>
        );
      })()}

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5" />
              {showLive && calculation
                ? `Preview payout (${selectedMonthLabel})`
                : hasSavedDraft
                ? `Draft payout tersimpan (${selectedMonthLabel})`
                : `Preview payout (${selectedMonthLabel})`}
            </CardTitle>
            <CardDescription className="flex flex-col gap-2">
              <span>
                {showLive && calculation && !hasSavedDraft
                  ? "Preview bagi hasil bersifat dinamis. Anda dapat menghitung ulang simulasi dan menyimpannya ke draft kapan saja sesuai kebutuhan pengambilan payout."
                  : hasSavedDraft && !isLivePreview
                  ? "Periode ini sudah tersimpan dalam draft. Anda tetap dapat menghitung ulang simulasi terbaru atau mengelola status per baris."
                  : "Menampilkan simulasi preview live terbaru untuk periode ini. Jika ada perubahan transaksi, nilai ini mengikuti data terkini."}
              </span>
              {showLive && calculation && calculatedAt ? (
                <span className="inline-flex w-fit items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Dihitung pada: {new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(calculatedAt)}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedDraft && isLivePreview ? (
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => setIsLivePreview(false)}>
                Lihat Draft Tersimpan
              </Button>
            ) : null}
            {calculation && !hasSavedDraft ? (
              <Button className="rounded-2xl shrink-0" onClick={() => void handleSaveDraft()} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan sebagai Draft
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {!calculation && !hasSavedDraft && !isLoading ? (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <WalletCards className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-primary">
                    Belum ada perhitungan atau draft tersimpan untuk periode {selectedMonthLabel}
                  </p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    Perhitungan bagi hasil dapat dilakukan kapan pun karena laba bersih serta margin produk titipan bersifat dinamis sesuai transaksi terkini. Jika sewaktu-waktu ada investor yang ingin mengambil payout, klik tombol &quot;Hitung Preview&quot; untuk melihat kalkulasi real-time lalu simpan sebagai draft kapan saja.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="rounded-2xl shrink-0 shadow-sm"
                onClick={() => void handleCalculate()}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Hitung Sekarang
              </Button>
            </div>
          ) : null}
          <PayoutPreviewTable
            rows={visibleRows}
            mode={tableMode}
            onApprove={(id) => void updateStatus(id, "disetujui")}
            onPaid={(id) => void updateStatus(id, "dibayar")}
          />
          {hasSavedDraft && !isLivePreview ? (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/8 p-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span>Draft periode ini sudah ada. Jika ada perubahan transaksi terbaru, Anda dapat memperbarui simulasi.</span>
              </div>
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary font-semibold hover:bg-primary/10 shrink-0" onClick={() => void handleCalculate()}>
                Hitung Ulang Preview Live
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {historyRows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-4">
            <h3 className="font-heading text-xl font-semibold">Riwayat Payout Sebelumnya</h3>
          </div>
          {Object.entries(
            historyRows.reduce((acc, row) => {
              const monthKey = row.periodStart ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(row.periodStart)) : "Periode Tidak Diketahui";
              if (!acc[monthKey]) acc[monthKey] = [];
              acc[monthKey].push(row);
              return acc;
            }, {} as Record<string, PayoutRow[]>)
          )
          .filter(([monthKey]) => monthKey !== selectedMonthLabel || !hasSavedDraft)
          .map(([monthKey, groupRows]) => (
            <Card key={monthKey} className="border-border/60 bg-card/60">
              <CardHeader className="py-4">
                <CardTitle className="text-lg">{monthKey}</CardTitle>
              </CardHeader>
              <CardContent>
                <PayoutPreviewTable
                  rows={groupRows}
                  mode="saved"
                  onApprove={(id) => void updateStatus(id, "disetujui")}
                  onPaid={(id) => void updateStatus(id, "dibayar")}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
