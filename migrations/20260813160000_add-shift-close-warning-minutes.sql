ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "shift_close_warning_minutes" integer DEFAULT 30 NOT NULL;
