import { ArrowUpRight, Info, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  tone?: "default" | "accent" | "warn";
  onClick?: () => void;
  dataState?: "ready" | "loading" | "error";
  onRetry?: () => void;
}

export function StatCard({
  title,
  value,
  description,
  tone = "default",
  onClick,
  dataState = "ready",
  onRetry,
}: StatCardProps) {
  const isClickable = !!onClick && dataState === "ready";
  const isLoading = dataState === "loading";
  const hasError = dataState === "error";

  return (
    <Card
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Lihat detail ${title}` : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "border-border/60 shadow-[0_20px_60px_-36px_rgba(65,35,18,0.45)] relative",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "warn" &&
          "bg-primary text-primary-foreground dark:border-primary/25 dark:bg-primary/18 dark:text-foreground",
        isClickable &&
          "cursor-pointer select-none transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_24px_68px_-32px_rgba(65,35,18,0.55)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      )}
    >
      <CardContent className="space-y-2 p-4 sm:space-y-3 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium opacity-80 sm:text-sm">{title}</p>
          <div className="flex items-center gap-1">
            {isClickable && (
              <Info className="size-3.5 opacity-50 transition-opacity group-hover:opacity-80" />
            )}
            <ArrowUpRight className="size-4 opacity-70" />
          </div>
        </div>
        {hasError ? (
          <div role="alert" className="space-y-2">
            <p className="font-heading text-base font-semibold">Gagal memuat data, coba lagi</p>
            {onRetry ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <RefreshCw className="size-3.5" />
                Muat ulang
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="font-heading text-lg sm:text-xl md:text-2xl xl:text-3xl font-bold tracking-tight tabular-nums break-words" title={isLoading ? undefined : value}>
              {isLoading ? "Memuat data..." : value}
            </p>
            <p className="line-clamp-2 text-xs opacity-75 sm:text-sm">
              {isLoading ? "Sedang mengambil data terbaru." : description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
