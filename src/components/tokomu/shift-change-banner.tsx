"use client";

import { useEffect, useState } from "react";
import { UserRoundCheck } from "lucide-react";

type ShiftChangeBannerProps = {
  cashierName: string;
  onDone?: () => void;
};

export function ShiftChangeBanner({ cashierName, onDone }: ShiftChangeBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = window.setTimeout(() => setVisible(true), 20);
    const exit = window.setTimeout(() => setVisible(false), 3600);
    const done = window.setTimeout(() => onDone?.(), 4200);

    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(exit);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 rounded-[24px] border border-primary/25 bg-popover px-4 py-3 text-popover-foreground shadow-[0_22px_55px_-24px_rgba(186,92,35,0.65)]">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <UserRoundCheck className="size-5" />
        </div>
        <div>
          <p className="font-heading text-lg font-semibold">Shift berganti</p>
          <p className="text-sm text-muted-foreground">
            Sekarang dicatat oleh <span className="font-semibold text-foreground">{cashierName}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
