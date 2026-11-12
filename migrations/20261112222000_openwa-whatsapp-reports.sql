CREATE TABLE IF NOT EXISTS "whatsapp_report_configs" (
  "workspace_owner_id" text PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "base_url" text DEFAULT 'http://localhost:2785' NOT NULL,
  "api_key" text DEFAULT '' NOT NULL,
  "session_id" text DEFAULT 'tokomu-wa' NOT NULL,
  "recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "weekly_enabled" boolean DEFAULT true NOT NULL,
  "weekly_day_of_week" integer DEFAULT 1 NOT NULL,
  "weekly_hour" integer DEFAULT 8 NOT NULL,
  "monthly_enabled" boolean DEFAULT true NOT NULL,
  "monthly_day_of_month" integer DEFAULT 1 NOT NULL,
  "monthly_hour" integer DEFAULT 8 NOT NULL,
  "attach_monthly_pdf" boolean DEFAULT true NOT NULL,
  "last_weekly_period_sent" text,
  "last_monthly_period_sent" text,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "whatsapp_dispatch_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_owner_id" text NOT NULL,
  "trigger_type" text NOT NULL,
  "report_mode" text NOT NULL,
  "period_key" text NOT NULL,
  "recipients" jsonb NOT NULL,
  "status" text NOT NULL,
  "summary_text" text NOT NULL,
  "pdf_attached" boolean DEFAULT false NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "whatsapp_dispatch_logs_ws_created_idx"
  ON "whatsapp_dispatch_logs" USING btree ("workspace_owner_id", "created_at");

