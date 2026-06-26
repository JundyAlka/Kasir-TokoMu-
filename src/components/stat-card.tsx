import { ArrowUpRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  tone?: "default" | "accent" | "warn";
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  description,
  tone = "default",
  onClick,
}: StatCardProps) {
  const isClickable = !!onClick;

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
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium opacity-80">{title}</p>
          <div className="flex items-center gap-1">
            {isClickable && (
              <Info className="size-3.5 opacity-50 transition-opacity group-hover:opacity-80" />
            )}
            <ArrowUpRight className="size-4 opacity-70" />
          </div>
        </div>
        <p className="font-heading text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm opacity-75">{description}</p>
      </CardContent>
    </Card>
  );
}
