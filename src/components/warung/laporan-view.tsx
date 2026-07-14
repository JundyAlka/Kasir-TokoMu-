"use client";

import { type PointerEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  ListChecks,
  Loader2,
  Printer,
  RotateCcw,
  Settings2,
  TableProperties,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { StatCard } from "@/components/stat-card";
import {
  ProfitLossSummary,
  ReportSummaryDetailDialog,
  ReportSummaryMetric,
} from "@/components/tokomu/report-summary-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import { estimateProductVelocity } from "@/lib/reporting";
import { cn } from "@/lib/utils";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const emptySummary: ProfitLossSummary = {
  periodStart: "",
  periodEnd: "",
  revenue: 0,
  cogs: 0,
  grossProfit: 0,
  expenseTotal: 0,
  netProfit: 0,
  transactionCount: 0,
  averageTicket: 0,
};

type ReportPreviewLayout = "cards" | "table";
type TrendRange = "mingguan" | "bulanan";
type TrendPoint = {
  key: string;
  label: string;
  revenue: number;
  tickLabel: string;
  transactions: number;
};
type TrendWeekOption = {
  endDay: number;
  label: string;
  rangeLabel: string;
  startDay: number;
  value: number;
};

const monthOptions = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const trendRangeOptions: Array<{ value: TrendRange; label: string }> = [
  { value: "mingguan", label: "1 Minggu" },
  { value: "bulanan", label: "1 Bulan" },
];

const jakartaDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Jakarta",
  year: "numeric",
});

const trendDayFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
});

const trendWeekdayFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
});

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function getJakartaDateKey(value: string | Date) {
  const parts = jakartaDateFormatter.formatToParts(new Date(value));
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 0);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 0);
  return formatDateKey(year, month, day);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function getTrendWeekOptions(period: string): TrendWeekOption[] {
  const [selectedYear, selectedMonth] = period.split("-").map(Number);
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const weekCount = Math.ceil(daysInMonth / 7);

  return Array.from({ length: weekCount }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    const startDate = dateFromKey(formatDateKey(selectedYear, selectedMonth, startDay));
    const endDate = dateFromKey(formatDateKey(selectedYear, selectedMonth, endDay));
    const rangeLabel =
      startDay === endDay
        ? trendDayFormatter.format(startDate)
        : `${trendDayFormatter.format(startDate)} - ${trendDayFormatter.format(endDate)}`;

    return {
      endDay,
      label: `Minggu ${index + 1}`,
      rangeLabel,
      startDay,
      value: index + 1,
    };
  });
}

function getDefaultTrendWeek(period: string) {
  const [selectedYear, selectedMonth] = period.split("-").map(Number);
  const todayKey = getJakartaDateKey(new Date());
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);

  if (todayYear === selectedYear && todayMonth === selectedMonth) {
    return Math.ceil(todayDay / 7);
  }

  return 1;
}

function getTrendKeys(period: string, range: TrendRange, weekNumber: number) {
  const [selectedYear, selectedMonth] = period.split("-").map(Number);
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  if (range === "bulanan") {
    return Array.from({ length: daysInMonth }, (_, index) =>
      formatDateKey(selectedYear, selectedMonth, index + 1)
    );
  }

  const week = getTrendWeekOptions(period).find((option) => option.value === weekNumber) ??
    getTrendWeekOptions(period)[0];
  const dayCount = week ? week.endDay - week.startDay + 1 : 7;

  return Array.from({ length: dayCount }, (_, index) =>
    formatDateKey(selectedYear, selectedMonth, (week?.startDay ?? 1) + index)
  );
}

function buildTrendSeries(
  period: string,
  range: TrendRange,
  weekNumber: number,
  transactions: Array<{ createdAt: string; total: number }>
) {
  const keys = getTrendKeys(period, range, weekNumber);
  const values = new Map(keys.map((key) => [key, { revenue: 0, transactions: 0 }]));

  for (const transaction of transactions) {
    const key = getJakartaDateKey(transaction.createdAt);
    const current = values.get(key);
    if (!current) {
      continue;
    }

    current.revenue += transaction.total;
    current.transactions += 1;
  }

  return keys.map((key) => {
    const date = dateFromKey(key);
    const value = values.get(key) ?? { revenue: 0, transactions: 0 };
    return {
      key,
      label: trendWeekdayFormatter.format(date),
      revenue: value.revenue,
      tickLabel: trendDayFormatter.format(date),
      transactions: value.transactions,
    };
  });
}

function filterTransactionsByMonth<T extends { createdAt: string }>(period: string, transactions: T[]) {
  return transactions.filter((transaction) => getJakartaDateKey(transaction.createdAt).startsWith(period));
}

function formatTrendPeriodLabel(series: TrendPoint[]) {
  const first = series.at(0);
  const last = series.at(-1);
  if (!first || !last) {
    return "-";
  }
  return first.key === last.key ? first.tickLabel : `${first.tickLabel} - ${last.tickLabel}`;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const [firstPoint, ...remainingPoints] = points;
  const commands = [`M ${firstPoint.x} ${firstPoint.y}`];

  remainingPoints.forEach((point, index) => {
    const previousPoint = points[index];
    const beforePreviousPoint = points[index - 1] ?? previousPoint;
    const nextPoint = points[index + 2] ?? point;
    const tension = 0.18;
    const controlPointA = {
      x: previousPoint.x + (point.x - beforePreviousPoint.x) * tension,
      y: previousPoint.y + (point.y - beforePreviousPoint.y) * tension,
    };
    const controlPointB = {
      x: point.x - (nextPoint.x - previousPoint.x) * tension,
      y: point.y - (nextPoint.y - previousPoint.y) * tension,
    };

    commands.push(
      `C ${controlPointA.x} ${controlPointA.y}, ${controlPointB.x} ${controlPointB.y}, ${point.x} ${point.y}`
    );
  });

  return commands.join(" ");
}

function TrendRevenueChart({
  periodLabel,
  scopeLabel,
  series,
}: Readonly<{
  periodLabel: string;
  scopeLabel: string;
  series: TrendPoint[];
}>) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxRevenue = Math.max(...series.map((item) => item.revenue), 1);

  // Map X across [5%, 95%] for clean side padding, and Y across [20%, 88%]
  const chartPoints = series.map((item, index) => {
    const x = series.length === 1 ? 50 : 5 + (index / (series.length - 1)) * 90;
    const y = 88 - (item.revenue / maxRevenue) * 68;
    return { ...item, x, y };
  });

  const linePath = buildLinePath(chartPoints);
  const firstX = chartPoints[0]?.x ?? 5;
  const lastX = chartPoints.at(-1)?.x ?? 95;
  const areaPath =
    chartPoints.length > 0
      ? `${linePath} L ${lastX} 95 L ${firstX} 95 Z`
      : "";

  const peakRevenue = Math.max(...chartPoints.map((point) => point.revenue), 0);
  const peakIndex = Math.max(0, chartPoints.findIndex((point) => point.revenue === peakRevenue));
  const displayIndex = activeIndex ?? peakIndex;
  const displayPoint = chartPoints[displayIndex] ?? chartPoints[0];

  // Tooltip X: clamp to keep the box from overflowing the left/right edges.
  const tooltipLeft = displayPoint ? Math.min(82, Math.max(18, displayPoint.x)) : 50;

  // Choose perfectly spaced index ticks for the bottom axis
  const tickIndexes = new Set(
    series
      .map((_, index) => index)
      .filter((index) => {
        if (series.length <= 8) return true;
        if (index === 0 || index === series.length - 1) return true;
        const step = Math.ceil((series.length - 1) / 6);
        return index % step === 0 && index + step < series.length;
      })
  );
  const visibleTicks = chartPoints.filter((_, index) => tickIndexes.has(index));

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (chartPoints.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const nearestIndex = chartPoints.reduce((nearest, point, index) => {
      const currentDistance = Math.abs(point.x - pointerX);
      const nearestDistance = Math.abs(chartPoints[nearest].x - pointerX);
      return currentDistance < nearestDistance ? index : nearest;
    }, 0);
    setActiveIndex(nearestIndex);
  }

  if (series.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-[28px] border border-border/70 bg-gradient-to-b from-card/85 to-card/50 p-5 shadow-sm">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{scopeLabel}</p>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Puncak: {formatCompactCurrency(peakRevenue)}
          </span>
        </div>
      </div>

      {/* Chart wrapper — relative positioning context for both chart + tooltip */}
      <div
        className="relative mt-4 h-64 touch-none"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActiveIndex(null);
        }}
      >
        {/* Chart area — overflow hidden only clips SVG/dots, NOT tooltip */}
        <div className="absolute inset-0 overflow-hidden rounded-[22px] border border-border/40 bg-background/45 shadow-inner transition-colors hover:bg-background/60">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full cursor-crosshair select-none"
            role="img"
            aria-label="Kurva tren omzet"
          >
            <defs>
              <linearGradient id="trend-area-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.32" />
                <stop offset="65%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trend-line-gradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="50%" stopColor="#ffb966" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
              <filter id="trend-line-glow" x="-20%" y="-45%" width="140%" height="190%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 1  0 0.72 0 0 0.46  0 0 0.36 0 0.18  0 0 0 0.8 0"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal Grid Lines */}
            {[22, 44, 66, 88].map((y) => (
              <line
                key={y}
                x1="3"
                x2="97"
                y1={y}
                y2={y}
                stroke="hsl(var(--border))"
                strokeDasharray="3 4"
                strokeOpacity="0.35"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Area under curve */}
            <path d={areaPath} fill="url(#trend-area-gradient)" className="transition-all duration-300 ease-out" />

            {/* Glowing Line */}
            <path
              d={linePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.3"
              strokeWidth="7.5"
              vectorEffect="non-scaling-stroke"
              filter="url(#trend-line-glow)"
            />

            {/* Main Sharp Line */}
            <path
              d={linePath}
              fill="none"
              stroke="url(#trend-line-gradient)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3.2"
              vectorEffect="non-scaling-stroke"
            />

            {/* Active Vertical Crosshair */}
            {displayPoint ? (
              <line
                x1={displayPoint.x}
                x2={displayPoint.x}
                y1="12"
                y2="95"
                stroke="hsl(var(--primary))"
                strokeDasharray="3 3"
                strokeOpacity="0.65"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {/* Marker Dots Layer */}
          <div className="pointer-events-none absolute inset-0">
            {chartPoints.map((point, index) => {
              const isPeak = point.revenue > 0 && point.revenue === peakRevenue;
              const isActive = displayIndex === index;

              return (
                <div
                  key={point.key}
                  className={cn(
                    "absolute rounded-full border transition-all duration-150",
                    point.revenue > 0
                      ? "size-2.5 border-card bg-primary shadow-sm"
                      : "size-2 border-muted-foreground/40 bg-muted/80",
                    isPeak && "size-3.5 border-primary-foreground bg-[#ffe4be] shadow-[0_0_16px_rgba(255,189,123,0.85)]",
                    isActive && "size-4 border-2 border-primary-foreground bg-primary shadow-[0_0_20px_rgba(255,189,123,0.95)] z-10"
                  )}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Floating Tooltip — OUTSIDE overflow-hidden, never clipped, always above curve */}
        {displayPoint ? (
          <div
            className="pointer-events-none absolute z-30 min-w-40 rounded-2xl border border-white/10 bg-popover/92 px-3 py-2 text-xs text-popover-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all duration-100"
            style={{
              left: `${tooltipLeft}%`,
              top: `${displayPoint.y}%`,
              transform: "translate(-50%, calc(-100% - 16px))",
            }}
          >
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="font-semibold text-foreground">{displayPoint.label}</span>
              <span>{displayPoint.tickLabel}</span>
            </div>
            <p className="mt-1 font-heading text-base font-bold text-primary">{formatCurrency(displayPoint.revenue)}</p>
            <p className="text-[11px] text-muted-foreground">{displayPoint.transactions} transaksi</p>
          </div>
        ) : null}
      </div>

      {/* Perfectly Aligned X-Axis Date Labels Below Chart */}
      <div className="relative mt-2.5 h-7 w-full select-none text-[11px] text-muted-foreground">
        {visibleTicks.map((item) => (
          <div
            key={item.key}
            className="absolute top-0 flex flex-col items-center transition-colors hover:text-foreground"
            style={{
              left: `${item.x}%`,
              transform: "translateX(-50%)",
            }}
          >
            <span className="font-semibold text-foreground/80">{item.label}</span>
            <span className="text-[10px] text-muted-foreground/75">{item.tickLabel}</span>
          </div>
        ))}
      </div>

      {/* Selected Point Status Bar */}
      {displayPoint ? (
        <div className="mt-3 grid gap-2.5 rounded-[20px] border border-border/60 bg-card/75 p-3 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] text-muted-foreground">
                {activeIndex === null ? "Titik puncak periode" : "Titik terpilih"}
              </p>
              <p className="font-semibold text-foreground">{displayPoint.label}, {displayPoint.tickLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
            <TrendingUp className="size-4 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] text-muted-foreground">Omzet tercatat</p>
              <p className="font-semibold text-foreground">{formatCurrency(displayPoint.revenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
            <ListChecks className="size-4 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] text-muted-foreground">Jumlah transaksi</p>
              <p className="font-semibold text-foreground">{displayPoint.transactions} transaksi</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LaporanView() {
  const { expenses, transactions, products, settings } = useAppState();
  const [period, setPeriod] = useState(currentMonthValue());
  const [summary, setSummary] = useState<ProfitLossSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSummaryMetric, setActiveSummaryMetric] = useState<ReportSummaryMetric | null>(null);
  const [reportPreviewLayout, setReportPreviewLayout] = useState<ReportPreviewLayout>("cards");
  const [customOwnerNotes, setCustomOwnerNotes] = useState("");
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [trendRange, setTrendRange] = useState<TrendRange>("bulanan");
  const [trendWeek, setTrendWeek] = useState(() => getDefaultTrendWeek(currentMonthValue()));

  useEffect(() => {
    let active = true;

    void fetch(`/api/reports/profit-loss?period=${period}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | (ProfitLossSummary & { error?: string })
          | null;
        if (!response.ok || !data) {
          throw new Error(data?.error ?? "Gagal memuat laporan periode.");
        }
        if (active) setSummary(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Gagal memuat laporan periode.");
        setSummary(emptySummary);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period]);

  const [selectedYear, selectedMonth] = period.split("-");
  const trendWeekOptions = useMemo(() => getTrendWeekOptions(period), [period]);
  const defaultTrendWeek = getDefaultTrendWeek(period);
  const maxTrendWeek = trendWeekOptions.at(-1)?.value ?? defaultTrendWeek;
  const selectedTrendWeek = Math.min(Math.max(trendWeek || defaultTrendWeek, 1), maxTrendWeek);
  const periodLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${period}-01T00:00:00`));
  const trendSeries = useMemo(
    () => buildTrendSeries(period, trendRange, selectedTrendWeek, transactions),
    [period, transactions, trendRange, selectedTrendWeek]
  );
  const trendTotal = trendSeries.reduce((sum, item) => sum + item.revenue, 0);
  const trendTransactionCount = trendSeries.reduce((sum, item) => sum + item.transactions, 0);
  const trendAverageTicket = trendTransactionCount > 0 ? trendTotal / trendTransactionCount : 0;
  const trendPeak = trendSeries.reduce(
    (peak, item) => (item.revenue > peak.revenue ? item : peak),
    trendSeries[0] ?? { key: "", label: "-", revenue: 0, tickLabel: "-", transactions: 0 }
  );
  const trendPeriodLabel = formatTrendPeriodLabel(trendSeries);
  const activeTrendWeek = trendWeekOptions.find((option) => option.value === selectedTrendWeek) ?? trendWeekOptions[0];
  const trendScopeLabel =
    trendRange === "mingguan" && activeTrendWeek ? activeTrendWeek.label : "Bulanan";
  const trendChartPeriodLabel =
    trendRange === "mingguan" && activeTrendWeek ? activeTrendWeek.rangeLabel : periodLabel;
  const periodTransactions = useMemo(
    () => filterTransactionsByMonth(period, transactions),
    [period, transactions]
  );
  const topVelocity = useMemo(
    () =>
      estimateProductVelocity(products, periodTransactions)
        .filter((item) => item.sold > 0)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 4),
    [periodTransactions, products]
  );
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (let year = currentYear + 1; year >= currentYear - 5; year -= 1) {
      years.add(year);
    }
    years.add(Number(selectedYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, selectedYear]);
  const defaultOwnerNotes = useMemo(
    () => [
      `Laba bersih ${periodLabel} tercatat ${formatCurrency(summary.netProfit)}.`,
      `Laba kotor ${formatCurrency(summary.grossProfit)} setelah HPP ${formatCurrency(summary.cogs)}.`,
      "Data laporan ini memakai API /api/reports/profit-loss yang sama dengan basis perhitungan bagi hasil.",
    ],
    [periodLabel, summary.cogs, summary.grossProfit, summary.netProfit]
  );
  const ownerNotes = customOwnerNotes.trim()
    ? customOwnerNotes
        .split("\n")
        .map((note) => note.trim())
        .filter(Boolean)
    : defaultOwnerNotes;
  const ownerNotesText = customOwnerNotes || defaultOwnerNotes.join("\n");

  function updatePeriod(nextYear: string, nextMonth: string) {
    setIsLoading(true);
    setPeriod(`${nextYear}-${nextMonth}`);
  }

  function buildReportPdfUrl(download = false) {
    const params = new URLSearchParams({ period });
    if (download) {
      params.set("download", "1");
    }
    ownerNotes.forEach((note) => params.append("note", note));
    return `/api/reports/profit-loss/pdf?${params.toString()}`;
  }

  function handlePreviewPrint() {
    setIsPdfPreviewOpen(true);
  }

  function handleDownloadPdf() {
    const link = document.createElement("a");
    link.href = buildReportPdfUrl(true);
    link.download = `laporan-untung-rugi-${period}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Omzet"
          value={formatCompactCurrency(summary.revenue)}
          description={`Total pemasukan untuk ${periodLabel}.`}
          onClick={() => setActiveSummaryMetric("omzet")}
        />
        <StatCard
          title="Laba kotor"
          value={formatCompactCurrency(summary.grossProfit)}
          description={`HPP periode ini ${formatCompactCurrency(summary.cogs)}.`}
          tone="accent"
          onClick={() => setActiveSummaryMetric("laba_kotor")}
        />
        <StatCard
          title="Pengeluaran"
          value={formatCompactCurrency(summary.expenseTotal)}
          description="Biaya operasional yang tercatat di periode ini."
          onClick={() => setActiveSummaryMetric("pengeluaran")}
        />
        <StatCard
          title="Laba bersih"
          value={formatCompactCurrency(summary.netProfit)}
          description="Omzet dikurangi HPP dan beban periode."
          tone="warn"
          onClick={() => setActiveSummaryMetric("laba_bersih")}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">Ringkasan untung rugi</CardTitle>
              <CardDescription>
                Angka utama diambil dari API laporan periode yang sama dengan perhitungan bagi hasil.
              </CardDescription>
            </div>

            <div className="grid min-w-[260px] gap-2">
              <Label htmlFor="report-month">Periode</Label>
              <div className="relative grid grid-cols-[1fr_96px] gap-2 rounded-[22px] border border-border/70 bg-card/80 p-1.5 shadow-inner">
                <Select
                  value={selectedMonth}
                  onValueChange={(month) => {
                    if (month) updatePeriod(selectedYear, month);
                  }}
                >
                  <SelectTrigger
                    id="report-month"
                    className="h-10 w-full rounded-[16px] border-0 bg-transparent px-3 font-medium shadow-none focus-visible:ring-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDays className="size-4 shrink-0 text-primary" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" className="w-[188px] rounded-2xl p-1">
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value} className="rounded-xl py-2">
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedYear}
                  onValueChange={(year) => {
                    if (year) updatePeriod(year, selectedMonth);
                  }}
                >
                  <SelectTrigger
                    aria-label="Tahun laporan"
                    className="h-10 w-full rounded-[16px] border-0 bg-muted/45 px-3 font-medium shadow-none focus-visible:ring-2"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className="w-[112px] rounded-2xl p-1">
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)} className="rounded-xl py-2">
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoading ? (
                  <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[26px] border border-border/70 bg-card/80 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Tren omzet {trendRange === "bulanan" ? "1 bulan" : "1 minggu"}
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold">{formatCurrency(trendTotal)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{trendPeriodLabel}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex rounded-2xl border border-border/70 bg-muted/35 p-1">
                    {trendRangeOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={trendRange === option.value ? "default" : "ghost"}
                        size="sm"
                        className="rounded-xl px-3"
                        onClick={() => setTrendRange(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {trendRange === "mingguan" ? (
                    <Select
                      value={String(selectedTrendWeek)}
                      onValueChange={(value) => setTrendWeek(Number(value))}
                    >
                      <SelectTrigger
                        aria-label="Pilih minggu tren"
                        className="h-10 min-w-36 rounded-2xl border-border/70 bg-card/70 px-3 font-medium"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end" className="rounded-2xl p-1">
                        {trendWeekOptions.map((week) => (
                          <SelectItem key={week.value} value={String(week.value)} className="rounded-xl py-2">
                            {week.label} ({week.rangeLabel})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <div className="shrink-0 whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
                    {trendTransactionCount} transaksi
                  </div>
                </div>
              </div>

              <TrendRevenueChart periodLabel={trendChartPeriodLabel} scopeLabel={trendScopeLabel} series={trendSeries} />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-muted/35 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Puncak omzet</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatCompactCurrency(trendPeak.revenue)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{trendPeak.tickLabel}</p>
                </div>
                <div className="rounded-2xl bg-muted/35 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Rata-rata transaksi</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatCompactCurrency(trendAverageTicket)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">di rentang tren</p>
                </div>
                <div className="rounded-2xl bg-muted/35 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Total periode laporan</p>
                  <p className="mt-1 font-semibold tabular-nums">{formatCompactCurrency(summary.revenue)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[26px] border border-border/70 bg-card/80 p-5">
                <p className="text-sm text-muted-foreground">Rata-rata transaksi</p>
                <p className="mt-2 font-heading text-3xl font-semibold">
                  {formatCurrency(summary.averageTicket)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nilai rata-rata per transaksi untuk {periodLabel}.
                </p>
              </div>

              <div className="rounded-[26px] border border-border/70 bg-card/80 p-5">
                <p className="text-sm text-muted-foreground">Produk paling bergerak</p>
                <div className="mt-4 space-y-3">
                  {topVelocity.length > 0 ? (
                    topVelocity.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-sm text-muted-foreground">{item.sold} terjual</span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
                      Belum ada produk terjual pada {periodLabel}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">Preview laporan PDF</CardTitle>
              <CardDescription>
                Preview memakai angka untung-rugi nyata dari database.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={handlePreviewPrint}
              >
                <Printer className="size-4" />
                Preview PDF
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={handleDownloadPdf}
              >
                <Download className="size-4" />
                Cetak PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-[26px] border border-border/70 bg-card/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="size-4 text-primary" />
                    Atur tampilan dan pesan laporan
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pesan di bawah akan muncul di preview dan ikut dibawa ke PDF.
                  </p>
                </div>
                <div className="flex rounded-2xl border border-border/70 bg-muted/35 p-1">
                  <Button
                    type="button"
                    variant={reportPreviewLayout === "cards" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setReportPreviewLayout("cards")}
                  >
                    <ListChecks className="size-4" />
                    Kartu
                  </Button>
                  <Button
                    type="button"
                    variant={reportPreviewLayout === "table" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setReportPreviewLayout("table")}
                  >
                    <TableProperties className="size-4" />
                    Tabel
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="owner-report-notes">Pesan catatan pemilik</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setCustomOwnerNotes("")}
                  >
                    <RotateCcw className="size-3.5" />
                    Reset otomatis
                  </Button>
                </div>
                <Textarea
                  id="owner-report-notes"
                  value={ownerNotesText}
                  onChange={(event) => setCustomOwnerNotes(event.target.value)}
                  className="min-h-28 rounded-2xl bg-card/80 text-sm leading-6"
                  placeholder="Tulis satu pesan per baris."
                />
                <p className="text-xs text-muted-foreground">
                  Gunakan satu baris untuk satu pesan. Kosongkan atau klik reset untuk kembali ke pesan otomatis.
                </p>
              </div>
            </div>

            <div className="rounded-[30px] bg-card/78 p-6 shadow-inner ring-1 ring-border/80 dark:bg-muted/35 dark:ring-border/70">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-border/80 pb-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">TokoMu report</p>
                  <h3 className="mt-2 font-heading text-3xl font-semibold">{settings.storeName}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[settings.storeTagline, settings.city].filter(Boolean).join(" - ")}
                  </p>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    {settings.storeAddress}
                  </p>
                </div>
                <div className="rounded-[22px] bg-muted/70 px-4 py-3 text-right text-foreground ring-1 ring-border/70">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{periodLabel}</p>
                  <p className="mt-2 font-heading text-2xl font-semibold">{formatCurrency(summary.netProfit)}</p>
                </div>
              </div>

              {reportPreviewLayout === "cards" ? (
                <div className="grid gap-4 border-b border-dashed border-border/80 py-5 sm:grid-cols-2">
                  <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                    <p className="text-sm text-muted-foreground">Omzet</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.revenue)}</p>
                  </div>
                  <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                    <p className="text-sm text-muted-foreground">HPP</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.cogs)}</p>
                  </div>
                  <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                    <p className="text-sm text-muted-foreground">Beban</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.expenseTotal)}</p>
                  </div>
                  <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                    <p className="text-sm text-muted-foreground">Laba bersih</p>
                    <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.netProfit)}</p>
                  </div>
                </div>
              ) : (
                <div className="border-b border-dashed border-border/80 py-5">
                  <div className="overflow-hidden rounded-[22px] border border-border/70 bg-card">
                    {[
                      ["Omzet", formatCurrency(summary.revenue)],
                      ["HPP", formatCurrency(summary.cogs)],
                      ["Laba kotor", formatCurrency(summary.grossProfit)],
                      ["Beban", formatCurrency(summary.expenseTotal)],
                      ["Laba bersih", formatCurrency(summary.netProfit)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0"
                      >
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-right font-medium tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 py-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="size-4 text-primary" />
                  Catatan untuk pemilik warung
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {ownerNotes.map((note, index) => (
                    <li
                      key={`${note}-${index}`}
                      className="rounded-[18px] bg-card px-4 py-3 ring-1 ring-border/70"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between border-t border-dashed border-border/80 pt-5 text-sm text-muted-foreground">
                <span>Disusun otomatis oleh TokoMu</span>
                <span>{formatDate(new Date().toISOString())}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReportSummaryDetailDialog
        expenses={expenses}
        metric={activeSummaryMetric}
        onClose={() => setActiveSummaryMetric(null)}
        periodLabel={periodLabel}
        summary={summary}
      />

      <Dialog open={isPdfPreviewOpen} onOpenChange={setIsPdfPreviewOpen}>
        <DialogContent className="max-h-[94vh] w-[min(1280px,calc(100vw-2rem))] !max-w-none overflow-hidden rounded-[28px] p-0 sm:!max-w-none">
          <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
            <DialogTitle>Preview PDF laporan</DialogTitle>
            <DialogDescription>
              Pratinjau memakai data periode {periodLabel}. Gunakan tombol Cetak PDF jika ingin mengunduh dokumen.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/35 p-3 sm:p-5">
            <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background shadow-inner">
              {isPdfPreviewOpen ? (
                <iframe
                  title={`Preview PDF laporan ${periodLabel}`}
                  src={`${buildReportPdfUrl()}#view=FitH&toolbar=1&navpanes=0`}
                  className="h-[76vh] min-h-[560px] w-full bg-background"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border/70 bg-card/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Preview ditampilkan inline agar tidak otomatis mengunduh file.
            </p>
            <Button type="button" className="rounded-full" onClick={handleDownloadPdf}>
              <Download className="size-4" />
              Cetak PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
