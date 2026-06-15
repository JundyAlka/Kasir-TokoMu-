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
--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "profit_share_pct" TYPE numeric USING "profit_share_pct"::numeric;
--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "profit_share_per_unit_pct" TYPE numeric USING "profit_share_per_unit_pct"::numeric;
--> statement-breakpoint
ALTER TABLE "investor_payouts" ALTER COLUMN "share_pct" TYPE numeric USING "share_pct"::numeric;
