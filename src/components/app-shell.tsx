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
  Menu,
  Package2,
  ScrollText,
  Settings2,
  ShoppingBasket,
  Store,
  UserCog,
  Wallet,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AccountPanel } from "@/components/auth/account-panel";
import { AIAssistantPanel } from "@/components/warung/ai-assistant-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { RoleProvider } from "@/components/role-gate";
import { cn } from "@/lib/utils";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Role } from "@/lib/server/rbac";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/kasir", label: "Kasir", icon: ShoppingBasket, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/inventaris", label: "Inventaris", icon: Package2, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/buku-hutang", label: "Buku Hutang", icon: Wallet, roles: ["pimpinan", "pengelola_keuangan", "kasir"] },
  { href: "/investor", label: "Investor", icon: Landmark, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/bagi-hasil", label: "Bagi Hasil", icon: HandCoins, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/laporan", label: "Laporan", icon: FileChartColumn, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/laporan-pcm", label: "Laporan PCM", icon: ScrollText, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings2, roles: ["pimpinan", "pengelola_keuangan"] },
  { href: "/pengaturan/karyawan", label: "Kelola Karyawan", icon: UserCog, roles: ["pimpinan"] },
  { href: "/pengaturan/audit-log", label: "Audit Log", icon: ListChecks, roles: ["pimpinan"] },
] satisfies Array<{ href: string; label: string; icon: typeof Gauge; roles: Role[] }>;

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard operasional warung",
    subtitle:
      "Lihat angka penting, stok menipis, dan aktivitas terbaru tanpa mengganggu layar kasir.",
  },
  "/kasir": {
    title: "Kasir cepat untuk jam sibuk",
    subtitle:
      "Layar ini khusus untuk jualan cepat: pilih produk, atur jumlah, dan selesaikan transaksi.",
  },
  "/inventaris": {
    title: "Kontrol stok tanpa buku catatan",
    subtitle:
      "Pantau produk aktif, restok cepat, dan sorot barang yang mulai menipis.",
  },
  "/inventaris/restok-ai": {
    title: "Restok via scan struk",
    subtitle:
      "Upload foto struk, cek hasil AI, lalu konfirmasi item sebelum stok bertambah.",
  },
  "/buku-hutang": {
    title: "Catatan kasbon yang rapi",
    subtitle:
      "Simpan pelanggan berhutang, kirim pengingat, dan tandai pelunasan dengan satu klik.",
  },
  "/laporan": {
    title: "Laporan untung yang gampang dipahami",
    subtitle:
      "Lihat omzet, pengeluaran, dan preview PDF untuk kebutuhan pinjaman atau evaluasi usaha.",
  },
  "/investor": {
    title: "Investor warung",
    subtitle: "Kelola penyertaan modal dan barang titip jual dari investor.",
  },
  "/bagi-hasil": {
    title: "Bagi hasil investor",
    subtitle: "Susun periode hitung, persetujuan, dan pembayaran bagi hasil.",
  },
  "/laporan-pcm": {
    title: "Laporan PCM",
    subtitle: "Siapkan laporan bulanan untuk pimpinan dan alokasi cadangan.",
  },
  "/pengaturan": {
    title: "Pengaturan warung",
    subtitle:
      "Atur profil warung, notifikasi stok menipis, dan metode bayar yang ingin ditampilkan.",
  },
  "/pengaturan/karyawan": {
    title: "Kelola karyawan",
    subtitle: "Undang user baru dan tentukan akses role di workspace warung.",
  },
  "/pengaturan/audit-log": {
    title: "Audit log",
    subtitle: "Pantau aksi sensitif, perubahan status, dan eksekusi AI di workspace.",
  },
};

const layoutStorageKey = "warungos.shell.layout.v1";
const defaultSidebarWidth = 272;
const defaultAiWidth = 400;
const minSidebarWidth = 220;
const maxSidebarWidth = 360;
const minAiWidth = 320;
const maxAiWidth = 560;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NavigationSheet({
  activePageTitle,
  exactActiveHref,
  pathname,
  settings,
  visibleNavigation,
}: Readonly<{
  activePageTitle: string;
  exactActiveHref?: string;
  pathname: string;
  settings: { storeName: string };
  visibleNavigation: typeof navigation;
}>) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Buka menu sidebar"
            title="Buka menu sidebar"
            className="rounded-2xl bg-card/85 shadow-[0_18px_40px_-28px_rgba(68,39,20,0.75)] backdrop-blur"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="!top-2 !bottom-2 !left-2 !h-[calc(100dvh-1rem)] w-[320px] rounded-[28px] border border-sidebar-border bg-sidebar/95 text-sidebar-foreground shadow-[0_28px_80px_-42px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-sidebar-foreground">
            {settings.storeName}
          </SheetTitle>
          <SheetDescription className="text-sidebar-foreground/70">
            {activePageTitle}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = exactActiveHref
              ? pathname === item.href
              : pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: isActive ? "secondary" : "ghost",
                    size: "lg",
                  }),
                  "w-full justify-start rounded-2xl",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/auth"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-4 h-11 w-full rounded-2xl",
            )}
          >
            Akun
          </Link>
          <ThemeToggle className="mt-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({
  children,
  role,
}: Readonly<{
  children: React.ReactNode;
  role: Role;
}>) {
  const pathname = usePathname();
  const { settings } = useAppState();
  const activePage = pageTitles[pathname] ?? pageTitles["/kasir"];
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
    <div className={cn("h-screen overflow-hidden bg-background", isResizing && "select-none cursor-col-resize")}>
      <div className="mx-auto flex h-full w-[calc(100vw-24px)] max-w-none gap-2 p-2 sm:w-[calc(100vw-28px)] sm:p-3 lg:w-[calc(100vw-36px)] lg:p-4 2xl:gap-3">
        <aside
          className={cn(
            "glass-panel hidden h-full shrink-0 flex-col overflow-hidden rounded-[30px] border border-border/60 shadow-[0_32px_80px_-50px_rgba(68,39,20,0.65)] transition-[width] duration-200 ease-out md:flex",
            tabletSidebarExpanded
              ? "w-[292px] items-stretch p-4"
              : "w-[72px] items-center px-2 py-3",
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
              {!tabletSidebarExpanded ? (
                <NavigationSheet
                  activePageTitle={activePage.title}
                  exactActiveHref={exactActiveHref}
                  pathname={pathname}
                  settings={settings}
                  visibleNavigation={visibleNavigation}
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-xl"
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
                "rounded-[22px] border border-primary/20 bg-primary/10 px-4 py-3 text-foreground transition-all dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground",
                tabletSidebarExpanded ? "mt-3 block" : "hidden 2xl:block"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                  <Store className="size-4" />
                </div>
                <p className="truncate text-sm font-medium">
                  {settings.storeName}
                </p>
              </div>
              <ThemeToggle className="mt-3" />
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
              "mt-3 flex-1 overflow-y-auto",
              leftCollapsed
                ? "flex flex-col items-center gap-1.5"
                : tabletSidebarExpanded
                  ? "space-y-2"
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
                    "flex items-center gap-3 rounded-2xl text-sm font-medium transition-colors",
                    leftCollapsed
                      ? "size-12 justify-center"
                      : tabletSidebarExpanded
                        ? "w-full justify-start px-4 py-3"
                        : "size-11 justify-center 2xl:size-auto 2xl:justify-start 2xl:px-4 2xl:py-3",
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
            <div className={cn(tabletSidebarExpanded ? "block" : "hidden 2xl:block")}>
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
            className="group hidden w-3 shrink-0 touch-none cursor-col-resize items-center justify-center rounded-full 2xl:flex"
          >
            <span className="h-16 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/70" />
          </button>
        ) : null}

        <div className="pointer-events-none fixed top-3 left-3 z-40 md:hidden">
          <div className="pointer-events-auto">
            <NavigationSheet
              activePageTitle={activePage.title}
              exactActiveHref={exactActiveHref}
              pathname={pathname}
              settings={settings}
              visibleNavigation={visibleNavigation}
            />
          </div>
        </div>

        <RoleProvider role={role}>
          <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto pt-14 md:pt-0 2xl:min-w-[680px]">
            {children}
          </main>
        </RoleProvider>

        {aiOpen ? (
          <button
            type="button"
            aria-label="Atur lebar asisten AI"
            title="Tarik untuk mengatur lebar asisten AI"
            onPointerDown={handleAiResizeStart}
            className="group hidden w-4 shrink-0 touch-none cursor-col-resize items-center justify-center rounded-full md:flex"
          >
            <span className="h-20 w-1.5 rounded-full bg-border transition-colors group-hover:bg-primary/70 group-active:bg-primary" />
          </button>
        ) : null}

        <AIAssistantPanel open={aiOpen} onOpenChange={handleAiOpenChange} width={aiWidth} />
      </div>
    </div>
  );
}
