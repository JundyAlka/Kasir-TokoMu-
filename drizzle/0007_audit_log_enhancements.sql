-- Add category, before, after columns to audit_logs for diff tracking
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'system';
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "before" jsonb;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "after" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_category_idx" ON "audit_logs" ("workspace_owner_id", "category");
