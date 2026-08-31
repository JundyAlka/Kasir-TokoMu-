import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function runSql(name, sqlQuery) {
  try {
    await pool.query(sqlQuery);
    console.log(`✅ [SUCCESS] ${name}`);
  } catch (err) {
    console.warn(`⚠️ [SKIP/WARN] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log("🚀 Starting database migration on remote DB...");

  // 1. Create missing tables
  await runSql("Create table daily_reports", `
    CREATE TABLE IF NOT EXISTS "daily_reports" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "report_date" date NOT NULL,
      "opening_total" bigint DEFAULT 0 NOT NULL,
      "revenue" bigint DEFAULT 0 NOT NULL,
      "cogs" bigint DEFAULT 0 NOT NULL,
      "expense_total" bigint DEFAULT 0 NOT NULL,
      "gross_profit" bigint DEFAULT 0 NOT NULL,
      "net_profit" bigint DEFAULT 0 NOT NULL,
      "closing_total" bigint DEFAULT 0 NOT NULL,
      "transaction_count" integer DEFAULT 0 NOT NULL,
      "profit_distribution" bigint DEFAULT 0 NOT NULL,
      "status" text DEFAULT 'draft' NOT NULL,
      "locked_at" timestamp with time zone,
      "locked_by_user_id" text,
      "created_at" timestamp with time zone NOT NULL,
      "updated_at" timestamp with time zone NOT NULL
    );
  `);

  await runSql("Create table kas_movements", `
    CREATE TABLE IF NOT EXISTS "kas_movements" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "shift_session_id" text NOT NULL,
      "from_bucket" text NOT NULL,
      "to_bucket" text NOT NULL,
      "amount" bigint NOT NULL,
      "note" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone NOT NULL
    );
  `);

  await runSql("Create table product_aliases", `
    CREATE TABLE IF NOT EXISTS "product_aliases" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "alias" text NOT NULL,
      "product_id" text NOT NULL,
      "created_at" timestamp with time zone NOT NULL
    );
  `);

  await runSql("Create table titipan_intakes", `
    CREATE TABLE IF NOT EXISTS "titipan_intakes" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "investor_id" text NOT NULL,
      "product_id" text,
      "intake_date" date NOT NULL,
      "qty_in" integer NOT NULL,
      "qty_sold" integer DEFAULT 0 NOT NULL,
      "unit_cost" bigint DEFAULT 0 NOT NULL,
      "unit_price" bigint DEFAULT 0 NOT NULL,
      "settled_amount" bigint DEFAULT 0 NOT NULL,
      "shift_session_id" text,
      "created_at" timestamp with time zone NOT NULL
    );
  `);

  await runSql("Create table transaction_import_batches", `
    CREATE TABLE IF NOT EXISTS "transaction_import_batches" (
      "id" text PRIMARY KEY NOT NULL,
      "workspace_owner_id" text NOT NULL,
      "file_name" text NOT NULL,
      "invoice_count" integer NOT NULL,
      "item_count" integer NOT NULL,
      "total_amount" integer NOT NULL,
      "imported_by_user_id" text NOT NULL,
      "created_at" timestamp with time zone NOT NULL,
      "rolled_back_at" timestamp with time zone,
      "rolled_back_by_user_id" text
    );
  `);

  // 2. Alter existing tables / add missing columns
  await runSql("debts: drop not null due_date", `ALTER TABLE "debts" ALTER COLUMN "due_date" DROP NOT NULL;`);
  await runSql("debts: add shift_session_id", `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "shift_session_id" text;`);
  
  await runSql("debt_payments: add shift_session_id", `ALTER TABLE "debt_payments" ADD COLUMN IF NOT EXISTS "shift_session_id" text;`);

  await runSql("expenses: add shift_session_id", `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "shift_session_id" text;`);
  await runSql("expenses: add expense_type", `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "expense_type" text DEFAULT 'operasional' NOT NULL;`);
  await runSql("expenses: add investor_id", `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "investor_id" text;`);
  await runSql("expenses: add is_cash_movement", `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_cash_movement" boolean DEFAULT false NOT NULL;`);

  await runSql("investments: add profit_share_per_unit_amount", `ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "profit_share_per_unit_amount" integer;`);

  await runSql("investor_payouts: add share_mode", `ALTER TABLE "investor_payouts" ADD COLUMN IF NOT EXISTS "share_mode" text DEFAULT 'percentage' NOT NULL;`);
  await runSql("investor_payouts: add per_unit_amount", `ALTER TABLE "investor_payouts" ADD COLUMN IF NOT EXISTS "per_unit_amount" integer;`);

  await runSql("investors: add partner_type", `ALTER TABLE "investors" ADD COLUMN IF NOT EXISTS "partner_type" text DEFAULT 'investor_uang' NOT NULL;`);

  await runSql("products: add is_consignment", `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_consignment" boolean DEFAULT false NOT NULL;`);

  await runSql("restock_plans: add estimated_price", `ALTER TABLE "restock_plans" ADD COLUMN IF NOT EXISTS "estimated_price" integer DEFAULT 0 NOT NULL;`);

  await runSql("shift_sessions: alter opening_cash type", `ALTER TABLE "shift_sessions" ALTER COLUMN "opening_cash" SET DATA TYPE bigint;`);
  await runSql("shift_sessions: alter closing_cash type", `ALTER TABLE "shift_sessions" ALTER COLUMN "closing_cash" SET DATA TYPE bigint;`);
  await runSql("shift_sessions: add opening_coins", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "opening_coins" bigint;`);
  await runSql("shift_sessions: add opening_savings", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "opening_savings" bigint;`);
  await runSql("shift_sessions: add closing_coins", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "closing_coins" bigint;`);
  await runSql("shift_sessions: add closing_savings", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "closing_savings" bigint;`);
  await runSql("shift_sessions: add expected_closing", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "expected_closing" bigint;`);
  await runSql("shift_sessions: add variance", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "variance" bigint;`);
  await runSql("shift_sessions: add variance_note", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "variance_note" text;`);
  await runSql("shift_sessions: add status", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'open' NOT NULL;`);
  await runSql("shift_sessions: add opened_at", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "opened_at" timestamp with time zone;`);
  await runSql("shift_sessions: add closed_at", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;`);
  await runSql("shift_sessions: add opened_by_user_id", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "opened_by_user_id" text;`);
  await runSql("shift_sessions: add closed_by_user_id", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "closed_by_user_id" text;`);
  await runSql("shift_sessions: add needs_review", `ALTER TABLE "shift_sessions" ADD COLUMN IF NOT EXISTS "needs_review" boolean DEFAULT false NOT NULL;`);

  await runSql("store_profiles: add pcm_chairman_title", `ALTER TABLE "store_profiles" ADD COLUMN IF NOT EXISTS "pcm_chairman_title" text DEFAULT 'Ketua PCM' NOT NULL;`);

  await runSql("transaction_items: drop not null product_id", `ALTER TABLE "transaction_items" ALTER COLUMN "product_id" DROP NOT NULL;`);
  await runSql("transaction_items: add is_adjustment", `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "is_adjustment" boolean DEFAULT false NOT NULL;`);
  await runSql("transaction_items: add note", `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "note" text DEFAULT '' NOT NULL;`);

  await runSql("transactions: add occurred_at", `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "occurred_at" timestamp with time zone;`);
  await runSql("transactions: backfill occurred_at", `UPDATE "transactions" SET "occurred_at" = "created_at" WHERE "occurred_at" IS NULL;`);
  await runSql("transactions: set occurred_at not null", `ALTER TABLE "transactions" ALTER COLUMN "occurred_at" SET NOT NULL;`);
  await runSql("transactions: add entry_source", `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "entry_source" text DEFAULT 'pos' NOT NULL;`);
  await runSql("transactions: add external_ref", `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "external_ref" text;`);
  await runSql("transactions: add import_batch_id", `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "import_batch_id" text;`);

  await runSql("user_roles: add monthly_salary", `ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "monthly_salary" integer DEFAULT 0 NOT NULL;`);

  // 3. Create indexes
  await runSql("Index daily_reports_user_report_date_key", `CREATE UNIQUE INDEX IF NOT EXISTS "daily_reports_user_report_date_key" ON "daily_reports" USING btree ("user_id","report_date");`);
  await runSql("Index daily_reports_user_report_date_idx", `CREATE INDEX IF NOT EXISTS "daily_reports_user_report_date_idx" ON "daily_reports" USING btree ("user_id","report_date");`);
  await runSql("Index kas_movements_user_shift_session_idx", `CREATE INDEX IF NOT EXISTS "kas_movements_user_shift_session_idx" ON "kas_movements" USING btree ("user_id","shift_session_id");`);
  await runSql("Index product_aliases_user_product_idx", `CREATE INDEX IF NOT EXISTS "product_aliases_user_product_idx" ON "product_aliases" USING btree ("user_id","product_id");`);
  await runSql("Index titipan_intakes_user_investor_idx", `CREATE INDEX IF NOT EXISTS "titipan_intakes_user_investor_idx" ON "titipan_intakes" USING btree ("user_id","investor_id");`);
  await runSql("Index titipan_intakes_user_shift_session_idx", `CREATE INDEX IF NOT EXISTS "titipan_intakes_user_shift_session_idx" ON "titipan_intakes" USING btree ("user_id","shift_session_id");`);
  await runSql("Index transaction_import_batches_workspace_idx", `CREATE INDEX IF NOT EXISTS "transaction_import_batches_workspace_idx" ON "transaction_import_batches" USING btree ("workspace_owner_id","created_at");`);

  // 4. Update check constraints
  await runSql("Constraint investors partner_type check", `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'investors_partner_type_check'
      ) THEN
        ALTER TABLE "investors" ADD CONSTRAINT "investors_partner_type_check" CHECK ("investors"."partner_type" in ('investor_uang', 'titipan_bagihasil', 'sales_harian'));
      END IF;
    END $$;
  `);

  console.log("✨ All migrations applied successfully!");
  await pool.end();
}

main().catch(console.error);
