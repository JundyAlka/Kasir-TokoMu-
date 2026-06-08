-- Source: drizzle/0000_bent_emma_frost.sql
CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"borrower_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"is_paid" integer NOT NULL,
	"last_reminder_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"buy_price" integer NOT NULL,
	"sell_price" integer NOT NULL,
	"stock" integer NOT NULL,
	"minimum_stock" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"store_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"owner_whatsapp" text NOT NULL,
	"city" text NOT NULL,
	"stock_alert_threshold" integer NOT NULL,
	"enabled_payments" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"cost_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total" integer NOT NULL,
	"payment_method" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);

-- Source: drizzle/0001_better_auth.sql
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
--> statement-breakpoint

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
--> statement-breakpoint

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
--> statement-breakpoint

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
--> statement-breakpoint

create index "session_userId_idx" on "session" ("userId");
--> statement-breakpoint

create index "account_userId_idx" on "account" ("userId");
--> statement-breakpoint

create index "verification_identifier_idx" on "verification" ("identifier");

-- Source: drizzle/0002_rich_thing.sql
ALTER TABLE "store_profiles" ADD COLUMN "store_tagline" text NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "store_address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "business_notes" text NOT NULL;

-- Source: drizzle/0003_ai_chat.sql
CREATE TABLE IF NOT EXISTS "ai_chats" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
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
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_chat_idx" ON "ai_messages" ("chat_id", "created_at");

-- Source: drizzle/0004_tokomu_extensions.sql
CREATE TABLE "investments" (
	"id" text PRIMARY KEY NOT NULL,
	"investor_id" text NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer,
	"profit_share_pct" integer,
	"product_id" text,
	"unit_count" integer,
	"unit_cost" integer,
	"profit_share_per_unit_pct" integer,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "investments_type_check" CHECK ("investments"."type" in ('uang', 'barang_titip_jual'))
);
--> statement-breakpoint
CREATE TABLE "investor_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"investment_id" text NOT NULL,
	"investor_id" text NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"base_profit" integer NOT NULL,
	"share_pct" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text NOT NULL,
	"paid_at" timestamp with time zone,
	"note" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "investor_payouts_status_check" CHECK ("investor_payouts"."status" in ('draft', 'disetujui', 'dibayar'))
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"address" text NOT NULL,
	"notes" text NOT NULL,
	"is_active" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"data" jsonb NOT NULL,
	"pdf_url" text,
	"status" text NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "monthly_reports_status_check" CHECK ("monthly_reports"."status" in ('draft', 'final'))
);
--> statement-breakpoint
CREATE TABLE "restock_logs" (
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
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "restock_logs_source_check" CHECK ("restock_logs"."source" in ('manual', 'ai_chat', 'ai_ocr'))
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_roles_role_check" CHECK ("user_roles"."role" in ('pimpinan', 'pengelola_keuangan', 'kasir'))
);
--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "pcm_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "pcm_chairman_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "pcm_address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "profit_share_pcm_pct" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "profit_share_reserve_pct" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
CREATE INDEX "investments_workspace_idx" ON "investments" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "investments_investor_idx" ON "investments" USING btree ("investor_id");--> statement-breakpoint
CREATE INDEX "investments_product_idx" ON "investments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "investor_payouts_workspace_idx" ON "investor_payouts" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "investor_payouts_investment_idx" ON "investor_payouts" USING btree ("investment_id");--> statement-breakpoint
CREATE INDEX "investor_payouts_investor_idx" ON "investor_payouts" USING btree ("investor_id");--> statement-breakpoint
CREATE INDEX "investor_payouts_period_idx" ON "investor_payouts" USING btree ("workspace_owner_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "investors_workspace_idx" ON "investors" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "monthly_reports_workspace_idx" ON "monthly_reports" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "monthly_reports_period_idx" ON "monthly_reports" USING btree ("workspace_owner_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "restock_logs_workspace_idx" ON "restock_logs" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "restock_logs_product_idx" ON "restock_logs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "restock_logs_performed_by_idx" ON "restock_logs" USING btree ("performed_by_user_id");--> statement-breakpoint
CREATE INDEX "user_roles_workspace_idx" ON "user_roles" USING btree ("workspace_owner_id");

