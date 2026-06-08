CREATE TABLE "debts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"borrower_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"is_paid" integer NOT NULL,
	"last_reminder_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"buy_price" integer NOT NULL,
	"sell_price" integer NOT NULL,
	"stock" integer NOT NULL,
	"minimum_stock" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"store_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"owner_whatsapp" text NOT NULL,
	"city" text NOT NULL,
	"stock_alert_threshold" integer NOT NULL,
	"enabled_payments" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"cost_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total" integer NOT NULL,
	"payment_method" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
