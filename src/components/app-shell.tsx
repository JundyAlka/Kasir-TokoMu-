"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  FileChartColumn,
  HandCoins,
  Gauge,
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
import type { Role } from "@/lib/server/rbac";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/kasir", label: "Kasir", icon: ShoppingBasket, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/inventaris", label: "Inventaris", icon: Package2, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/buku-hutang", label: "Buku Hutang", icon: Wallet, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/investor", label: "Investor", icon: Landmark, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/bagi-hasil", label: "Bagi Hasil", icon: HandCoins, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/laporan", label: "Laporan", icon: FileChartColumn, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/laporan-pcm", label: "Laporan PCM", icon: ScrollText, roles: ["pimpinan"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings2, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/pengaturan/karyawan", label: "Kelola Karyawan", icon: UserCog, roles: ["pimpinan"] },
  { href: "/pengaturan/audit-log", label: "Audit Log", icon: ListChecks, roles: ["pimpinan"] },
] satisfies Array<{ href: string; label: string; icon: typeof Gauge; roles: Role[] }>;

const layoutStorageKey = "warungos.shell.layout.v2";
const defaultSidebarWidth = 240;
const defaultAiWidth = 320;
const minSidebarWidth = 200;
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
  const visibleNavigation = navigation.filter((item) => item.roles.includes(role));
  const exactActiveHref = visibleNavigation.find((item) => pathname === item.href)?.href;
  const [aiOpen, setAiOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [tabletSidebarExpanded, setTabletSidebarExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [aiWidth, setAiWidth] = useState(defaultAiWidth);
  const [isResizing, setIsResizing] = useState(false);

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
            "glass-panel hidden h-full shrink-0 flex-col overflow-hidden rounded-[26px] border border-border/60 shadow-[0_32px_80px_-50px_rgba(68,39,20,0.65)] transition-[width] duration-200 ease-out md:flex",
            tabletSidebarExpanded
              ? "w-[180px] items-stretch p-3"
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl text-xs font-medium transition-colors sm:text-sm 2xl:rounded-2xl",
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
                    <span className={cn(tabletSidebarExpanded ? "inline" : "hidden 2xl:inline")}>
                      {item.label}
                    </span>
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
          <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto px-1 py-0.5 sm:px-2 sm:py-1 2xl:min-w-[680px]">
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

        <AIAssistantPanel open={aiOpen} onOpenChange={handleAiOpenChange} width={aiWidth} />
      </div>
    </div>
  );
}
