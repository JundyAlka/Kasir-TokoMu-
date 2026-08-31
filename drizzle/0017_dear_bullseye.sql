CREATE TABLE "daily_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"report_date" date NOT NULL,
	"opening_total" bigint DEFAULT 0 NOT NULL,
	"revenue" bigint DEFAULT 0 NOT NULL,
	"cogs" bigint DEFAULT 0 NOT NULL,
	"expense_total" bigint DEFAULT 0 NOT NULL,
	"gross_profit" bigint DEFAULT 0 NOT NULL,
	"net_profit" bigint DEFAULT 0 NOT NULL,
	"closing_total" bigint DEFAULT 0 NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"profit_distribution" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kas_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"shift_session_id" text NOT NULL,
	"from_bucket" text NOT NULL,
	"to_bucket" text NOT NULL,
	"amount" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"alias" text NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titipan_intakes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"investor_id" text NOT NULL,
	"product_id" text,
	"intake_date" date NOT NULL,
	"qty_in" integer NOT NULL,
	"qty_sold" integer DEFAULT 0 NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"settled_amount" bigint DEFAULT 0 NOT NULL,
	"shift_session_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"file_name" text NOT NULL,
	"invoice_count" integer NOT NULL,
	"item_count" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"imported_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"rolled_back_at" timestamp with time zone,
	"rolled_back_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "debts" ALTER COLUMN "due_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_sessions" ALTER COLUMN "opening_cash" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ALTER COLUMN "closing_cash" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transaction_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD COLUMN "shift_session_id" text;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "shift_session_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "shift_session_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "expense_type" text DEFAULT 'operasional' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "investor_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "is_cash_movement" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "profit_share_per_unit_amount" integer;--> statement-breakpoint
ALTER TABLE "investor_payouts" ADD COLUMN "share_mode" text DEFAULT 'percentage' NOT NULL;--> statement-breakpoint
ALTER TABLE "investor_payouts" ADD COLUMN "per_unit_amount" integer;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "partner_type" text DEFAULT 'investor_uang' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_consignment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "restock_plans" ADD COLUMN "estimated_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "opening_coins" bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "opening_savings" bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "closing_coins" bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "closing_savings" bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "expected_closing" bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "variance" bigint;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "variance_note" text;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "opened_by_user_id" text;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "closed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "shift_sessions" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "pcm_chairman_title" text DEFAULT 'Ketua PCM' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD COLUMN "is_adjustment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "occurred_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "entry_source" text DEFAULT 'pos' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "import_batch_id" text;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "monthly_salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_reports_user_report_date_key" ON "daily_reports" USING btree ("user_id","report_date");--> statement-breakpoint
CREATE INDEX "daily_reports_user_report_date_idx" ON "daily_reports" USING btree ("user_id","report_date");--> statement-breakpoint
CREATE INDEX "kas_movements_user_shift_session_idx" ON "kas_movements" USING btree ("user_id","shift_session_id");--> statement-breakpoint
CREATE INDEX "product_aliases_user_product_idx" ON "product_aliases" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "titipan_intakes_user_investor_idx" ON "titipan_intakes" USING btree ("user_id","investor_id");--> statement-breakpoint
CREATE INDEX "titipan_intakes_user_shift_session_idx" ON "titipan_intakes" USING btree ("user_id","shift_session_id");--> statement-breakpoint
CREATE INDEX "transaction_import_batches_workspace_idx" ON "transaction_import_batches" USING btree ("workspace_owner_id","created_at");--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_partner_type_check" CHECK ("investors"."partner_type" in ('investor_uang', 'titipan_bagihasil', 'sales_harian'));