ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recorded_by_user_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recorded_by_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "shift_session_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shifts" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "name" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "assigned_user_id" text,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shifts_workspace_idx" ON "shifts" ("workspace_owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shifts_workspace_active_idx" ON "shifts" ("workspace_owner_id", "is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "shift_id" text NOT NULL,
  "cashier_user_id" text NOT NULL,
  "started_at" timestamptz NOT NULL,
  "ended_at" timestamptz,
  "opening_cash" integer,
  "closing_cash" integer,
  "expected_cash" integer,
  "difference" integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_sessions_workspace_idx" ON "shift_sessions" ("workspace_owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_sessions_shift_idx" ON "shift_sessions" ("shift_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_sessions_cashier_idx" ON "shift_sessions" ("cashier_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_sessions_open_idx" ON "shift_sessions" ("workspace_owner_id", "ended_at");
