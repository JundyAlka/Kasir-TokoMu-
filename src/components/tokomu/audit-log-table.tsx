"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Search,
  Shield,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AuditLogDetailDialog,
  type AuditLogEntry,
} from "@/components/tokomu/audit-log-detail-dialog";
import {
  getAuditLabel,
  CATEGORY_STYLES,
  type AuditCategory,
} from "@/lib/audit-labels";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Facets = {
  eventTypes: string[];
  actors: { id: string; name: string | null; email: string | null }[];
};

type Filters = {
  eventType: string;
  actorUserId: string;
  category: string;
  q: string;
  start: string;
  end: string;
  page: number;
};

const PAGE_SIZE = 25;

const EMPTY_FILTERS: Filters = {
  eventType: "",
  actorUserId: "",
  category: "",
  q: "",
  start: "",
  end: "",
  page: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function exactTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function buildQueryString(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.actorUserId) params.set("actorUserId", filters.actorUserId);
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.start) params.set("start", `${filters.start}T00:00:00.000Z`);
  if (filters.end) params.set("end", `${filters.end}T23:59:59.999Z`);
  params.set("page", String(filters.page));
  params.set("pageSize", String(PAGE_SIZE));
  return params.toString();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: AuditCategory }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.system;
  return (
    <Badge className={cn("rounded-full border text-[10px]", style.className)}>
      {style.label}
    </Badge>
  );
}

function ActorCell({ name, email }: { name: string | null; email: string | null }) {
  const displayName = name || email || "Sistem";
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
        {getInitials(displayName)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {email && name && (
          <p className="truncate text-[11px] text-muted-foreground">{email}</p>
        )}
      </div>
    </div>
  );
}

function QuickChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function NativeSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
        !value && "text-muted-foreground",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Fetch facets once
  useEffect(() => {
    void fetch("/api/audit-log?facets=1")
      .then((r) => r.json())
      .then((data) => setFacets(data.facets))
      .catch(() => {});
  }, []);

  // Fetch logs on filter change
  const fetchLogs = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-log?${buildQueryString(f)}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs(filters);
  }, [filters, fetchLogs]);

  function updateFilter(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, page: 1, ...patch }));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateFilter({ q: searchInput });
  }

  function handleExport() {
    const params = buildQueryString(filters);
    window.open(`/api/audit-log/export?${params}`, "_blank");
  }

  // Quick filter: today
  const todayIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
  const isToday = filters.start === todayIso && filters.end === todayIso;

  // Group logs by day
  const groupedLogs: { day: string; entries: AuditLogEntry[] }[] = [];
  let currentDay = "";
  for (const log of logs) {
    const day = dayKey(log.createdAt);
    if (day !== currentDay) {
      groupedLogs.push({ day, entries: [] });
      currentDay = day;
    }
    groupedLogs[groupedLogs.length - 1].entries.push(log);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="border-border/60 bg-card/74">
        <CardContent className="space-y-3 p-4">
          {/* Row 1: dropdowns + date range */}
          <div className="flex flex-wrap items-end gap-2">
            <NativeSelect
              value={filters.eventType}
              onChange={(v) => updateFilter({ eventType: v })}
              placeholder="Semua event"
              options={
                facets?.eventTypes.map((e) => ({
                  value: e,
                  label: getAuditLabel(e).label,
                })) ?? []
              }
              className="min-w-[160px]"
            />
            <NativeSelect
              value={filters.actorUserId}
              onChange={(v) => updateFilter({ actorUserId: v })}
              placeholder="Semua actor"
              options={
                facets?.actors.map((a) => ({
                  value: a.id,
                  label: a.name || a.email || a.id,
                })) ?? []
              }
              className="min-w-[160px]"
            />
            <NativeSelect
              value={filters.category}
              onChange={(v) => updateFilter({ category: v })}
              placeholder="Semua kategori"
              options={[
                { value: "create", label: "Buat" },
                { value: "update", label: "Ubah" },
                { value: "delete", label: "Hapus" },
                { value: "auth", label: "Auth" },
                { value: "finance", label: "Keuangan" },
                { value: "ai", label: "AI" },
                { value: "system", label: "Sistem" },
              ]}
              className="min-w-[130px]"
            />
            <div className="flex items-center gap-1">
              <Calendar className="size-3.5 text-muted-foreground" />
              <input
                type="date"
                value={filters.start}
                onChange={(e) => updateFilter({ start: e.target.value })}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="date"
                value={filters.end}
                onChange={(e) => updateFilter({ end: e.target.value })}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
          </div>

          {/* Row 2: search + quick chips + export */}
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSearch} className="relative flex-1 sm:max-w-[280px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari event, entity…"
                className="h-8 pl-8 pr-8"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    updateFilter({ q: "" });
                  }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-1.5">
              <QuickChip
                label="Hari ini"
                active={isToday}
                icon={<Calendar className="size-3" />}
                onClick={() => {
                  if (isToday) {
                    updateFilter({ start: "", end: "" });
                  } else {
                    updateFilter({ start: todayIso, end: todayIso });
                  }
                }}
              />
              <QuickChip
                label="Sensitif"
                active={filters.category === "auth" || filters.category === "delete"}
                icon={<Shield className="size-3" />}
                onClick={() => {
                  const isActive = filters.category === "auth" || filters.category === "delete";
                  updateFilter({ category: isActive ? "" : "auth" });
                }}
              />
              <QuickChip
                label="AI"
                active={filters.category === "ai"}
                icon={<Bot className="size-3" />}
                onClick={() => updateFilter({ category: filters.category === "ai" ? "" : "ai" })}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {(filters.eventType || filters.actorUserId || filters.category || filters.q || filters.start || filters.end) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setSearchInput("");
                  }}
                >
                  <X className="size-3" />
                  Reset
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-3.5" data-icon="inline-start" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/60 bg-card/74">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Memuat audit log…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Belum ada audit log untuk filter ini.
            </div>
          ) : (
            <div>
              {groupedLogs.map((group) => (
                <div key={group.day}>
                  {/* Day header */}
                  <div className="sticky top-0 z-10 border-b border-t border-border/40 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm first:border-t-0">
                    {group.day}
                  </div>
                  {group.entries.map((entry) => {
                    const labelInfo = getAuditLabel(entry.eventType);
                    const cat = (entry.category || labelInfo.category) as AuditCategory;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="flex w-full items-center gap-3 border-b border-border/30 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
                      >
                        {/* Time */}
                        <div className="w-[80px] shrink-0" title={exactTime(entry.createdAt)}>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {relativeTime(entry.createdAt)}
                          </p>
                        </div>

                        {/* Event + category badge */}
                        <div className="flex min-w-[180px] items-center gap-2">
                          <CategoryBadge category={cat} />
                          <span className="text-sm font-medium">{labelInfo.label}</span>
                        </div>

                        {/* Actor */}
                        <div className="hidden min-w-[160px] md:block">
                          <ActorCell name={entry.actorName} email={entry.actorEmail} />
                        </div>

                        {/* Entity */}
                        <div className="hidden min-w-[120px] lg:block">
                          <p className="text-sm text-muted-foreground">
                            {entry.entityType}
                            {entry.entityId && (
                              <span className="ml-1 text-[11px] opacity-60">#{entry.entityId.slice(0, 12)}</span>
                            )}
                          </p>
                        </div>

                        {/* Detail button */}
                        <div className="ml-auto shrink-0">
                          <Eye className="size-4 text-muted-foreground/50" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {(filters.page - 1) * PAGE_SIZE + 1}–{Math.min(filters.page * PAGE_SIZE, total)} dari {total} log
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums">
              {filters.page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <AuditLogDetailDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
