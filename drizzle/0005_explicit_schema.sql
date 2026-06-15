CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_profiles" (
  "user_id" text PRIMARY KEY NOT NULL,
  "store_name" text NOT NULL,
  "store_tagline" text DEFAULT '' NOT NULL,
  "store_address" text DEFAULT '' NOT NULL,
  "pcm_name" text DEFAULT '' NOT NULL,
  "pcm_chairman_name" text DEFAULT '' NOT NULL,
  "pcm_address" text DEFAULT '' NOT NULL,
  "owner_name" text NOT NULL,
  "owner_whatsapp" text NOT NULL,
  "city" text NOT NULL,
  "business_notes" text DEFAULT '' NOT NULL,
  "stock_alert_threshold" integer NOT NULL,
  "profit_share_pcm_pct" integer DEFAULT 30 NOT NULL,
  "profit_share_reserve_pct" integer DEFAULT 20 NOT NULL,
  "enabled_payments" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "store_tagline" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "store_address" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "pcm_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "pcm_chairman_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "pcm_address" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "business_notes" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "profit_share_pcm_pct" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "profit_share_reserve_pct" integer DEFAULT 20 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" text PRIMARY KEY NOT NULL,
  "role" text NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "user_roles_role_check" CHECK ("role" in ('pimpinan', 'pengelola_keuangan', 'kasir'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_workspace_idx" ON "user_roles" ("workspace_owner_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "buy_price" integer NOT NULL,
  "sell_price" integer NOT NULL,
  "stock" integer NOT NULL,
  "minimum_stock" integer NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "total" integer NOT NULL,
  "payment_method" text NOT NULL,
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_items" (
  "id" text PRIMARY KEY NOT NULL,
  "transaction_id" text NOT NULL,
  "product_id" text NOT NULL,
  "product_name" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "cost_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "borrower_name" text NOT NULL,
  "whatsapp" text NOT NULL,
  "amount" integer NOT NULL,
  "created_at" timestamptz NOT NULL,
  "due_date" timestamptz NOT NULL,
  "is_paid" integer NOT NULL,
  "last_reminder_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "amount" integer NOT NULL,
  "created_at" timestamptz NOT NULL,
  "category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investors" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "name" text NOT NULL,
  "whatsapp" text NOT NULL,
  "address" text NOT NULL,
  "notes" text NOT NULL,
  "is_active" integer NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investors_workspace_idx" ON "investors" ("workspace_owner_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investments" (
  "id" text PRIMARY KEY NOT NULL,
  "investor_id" text NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "type" text NOT NULL,
  "amount" integer,
  "profit_share_pct" numeric,
  "product_id" text,
  "unit_count" integer,
  "unit_cost" integer,
  "profit_share_per_unit_pct" numeric,
  "start_date" timestamptz NOT NULL,
  "end_date" timestamptz,
  "is_active" integer NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "investments_type_check" CHECK ("type" in ('uang', 'barang_titip_jual'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investments_workspace_idx" ON "investments" ("workspace_owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investments_investor_idx" ON "investments" ("investor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investments_product_idx" ON "investments" ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investor_payouts" (
  "id" text PRIMARY KEY NOT NULL,
  "investment_id" text NOT NULL,
  "investor_id" text NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "base_profit" integer NOT NULL,
  "share_pct" numeric NOT NULL,
  "amount" integer NOT NULL,
  "status" text NOT NULL,
  "paid_at" timestamptz,
  "note" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "investor_payouts_status_check" CHECK ("status" in ('draft', 'disetujui', 'dibayar'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investor_payouts_workspace_idx" ON "investor_payouts" ("workspace_owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investor_payouts_investment_idx" ON "investor_payouts" ("investment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investor_payouts_investor_idx" ON "investor_payouts" ("investor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investor_payouts_period_idx" ON "investor_payouts" ("workspace_owner_id", "period_start", "period_end");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restock_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "product_id" text NOT NULL,
  "performed_by_user_id" text NOT NULL,
  "source" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_cost" integer,
  "receipt_image_url" text,
  "ocr_raw" jsonb,
  "note" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  CONSTRAINT "restock_logs_source_check" CHECK ("source" in ('manual', 'ai_chat', 'ai_ocr'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restock_logs_workspace_idx" ON "restock_logs" ("workspace_owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restock_logs_product_idx" ON "restock_logs" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restock_logs_performed_by_idx" ON "restock_logs" ("performed_by_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "period_year" integer NOT NULL,
  "period_month" integer NOT NULL,
  "data" jsonb NOT NULL,
  "pdf_url" text,
  "status" text NOT NULL,
  "finalized_at" timestamptz,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "monthly_reports_status_check" CHECK ("status" in ('draft', 'final'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reports_workspace_idx" ON "monthly_reports" ("workspace_owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_reports_period_idx" ON "monthly_reports" ("workspace_owner_id", "period_year", "period_month");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chats" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chats_user_idx" ON "ai_chats" ("user_id", "updated_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "chat_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "tool_name" text,
  "tool_call_id" text,
  "tool_calls" jsonb,
  "tool_args" jsonb,
  "tool_result" jsonb,
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_chat_idx" ON "ai_messages" ("chat_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "event_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_created_idx" ON "audit_logs" ("workspace_owner_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_event_idx" ON "audit_logs" ("workspace_owner_id", "event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("workspace_owner_id", "actor_user_id");
