ALTER TABLE "whatsapp_report_configs"
  ADD COLUMN IF NOT EXISTS "daily_enabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "daily_hour" integer DEFAULT 19 NOT NULL,
  ADD COLUMN IF NOT EXISTS "attach_daily_pdf" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "daily_wait_shift_close" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_daily_period_sent" text;

