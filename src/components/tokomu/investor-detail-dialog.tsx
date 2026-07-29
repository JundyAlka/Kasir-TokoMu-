"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeDollarSign, CalendarDays, Loader2, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvestorSummary } from "@/components/tokomu/investor-card";

type InvestmentDetail = {
  id: string;
  type: string;
  akadType: string | null;
  amount: number | null;
  monthlyReturnRatePct: number | null;
  profitSharePct: number | null;
  productName?: string | null;
  unitCount: number | null;
  unitCost: number | null;
  profitSharePerUnitPct: number | null;
  profitSharePerUnitAmount: number | null;
  startDate: string;
  isActive: number;
};

type PayoutDetail = {
  id: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: string;
  shareMode: string;
  perUnitAmount: number | null;
  sharePct: number;
};

type InvestorDetailResponse = {
  investor: {
    name: string;
    whatsapp: string;
    address: string;
    notes: string;
    isActive: number;
  };
  investments: InvestmentDetail[];
  payouts: PayoutDetail[];
};

function investmentLabel(investment: InvestmentDetail) {
  if (investment.type === "uang") {
    return formatCurrency(investment.amount ?? 0);
  }

  return `${investment.unitCount ?? 0} unit × ${formatCurrency(investment.unitCost ?? 0)}`;
}

function investmentRateLabel(investment: InvestmentDetail) {
  if (investment.profitSharePerUnitAmount !== null) {
    return `${formatCurrency(investment.profitSharePerUnitAmount)} / pcs`;
  }
  if (investment.type === "uang" && investment.monthlyReturnRatePct !== null) {
    return `${investment.monthlyReturnRatePct}% / bulan`;
  }
  if (investment.profitSharePct !== null) {
    return `${investment.profitSharePct}% laba`;
  }
  return `${investment.profitSharePerUnitPct ?? 0}% margin`;
}

export function InvestorDetailDialog({
  investor,
  investors,
  selectInvestor = false,
}: Readonly<{
  investor: InvestorSummary;
  investors?: InvestorSummary[];
  selectInvestor?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState(investor.id);
  const [detail, setDetail] = useState<InvestorDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedInvestor = investors?.find((item) => item.id === selectedInvestorId) ?? investor;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/investors/${selectedInvestor.id}`)
      .then(async (response) => {
        const body = (await response.json()) as InvestorDetailResponse & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Gagal memuat detail investor.");
        if (!cancelled) setDetail(body);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat detail investor.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedInvestor.id]);

  const activeInvestments = detail?.investments.filter((item) => item.isActive === 1) ?? [];
  const activeCapital = activeInvestments.reduce(
    (total, item) => total + (item.type === "uang" ? item.amount ?? 0 : (item.unitCount ?? 0) * (item.unitCost ?? 0)),
    0
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="rounded-full" />}>
        {selectInvestor ? "Lihat detail investor" : "Lihat detail"}
        <ArrowRight className="size-4" />
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[960px] gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-[960px]">
        <DialogHeader className="border-b border-border/60 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start justify-between gap-4 pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate font-heading text-2xl">{detail?.investor.name ?? selectedInvestor.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {detail?.investor.whatsapp || selectedInvestor.whatsapp || "Nomor WhatsApp belum diisi"}
              </DialogDescription>
            </div>
            <Badge variant={(detail?.investor.isActive ?? selectedInvestor.isActive) === 1 ? "default" : "secondary"}>
              {(detail?.investor.isActive ?? selectedInvestor.isActive) === 1 ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[72vh]">
          <div className="space-y-5 px-5 py-5 sm:px-7">
            {selectInvestor && investors && investors.length > 1 ? (
              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pilih investor</span>
                <Select value={selectedInvestorId} onValueChange={(value) => setSelectedInvestorId(value ?? selectedInvestor.id)}>
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-card">
                    <SelectValue>{selectedInvestor.name}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {investors.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {loading ? (
              <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Memuat detail investor...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
            ) : detail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-border/70 bg-muted/25 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><WalletCards className="size-4" /> Modal aktif</div>
                    <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{formatCurrency(activeCapital)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{activeInvestments.length} investasi aktif</p>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-muted/25 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><BadgeDollarSign className="size-4" /> Payout bulan ini</div>
                    <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{formatCurrency(investor.payoutAmountThisMonth)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{investor.payoutCountThisMonth} payout tercatat</p>
                  </div>
                </div>

                <section className="rounded-[22px] border border-border/70 bg-card/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-semibold">Investasi aktif</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Modal uang dan barang titip jual yang sedang berjalan.</p>
                    </div>
                    <Badge variant="outline">{activeInvestments.length} aktif</Badge>
                  </div>
                  <div className="space-y-2">
                    {activeInvestments.map((item) => (
                      <div key={item.id} className="grid gap-2 rounded-2xl border border-border/60 bg-background/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.productName || (item.type === "uang" ? "Modal uang" : "Produk titipan")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{investmentLabel(item)} · Mulai {formatDate(item.startDate)}</p>
                        </div>
                        <Badge variant="outline" className="w-fit whitespace-nowrap">{investmentRateLabel(item)}</Badge>
                      </div>
                    ))}
                    {activeInvestments.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Belum ada investasi aktif.</p> : null}
                  </div>
                </section>

                <section className="rounded-[22px] border border-border/70 bg-card/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    <div>
                      <h3 className="font-heading font-semibold">Payout terbaru</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Maksimal 4 riwayat payout terakhir.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {detail.payouts.slice(0, 4).map((payout) => (
                      <div key={payout.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {payout.shareMode === "per_unit_amount" ? `${formatCurrency(payout.perUnitAmount ?? 0)} / pcs` : `${payout.sharePct}% bagi hasil`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatCurrency(payout.amount)}</p>
                          <Badge variant={payout.status === "dibayar" ? "default" : "secondary"} className="mt-1">{payout.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {detail.payouts.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Belum ada riwayat payout.</p> : null}
                  </div>
                </section>

                {detail.investor.address || detail.investor.notes ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {detail.investor.address ? <p>Alamat: {detail.investor.address}</p> : null}
                    {detail.investor.notes ? <p className={detail.investor.address ? "mt-2" : ""}>Catatan: {detail.investor.notes}</p> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex justify-end border-t border-border/60 bg-muted/20 px-5 py-4 sm:px-7">
          <Button render={<Link href={`/investor/${selectedInvestor.id}`} />} nativeButton={false} variant="outline" className="rounded-full">
            Buka halaman lengkap
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
