ALTER TABLE "whatsapp_report_configs"
  ADD COLUMN IF NOT EXISTS "attach_weekly_pdf" boolean DEFAULT true NOT NULL;

