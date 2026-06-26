ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "akad_type" text;
--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "monthly_return_rate_pct" numeric DEFAULT 2.5 NOT NULL;
--> statement-breakpoint
UPDATE "investments"
SET "akad_type" = CASE
  WHEN "type" = 'barang_titip_jual' THEN 'barang_titip_jual'
  ELSE 'murabahah_bil_wakalah'
END
WHERE "akad_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "akad_type" SET DEFAULT 'murabahah_bil_wakalah';
--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "akad_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "investments" DROP CONSTRAINT IF EXISTS "investments_akad_type_check";
--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_akad_type_check" CHECK ("akad_type" in ('murabahah_bil_wakalah', 'mudharabah', 'musyarakah', 'barang_titip_jual', 'sales_titipan', 'pinjaman_qardh'));
