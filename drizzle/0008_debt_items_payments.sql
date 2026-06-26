ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "paid_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'aktif' NOT NULL;
--> statement-breakpoint
UPDATE "debts" SET "paid_amount" = "amount", "status" = 'lunas' WHERE "is_paid" = 1;
--> statement-breakpoint
UPDATE "debts" SET "paid_amount" = 0, "status" = 'aktif' WHERE "is_paid" = 0 AND "paid_amount" = 0;
--> statement-breakpoint
ALTER TABLE "debts" DROP CONSTRAINT IF EXISTS "debts_status_check";
--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_status_check" CHECK ("status" in ('aktif', 'lunas', 'lewat_tempo'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debts_user_status_idx" ON "debts" ("user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debt_items" (
  "id" text PRIMARY KEY NOT NULL,
  "debt_id" text NOT NULL,
  "product_id" text,
  "name" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "line_total" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_items_debt_idx" ON "debt_items" ("debt_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_items_product_idx" ON "debt_items" ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debt_payments" (
  "id" text PRIMARY KEY NOT NULL,
  "debt_id" text NOT NULL,
  "amount" integer NOT NULL,
  "paid_at" timestamptz NOT NULL,
  "note" text NOT NULL,
  "recorded_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debt_payments_debt_idx" ON "debt_payments" ("debt_id");
