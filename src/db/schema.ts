import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { PaymentMethod } from "@/lib/types";

export const storeProfiles = pgTable("store_profiles", {
  userId: text("user_id").primaryKey(),
  storeName: text("store_name").notNull(),
  storeTagline: text("store_tagline").notNull(),
  storeAddress: text("store_address").notNull(),
  pcmName: text("pcm_name").notNull().default(""),
  pcmChairmanName: text("pcm_chairman_name").notNull().default(""),
  pcmChairmanTitle: text("pcm_chairman_title").notNull().default("Ketua PCM"),
  pcmAddress: text("pcm_address").notNull().default(""),
  ownerName: text("owner_name").notNull(),
  ownerWhatsapp: text("owner_whatsapp").notNull(),
  city: text("city").notNull(),
  businessNotes: text("business_notes").notNull(),
  stockAlertThreshold: integer("stock_alert_threshold").notNull(),
  profitSharePcmPct: integer("profit_share_pcm_pct").notNull().default(30),
  profitShareReservePct: integer("profit_share_reserve_pct").notNull().default(20),
  enabledPayments: jsonb("enabled_payments").$type<PaymentMethod[]>().notNull(),
  qrisPayload: text("qris_payload").notNull().default(""),
  qrisImageUrl: text("qris_image_url").notNull().default(""),
  bankTransferInfo: text("bank_transfer_info").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id").primaryKey(),
    role: text("role").notNull(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    isActive: integer("is_active").notNull().default(1),
    monthlySalary: integer("monthly_salary").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("user_roles_workspace_idx").on(table.workspaceOwnerId),
    index("user_roles_workspace_active_idx").on(table.workspaceOwnerId, table.isActive),
    check(
      "user_roles_role_check",
      sql`${table.role} in ('pimpinan', 'pengelola_keuangan', 'kasir')`
    ),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    token: text("token").notNull(),
    status: text("status").notNull(),
    invitedByUserId: text("invited_by_user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("invitations_workspace_email_idx").on(table.workspaceOwnerId, table.email),
    uniqueIndex("invitations_token_idx").on(table.token),
    check(
      "invitations_role_check",
      sql`${table.role} in ('pengelola_keuangan', 'kasir')`
    ),
    check(
      "invitations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'expired')`
    ),
  ]
);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sku: text("sku").notNull().default(""),
  name: text("name").notNull(),
  category: text("category").notNull(),
  buyPrice: integer("buy_price").notNull(),
  sellPrice: integer("sell_price").notNull(),
  stock: integer("stock").notNull(),
  minimumStock: integer("minimum_stock").notNull(),
  isConsignment: boolean("is_consignment").notNull().default(false),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const productAliases = pgTable(
  "product_aliases",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    alias: text("alias").notNull(),
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("product_aliases_user_product_idx").on(table.userId, table.productId),
  ]
);

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
    partnerType: text("partner_type").notNull().default("investor_uang"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("investors_workspace_idx").on(table.workspaceOwnerId),
    check("investors_partner_type_check", sql`${table.partnerType} in ('investor_uang', 'titipan_bagihasil', 'sales_harian')`),
  ]
);

export const investments = pgTable(
  "investments",
  {
    id: text("id").primaryKey(),
    investorId: text("investor_id").notNull(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    type: text("type").notNull(),
    akadType: text("akad_type").notNull().default("murabahah_bil_wakalah"),
    amount: integer("amount"),
    monthlyReturnRatePct: numeric("monthly_return_rate_pct", { mode: "number" }).notNull().default(2.5),
    profitSharePct: numeric("profit_share_pct", { mode: "number" }),
    productId: text("product_id"),
    unitCount: integer("unit_count"),
    unitCost: integer("unit_cost"),
    profitSharePerUnitPct: numeric("profit_share_per_unit_pct", { mode: "number" }),
    profitSharePerUnitAmount: integer("profit_share_per_unit_amount"),
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
    check(
      "investments_akad_type_check",
      sql`${table.akadType} in ('murabahah_bil_wakalah', 'mudharabah', 'musyarakah', 'barang_titip_jual', 'sales_titipan', 'pinjaman_qardh')`
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
    sharePct: numeric("share_pct", { mode: "number" }).notNull(),
    shareMode: text("share_mode").notNull().default("percentage"),
    perUnitAmount: integer("per_unit_amount"),
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
  paidAmount: integer("paid_amount").notNull().default(0),
  changeAmount: integer("change_amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().default(""),
  recordedByName: text("recorded_by_name").notNull().default(""),
  shiftSessionId: text("shift_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
  entrySource: text("entry_source").notNull().default("pos"),
  externalRef: text("external_ref"),
  importBatchId: text("import_batch_id"),
});

export const transactionImportBatches = pgTable(
  "transaction_import_batches",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    fileName: text("file_name").notNull(),
    invoiceCount: integer("invoice_count").notNull(),
    itemCount: integer("item_count").notNull(),
    totalAmount: integer("total_amount").notNull(),
    importedByUserId: text("imported_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: "string" }),
    rolledBackByUserId: text("rolled_back_by_user_id"),
  },
  (table) => [index("transaction_import_batches_workspace_idx").on(table.workspaceOwnerId, table.createdAt)]
);

export const shifts = pgTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    assignedUserId: text("assigned_user_id"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("shifts_workspace_idx").on(table.workspaceOwnerId),
    index("shifts_workspace_active_idx").on(table.workspaceOwnerId, table.isActive),
  ]
);

export const shiftSessions = pgTable(
  "shift_sessions",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    shiftId: text("shift_id").notNull(),
    cashierUserId: text("cashier_user_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    openingCash: bigint("opening_cash", { mode: "number" }),
    openingCoins: bigint("opening_coins", { mode: "number" }),
    openingSavings: bigint("opening_savings", { mode: "number" }),
    closingCash: bigint("closing_cash", { mode: "number" }),
    closingCoins: bigint("closing_coins", { mode: "number" }),
    closingSavings: bigint("closing_savings", { mode: "number" }),
    expectedCash: integer("expected_cash"),
    expectedClosing: bigint("expected_closing", { mode: "number" }),
    difference: integer("difference"),
    variance: bigint("variance", { mode: "number" }),
    varianceNote: text("variance_note"),
    status: text("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "string" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
    openedByUserId: text("opened_by_user_id"),
    closedByUserId: text("closed_by_user_id"),
    needsReview: boolean("needs_review").notNull().default(false),
  },
  (table) => [
    index("shift_sessions_workspace_idx").on(table.workspaceOwnerId),
    index("shift_sessions_shift_idx").on(table.shiftId),
    index("shift_sessions_cashier_idx").on(table.cashierUserId),
    index("shift_sessions_open_idx").on(table.workspaceOwnerId, table.endedAt),
  ]
);

export const transactionItems = pgTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  productId: text("product_id"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  costPrice: integer("cost_price").notNull(),
  isAdjustment: boolean("is_adjustment").notNull().default(false),
  note: text("note").notNull().default(""),
});

export const debts = pgTable(
  "debts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    borrowerName: text("borrower_name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    amount: integer("amount").notNull(),
    paidAmount: integer("paid_amount").notNull().default(0),
    status: text("status").notNull().default("aktif"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "string" }),
    shiftSessionId: text("shift_session_id"),
    isPaid: integer("is_paid").notNull(),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("debts_user_status_idx").on(table.userId, table.status),
    check(
      "debts_status_check",
      sql`${table.status} in ('aktif', 'lunas', 'lewat_tempo')`
    ),
  ]
);

export const debtItems = pgTable(
  "debt_items",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id").notNull(),
    productId: text("product_id"),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (table) => [
    index("debt_items_debt_idx").on(table.debtId),
    index("debt_items_product_idx").on(table.productId),
  ]
);

export const debtPayments = pgTable(
  "debt_payments",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id").notNull(),
    amount: integer("amount").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }).notNull(),
    note: text("note").notNull(),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    shiftSessionId: text("shift_session_id"),
  },
  (table) => [
    index("debt_payments_debt_idx").on(table.debtId),
  ]
);

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  category: text("category").notNull(),
  shiftSessionId: text("shift_session_id"),
  expenseType: text("expense_type").notNull().default("operasional"),
  investorId: text("investor_id"),
  isCashMovement: boolean("is_cash_movement").notNull().default(false),
});

export const kasMovements = pgTable(
  "kas_movements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    shiftSessionId: text("shift_session_id").notNull(),
    fromBucket: text("from_bucket").notNull(),
    toBucket: text("to_bucket").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("kas_movements_user_shift_session_idx").on(table.userId, table.shiftSessionId)]
);

export const dailyReports = pgTable(
  "daily_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    reportDate: date("report_date").notNull(),
    openingTotal: bigint("opening_total", { mode: "number" }).notNull().default(0),
    revenue: bigint("revenue", { mode: "number" }).notNull().default(0),
    cogs: bigint("cogs", { mode: "number" }).notNull().default(0),
    expenseTotal: bigint("expense_total", { mode: "number" }).notNull().default(0),
    grossProfit: bigint("gross_profit", { mode: "number" }).notNull().default(0),
    netProfit: bigint("net_profit", { mode: "number" }).notNull().default(0),
    closingTotal: bigint("closing_total", { mode: "number" }).notNull().default(0),
    transactionCount: integer("transaction_count").notNull().default(0),
    profitDistribution: bigint("profit_distribution", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("draft"),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    lockedByUserId: text("locked_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("daily_reports_user_report_date_key").on(table.userId, table.reportDate),
    index("daily_reports_user_report_date_idx").on(table.userId, table.reportDate),
  ]
);

export const titipanIntakes = pgTable(
  "titipan_intakes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    investorId: text("investor_id").notNull(),
    productId: text("product_id"),
    intakeDate: date("intake_date").notNull(),
    qtyIn: integer("qty_in").notNull(),
    qtySold: integer("qty_sold").notNull().default(0),
    unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull().default(0),
    settledAmount: bigint("settled_amount", { mode: "number" }).notNull().default(0),
    shiftSessionId: text("shift_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("titipan_intakes_user_investor_idx").on(table.userId, table.investorId),
    index("titipan_intakes_user_shift_session_idx").on(table.userId, table.shiftSessionId),
  ]
);

export const restockPlans = pgTable(
  "restock_plans",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    productName: text("product_name").notNull(),
    note: text("note").notNull().default(""),
    estimatedPrice: integer("estimated_price").notNull().default(0),
    isDone: integer("is_done").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("restock_plans_workspace_idx").on(table.workspaceOwnerId),
    index("restock_plans_status_idx").on(table.workspaceOwnerId, table.isDone),
  ]
);

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

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceOwnerId: text("workspace_owner_id").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    category: text("category").notNull().default("system"),
    payload: jsonb("payload").$type<unknown>().notNull(),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("audit_logs_workspace_created_idx").on(table.workspaceOwnerId, table.createdAt),
    index("audit_logs_event_idx").on(table.workspaceOwnerId, table.eventType),
    index("audit_logs_actor_idx").on(table.workspaceOwnerId, table.actorUserId),
    index("audit_logs_category_idx").on(table.workspaceOwnerId, table.category),
  ]
);
