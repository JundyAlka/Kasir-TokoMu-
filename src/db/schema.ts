import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PaymentMethod } from "@/lib/types";

export const storeProfiles = pgTable("store_profiles", {
  userId: text("user_id").primaryKey(),
  storeName: text("store_name").notNull(),
  storeTagline: text("store_tagline").notNull(),
  storeAddress: text("store_address").notNull(),
  pcmName: text("pcm_name").notNull().default(""),
  pcmChairmanName: text("pcm_chairman_name").notNull().default(""),
  pcmAddress: text("pcm_address").notNull().default(""),
  ownerName: text("owner_name").notNull(),
  ownerWhatsapp: text("owner_whatsapp").notNull(),
  city: text("city").notNull(),
  businessNotes: text("business_notes").notNull(),
  stockAlertThreshold: integer("stock_alert_threshold").notNull(),
  profitSharePcmPct: integer("profit_share_pcm_pct").notNull().default(30),
  profitShareReservePct: integer("profit_share_reserve_pct").notNull().default(20),
  enabledPayments: jsonb("enabled_payments").$type<PaymentMethod[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id").primaryKey(),
    role: text("role").notNull(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("user_roles_workspace_idx").on(table.workspaceOwnerId),
    check(
      "user_roles_role_check",
      sql`${table.role} in ('pimpinan', 'pengelola_keuangan', 'kasir')`
    ),
  ]
);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  buyPrice: integer("buy_price").notNull(),
  sellPrice: integer("sell_price").notNull(),
  stock: integer("stock").notNull(),
  minimumStock: integer("minimum_stock").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const investors = pgTable(
  "investors",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    name: text("name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    address: text("address").notNull(),
    notes: text("notes").notNull(),
    isActive: integer("is_active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("investors_workspace_idx").on(table.workspaceOwnerId),
  ]
);

export const investments = pgTable(
  "investments",
  {
    id: text("id").primaryKey(),
    investorId: text("investor_id").notNull(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    type: text("type").notNull(),
    amount: integer("amount"),
    profitSharePct: integer("profit_share_pct"),
    productId: text("product_id"),
    unitCount: integer("unit_count"),
    unitCost: integer("unit_cost"),
    profitSharePerUnitPct: integer("profit_share_per_unit_pct"),
    startDate: timestamp("start_date", { withTimezone: true, mode: "string" }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true, mode: "string" }),
    isActive: integer("is_active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("investments_workspace_idx").on(table.workspaceOwnerId),
    index("investments_investor_idx").on(table.investorId),
    index("investments_product_idx").on(table.productId),
    check(
      "investments_type_check",
      sql`${table.type} in ('uang', 'barang_titip_jual')`
    ),
  ]
);

export const investorPayouts = pgTable(
  "investor_payouts",
  {
    id: text("id").primaryKey(),
    investmentId: text("investment_id").notNull(),
    investorId: text("investor_id").notNull(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true, mode: "string" }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: "string" }).notNull(),
    baseProfit: integer("base_profit").notNull(),
    sharePct: integer("share_pct").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("investor_payouts_workspace_idx").on(table.workspaceOwnerId),
    index("investor_payouts_investment_idx").on(table.investmentId),
    index("investor_payouts_investor_idx").on(table.investorId),
    index("investor_payouts_period_idx").on(table.workspaceOwnerId, table.periodStart, table.periodEnd),
    check(
      "investor_payouts_status_check",
      sql`${table.status} in ('draft', 'disetujui', 'dibayar')`
    ),
  ]
);

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const transactionItems = pgTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  costPrice: integer("cost_price").notNull(),
});

export const debts = pgTable("debts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  borrowerName: text("borrower_name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true, mode: "string" }).notNull(),
  isPaid: integer("is_paid").notNull(),
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true, mode: "string" }),
});

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  category: text("category").notNull(),
});

export const restockLogs = pgTable(
  "restock_logs",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    productId: text("product_id").notNull(),
    performedByUserId: text("performed_by_user_id").notNull(),
    source: text("source").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost"),
    receiptImageUrl: text("receipt_image_url"),
    ocrRaw: jsonb("ocr_raw").$type<unknown>(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("restock_logs_workspace_idx").on(table.workspaceOwnerId),
    index("restock_logs_product_idx").on(table.productId),
    index("restock_logs_performed_by_idx").on(table.performedByUserId),
    check(
      "restock_logs_source_check",
      sql`${table.source} in ('manual', 'ai_chat', 'ai_ocr')`
    ),
  ]
);

export const monthlyReports = pgTable(
  "monthly_reports",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    data: jsonb("data").notNull(),
    pdfUrl: text("pdf_url"),
    status: text("status").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("monthly_reports_workspace_idx").on(table.workspaceOwnerId),
    index("monthly_reports_period_idx").on(table.workspaceOwnerId, table.periodYear, table.periodMonth),
    check(
      "monthly_reports_status_check",
      sql`${table.status} in ('draft', 'final')`
    ),
  ]
);

export const aiChats = pgTable("ai_chats", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  toolName: text("tool_name"),
  toolCallId: text("tool_call_id"),
  toolCalls: jsonb("tool_calls").$type<unknown>(),
  toolArgs: jsonb("tool_args").$type<unknown>(),
  toolResult: jsonb("tool_result").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
