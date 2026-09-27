"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// ==========================================
// 1. MONTH PICKER (Format: YYYY-MM)
// ==========================================
export function MonthPicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string; // e.g. "2026-09"
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialYear = value ? parseInt(value.slice(0, 4), 10) : new Date().getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);

  useEffect(() => {
    if (value) {
      const y = parseInt(value.slice(0, 4), 10);
      if (!isNaN(y)) setViewYear(y);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedYear = value ? parseInt(value.slice(0, 4), 10) : null;
  const selectedMonth = value ? parseInt(value.slice(5, 7), 10) - 1 : null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const labelText = value
    ? `${MONTH_NAMES[parseInt(value.slice(5, 7), 10) - 1] || ""} ${value.slice(0, 4)}`
    : "Pilih Bulan...";

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-2 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed",
          open
            ? "border-primary ring-2 ring-primary/20 bg-card text-foreground"
            : "border-border/70 bg-background/90 text-foreground hover:bg-muted/60"
        )}
      >
        <Calendar className="size-3.5 text-primary" />
        <span>{labelText}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-2xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
          {/* Year Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-border/40">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Tahun sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-heading font-bold text-sm text-foreground">
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Tahun berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT.map((mShort, idx) => {
              const isSelected = selectedYear === viewYear && selectedMonth === idx;
              const isCurrent = currentYear === viewYear && currentMonth === idx;

              return (
                <button
                  key={mShort}
                  type="button"
                  onClick={() => {
                    const formatted = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
                    onChange(formatted);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-8 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center relative",
                    isSelected
                      ? "bg-primary text-primary-foreground font-extrabold shadow-sm"
                      : isCurrent
                      ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  {mShort}
                </button>
              );
            })}
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/40 text-[11px]">
            <button
              type="button"
              onClick={() => {
                const cur = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
                onChange(cur);
                setViewYear(currentYear);
                setOpen(false);
              }}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. DATE PICKER (Format: YYYY-MM-DD)
// ==========================================
export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih Hari...",
  className,
}: {
  value: string; // e.g. "2026-09-28" or ""
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Calendar matrix calculation
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const labelText = value
    ? (() => {
        try {
          const d = new Date(value);
          return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(d);
        } catch {
          return value;
        }
      })()
    : null;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "inline-flex items-center gap-2 h-8 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none",
            open
              ? "border-primary ring-2 ring-primary/20 bg-card text-foreground"
              : value
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/70 bg-background/90 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <Calendar className="size-3.5 text-primary" />
          <span className={cn(value ? "text-foreground font-semibold" : "text-muted-foreground")}>
            {labelText || placeholder}
          </span>
        </button>

        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Hapus filter hari"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-68 rounded-2xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
          {/* Header Month & Year */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>

            <span className="font-heading font-bold text-xs sm:text-sm text-foreground">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Bulan berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((day) => (
              <span key={day} className="text-[10px] font-semibold text-muted-foreground/80 py-0.5">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous month padding days */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => {
              const dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
              return (
                <span
                  key={`prev-${i}`}
                  className="h-7 flex items-center justify-center text-[11px] text-muted-foreground/30 select-none"
                >
                  {dayNum}
                </span>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const isSelected = value === dateStr;
              const isToday = todayStr === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    onChange(dateStr);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-7 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center",
                    isSelected
                      ? "bg-primary text-primary-foreground font-extrabold shadow-sm"
                      : isToday
                      ? "bg-primary/20 text-primary border border-primary/40 font-bold hover:bg-primary/30"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Quick Footer Shortcuts */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/40 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange(todayStr);
                  setOpen(false);
                }}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Hari Ini
              </button>
              <span className="text-muted-foreground/40">•</span>
              <button
                type="button"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
                  onChange(yStr);
                  setOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Kemarin
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="font-medium text-destructive hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
