/**
 * import-db-to-vps.mjs
 *
 * Script untuk import SEMUA data dari db-export.json ke database VPS.
 * Jalankan dari PC lokal setelah `node scripts/export-db-data.mjs` berhasil.
 *
 * Cara pakai:
 *   $env:VPS_DB_URL = "postgresql://warungos_user:PASSWORD@IP_VPS:5432/warungos"
 *   node scripts/import-db-to-vps.mjs
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';

const VPS_DB_URL =
  process.env.VPS_DB_URL ??
  "postgresql://warungos_user:GANTI_PASSWORD@IP_VPS:5432/warungos";

// Urutan insert: parent tables dulu, child tables belakangan
const TABLE_ORDER = [
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
  if (VPS_DB_URL.includes("GANTI_PASSWORD") || VPS_DB_URL.includes("IP_VPS")) {
    console.error("❌ Set VPS_DB_URL dulu!");
    console.error("   $env:VPS_DB_URL = \"postgresql://warungos_user:PASSWORD@IP:5432/warungos\"");
    process.exit(1);
  }

  console.log("📂 Membaca db-export.json...");
  const data = JSON.parse(readFileSync("db-export.json", "utf8"));

  const client = new Client({ connectionString: VPS_DB_URL });
  console.log("🔌 Menghubungkan ke VPS...");
  await client.connect();
  console.log("✅ Terhubung:", VPS_DB_URL.replace(/:\/\/.*@/, "://***@"));

  // Nonaktifkan FK check
  try {
    await client.query("SET session_replication_role = replica;");
  } catch (e) {
    console.warn("⚠️  FK skip gagal:", e.message);
  }

  let totalOk = 0;
  let totalErr = 0;

  for (const table of TABLE_ORDER) {
    const rows = data[table] ?? [];
    if (rows.length === 0) {
      console.log(`  "${table}": kosong`);
      continue;
    }

    const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(", ");
    const params = Object.keys(rows[0]).map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO "${table}" (${cols}) VALUES (${params}) ON CONFLICT DO NOTHING`;

    let ok = 0, err = 0;
    for (const row of rows) {
      const values = Object.values(row).map(val => {
        if (val !== null && typeof val === "object" && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });
      try {
        await client.query(sql, values);
        ok++;
      } catch (e) {
        err++;
        if (err === 1) console.error(`    ⚠️ ${e.message}`);
      }
    }
    console.log(`  "${table}": ${ok} inserted${err > 0 ? `, ${err} errors` : ""}`);
    totalOk += ok;
    totalErr += err;
  }

  try {
    await client.query("SET session_replication_role = DEFAULT;");
  } catch (_) {}

  console.log("\n──────────────────────────────");
  console.log(`✅ Import selesai!`);
  console.log(`   Berhasil: ${totalOk}`);
  console.log(`   Error:    ${totalErr}`);
  console.log("──────────────────────────────");

  await client.end();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
