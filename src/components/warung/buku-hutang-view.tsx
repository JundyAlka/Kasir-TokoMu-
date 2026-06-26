"use client";

import { useCallback, useMemo, useState } from "react";
import { Info, Search, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { StatCard } from "@/components/stat-card";
import { DebtDetailDialog } from "@/components/tokomu/debt-detail-dialog";
import { DebtFormDialog } from "@/components/tokomu/debt-form-dialog";
import {
  DebtSummaryDetailDialog,
  DebtSummaryMetric,
} from "@/components/tokomu/debt-summary-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { Debt } from "@/lib/types";

type DebtFilter = "semua" | "aktif" | "lewat_tempo" | "lunas";

function statusClassName(status: Debt["status"]) {
  if (status === "lunas") {
    return "rounded-full bg-accent text-accent-foreground";
  }

  if (status === "lewat_tempo") {
    return "rounded-full bg-destructive text-destructive-foreground";
  }

  return "rounded-full bg-primary text-primary-foreground";
}

function statusLabel(status: Debt["status"]) {
  if (status === "lunas") {
    return "Lunas";
  }

  if (status === "lewat_tempo") {
    return "Lewat tempo";
  }

  return "Aktif";
}

export function BukuHutangView() {
  const { debts, products, addDebt } = useAppState();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DebtFilter>("semua");
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [debtOverrides, setDebtOverrides] = useState<Record<string, Debt>>({});
  const [activeSummaryMetric, setActiveSummaryMetric] = useState<DebtSummaryMetric | null>(null);

  const visibleDebts = useMemo(
    () => debts.map((debt) => debtOverrides[debt.id] ?? debt),
    [debtOverrides, debts]
  );

  const filteredDebts = visibleDebts.filter((debt) => {
    const keyword = query.toLowerCase();
    const matchesKeyword =
      debt.borrowerName.toLowerCase().includes(keyword) ||
      debt.whatsapp.includes(keyword);
    const matchesStatus = status === "semua" || debt.status === status;
    return matchesKeyword && matchesStatus;
  });

  const outstandingTotal = visibleDebts
    .filter((debt) => debt.status !== "lunas")
    .reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const paidCount = visibleDebts.filter((debt) => debt.status === "lunas").length;
  const overdueCount = visibleDebts.filter((debt) => debt.status === "lewat_tempo").length;

  const handleDebtUpdated = useCallback((debt: Debt) => {
    setDebtOverrides((current) => ({
      ...current,
      [debt.id]: debt,
    }));
  }, []);

  function openDetail(debtId: string) {
    setSelectedDebtId(debtId);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Kasbon aktif"
          value={formatCurrency(outstandingTotal)}
          description="Total sisa piutang yang masih perlu ditagih."
          onClick={() => setActiveSummaryMetric("aktif")}
        />
        <StatCard
          title="Sudah lunas"
          value={`${paidCount} pelanggan`}
          description="Pelanggan yang sudah menyelesaikan pembayaran."
          tone="accent"
          onClick={() => setActiveSummaryMetric("lunas")}
        />
        <StatCard
          title="Lewat tempo"
          value={`${overdueCount} kasbon`}
          description="Kasbon belum lunas yang melewati jatuh tempo hari ini."
          tone="warn"
          onClick={() => setActiveSummaryMetric("lewat_tempo")}
        />
      </section>

      <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl">Buku hutang pelanggan</CardTitle>
            <CardDescription>
              Kelola kasbon, cicilan, dan rincian barang pelanggan dari satu halaman.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-[220px]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama atau no. WhatsApp"
                className="h-11 rounded-2xl bg-card/85 pl-9"
              />
            </div>

            <DebtFormDialog
              products={products}
              onSubmit={async (draft) => {
                await addDebt(draft);
                toast.success("Kasbon berhasil disimpan.");
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={status} onValueChange={(value) => setStatus(value as DebtFilter)}>
            <TabsList className="rounded-full p-1">
              <TabsTrigger value="semua" className="rounded-full px-4">
                Semua
              </TabsTrigger>
              <TabsTrigger value="aktif" className="rounded-full px-4">
                Aktif
              </TabsTrigger>
              <TabsTrigger value="lewat_tempo" className="rounded-full px-4">
                Lewat tempo
              </TabsTrigger>
              <TabsTrigger value="lunas" className="rounded-full px-4">
                Lunas
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredDebts.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredDebts.map((debt) => (
                <button
                  key={debt.id}
                  type="button"
                  onClick={() => openDetail(debt.id)}
                  className="text-left"
                >
                  <Card className="h-full rounded-[26px] border border-border/70 bg-card/78 transition hover:border-primary/60 hover:bg-card">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-heading text-xl font-semibold">{debt.borrowerName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{debt.whatsapp}</p>
                        </div>
                        <Badge className={statusClassName(debt.status)}>
                          {statusLabel(debt.status)}
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[20px] bg-muted/55 p-4">
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="mt-2 text-lg font-semibold">{formatCurrency(debt.amount)}</p>
                        </div>
                        <div className="rounded-[20px] bg-muted/55 p-4">
                          <p className="text-sm text-muted-foreground">Sisa</p>
                          <p className="mt-2 text-lg font-semibold">{formatCurrency(debt.remainingAmount)}</p>
                        </div>
                        <div className="rounded-[20px] bg-muted/55 p-4">
                          <p className="text-sm text-muted-foreground">Tempo</p>
                          <p className="mt-2 text-lg font-semibold">{formatDate(debt.dueDate)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-[20px] border border-border/70 bg-card/75 p-4 text-sm text-muted-foreground">
                        <div>
                          <p>Dicatat: {formatDateTime(debt.createdAt)}</p>
                          <p className="mt-1">
                            Pengingat: {debt.lastReminderAt ? formatDateTime(debt.lastReminderAt) : "Belum dikirim"}
                          </p>
                        </div>
                        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground">
                          <Info className="size-4" />
                          Detail
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-[26px] border border-dashed border-border/80 bg-muted/35 p-6 text-center">
              <WalletCards className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Belum ada kasbon yang cocok.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ubah filter atau catat kasbon baru untuk mulai melacak piutang pelanggan.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <DebtDetailDialog
        debtId={selectedDebtId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDebtUpdated={handleDebtUpdated}
      />
      <DebtSummaryDetailDialog
        debts={visibleDebts}
        metric={activeSummaryMetric}
        onClose={() => setActiveSummaryMetric(null)}
      />
    </div>
  );
}
