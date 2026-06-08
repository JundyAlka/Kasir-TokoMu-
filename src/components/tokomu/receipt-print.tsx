"use client";

import { Printer, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Settings, Transaction } from "@/lib/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReceiptHtml(transaction: Transaction, settings: Settings) {
  const itemRows = transaction.items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="name">${escapeHtml(item.productName)}</div>
            <div class="muted">${item.quantity} x ${escapeHtml(formatCurrency(item.unitPrice))}</div>
          </td>
          <td class="right">${escapeHtml(formatCurrency(item.quantity * item.unitPrice))}</td>
        </tr>
      `
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Struk ${escapeHtml(transaction.id)}</title>
    <style>
      @page { size: 80mm auto; margin: 8mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #1f1713;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.35;
      }
      .receipt { width: 100%; }
      .center { text-align: center; }
      .store { font-size: 17px; font-weight: 700; }
      .tagline { margin-top: 2px; color: #6f5a4d; }
      .divider {
        border: 0;
        border-top: 1px dashed #8d7769;
        margin: 10px 0;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      td {
        padding: 4px 0;
        vertical-align: top;
      }
      .name { font-weight: 600; }
      .muted { color: #6f5a4d; }
      .right { text-align: right; white-space: nowrap; }
      .total {
        font-size: 15px;
        font-weight: 700;
      }
      .thanks { margin-top: 12px; font-weight: 700; }
    </style>
  </head>
  <body>
    <main class="receipt">
      <section class="center">
        <div class="store">${escapeHtml(settings.storeName || "TokoMu")}</div>
        <div class="tagline">${escapeHtml(settings.storeTagline || "Toko Amal Usaha")}</div>
        <div class="tagline">${escapeHtml(settings.storeAddress || "-")}</div>
      </section>

      <hr class="divider" />

      <section>
        <div class="row"><span>No</span><span>${escapeHtml(transaction.id)}</span></div>
        <div class="row"><span>Tanggal</span><span>${escapeHtml(formatDateTime(transaction.createdAt))}</span></div>
        <div class="row"><span>Bayar</span><span>${escapeHtml(transaction.paymentMethod)}</span></div>
      </section>

      <hr class="divider" />

      <table>
        <tbody>${itemRows}</tbody>
      </table>

      <hr class="divider" />

      <section class="row total">
        <span>Total</span>
        <span>${escapeHtml(formatCurrency(transaction.total))}</span>
      </section>

      <section class="center thanks">
        Terima kasih sudah berbelanja
      </section>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`;
}

function printReceipt(transaction: Transaction, settings: Settings) {
  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) {
    throw new Error("Popup struk diblokir browser. Izinkan popup untuk mencetak struk.");
  }

  printWindow.document.open();
  printWindow.document.write(buildReceiptHtml(transaction, settings));
  printWindow.document.close();
}

export function ReceiptPrintDialog({
  open,
  onOpenChange,
  settings,
  transaction,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  transaction: Transaction | null;
}>) {
  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/14 text-primary">
            <ReceiptText className="size-5" />
          </div>
          <DialogTitle className="font-heading text-2xl">Transaksi Berhasil</DialogTitle>
          <DialogDescription>
            Struk transaksi siap dicetak atau disimpan sebagai PDF lewat dialog print browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-4">
          <div className="rounded-[22px] border border-border/70 bg-card/75 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-heading text-2xl font-semibold">
                {formatCurrency(transaction.total)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Metode</span>
              <span>{transaction.paymentMethod}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Item</span>
              <span>{transaction.items.length} produk</span>
            </div>
          </div>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-[22px] border border-border/70 bg-muted/35 p-3">
            {transaction.items.map((item) => (
              <div key={`${transaction.id}-${item.productId}`} className="flex justify-between gap-3 text-sm">
                <span>
                  {item.productName} x{item.quantity}
                </span>
                <span className="font-medium">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="rounded-b-[28px]" showCloseButton>
          <Button
            type="button"
            onClick={() => {
              try {
                printReceipt(transaction, settings);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal membuka struk.");
              }
            }}
          >
            <Printer className="size-4" />
            Cetak Struk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
