"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoHintProps = {
  text: string;
  label?: string;
  className?: string;
  side?: "top" | "bottom";
};

type TooltipPosition = {
  left: number;
  top: number;
  width: number;
  side: "top" | "bottom";
};

const tooltipWidth = 240;
const tooltipMargin = 12;

export function InfoHint({
  text,
  label = "Penjelasan field",
  className,
  side = "bottom",
}: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();

  function openTooltip() {
    setPosition(null);
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;

      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const width = Math.min(
        tooltipWidth,
        Math.max(180, window.innerWidth - tooltipMargin * 2)
      );
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, tooltipMargin),
        window.innerWidth - width - tooltipMargin
      );
      const resolvedSide = side === "top" && rect.top > 160 ? "top" : "bottom";
      const top = resolvedSide === "top" ? rect.top - 8 : rect.bottom + 8;

      setPosition({ left, top, width, side: resolvedSide });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, side]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!pinned) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }

      setPinned(false);
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setPinned(false);
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, pinned]);

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => {
        if (!pinned) {
          openTooltip();
        }
      }}
      onMouseLeave={() => {
        if (!pinned) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? descriptionId : undefined}
        aria-expanded={open}
        className="inline-flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={(event) => {
          event.stopPropagation();
          setPinned((current) => {
            const next = !current;
            if (next) {
              openTooltip();
            } else {
              setOpen(false);
            }
            return next;
          });
        }}
        onFocus={() => {
          if (!pinned) {
            openTooltip();
          }
        }}
        onBlur={() => {
          if (!pinned) {
            setOpen(false);
          }
        }}
      >
        <Info className="size-3.5" />
      </button>

      {open ? (
        <span
          id={descriptionId}
          role="tooltip"
          style={
            position
              ? position
              : {
                  left: -9999,
                  top: -9999,
                  width: tooltipWidth,
                }
          }
          className={cn(
            "fixed z-[80] rounded-xl border border-border bg-popover px-3 py-2 text-left text-[11px] leading-snug whitespace-normal text-popover-foreground opacity-0 shadow-lg shadow-black/10 transition-opacity duration-75",
            position && "opacity-100",
            position?.side === "top" && "-translate-y-full"
          )}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
