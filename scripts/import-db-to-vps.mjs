/**
 * import-db-to-vps.mjs
 *
 * Script untuk import SEMUA data dari db-export-live.json ke database PostgreSQL di VPS.
 * 
 * Cara pakai:
 *   $env:VPS_DB_URL = "postgresql://warungos_user:PASSWORD@IP_VPS:5432/warungos"
 *   node scripts/import-db-to-vps.mjs
 */

import { Client } from 'pg';
import { readFileSync, existsSync } from 'fs';

const VPS_DB_URL =
  process.env.VPS_DB_URL ??
  process.env.DATABASE_URL ??
  "postgresql://warungos_user:GANTI_PASSWORD@IP_VPS:5432/warungos";

// 30 tabel sesuai urutan relasi
const TABLE_ORDER = [
  "user", "session", "account", "verification",
  "store_profiles", "user_roles", "invitations",
  "products", "product_aliases", "restock_plans", "restock_logs", "titipan_intakes",
  "investors", "investments", "investor_payouts",
  "shifts", "shift_sessions",
  "transaction_import_batches", "transactions", "transaction_items",
  "debts", "debt_items", "debt_payments",
  "expenses", "kas_movements",
  "daily_reports", "monthly_reports", "ai_chats", "ai_messages", "audit_logs"
];

async function main() {
  if (VPS_DB_URL.includes("GANTI_PASSWORD") || VPS_DB_URL.includes("IP_VPS")) {
    console.error("❌ Set VPS_DB_URL dulu!");
    console.error("   Contoh di PowerShell:");
    console.error("   $env:VPS_DB_URL = \"postgresql://postgres:password_vps@123.45.67.89:5432/warungos\"");
    console.error("   node scripts/import-db-to-vps.mjs");
    process.exit(1);
  }

  const exportFile = existsSync("db-export-live.json") ? "db-export-live.json" : "db-export.json";
  console.log(`📂 Membaca ${exportFile}...`);
  const data = JSON.parse(readFileSync(exportFile, "utf8"));

  const client = new Client({
    connectionString: VPS_DB_URL,
    ssl: VPS_DB_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
  });

  console.log("🔌 Menghubungkan ke VPS Database...");
  await client.connect();
  console.log("✅ Terhubung ke database target!");

  // Nonaktifkan FK constraint sementara
  try {
    await client.query("SET session_replication_role = replica;");
    console.log("⚡ session_replication_role = replica (FK check dinonaktifkan sementara)");
  } catch (e) {
    console.warn("⚠️  FK check disable warning:", e.message);
  }

  // Truncate tabel terlebih dahulu agar bersih dan tidak duplikat
  console.log("🧹 Membersihkan tabel target (TRUNCATE CASCADE)...");
  const reversed = [...TABLE_ORDER].reverse();
  for (const table of reversed) {
    try {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (_) {}
  }

  let totalOk = 0;
  let totalErr = 0;

  for (const table of TABLE_ORDER) {
    const rows = data[table] ?? [];
    if (rows.length === 0) {
      console.log(`  "${table}": kosong (0 baris)`);
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
        if (err === 1) console.error(`    ⚠️ Error pada ${table}: ${e.message}`);
      }
    }
    console.log(`  "${table}": ${ok} baris disalin${err > 0 ? `, ${err} errors` : ""}`);
    totalOk += ok;
    totalErr += err;
  }

  try {
    await client.query("SET session_replication_role = DEFAULT;");
  } catch (_) {}

  console.log("\n──────────────────────────────────────────────");
  console.log(`✅ Import ke VPS selesai!`);
  console.log(`   Total baris berhasil : ${totalOk}`);
  console.log(`   Total error          : ${totalErr}`);
  console.log("──────────────────────────────────────────────");

  await client.end();
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
