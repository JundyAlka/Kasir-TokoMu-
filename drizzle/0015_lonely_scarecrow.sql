CREATE TABLE "restock_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_owner_id" text NOT NULL,
	"product_name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"is_done" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "restock_plans_workspace_idx" ON "restock_plans" USING btree ("workspace_owner_id");--> statement-breakpoint
CREATE INDEX "restock_plans_status_idx" ON "restock_plans" USING btree ("workspace_owner_id","is_done");