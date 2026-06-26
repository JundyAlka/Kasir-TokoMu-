"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { getAuditLabel, CATEGORY_STYLES, type AuditCategory } from "@/lib/audit-labels";
import { cn } from "@/lib/utils";

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorEmail: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  category: string;
  payload: unknown;
  before: unknown;
  after: unknown;
  createdAt: string;
};

interface AuditLogDetailDialogProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    // Heuristic: if the field looks like currency (> 100), format as IDR
    if (value >= 100) return formatCurrency(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nama",
  email: "Email",
  role: "Role",
  buyPrice: "Harga beli",
  sellPrice: "Harga jual",
  stock: "Stok",
  minimumStock: "Stok minimum",
  category: "Kategori",
  description: "Deskripsi",
  amount: "Jumlah",
  total: "Total",
  status: "Status",
  borrowerName: "Nama peminjam",
  whatsapp: "WhatsApp",
  dueDate: "Jatuh tempo",
  isPaid: "Lunas",
  storeName: "Nama toko",
  storeAddress: "Alamat toko",
  ownerName: "Pemilik",
  paymentMethod: "Metode bayar",
  title: "Judul",
  quantity: "Kuantitas",
  unitPrice: "Harga satuan",
  costPrice: "Harga modal",
  profitSharePcmPct: "Bagi hasil PCM (%)",
  profitShareReservePct: "Dana cadangan (%)",
  stockAlertThreshold: "Batas alert stok",
  enabledPayments: "Pembayaran aktif",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

/**
 * Renders a diff table comparing before and after values.
 * Rows with changes are highlighted.
 */
function DiffTable({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  // Filter out keys that are not interesting (internal IDs, timestamps)
  const skipKeys = new Set(["id", "userId", "createdAt", "updatedAt", "workspaceOwnerId"]);
  const keys = allKeys.filter((k) => !skipKeys.has(k));

  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada perubahan yang terdeteksi.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Field</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sebelum</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sesudah</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const oldVal = before[key];
            const newVal = after[key];
            const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            return (
              <tr
                key={key}
                className={cn(
                  "border-b border-border/40 last:border-b-0",
                  changed && "bg-amber-50/60 dark:bg-amber-900/10"
                )}
              >
                <td className="px-3 py-2 font-medium">{fieldLabel(key)}</td>
                <td className={cn("px-3 py-2 tabular-nums", changed && "text-red-600 line-through dark:text-red-400")}>
                  {formatValue(oldVal)}
                </td>
                <td className={cn("px-3 py-2 tabular-nums", changed && "text-emerald-600 font-medium dark:text-emerald-400")}>
                  {formatValue(newVal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders payload as a clean key-value list (not raw JSON).
 */
function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  const skipKeys = new Set(["id", "userId", "createdAt", "updatedAt", "workspaceOwnerId"]);
  const entries = Object.entries(payload).filter(([k]) => !skipKeys.has(k));

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada detail tambahan.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">{fieldLabel(key)}</span>
          <span className="text-right text-sm font-medium tabular-nums">{formatValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

function formatExactTime(iso: string) {
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

export function AuditLogDetailDialog({ entry, onClose }: AuditLogDetailDialogProps) {
  if (!entry) return null;

  const labelInfo = getAuditLabel(entry.eventType);
  const categoryStyle = CATEGORY_STYLES[labelInfo.category] ?? CATEGORY_STYLES.system;
  const hasDiff =
    entry.before && typeof entry.before === "object" &&
    entry.after && typeof entry.after === "object";
  const hasPayload = entry.payload && typeof entry.payload === "object" && Object.keys(entry.payload as object).length > 0;

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className={cn("rounded-full border text-xs", categoryStyle.className)}>
              {categoryStyle.label}
            </Badge>
            <DialogTitle className="text-lg">{labelInfo.label}</DialogTitle>
          </div>
          <DialogDescription>{formatExactTime(entry.createdAt)}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Actor</p>
                <p className="mt-0.5 text-sm font-medium">
                  {entry.actorName ?? entry.actorEmail ?? entry.actorUserId}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Entity</p>
                <p className="mt-0.5 text-sm font-medium">
                  {entry.entityType}
                  {entry.entityId ? (
                    <span className="ml-1 text-xs text-muted-foreground">#{entry.entityId}</span>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Diff view */}
            {hasDiff ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Perubahan (diff)</p>
                <DiffTable
                  before={entry.before as Record<string, unknown>}
                  after={entry.after as Record<string, unknown>}
                />
              </div>
            ) : null}

            {/* Payload view */}
            {hasPayload ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Detail</p>
                <PayloadView payload={entry.payload as Record<string, unknown>} />
              </div>
            ) : null}

            {!hasDiff && !hasPayload ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada detail tambahan untuk event ini.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
