ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "monthly_salary" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "profit_share_per_unit_amount" integer;
--> statement-breakpoint
ALTER TABLE "investor_payouts" ADD COLUMN IF NOT EXISTS "share_mode" text DEFAULT 'percentage' NOT NULL;
--> statement-breakpoint
ALTER TABLE "investor_payouts" ADD COLUMN IF NOT EXISTS "per_unit_amount" integer;
