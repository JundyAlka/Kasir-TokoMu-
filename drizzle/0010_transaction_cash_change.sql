ALTER TABLE "transactions" ADD COLUMN "paid_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "change_amount" integer DEFAULT 0 NOT NULL;
