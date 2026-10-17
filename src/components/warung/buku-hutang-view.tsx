"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Info,
  Layers,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Phone,
  Receipt,
  Search,
  TableProperties,
  User,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { StatCard } from "@/components/stat-card";
import { DebtDetailDialog } from "@/components/tokomu/debt-detail-dialog";
import { DebtFormDialog } from "@/components/tokomu/debt-form-dialog";
import { DebtImportDialog } from "@/components/tokomu/debt-import-dialog";
import {
  DebtSummaryDetailDialog,
  DebtSummaryMetric,
} from "@/components/tokomu/debt-summary-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { Debt } from "@/lib/types";
import { cn } from "@/lib/utils";

type DebtFilter = "semua" | "aktif" | "lewat_tempo" | "lunas";
type ViewMode = "table" | "grid";

export interface CustomerDebtGroup {
  key: string;
  displayName: string;
  whatsapp: string;
  variantNames: string[];
  debts: Debt[];
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  overallStatus: "lewat_tempo" | "aktif" | "lunas";
  overdueCount: number;
  activeCount: number;
  paidCount: number;
  earliestDueDate: string | null;
  latestCreatedAt: string;
}

function normalizeName(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanPhone(phone?: string | null): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("62")) return "0" + d.slice(2);
  return d;
}

function capitalizeWords(str: string): string {
  return str
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function stripHonorific(name: string): string {
  return name.replace(/^(bpk|bapak|ibu|bu|pak|mas|mbak|mbok|mbokde|lek|lik|om|tante|cak|haji|h\.)\s+/i, "");
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "P";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d]/g, ""));
}

function formatNumberInput(value: number) {
  if (!value) return "";
  return new Intl.NumberFormat("id-ID").format(value);
}

function statusClassName(status: Debt["status"]) {
  if (status === "lunas") {
    return "rounded-full bg-emerald-600 text-white font-semibold text-xs";
  }
  if (status === "lewat_tempo") {
    return "rounded-full bg-rose-600 text-white font-semibold text-xs animate-pulse";
  }
  return "rounded-full bg-amber-600 text-white font-semibold text-xs";
}

function statusLabel(status: Debt["status"]) {
  if (status === "lunas") return "Lunas";
  if (status === "lewat_tempo") return "Lewat tempo";
  return "Aktif";
}

export function BukuHutangView() {
  const { debts, products, addDebt } = useAppState();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DebtFilter>("semua");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [debtOverrides, setDebtOverrides] = useState<Record<string, Debt>>({});
  const [activeSummaryMetric, setActiveSummaryMetric] = useState<DebtSummaryMetric | null>(null);

  // Quick Pay States
  const [quickPayDebt, setQuickPayDebt] = useState<Debt | null>(null);
  const [quickPayMode, setQuickPayMode] = useState<"cicil" | "lunas">("cicil");
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [quickPayNote, setQuickPayNote] = useState<string>("");
  const [quickPaySubmitting, setQuickPaySubmitting] = useState<boolean>(false);

  const visibleDebts = useMemo(
    () => debts.map((debt) => debtOverrides[debt.id] ?? debt),
    [debtOverrides, debts]
  );

  // Customer Grouping Logic
  const customerGroups = useMemo<CustomerDebtGroup[]>(() => {
    const groups: CustomerDebtGroup[] = [];
    const nameToGroup = new Map<string, CustomerDebtGroup>();
    const phoneToGroup = new Map<string, CustomerDebtGroup>();
    const baseToGroup = new Map<string, CustomerDebtGroup>();

    for (const debt of visibleDebts) {
      const rawName = debt.borrowerName?.trim() || "Pelanggan";
      const normName = normalizeName(rawName);
      const baseName = normalizeName(stripHonorific(normName));
      const phone = cleanPhone(debt.whatsapp);

      // Match finding
      let group: CustomerDebtGroup | undefined;
      if (nameToGroup.has(normName)) {
        group = nameToGroup.get(normName);
      } else if (phone && phone.length >= 8 && phoneToGroup.has(phone)) {
        group = phoneToGroup.get(phone);
      } else if (baseName && baseName.length >= 3 && baseToGroup.has(baseName)) {
        const candidate = baseToGroup.get(baseName)!;
        const candidatePhone = cleanPhone(candidate.whatsapp);
        if (!phone || !candidatePhone || phone === candidatePhone) {
          group = candidate;
        }
      }

      if (!group) {
        const key = `group_${normName.replace(/[^a-z0-9]/g, "_") || "user"}_${groups.length}`;
        group = {
          key,
          displayName: capitalizeWords(rawName),
          whatsapp: debt.whatsapp || "",
          variantNames: [rawName],
          debts: [],
          totalAmount: 0,
          totalPaid: 0,
          totalRemaining: 0,
          overallStatus: "aktif",
          overdueCount: 0,
          activeCount: 0,
          paidCount: 0,
          earliestDueDate: null,
          latestCreatedAt: debt.createdAt,
        };
        groups.push(group);
        nameToGroup.set(normName, group);
        if (baseName && baseName.length >= 3) {
          baseToGroup.set(baseName, group);
        }
      } else {
        if (!group.variantNames.includes(rawName)) {
          group.variantNames.push(rawName);
        }
        if (!group.whatsapp && debt.whatsapp) {
          group.whatsapp = debt.whatsapp;
        }
        // Retain neatest capitalized name
        if (rawName.length > group.displayName.length && rawName !== rawName.toLowerCase()) {
          group.displayName = capitalizeWords(rawName);
        }
      }

      if (phone && phone.length >= 8) {
        phoneToGroup.set(phone, group);
      }

      group.debts.push(debt);
    }

    // Process group metrics & internal sort
    for (const group of groups) {
      // Sort individual debts: overdue first, active second, lunas last, newest first
      group.debts.sort((a, b) => {
        const rank = (s: Debt["status"]) => (s === "lewat_tempo" ? 0 : s === "aktif" ? 1 : 2);
        const rA = rank(a.status);
        const rB = rank(b.status);
        if (rA !== rB) return rA - rB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      group.totalAmount = group.debts.reduce((sum, d) => sum + d.amount, 0);
      group.totalRemaining = group.debts.reduce((sum, d) => sum + d.remainingAmount, 0);
      group.totalPaid = group.totalAmount - group.totalRemaining;
      group.overdueCount = group.debts.filter((d) => d.status === "lewat_tempo").length;
      group.activeCount = group.debts.filter((d) => d.status === "aktif" && d.remainingAmount > 0).length;
      group.paidCount = group.debts.filter((d) => d.status === "lunas" || d.remainingAmount <= 0).length;

      group.overallStatus =
        group.overdueCount > 0 ? "lewat_tempo" : group.totalRemaining > 0 ? "aktif" : "lunas";

      const activeDueDates = group.debts
        .filter((d) => d.status !== "lunas" && d.remainingAmount > 0 && d.dueDate)
        .map((d) => d.dueDate!)
        .sort();
      group.earliestDueDate = activeDueDates[0] || null;

      const dates = group.debts.map((d) => d.createdAt).sort().reverse();
      group.latestCreatedAt = dates[0] || new Date().toISOString();
    }

    // Sort groups: Active & Overdue ALWAYS appear first!
    groups.sort((a, b) => {
      const rank = (s: "lewat_tempo" | "aktif" | "lunas") => (s === "lewat_tempo" ? 0 : s === "aktif" ? 1 : 2);
      const rA = rank(a.overallStatus);
      const rB = rank(b.overallStatus);
      if (rA !== rB) return rA - rB;

      // Active groups with highest remaining balance come first
      if (a.overallStatus !== "lunas" && b.overallStatus !== "lunas") {
        if (b.totalRemaining !== a.totalRemaining) {
          return b.totalRemaining - a.totalRemaining;
        }
      }

      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });

    return groups;
  }, [visibleDebts]);

  // Tab Filtering & Query Searching
  const filteredGroups = useMemo(() => {
    return customerGroups.filter((group) => {
      // Status filtering
      if (status === "aktif" && group.totalRemaining <= 0) return false;
      if (status === "lewat_tempo" && group.overdueCount === 0) return false;
      if (status === "lunas" && group.totalRemaining > 0) return false;

      // Search keyword filtering
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchName =
          group.displayName.toLowerCase().includes(q) ||
          group.variantNames.some((v) => v.toLowerCase().includes(q));
        const matchPhone = group.whatsapp.includes(q);
        const matchDebts = group.debts.some(
          (d) =>
            (d.dueDate && d.dueDate.includes(q)) ||
            (d.borrowerName && d.borrowerName.toLowerCase().includes(q))
        );
        return matchName || matchPhone || matchDebts;
      }

      return true;
    });
  }, [customerGroups, status, query]);

  // Overall metric totals
  const outstandingTotal = visibleDebts
    .filter((debt) => debt.status !== "lunas")
    .reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const paidCount = visibleDebts.filter((debt) => debt.status === "lunas").length;
  const overdueCount = visibleDebts.filter((debt) => debt.status === "lewat_tempo").length;

  // Group metric counts for tabs
  const groupStats = useMemo(() => {
    return {
      total: customerGroups.length,
      aktif: customerGroups.filter((g) => g.totalRemaining > 0).length,
      lewatTempo: customerGroups.filter((g) => g.overdueCount > 0).length,
      lunas: customerGroups.filter((g) => g.totalRemaining === 0).length,
    };
  }, [customerGroups]);

  const toggleGroupExpand = useCallback((key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedGroupKeys(new Set(filteredGroups.map((g) => g.key)));
  }, [filteredGroups]);

  const collapseAll = useCallback(() => {
    setExpandedGroupKeys(new Set());
  }, []);

  const isAllExpanded = useMemo(() => {
    if (filteredGroups.length === 0) return false;
    return filteredGroups.every((g) => expandedGroupKeys.has(g.key));
  }, [filteredGroups, expandedGroupKeys]);

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

  function openQuickCicil(debt: Debt) {
    setQuickPayDebt(debt);
    setQuickPayMode("cicil");
    setQuickPayAmount(Math.min(20000, debt.remainingAmount));
    setQuickPayNote("Cicilan kasbon");
  }

  function openQuickLunas(debt: Debt) {
    setQuickPayDebt(debt);
    setQuickPayMode("lunas");
    setQuickPayAmount(debt.remainingAmount);
    setQuickPayNote("Pelunasan kasbon");
  }

  function sendWhatsappReminder(borrowerName: string, whatsapp: string, remainingAmount: number, dueDate?: string | null) {
    if (!whatsapp) {
      toast.error("Nomor WhatsApp pelanggan belum dicatat.");
      return;
    }
    const cleanNumber = whatsapp.replace(/\D/g, "");
    const formattedPhone = cleanNumber.startsWith("0") ? "62" + cleanNumber.slice(1) : cleanNumber;
    const dueInfo = dueDate ? ` yang jatuh tempo pada tanggal *${formatDate(dueDate)}*` : "";
    const text = `Assalamu'alaikum wr. wb.\n\nHalo Kak *${borrowerName}*, mohon maaf mengganggu waktunya sebentar 🙏\n\nIni pesan pengingat ramah dari TokoMu, sekadar menginformasikan catatan kasbon yang masih ada sebesar *${formatCurrency(remainingAmount)}*${dueInfo}.\n\nBila ada kelonggaran rezeki, pembayaran atau cicilan bisa dilakukan di kasir toko ya kak. Terima kasih banyak, semoga selalu dilancarkan rezekinya! 😊`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleQuickPaySubmit() {
    if (!quickPayDebt) return;
    if (quickPayAmount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari Rp 0.");
      return;
    }
    if (quickPayAmount > quickPayDebt.remainingAmount) {
      toast.error(`Nominal melebihi sisa tagihan (${formatCurrency(quickPayDebt.remainingAmount)}).`);
      return;
    }

    try {
      setQuickPaySubmitting(true);
      const res = await fetch(`/api/debts/${quickPayDebt.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: quickPayAmount,
          note: quickPayNote || (quickPayMode === "lunas" ? "Pelunasan kasbon" : "Cicilan kasbon"),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Gagal mencatat pembayaran.");
      }

      const data = (await res.json()) as { debt: Debt };
      handleDebtUpdated(data.debt);
      toast.success(
        data.debt.isPaid
          ? `Kasbon atas nama ${data.debt.borrowerName} telah LUNAS! 🎉`
          : `Cicilan ${formatCurrency(quickPayAmount)} untuk ${data.debt.borrowerName} berhasil dicatat!`
      );
      setQuickPayDebt(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pembayaran.");
    } finally {
      setQuickPaySubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Stat Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Kasbon aktif"
          value={formatCurrency(outstandingTotal)}
          description={`${groupStats.aktif} pelanggan masih memiliki sisa piutang.`}
          onClick={() => setActiveSummaryMetric("aktif")}
        />
        <StatCard
          title="Sudah lunas"
          value={`${paidCount} kasbon`}
          description={`${groupStats.lunas} pelanggan sudah menyelesaikan seluruh kasbon.`}
          tone="accent"
          onClick={() => setActiveSummaryMetric("lunas")}
        />
        <StatCard
          title="Lewat tempo"
          value={`${overdueCount} kasbon`}
          description={`${groupStats.lewatTempo} pelanggan melewati batas jatuh tempo.`}
          tone="warn"
          onClick={() => setActiveSummaryMetric("lewat_tempo")}
        />
      </section>

      {/* Main Container */}
      <Card className="border-border/60 bg-card/75 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="font-heading text-2xl">Buku Hutang Pelanggan</CardTitle>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-primary/25">
                {groupStats.aktif} Pelanggan Aktif
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Daftar kasbon terkelompok per pelanggan. Hutang aktif dan jatuh tempo diprioritaskan di atas.
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 md:items-center">
            {/* Search Input */}
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  // Auto-expand on search so results are immediately visible
                  if (event.target.value.trim().length > 0) {
                    setExpandedGroupKeys(new Set(customerGroups.map((g) => g.key)));
                  }
                }}
                placeholder="Cari nama, nama mirip, atau WA..."
                className="h-10 rounded-2xl bg-card/85 pl-9 text-xs sm:text-sm"
              />
            </div>

            <DebtImportDialog />

            <DebtFormDialog
              products={products}
              onSubmit={async (draft) => {
                await addDebt(draft);
                toast.success("Kasbon berhasil disimpan.");
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Controls Bar: Tabs Filter, View Toggle, Expand/Collapse */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/50 pb-3">
            <Tabs
              value={status}
              onValueChange={(value) => setStatus(value as DebtFilter)}
              className="w-full sm:w-auto"
            >
              <TabsList className="rounded-full p-1 h-10 bg-muted/60 dark:bg-muted/40 border border-border/60">
                <TabsTrigger value="semua" className="rounded-full px-3.5 text-xs sm:text-sm font-semibold">
                  Semua ({groupStats.total})
                </TabsTrigger>
                <TabsTrigger value="aktif" className="rounded-full px-3.5 text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Aktif ({groupStats.aktif})
                </TabsTrigger>
                <TabsTrigger value="lewat_tempo" className="rounded-full px-3.5 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-400">
                  Lewat tempo ({groupStats.lewatTempo})
                </TabsTrigger>
                <TabsTrigger value="lunas" className="rounded-full px-3.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Lunas ({groupStats.lunas})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {/* Expand / Collapse All */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={isAllExpanded ? collapseAll : expandAll}
                className="h-9 rounded-full text-xs gap-1.5 px-3 border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                {isAllExpanded ? (
                  <>
                    <Minimize2 className="size-3.5" />
                    <span>Tutup Semua</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="size-3.5" />
                    <span>Buka Rincian Semua</span>
                  </>
                )}
              </Button>

              {/* View Switcher: Table vs Grid */}
              <div className="flex items-center p-0.5 rounded-full border border-border/60 bg-muted/50">
                <Button
                  type="button"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "h-8 rounded-full px-2.5 text-xs font-semibold gap-1",
                    viewMode === "table" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                  )}
                  title="Tampilan Tabel Berisi & Dikelompokkan (Rekomendasi)"
                >
                  <TableProperties className="size-3.5" />
                  <span className="hidden sm:inline">Tabel Rapi</span>
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "h-8 rounded-full px-2.5 text-xs font-semibold gap-1",
                    viewMode === "grid" ? "bg-card shadow-xs text-foreground" : "text-muted-foreground"
                  )}
                  title="Tampilan Kartu Grid"
                >
                  <LayoutGrid className="size-3.5" />
                  <span className="hidden sm:inline">Grid Kartu</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Table View (Default & Primary) */}
          {filteredGroups.length > 0 ? (
            viewMode === "table" ? (
              <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/60 shadow-2xs">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 text-xs">
                      <TableHead className="w-10 px-3 text-center">#</TableHead>
                      <TableHead className="min-w-[220px] px-3">Pelanggan</TableHead>
                      <TableHead className="w-[120px] px-3">Status Buku</TableHead>
                      <TableHead className="w-[130px] px-3">Catatan Kasbon</TableHead>
                      <TableHead className="w-[140px] px-3 text-right">Total Kasbon</TableHead>
                      <TableHead className="w-[150px] px-3 text-right">Sisa Tagihan</TableHead>
                      <TableHead className="w-[160px] px-3">Progress Bayar</TableHead>
                      <TableHead className="w-[140px] px-3">Jatuh Tempo</TableHead>
                      <TableHead className="w-[200px] px-3 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => {
                      const isExpanded = expandedGroupKeys.has(group.key);
                      const paidPct =
                        group.totalAmount > 0
                          ? Math.min(100, Math.round((group.totalPaid / group.totalAmount) * 100))
                          : 100;
                      const hasActive = group.totalRemaining > 0;
                      const isOverdue = group.overallStatus === "lewat_tempo";
                      const firstUnpaidDebt = group.debts.find((d) => d.remainingAmount > 0) || group.debts[0];

                      return (
                        <TableRowGroup
                          key={group.key}
                          group={group}
                          isExpanded={isExpanded}
                          paidPct={paidPct}
                          hasActive={hasActive}
                          isOverdue={isOverdue}
                          firstUnpaidDebt={firstUnpaidDebt}
                          onToggleExpand={() => toggleGroupExpand(group.key)}
                          onOpenDetail={openDetail}
                          onQuickCicil={openQuickCicil}
                          onQuickLunas={openQuickLunas}
                          onSendReminder={sendWhatsappReminder}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Grid View (Alternative) */
              <div className="grid gap-4 md:grid-cols-2">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGroupKeys.has(group.key);
                  const paidPct =
                    group.totalAmount > 0
                      ? Math.min(100, Math.round((group.totalPaid / group.totalAmount) * 100))
                      : 100;
                  const firstUnpaidDebt = group.debts.find((d) => d.remainingAmount > 0) || group.debts[0];

                  return (
                    <Card
                      key={group.key}
                      className={cn(
                        "h-full rounded-[24px] border transition flex flex-col justify-between shadow-2xs",
                        group.overallStatus === "lewat_tempo"
                          ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500"
                          : group.overallStatus === "aktif"
                            ? "border-border/70 bg-card/85 hover:border-primary/60"
                            : "border-border/50 bg-card/60 opacity-90"
                      )}
                    >
                      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-3.5">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "size-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0",
                                  group.overallStatus === "lewat_tempo"
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                                    : group.overallStatus === "aktif"
                                      ? "bg-primary/15 text-primary"
                                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                )}
                              >
                                {getInitials(group.displayName)}
                              </div>
                              <div>
                                <p className="font-heading text-lg font-bold hover:text-primary transition-colors">
                                  {group.displayName}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  {group.whatsapp ? (
                                    <>
                                      <Phone className="size-3" />
                                      <span>{group.whatsapp}</span>
                                    </>
                                  ) : (
                                    "Nomor WhatsApp belum diisi"
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge className={statusClassName(group.overallStatus)}>
                                {statusLabel(group.overallStatus)}
                              </Badge>
                              {group.debts.length > 1 && (
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  {group.debts.length} catatan kasbon
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Variant names note if any */}
                          {group.variantNames.length > 1 && (
                            <div className="text-[11px] px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground flex items-center gap-1.5 border border-border/50">
                              <Layers className="size-3 text-primary shrink-0" />
                              <span>
                                Dikelompokkan dari: <span className="font-medium text-foreground">{group.variantNames.join(", ")}</span>
                              </span>
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progress pembayaran</span>
                              <span className="font-semibold tabular-nums">{paidPct}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border/60">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  paidPct >= 100
                                    ? "bg-emerald-500"
                                    : group.overallStatus === "lewat_tempo"
                                      ? "bg-rose-500"
                                      : "bg-primary"
                                )}
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[11px] text-muted-foreground">Total</p>
                              <p className="mt-1 text-sm font-semibold">{formatCurrency(group.totalAmount)}</p>
                            </div>
                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[11px] text-muted-foreground">Sisa</p>
                              <p
                                className={cn(
                                  "mt-1 text-sm font-bold",
                                  group.totalRemaining > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {formatCurrency(group.totalRemaining)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-muted/50 p-2.5">
                              <p className="text-[11px] text-muted-foreground">Tempo</p>
                              <p className="mt-1 text-xs font-semibold truncate">
                                {group.earliestDueDate ? formatDate(group.earliestDueDate) : "Tanpa batas"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 mt-2 pt-2 border-t border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleGroupExpand(group.key)}
                              className="h-8 rounded-full text-xs font-medium px-2.5 gap-1 hover:bg-muted text-muted-foreground"
                            >
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                              <span>{isExpanded ? "Tutup Rincian" : `Rincian (${group.debts.length})`}</span>
                            </Button>

                            <div className="flex items-center gap-1.5">
                              {group.totalRemaining > 0 && firstUnpaidDebt ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openQuickCicil(firstUnpaidDebt)}
                                    className="h-8 rounded-full border-primary/40 text-primary hover:bg-primary/10 px-2.5 text-xs font-semibold"
                                  >
                                    <Coins className="size-3.5 mr-1" />
                                    Cicil
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => openQuickLunas(firstUnpaidDebt)}
                                    className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-xs font-semibold"
                                  >
                                    <CheckCircle2 className="size-3.5 mr-1" />
                                    Lunas
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openDetail(firstUnpaidDebt?.id || group.debts[0].id)}
                                className="h-8 rounded-full px-2.5 text-xs font-medium"
                              >
                                <Info className="size-3.5 mr-1" />
                                Detail
                              </Button>
                            </div>
                          </div>

                          {/* Expanded list in Grid */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-2 bg-muted/30 p-3 rounded-xl">
                              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Receipt className="size-3.5 text-primary" />
                                <span>Daftar {group.debts.length} Kasbon Terpisah:</span>
                              </p>
                              {group.debts.map((d) => (
                                <div
                                  key={d.id}
                                  className="p-2.5 rounded-lg border border-border/60 bg-card text-xs flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <p className="font-semibold">{d.borrowerName}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {formatDateTime(d.createdAt)} • Tempo: {d.dueDate ? formatDate(d.dueDate) : "Tanpa batas"}
                                    </p>
                                    <p className="mt-0.5 text-[11px]">
                                      Total: {formatCurrency(d.amount)} • Sisa:{" "}
                                      <span className={d.remainingAmount > 0 ? "font-bold text-destructive" : "font-bold text-emerald-600"}>
                                        {formatCurrency(d.remainingAmount)}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {d.remainingAmount > 0 ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openQuickCicil(d)}
                                        className="h-7 px-2 text-[11px] rounded-lg"
                                      >
                                        Cicil
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openDetail(d.id)}
                                      className="h-7 px-2 text-[11px] rounded-lg"
                                    >
                                      Detail
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/80 bg-muted/30 p-8 text-center">
              <WalletCards className="size-10 text-muted-foreground/60" />
              <p className="mt-3 font-semibold text-foreground text-base">Tidak ada catatan hutang yang cocok.</p>
              <p className="mt-1 max-w-md text-xs sm:text-sm text-muted-foreground">
                Ubah kata kunci pencarian, filter status, atau klik tombol Tambah Kasbon di atas untuk mencatat kasbon baru.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Pay Modal (Cicil / Lunas) */}
      <Dialog open={Boolean(quickPayDebt)} onOpenChange={(open) => !open && setQuickPayDebt(null)}>
        {quickPayDebt ? (
          <DialogContent className="sm:max-w-md rounded-[28px] p-6 gap-5">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl flex items-center gap-2">
                {quickPayMode === "lunas" ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <span>Konfirmasi Pelunasan Kasbon</span>
                  </>
                ) : (
                  <>
                    <Coins className="size-5 text-primary" />
                    <span>Bayar Cicilan Kasbon</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Pelanggan: <span className="font-semibold text-foreground">{quickPayDebt.borrowerName}</span>
                {quickPayDebt.whatsapp ? ` (${quickPayDebt.whatsapp})` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total Kasbon</p>
                  <p className="text-base font-semibold mt-0.5">{formatCurrency(quickPayDebt.amount)}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-destructive/10 p-3">
                  <p className="text-xs text-destructive font-medium">Sisa Tagihan</p>
                  <p className="text-base font-semibold text-destructive mt-0.5">
                    {formatCurrency(quickPayDebt.remainingAmount)}
                  </p>
                </div>
              </div>

              {quickPayMode === "cicil" ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="quick-amount" className="text-xs font-semibold">
                      Nominal Cicilan (Rp)
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="quick-amount"
                        type="text"
                        value={formatNumberInput(quickPayAmount)}
                        onChange={(e) => setQuickPayAmount(parseNumberInput(e.target.value))}
                        className="pl-11 text-lg font-semibold rounded-xl h-12"
                        placeholder="0"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Pilihan Cepat:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[10000, 20000, 50000, 100000].map((nominal) => (
                        <Button
                          key={nominal}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={nominal > quickPayDebt.remainingAmount}
                          onClick={() => setQuickPayAmount(nominal)}
                          className="h-7 text-xs rounded-lg px-2.5"
                        >
                          {formatCurrency(nominal)}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setQuickPayAmount(quickPayDebt.remainingAmount)}
                        className="h-7 text-xs rounded-lg px-2.5 font-semibold text-emerald-600 dark:text-emerald-400"
                      >
                        Semua ({formatCurrency(quickPayDebt.remainingAmount)})
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="quick-note" className="text-xs font-medium">
                      Catatan (Opsional)
                    </Label>
                    <Input
                      id="quick-note"
                      value={quickPayNote}
                      onChange={(e) => setQuickPayNote(e.target.value)}
                      placeholder="Contoh: Titip uang lewat tetangga"
                      className="mt-1 rounded-xl text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-1.5">
                  <p className="text-xs text-muted-foreground">Pelanggan akan melunasi sisa tagihan sebesar:</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(quickPayDebt.remainingAmount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Status kasbon akan otomatis berubah menjadi <span className="font-semibold text-emerald-600">Lunas</span>.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickPayDebt(null)}
                disabled={quickPaySubmitting}
                className="rounded-full"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => void handleQuickPaySubmit()}
                disabled={quickPaySubmitting || quickPayAmount <= 0}
                className={
                  quickPayMode === "lunas"
                    ? "rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : "rounded-full font-semibold"
                }
              >
                {quickPaySubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : quickPayMode === "lunas" ? (
                  `Ya, Lunasi ${formatCurrency(quickPayDebt.remainingAmount)}`
                ) : (
                  `Simpan Cicilan ${formatCurrency(quickPayAmount)}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <DebtDetailDialog
        debtId={selectedDebtId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDebtUpdated={handleDebtUpdated}
        products={products}
      />
      <DebtSummaryDetailDialog
        debts={visibleDebts}
        metric={activeSummaryMetric}
        onClose={() => setActiveSummaryMetric(null)}
      />
    </div>
  );
}

// Subcomponent: Row Group with Expandable Sub-table
function TableRowGroup({
  group,
  isExpanded,
  paidPct,
  hasActive,
  isOverdue,
  firstUnpaidDebt,
  onToggleExpand,
  onOpenDetail,
  onQuickCicil,
  onQuickLunas,
  onSendReminder,
}: {
  group: CustomerDebtGroup;
  isExpanded: boolean;
  paidPct: number;
  hasActive: boolean;
  isOverdue: boolean;
  firstUnpaidDebt?: Debt;
  onToggleExpand: () => void;
  onOpenDetail: (id: string) => void;
  onQuickCicil: (debt: Debt) => void;
  onQuickLunas: (debt: Debt) => void;
  onSendReminder: (name: string, phone: string, amount: number, dueDate?: string | null) => void;
}) {
  return (
    <>
      <TableRow
        className={cn(
          "transition-colors cursor-pointer border-b border-border/70 hover:bg-muted/40",
          isOverdue
            ? "bg-rose-500/5 hover:bg-rose-500/10"
            : hasActive
              ? "bg-card hover:bg-muted/50"
              : "bg-card/40 text-muted-foreground opacity-85 hover:bg-muted/30"
        )}
        onClick={onToggleExpand}
      >
        {/* Toggle Expand Icon */}
        <TableCell className="text-center px-3 py-3.5">
          <button
            type="button"
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-transform"
            aria-label="Expand rincian"
          >
            {isExpanded ? (
              <ChevronDown className="size-4 text-primary font-bold" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </TableCell>

        {/* Pelanggan */}
        <TableCell className="px-3 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "size-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs",
                isOverdue
                  ? "bg-rose-500/20 text-rose-700 dark:text-rose-400"
                  : hasActive
                    ? "bg-primary/15 text-primary"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              )}
            >
              {getInitials(group.displayName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-heading font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors">
                  {group.displayName}
                </span>
                {group.debts.length > 1 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold px-2 py-0 h-5 rounded-full border-primary/30 bg-primary/10 text-primary"
                  >
                    {group.debts.length} kasbon
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                {group.whatsapp ? (
                  <>
                    <Phone className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{group.whatsapp}</span>
                  </>
                ) : (
                  <span className="italic">No. WA belum diisi</span>
                )}
                {group.variantNames.length > 1 && (
                  <span className="text-[10px] text-muted-foreground/80 hidden xl:inline">
                    • ({group.variantNames.join(", ")})
                  </span>
                )}
              </p>
            </div>
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="px-3 py-3.5">
          <Badge className={statusClassName(group.overallStatus)}>
            {statusLabel(group.overallStatus)}
          </Badge>
        </TableCell>

        {/* Catatan Kasbon */}
        <TableCell className="px-3 py-3.5">
          <div className="text-xs space-y-0.5">
            <span className="font-semibold text-foreground">
              {group.debts.length} Kasbon
            </span>
            <p className="text-[11px] text-muted-foreground">
              {group.activeCount > 0 ? (
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {group.activeCount} Aktif
                </span>
              ) : null}
              {group.activeCount > 0 && group.paidCount > 0 ? " • " : null}
              {group.paidCount > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {group.paidCount} Lunas
                </span>
              ) : null}
            </p>
          </div>
        </TableCell>

        {/* Total Kasbon */}
        <TableCell className="px-3 py-3.5 text-right font-medium text-xs sm:text-sm tabular-nums">
          <div>{formatCurrency(group.totalAmount)}</div>
          <div className="text-[11px] text-muted-foreground">
            Lunas: {formatCurrency(group.totalPaid)}
          </div>
        </TableCell>

        {/* Sisa Tagihan */}
        <TableCell className="px-3 py-3.5 text-right">
          <span
            className={cn(
              "font-bold text-sm sm:text-base tabular-nums",
              hasActive ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {formatCurrency(group.totalRemaining)}
          </span>
        </TableCell>

        {/* Progress Bayar */}
        <TableCell className="px-3 py-3.5">
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Terbayar</span>
              <span className="font-bold tabular-nums">{paidPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  paidPct >= 100
                    ? "bg-emerald-500"
                    : isOverdue
                      ? "bg-rose-500"
                      : "bg-primary"
                )}
                style={{ width: `${paidPct}%` }}
              />
            </div>
          </div>
        </TableCell>

        {/* Jatuh Tempo */}
        <TableCell className="px-3 py-3.5">
          {group.overallStatus === "lunas" ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-3.5" />
              Lunas
            </span>
          ) : group.earliestDueDate ? (
            <div className="text-xs">
              <p
                className={cn(
                  "font-semibold",
                  isOverdue ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                )}
              >
                {formatDate(group.earliestDueDate)}
              </p>
              {isOverdue && (
                <span className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                  <Clock className="size-3" />
                  Lewat tempo
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Tanpa batas</span>
          )}
        </TableCell>

        {/* Action Buttons */}
        <TableCell
          className="px-3 py-3.5 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {hasActive && firstUnpaidDebt ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onQuickCicil(firstUnpaidDebt)}
                  className="h-7 rounded-full border-primary/40 text-primary hover:bg-primary/10 px-2 text-xs font-semibold shadow-2xs"
                  title="Cicil kasbon tertua/aktif"
                >
                  <Coins className="size-3 mr-1" />
                  Cicil
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onQuickLunas(firstUnpaidDebt)}
                  className="h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-xs font-semibold shadow-2xs"
                  title="Lunasi sisa kasbon"
                >
                  <CheckCircle2 className="size-3 mr-1" />
                  Lunas
                </Button>
              </>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onToggleExpand}
              className="h-7 rounded-full border border-border bg-card px-2 text-xs font-medium hover:bg-muted text-foreground"
              title="Lihat seluruh catatan kasbon"
            >
              <Receipt className="size-3 mr-1 text-primary" />
              <span>{isExpanded ? "Tutup" : `Rincian (${group.debts.length})`}</span>
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Sub-Table Row */}
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/80">
          <TableCell colSpan={9} className="p-0">
            <div className="p-4 sm:p-5 space-y-3 bg-muted/40 dark:bg-muted/20 border-y border-border/70 shadow-inner">
              {/* Sub-table Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Receipt className="size-4 text-primary" />
                    <p className="font-heading font-bold text-sm text-foreground">
                      Daftar Catatan Kasbon untuk: <span className="text-primary">{group.displayName}</span>
                    </p>
                    <Badge variant="secondary" className="text-[11px] rounded-full">
                      Total {group.debts.length} Kasbon
                    </Badge>
                  </div>
                  {group.variantNames.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      💡 Menggabungkan nama mirip:{" "}
                      <span className="font-semibold text-foreground">
                        {group.variantNames.map((n) => `"${n}"`).join(", ")}
                      </span>
                    </p>
                  )}
                </div>

                {/* WhatsApp Reminder Button */}
                {group.whatsapp && hasActive && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onSendReminder(
                        group.displayName,
                        group.whatsapp,
                        group.totalRemaining,
                        group.earliestDueDate
                      )
                    }
                    className="h-8 rounded-full border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Kirim Pengingat WA</span>
                  </Button>
                )}
              </div>

              {/* Sub-Table of Individual Debts */}
              <div className="rounded-xl border border-border/60 overflow-hidden bg-card/90 shadow-2xs">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-muted/60 text-[11px] hover:bg-muted/60">
                      <TableHead className="w-10 px-3 text-center">No</TableHead>
                      <TableHead className="w-[180px] px-3">Tanggal Dicatat</TableHead>
                      <TableHead className="min-w-[150px] px-3">Nama di Catatan</TableHead>
                      <TableHead className="w-[130px] px-3">Jatuh Tempo</TableHead>
                      <TableHead className="w-[120px] px-3 text-right">Nominal</TableHead>
                      <TableHead className="w-[120px] px-3 text-right">Sisa</TableHead>
                      <TableHead className="w-[110px] px-3 text-center">Status</TableHead>
                      <TableHead className="w-[190px] px-3 text-right">Aksi Kasbon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.debts.map((debt, idx) => {
                      const debtPaidPct =
                        debt.amount > 0
                          ? Math.min(100, Math.round(((debt.amount - debt.remainingAmount) / debt.amount) * 100))
                          : 100;
                      const isDebtUnpaid = debt.status !== "lunas" && debt.remainingAmount > 0;

                      return (
                        <TableRow
                          key={debt.id}
                          className={cn(
                            "text-xs transition-colors hover:bg-muted/40",
                            debt.status === "lewat_tempo"
                              ? "bg-rose-500/5 hover:bg-rose-500/10"
                              : debt.status === "lunas"
                                ? "bg-card/40 opacity-80"
                                : "bg-card"
                          )}
                        >
                          <TableCell className="text-center px-3 py-2.5 font-semibold text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <span className="font-medium text-foreground">
                              {formatDateTime(debt.createdAt)}
                            </span>
                            {debt.lastReminderAt && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="size-2.5" />
                                <span>Ingatkan: {formatDateTime(debt.lastReminderAt)}</span>
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <span className="font-semibold text-foreground">{debt.borrowerName}</span>
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            {debt.dueDate ? (
                              <span
                                className={cn(
                                  "font-medium",
                                  debt.status === "lewat_tempo"
                                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                                    : "text-foreground"
                                )}
                              >
                                {formatDate(debt.dueDate)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Tanpa batas</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right font-medium tabular-nums">
                            {formatCurrency(debt.amount)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right font-bold tabular-nums">
                            <span
                              className={
                                isDebtUnpaid ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                              }
                            >
                              {formatCurrency(debt.remainingAmount)}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-center">
                            <Badge className={statusClassName(debt.status)}>
                              {statusLabel(debt.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isDebtUnpaid ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onQuickCicil(debt)}
                                    className="h-6 rounded-full border-primary/40 text-primary hover:bg-primary/10 px-2 text-[11px] font-semibold"
                                  >
                                    Cicil
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => onQuickLunas(debt)}
                                    className="h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2 text-[11px] font-semibold"
                                  >
                                    Lunas
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => onOpenDetail(debt.id)}
                                className="h-6 rounded-full border border-border bg-card px-2 text-[11px] font-medium"
                              >
                                Detail
                              </Button>
                              {group.whatsapp && isDebtUnpaid && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    onSendReminder(
                                      debt.borrowerName,
                                      group.whatsapp,
                                      debt.remainingAmount,
                                      debt.dueDate
                                    )
                                  }
                                  className="h-6 rounded-full px-1.5 text-emerald-600 hover:bg-emerald-500/10"
                                  title="Kirim pengingat WhatsApp"
                                >
                                  <MessageCircle className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
