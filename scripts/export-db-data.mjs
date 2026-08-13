/**
 * export-db-data.mjs — Export semua data dari DB lokal ke JSON
 */
import { Client } from 'pg';
import { writeFileSync } from 'fs';

const DB_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5439/warungos";

const TABLES = [
  "user", "session", "account", "verification",
  "store_profiles", "user_roles", "invitations",
  "investors", "products", "investments", "investor_payouts",
  "shifts", "shift_sessions",
  "transactions", "transaction_items",
  "debts", "debt_items", "debt_payments",
  "expenses", "restock_plans", "restock_logs",
  "monthly_reports", "ai_chats", "ai_messages", "audit_logs"
];

async function main() {
  console.log("Connecting to:", DB_URL.replace(/:\/\/.*@/, "://***@"));
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
  } catch (e) {
    console.error("Connection error:", e.message);
    console.error("Stack:", e.stack);
    process.exit(1);
  }
  console.log("✅ Connected!");

  const dump = {};
  for (const table of TABLES) {
    try {
      const res = await client.query(`SELECT * FROM "${table}"`);
      dump[table] = res.rows;
      console.log(`  ${table}: ${res.rows.length} rows`);
    } catch (e) {
      console.log(`  ${table}: SKIP (${e.message})`);
      dump[table] = [];
    }
  }

  writeFileSync("db-export.json", JSON.stringify(dump, null, 2));
  console.log("\n✅ Data exported to db-export.json");

  await client.end();
}

main().catch(e => { console.error("❌ Error:", e.message); console.error("Stack:", e.stack); process.exit(1); });
