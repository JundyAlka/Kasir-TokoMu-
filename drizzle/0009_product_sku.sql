ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_user_sku_unique_idx" ON "products" ("user_id", "sku") WHERE "sku" <> '';
