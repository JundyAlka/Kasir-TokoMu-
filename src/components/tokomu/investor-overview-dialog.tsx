"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeDollarSign, Loader2, PackageOpen, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvestorSummary } from "@/components/tokomu/investor-card";

type InvestorDetail = {
  investor: {
    id: string;
    name: string;
    whatsapp: string;
    address: string;
    notes: string;
    isActive: number;
  };
  investments: Array<{
    id: string;
    type: string;
    amount: number | null;
    productName?: string | null;
    unitCount: number | null;
    unitCost: number | null;
    profitSharePerUnitAmount: number | null;
    profitSharePerUnitPct: number | null;
    monthlyReturnRatePct: number | null;
    isActive: number;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    periodStart: string;
    periodEnd: string;
    shareMode: string;
    perUnitAmount: number | null;
    sharePct: number;
    status: string;
  }>;
};

function investmentSummary(item: InvestorDetail["investments"][number]) {
  const capital = item.type === "uang"
    ? formatCurrency(item.amount ?? 0)
    : `${item.unitCount ?? 0} unit × ${formatCurrency(item.unitCost ?? 0)}`;
  const scheme = item.profitSharePerUnitAmount !== null
    ? `${formatCurrency(item.profitSharePerUnitAmount)} / pcs`
    : item.type === "uang"
      ? `${item.monthlyReturnRatePct ?? 0}% / bulan`
      : `${item.profitSharePerUnitPct ?? 0}% margin`;

  return { capital, scheme };
}

export function InvestorOverviewDialog({ investors }: Readonly<{ investors: InvestorSummary[] }>) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<InvestorDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all(
      investors.map(async (investor) => {
        const response = await fetch(`/api/investors/${investor.id}`);
        const body = (await response.json()) as InvestorDetail & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `Gagal memuat ${investor.name}.`);
        return body;
      })
    )
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat data investor.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [investors, open]);

  const totals = useMemo(() => ({
    activeCount: investors.filter((item) => item.isActive === 1).length,
    capital: investors.filter((item) => item.isActive === 1).reduce((sum, item) => sum + item.totalModal, 0),
    payout: investors.reduce((sum, item) => sum + item.payoutAmountThisMonth, 0),
  }), [investors]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="rounded-full" />}>
        Lihat semua investor
        <ArrowRight className="size-4" />
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[1120px] gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-[1120px]">
        <DialogHeader className="border-b border-border/60 px-5 py-5 sm:px-7">
          <DialogTitle className="font-heading text-2xl">Ringkasan semua investor</DialogTitle>
          <DialogDescription className="mt-1">Data modal, investasi, dan riwayat payout seluruh investor dalam satu tampilan.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[72vh]">
          <div className="space-y-5 px-5 py-5 sm:px-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="size-4" /> Investor aktif</div>
                <p className="mt-2 font-heading text-2xl font-semibold">{totals.activeCount} investor</p>
              </div>
              <div className="rounded-[20px] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><WalletCards className="size-4" /> Total modal aktif</div>
                <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{formatCurrency(totals.capital)}</p>
              </div>
              <div className="rounded-[20px] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><BadgeDollarSign className="size-4" /> Payout bulan ini</div>
                <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{formatCurrency(totals.payout)}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat seluruh data investor...</div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {details.map((detail) => {
                  const summary = investors.find((item) => item.id === detail.investor.id);
                  const activeInvestments = detail.investments.filter((item) => item.isActive === 1);
                  return (
                    <section key={detail.investor.id} className="rounded-[22px] border border-border/70 bg-card/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-heading text-lg font-semibold">{detail.investor.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{detail.investor.whatsapp || "WA belum diisi"}</p>
                        </div>
                        <Badge variant={detail.investor.isActive === 1 ? "default" : "secondary"}>{detail.investor.isActive === 1 ? "Aktif" : "Nonaktif"}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-muted/25 p-3"><p className="text-xs text-muted-foreground">Modal aktif</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(summary?.totalModal ?? 0)}</p></div>
                        <div className="rounded-xl bg-muted/25 p-3"><p className="text-xs text-muted-foreground">Payout bulan ini</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(summary?.payoutAmountThisMonth ?? 0)}</p></div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><PackageOpen className="size-4 text-primary" /> Investasi aktif ({activeInvestments.length})</div>
                        <div className="space-y-1.5">
                          {activeInvestments.map((item) => {
                            const itemSummary = investmentSummary(item);
                            return <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-xs"><span className="min-w-0 truncate">{item.productName || (item.type === "uang" ? "Modal uang" : "Produk titipan")} · {itemSummary.capital}</span><Badge variant="outline" className="shrink-0">{itemSummary.scheme}</Badge></div>;
                          })}
                          {activeInvestments.length === 0 ? <p className="rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground">Tidak ada investasi aktif.</p> : null}
                        </div>
                      </div>
                      <div className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                        <p>Payout terakhir: {detail.payouts[0] ? `${formatCurrency(detail.payouts[0].amount)} · ${formatDate(detail.payouts[0].periodStart)} – ${formatDate(detail.payouts[0].periodEnd)}` : "Belum ada payout"}</p>
                        {detail.investor.notes ? <p className="mt-1 line-clamp-2">Catatan: {detail.investor.notes}</p> : null}
                      </div>
                      <details className="mt-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium text-foreground">Lihat seluruh investasi dan payout</summary>
                        <div className="mt-3 space-y-3 text-muted-foreground">
                          <div>
                            <p className="mb-1.5 font-medium text-foreground">Semua investasi ({detail.investments.length})</p>
                            <div className="space-y-1.5">
                              {detail.investments.map((item) => {
                                const itemSummary = investmentSummary(item);
                                return <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-2.5 py-2"><span className="min-w-0 truncate">{item.productName || (item.type === "uang" ? "Modal uang" : "Produk titipan")} · {itemSummary.capital}</span><span className="shrink-0">{item.isActive === 1 ? "Aktif" : "Selesai"}</span></div>;
                              })}
                              {detail.investments.length === 0 ? <p>Belum ada investasi.</p> : null}
                            </div>
                          </div>
                          <div>
                            <p className="mb-1.5 font-medium text-foreground">Riwayat payout ({detail.payouts.length})</p>
                            <div className="space-y-1.5">
                              {detail.payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-2.5 py-2"><span>{formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}</span><span className="shrink-0 font-medium text-foreground">{formatCurrency(payout.amount)}</span></div>)}
                              {detail.payouts.length === 0 ? <p>Belum ada payout.</p> : null}
                            </div>
                          </div>
                        </div>
                      </details>
                      <Button render={<Link href={`/investor/${detail.investor.id}`} />} nativeButton={false} variant="outline" size="sm" className="mt-3 rounded-full">Halaman lengkap <ArrowRight className="size-3.5" /></Button>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
