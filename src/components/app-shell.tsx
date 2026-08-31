"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  FileChartColumn,
  HandCoins,
  Gauge,
  Info,
  Landmark,
  ListChecks,
  Package2,
  ScrollText,
  Settings2,
  ShoppingBasket,
  Store,
  UserCog,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountPanel } from "@/components/auth/account-panel";
import { AIAssistantPanel } from "@/components/warung/ai-assistant-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { RoleProvider } from "@/components/role-gate";
import { cn } from "@/lib/utils";
import { isCashierRestrictedPath } from "@/lib/transaction-import-ui";
import { isReportReminderWindow } from "@/lib/report-reminder";
import type { Role } from "@/lib/server/rbac";
import { toast } from "sonner";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/kasir", label: "Kasir", icon: ShoppingBasket, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/inventaris", label: "Inventaris", icon: Package2, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/buku-hutang", label: "Buku Hutang", icon: Wallet, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/investor", label: "Investor", icon: Landmark, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/bagi-hasil", label: "Bagi Hasil", icon: HandCoins, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/laporan", label: "Laporan", icon: FileChartColumn, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/laporan-pcm", label: "Laporan PCM", icon: ScrollText, roles: ["pimpinan"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings2, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/pengaturan/karyawan", label: "Kelola Karyawan", icon: UserCog, roles: ["pimpinan"] },
  { href: "/pengaturan/audit-log", label: "Audit Log", icon: ListChecks, roles: ["pimpinan"] },
] satisfies Array<{ href: string; label: string; icon: typeof Gauge; roles: Role[] }>;

const layoutStorageKey = "warungos.shell.layout.v2";
const defaultSidebarWidth = 280;
const defaultAiWidth = 320;
const minSidebarWidth = 260;
const maxSidebarWidth = 320;
const minAiWidth = 280;
const maxAiWidth = 460;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function AppShell({
  children,
  role,
}: Readonly<{
  children: React.ReactNode;
  role: Role;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibleNavigation = navigation.filter((item) => item.roles.includes(role));
  const exactActiveHref = visibleNavigation.find((item) => pathname === item.href)?.href;
  const [aiOpen, setAiOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [tabletSidebarExpanded, setTabletSidebarExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [aiWidth, setAiWidth] = useState(defaultAiWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [hasPendingMonthlyReport, setHasPendingMonthlyReport] = useState(false);
  const [hasPendingPcmReport, setHasPendingPcmReport] = useState(false);
  const [pendingPcmPeriod, setPendingPcmPeriod] = useState<string | null>(null);
  const unsavedTransactionsRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isCashierRestrictedPath(role, pathname)) {
      router.replace("/dashboard?notice=akses-dibatasi");
      return;
    }

    if (searchParams.get("notice") === "akses-dibatasi") {
      toast.error("Halaman ini hanya tersedia untuk pimpinan atau pengelola keuangan.");
      router.replace("/dashboard");
    }
  }, [pathname, role, router, searchParams]);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    function fetchReportsStatus() {
      if (role === "kasir") {
        setHasPendingMonthlyReport(false);
        setHasPendingPcmReport(false);
        return;
      }

      const ts = Date.now();
      fetch(`/api/reports/monthly?t=${ts}`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)).catch(() => null).then((monthlyData) => {
        if (!mounted) return;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentPeriodStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

        const currentSnapshot = monthlyData?.reports?.find((r: any) =>
          r.periodYear === currentYear && r.periodMonth === currentMonth
        );
        // The sidebar reminder is intentionally quiet until H-2 at month end.
        const inReportReminderWindow = isReportReminderWindow(now);
        const staleSnapshotPeriod = monthlyData?.notifications?.snapshotOutdatedPeriods?.find((p: string) => p === currentPeriodStr) ?? null;
        const stalePcmPeriod = monthlyData?.notifications?.pcmOutdatedPeriods?.find((p: string) => p === currentPeriodStr) ?? null;

        // A finalized report that changed after closing is always actionable,
        // even outside the routine H-2 reminder window.
        const monthlyPending = Boolean(staleSnapshotPeriod) || (inReportReminderWindow && (!currentSnapshot || unsavedTransactionsRef.current));
        setHasPendingMonthlyReport(monthlyPending);

        // PCM becomes actionable only once its source snapshot is current.
        setHasPendingPcmReport(Boolean(stalePcmPeriod));
        setPendingPcmPeriod(stalePcmPeriod);
      });
    }

    fetchReportsStatus();

    function handlePcmUpdate(e: any) {
      if (role === "kasir") {
        setHasPendingMonthlyReport(false);
        setHasPendingPcmReport(false);
        return;
      }
      if (e.detail?.action === "unsaved_changes") {
        const unsaved = !!e.detail?.hasUnsaved;
        unsavedTransactionsRef.current = unsaved;
        setHasPendingMonthlyReport(isReportReminderWindow(new Date()) && unsaved);
      } else if (e.detail?.action === "transaction_added") {
        unsavedTransactionsRef.current = true;
        setHasPendingMonthlyReport(true);
      } else if (e.detail?.action === "snapshot_updated") {
        unsavedTransactionsRef.current = false;
        setHasPendingMonthlyReport(false);
      } else if (e.detail?.action === "updated" || e.detail?.action === "finalized") {
        setHasPendingPcmReport(false);
      } else if (e.detail?.action === "reopened") {
        setHasPendingPcmReport(isReportReminderWindow(new Date()));
      }
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchReportsStatus, 800);
    }

    window.addEventListener("pcm-reports-updated", handlePcmUpdate);
    return () => {
      mounted = false;
      if (refetchTimer) clearTimeout(refetchTimer);
      window.removeEventListener("pcm-reports-updated", handlePcmUpdate);
    };
  }, [role]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(layoutStorageKey) ?? "{}") as {
          sidebarWidth?: number;
          aiWidth?: number;
        };
        if (typeof saved.sidebarWidth === "number") {
          setSidebarWidth(clamp(saved.sidebarWidth, minSidebarWidth, maxSidebarWidth));
        }
        if (typeof saved.aiWidth === "number") {
          setAiWidth(clamp(saved.aiWidth, minAiWidth, maxAiWidth));
        }
      } catch {
        // Layout preferences are optional.
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({ sidebarWidth, aiWidth })
    );
  }, [aiWidth, sidebarWidth]);

  const handleAiOpenChange = (open: boolean) => {
    setAiOpen(open);
  };

  function handleSidebarResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setIsResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(clamp(startWidth + moveEvent.clientX - startX, minSidebarWidth, maxSidebarWidth));
    };
    const handleEnd = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
  }

  function handleAiResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = aiWidth;
    setIsResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      setAiWidth(clamp(startWidth + startX - moveEvent.clientX, minAiWidth, maxAiWidth));
    };
    const handleEnd = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
  }

  return (
    <div className={cn("flex flex-col h-full w-full overflow-hidden bg-background", isResizing && "select-none cursor-col-resize")}>
      <div className="flex flex-1 min-h-0 w-full max-w-none gap-2 p-2 sm:gap-2.5 sm:p-2.5 lg:gap-3 lg:p-3">
        <aside
          className={cn(
            "glass-panel flex max-md:hidden h-full shrink-0 flex-col overflow-hidden rounded-[26px] border border-border/60 shadow-[0_32px_80px_-50px_rgba(68,39,20,0.65)] transition-[width] duration-200 ease-out",
            tabletSidebarExpanded
              ? "w-[260px] items-stretch p-3"
              : "w-[60px] items-center px-1.5 py-2.5",
            leftCollapsed
              ? "2xl:w-[88px] 2xl:items-center 2xl:px-5 2xl:py-4"
              : "2xl:items-stretch 2xl:p-5 2xl:[width:var(--sidebar-width)]",
          )}
          style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
        >
          {leftCollapsed ? (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Store className="size-5" />
            </div>
          ) : (
            <div
              className={cn(
                "flex shrink-0",
                tabletSidebarExpanded
                  ? "items-center justify-end"
                  : "flex-col items-center gap-2",
                "2xl:hidden"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-xl"
                onClick={() => setTabletSidebarExpanded((value) => !value)}
                aria-label={tabletSidebarExpanded ? "Ringkas sidebar" : "Lebarkan sidebar"}
                title={tabletSidebarExpanded ? "Ringkas sidebar" : "Lebarkan sidebar"}
              >
                {tabletSidebarExpanded ? (
                  <ChevronsLeft className="size-4" />
                ) : (
                  <ChevronsRight className="size-4" />
                )}
              </Button>
            </div>
          )}

          {!leftCollapsed ? (
            <div
              className={cn(
                "rounded-[18px] border border-primary/20 bg-primary/10 px-3 py-2.5 text-foreground transition-all dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground",
                tabletSidebarExpanded ? "mt-2.5 block" : "hidden 2xl:block 2xl:rounded-[22px] 2xl:px-4 2xl:py-3"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground 2xl:size-10 2xl:rounded-xl">
                  <Store className="size-3.5 2xl:size-4" />
                </div>
                <p className="truncate text-xs font-medium sm:text-sm">
                  TokoMu
                </p>
              </div>
              <ThemeToggle className="mt-2.5 2xl:mt-3" />
            </div>
          ) : null}

          <Button
            variant="ghost"
            size={leftCollapsed ? "default" : "icon-sm"}
            onClick={() => setLeftCollapsed((v) => !v)}
            aria-label={leftCollapsed ? "Buka sidebar" : "Tutup sidebar"}
            title={leftCollapsed ? "Buka sidebar" : "Tutup sidebar"}
            className={cn(
              "mt-3 hidden rounded-xl 2xl:inline-flex",
              leftCollapsed ? "size-12 p-0" : "self-end",
            )}
          >
            {leftCollapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>

          <nav
            className={cn(
              "mt-2.5 flex-1 overflow-y-auto 2xl:mt-3",
              leftCollapsed
                ? "flex flex-col items-center gap-1.5"
                : tabletSidebarExpanded
                  ? "space-y-1.5"
                  : "flex flex-col items-center gap-1.5 2xl:block 2xl:space-y-2",
            )}
          >
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = exactActiveHref
                ? pathname === item.href
                : pathname.startsWith(`${item.href}/`);

              const href = item.href === "/laporan-pcm" && pendingPcmPeriod
                ? `${item.href}?period=${encodeURIComponent(pendingPcmPeriod)}`
                : item.href;

              return (
                <Link
                  key={item.href}
                  href={href}
                  title={item.label}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-xl text-xs font-medium transition-colors sm:text-sm 2xl:rounded-2xl",
                    leftCollapsed
                      ? "size-12 justify-center"
                      : tabletSidebarExpanded
                        ? "w-full justify-start px-3 py-2 2xl:px-4 2xl:py-3"
                        : "size-10 justify-center 2xl:size-auto 2xl:justify-start 2xl:px-4 2xl:py-3",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-[0_20px_45px_-28px_rgba(186,92,35,0.75)]"
                      : "text-foreground/70 hover:bg-card/50 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("shrink-0", leftCollapsed ? "size-5" : "size-4")} />
                  {!leftCollapsed && (
                    <span className={cn(tabletSidebarExpanded ? "block" : "hidden 2xl:block", "whitespace-nowrap")}>
                      {item.label}
                    </span>
                  )}
                  {/* Badge Notifikasi 1: Laporan Bulanan (/laporan) */}
                  {hasPendingMonthlyReport && role !== "kasir" && item.href === "/laporan" && (
                    <>
                      {/* Expanded Pill Badge */}
                      <span className={cn(
                        "relative ml-auto hidden shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold leading-none tracking-tight text-amber-900 shadow-sm transition-all dark:bg-amber-300/25 dark:text-amber-100 dark:border-amber-200/45 border border-amber-500/45 animate-pulse",
                        !leftCollapsed && (tabletSidebarExpanded ? "flex" : "2xl:flex"),
                        isActive && "!border-[#f0ae67] !bg-[#fff7ea] !text-[#9a4c1d] shadow-md dark:!border-[#ffbd7b]/80 dark:!bg-[#3c2419] dark:!text-[#ffbd7b]"
                      )}>
                        <Info className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                        Perbarui
                      </span>
                      {/* Collapsed Dot Badge */}
                      <span
                        className={cn(
                          "absolute top-1 right-1 flex size-2.5 shrink-0 transition-all z-10 animate-pulse",
                          !leftCollapsed && (tabletSidebarExpanded ? "hidden" : "2xl:hidden")
                        )}
                        title="Ada transaksi baru, perlu perbarui snapshot laporan"
                      >
                        <span
                          className={cn(
                            "relative inline-flex size-2.5 rounded-full ring-2 ring-sidebar",
                            isActive ? "!bg-[#9a4c1d] !ring-[#fff7ea] dark:!bg-[#3c2419] dark:!ring-[#ffbd7b]" : "bg-amber-400"
                          )}
                        />
                      </span>
                    </>
                  )}

                  {/* Badge Notifikasi 2: Laporan PCM (/laporan-pcm) */}
                  {hasPendingPcmReport && role !== "kasir" && item.href === "/laporan-pcm" && (
                    <>
                      {/* Expanded Pill Badge */}
                      <span className={cn(
                        "relative ml-auto hidden shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold leading-none tracking-tight text-amber-900 shadow-sm transition-all dark:bg-amber-300/25 dark:text-amber-100 dark:border-amber-200/45 border border-amber-500/45 animate-pulse",
                        !leftCollapsed && (tabletSidebarExpanded ? "flex" : "2xl:flex"),
                        isActive && "!border-[#f0ae67] !bg-[#fff7ea] !text-[#9a4c1d] shadow-md dark:!border-[#ffbd7b]/80 dark:!bg-[#3c2419] dark:!text-[#ffbd7b]"
                      )}>
                        <Info className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                        Update
                      </span>
                      {/* Collapsed Dot Badge */}
                      <span
                        className={cn(
                          "absolute top-1 right-1 flex size-2.5 shrink-0 transition-all z-10 animate-pulse",
                          !leftCollapsed && (tabletSidebarExpanded ? "hidden" : "2xl:hidden")
                        )}
                        title="Laporan PCM perlu diperbarui"
                      >
                        <span
                          className={cn(
                            "relative inline-flex size-2.5 rounded-full ring-2 ring-sidebar",
                            isActive ? "!bg-[#9a4c1d] !ring-[#fff7ea] dark:!bg-[#3c2419] dark:!ring-[#ffbd7b]" : "bg-amber-400"
                          )}
                        />
                      </span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {!leftCollapsed && (
            <div className={cn(tabletSidebarExpanded ? "mt-2 block" : "hidden 2xl:block")}>
              <AccountPanel />
            </div>
          )}
        </aside>

        {!leftCollapsed ? (
          <button
            type="button"
            aria-label="Atur lebar sidebar"
            title="Tarik untuk mengatur lebar sidebar"
            onPointerDown={handleSidebarResizeStart}
            className="group -mx-2 hidden w-5 shrink-0 touch-none cursor-col-resize items-center justify-center rounded-full 2xl:flex"
          >
            <span className="h-14 w-0.5 rounded-full bg-border transition-colors group-hover:w-1 group-hover:bg-primary/70 group-active:w-1 group-active:bg-primary" />
          </button>
        ) : null}

        <RoleProvider role={role}>
          <main ref={mainRef} className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto px-1 py-0.5 sm:px-2 sm:py-1 2xl:min-w-[680px] pb-20 md:pb-0">
            {children}
          </main>
        </RoleProvider>

        {aiOpen ? (
          <button
            type="button"
            aria-label="Atur lebar asisten AI"
            title="Tarik untuk mengatur lebar asisten AI"
            onPointerDown={handleAiResizeStart}
            className="group -mx-2 hidden w-5 shrink-0 touch-none cursor-col-resize items-center justify-center rounded-full md:flex"
          >
            <span className="h-16 w-0.5 rounded-full bg-border transition-colors group-hover:w-1 group-hover:bg-primary/70 group-active:w-1 group-active:bg-primary" />
          </button>
        ) : null}

        <AIAssistantPanel open={aiOpen} onOpenChange={handleAiOpenChange} width={aiWidth} role={role} />
      </div>

      {/* Mobile Bottom Navigation - only shown on screens smaller than md */}
      <nav className="md:hidden flex-shrink-0 border-t border-border/60 bg-card/90 backdrop-blur-md">
        <div className="flex items-center justify-around px-1 py-1.5">
          {visibleNavigation.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = exactActiveHref
              ? pathname === item.href
              : pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn(
                  "flex size-8 items-center justify-center rounded-xl transition-colors",
                  isActive ? "bg-primary/15" : ""
                )}>
                  <Icon className="size-4" />
                </span>
                <span className="truncate">{item.label}</span>
                {/* Red dot for laporan */}
                {hasPendingMonthlyReport && role !== "kasir" && item.href === "/laporan" && (
                  <span className="absolute top-1 right-3 size-2 rounded-full bg-rose-500" />
                )}
                {hasPendingPcmReport && role !== "kasir" && item.href === "/laporan-pcm" && (
                  <span className="absolute top-1 right-3 size-2 rounded-full bg-rose-500" />
                )}
              </Link>
            );
          })}
          {visibleNavigation.length > 5 && (
            <button
              type="button"
              onClick={() => setTabletSidebarExpanded((v) => !v)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex size-8 items-center justify-center rounded-xl">
                <Settings2 className="size-4" />
              </span>
              <span>Lainnya</span>
            </button>
          )}
        </div>
        {/* Expanded mobile menu for extra nav items */}
        {tabletSidebarExpanded && visibleNavigation.length > 5 && (
          <div className="border-t border-border/40 px-2 pb-2 pt-1.5 grid grid-cols-3 gap-1.5">
            {visibleNavigation.slice(5).map((item) => {
              const Icon = item.icon;
              const isActive = exactActiveHref
                ? pathname === item.href
                : pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setTabletSidebarExpanded(false)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-xl p-2 text-[10px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="truncate text-center">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );
}
