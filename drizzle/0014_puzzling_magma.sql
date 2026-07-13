CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"category" text DEFAULT 'system' NOT NULL,
	"payload" jsonb NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_items" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"note" text NOT NULL,
	"recorded_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"status" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" in ('pengelola_keuangan', 'kasir')),
	CONSTRAINT "invitations_status_check" CHECK ("invitations"."status" in ('pending', 'accepted', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "shift_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"shift_id" text NOT NULL,
	"cashier_user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"opening_cash" integer,
	"closing_cash" integer,
	"expected_cash" integer,
	"difference" integer
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"assigned_user_id" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "profit_share_pct" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "profit_share_per_unit_pct" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "investor_payouts" ALTER COLUMN "share_pct" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "paid_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "status" text DEFAULT 'aktif' NOT NULL;--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "akad_type" text DEFAULT 'murabahah_bil_wakalah' NOT NULL;--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "monthly_return_rate_pct" numeric DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "qris_payload" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "qris_image_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "bank_transfer_info" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paid_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "change_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recorded_by_user_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recorded_by_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "shift_session_id" text;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_created_idx" ON "audit_logs" USING btree ("workspace_owner_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_event_idx" ON "audit_logs" USING btree ("workspace_owner_id","event_type");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("workspace_owner_id","actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_category_idx" ON "audit_logs" USING btree ("workspace_owner_id","category");--> statement-breakpoint
CREATE INDEX "debt_items_debt_idx" ON "debt_items" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "debt_items_product_idx" ON "debt_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "debt_payments_debt_idx" ON "debt_payments" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "invitations_workspace_email_idx" ON "invitations" USING btree ("workspace_owner_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "shift_sessions_workspace_idx" ON "shift_sessions" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "shift_sessions_shift_idx" ON "shift_sessions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_sessions_cashier_idx" ON "shift_sessions" USING btree ("cashier_user_id");--> statement-breakpoint
CREATE INDEX "shift_sessions_open_idx" ON "shift_sessions" USING btree ("workspace_owner_id","ended_at");--> statement-breakpoint
CREATE INDEX "shifts_workspace_idx" ON "shifts" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "shifts_workspace_active_idx" ON "shifts" USING btree ("workspace_owner_id","is_active");--> statement-breakpoint
CREATE INDEX "debts_user_status_idx" ON "debts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_roles_workspace_active_idx" ON "user_roles" USING btree ("workspace_owner_id","is_active");--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_status_check" CHECK ("debts"."status" in ('aktif', 'lunas', 'lewat_tempo'));--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_akad_type_check" CHECK ("investments"."akad_type" in ('murabahah_bil_wakalah', 'mudharabah', 'musyarakah', 'barang_titip_jual', 'sales_titipan', 'pinjaman_qardh'));