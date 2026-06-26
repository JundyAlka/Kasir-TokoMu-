/**
 * Central mapping of eventType → Indonesian label, icon name, and category.
 * Used by both the audit-log table UI and the CSV exporter.
 */

export type AuditCategory =
  | "create"
  | "update"
  | "delete"
  | "auth"
  | "finance"
  | "ai"
  | "system";

export type AuditLabelInfo = {
  label: string;
  icon: string;
  category: AuditCategory;
};

/**
 * Known event types → labels. Unknown types fall back to the raw eventType string.
 */
const EVENT_MAP: Record<string, AuditLabelInfo> = {
  // Products
  PRODUCT_CREATED: { label: "Produk ditambahkan", icon: "PackagePlus", category: "create" },
  PRODUCT_UPDATED: { label: "Produk diubah", icon: "PackageCheck", category: "update" },
  PRODUCT_DELETED: { label: "Produk dihapus", icon: "PackageX", category: "delete" },
  PRODUCT_RESTOCKED: { label: "Stok ditambah", icon: "PackagePlus", category: "update" },

  // Transactions
  TRANSACTION_CREATED: { label: "Transaksi baru", icon: "ReceiptText", category: "create" },

  // Debts
  DEBT_CREATED: { label: "Kasbon ditambahkan", icon: "WalletCards", category: "create" },
  DEBT_PAID: { label: "Kasbon dilunasi", icon: "BadgeCheck", category: "update" },
  DEBT_REMINDED: { label: "Pengingat kasbon", icon: "Bell", category: "update" },

  // Expenses
  EXPENSE_CREATED: { label: "Pengeluaran dicatat", icon: "CreditCard", category: "finance" },

  // Settings
  SETTINGS_UPDATED: { label: "Pengaturan diubah", icon: "Settings", category: "update" },

  // Users / Auth
  USER_INVITED: { label: "User diundang", icon: "UserPlus", category: "auth" },
  USER_DEACTIVATED: { label: "User dinonaktifkan", icon: "UserX", category: "auth" },
  ROLE_CHANGED: { label: "Role diubah", icon: "Shield", category: "auth" },

  // Investors
  INVESTOR_CREATED: { label: "Investor dibuat", icon: "UserPlus", category: "create" },
  INVESTMENT_CREATED: { label: "Investasi dibuat", icon: "WalletCards", category: "create" },

  // Reports / Finance
  REPORT_FINALIZED: { label: "Laporan dicetak", icon: "FileCheck", category: "finance" },
  REPORT_REOPENED: { label: "Laporan dibuka kembali", icon: "FilePenLine", category: "finance" },
  PAYOUT_DRAFTED: { label: "Draft payout dibuat", icon: "WalletCards", category: "finance" },
  PAYOUT_APPROVED: { label: "Payout disetujui", icon: "CircleDollarSign", category: "finance" },
  PAYOUT_PAID: { label: "Payout dibayarkan", icon: "CircleDollarSign", category: "finance" },

  // Restock
  RESTOCK_BATCH: { label: "Restok batch", icon: "Truck", category: "create" },

  // AI
  AI_TOOL_EXECUTED: { label: "AI tool dijalankan", icon: "Bot", category: "ai" },

  // System
  RESET_WORKSPACE: { label: "Workspace direset", icon: "RotateCcw", category: "system" },
};

export function getAuditLabel(eventType: string): AuditLabelInfo {
  return (
    EVENT_MAP[eventType] ?? {
      label: eventType.replace(/_/g, " ").toLowerCase(),
      icon: "Activity",
      category: "system" as AuditCategory,
    }
  );
}

/**
 * Category → display properties for badge colors.
 */
export const CATEGORY_STYLES: Record<
  AuditCategory,
  { label: string; className: string }
> = {
  create: {
    label: "Buat",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800",
  },
  update: {
    label: "Ubah",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-400 dark:border-blue-800",
  },
  delete: {
    label: "Hapus",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/25 dark:text-red-400 dark:border-red-800",
  },
  auth: {
    label: "Auth",
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/25 dark:text-violet-400 dark:border-violet-800",
  },
  finance: {
    label: "Keuangan",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800",
  },
  ai: {
    label: "AI",
    className:
      "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/25 dark:text-fuchsia-400 dark:border-fuchsia-800",
  },
  system: {
    label: "Sistem",
    className:
      "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700",
  },
};

export const ALL_CATEGORIES: AuditCategory[] = [
  "create",
  "update",
  "delete",
  "auth",
  "finance",
  "ai",
  "system",
];
