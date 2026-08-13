/**
 * generate-sql-dump.mjs
 *
 * Membaca db-export.json dan menghasilkan file SQL murni (vps-import.sql)
 * yang bisa langsung dijalankan di VPS tanpa perlu Node.js script.
 *
 * Cara pakai:
 *   node scripts/generate-sql-dump.mjs
 *
 * Hasilnya: file "vps-import.sql" di root project
 * Di VPS tinggal jalankan:
 *   psql -U postgres -d warungos -f vps-import.sql
 */

import { readFileSync, writeFileSync } from 'fs';

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

function escapeSQL(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function main() {
  console.log("📂 Membaca db-export.json...");
  const data = JSON.parse(readFileSync("db-export.json", "utf8"));

  const lines = [];

  lines.push("-- ═══════════════════════════════════════════════════════════");
  lines.push("-- VPS Import SQL — Generated from db-export.json");
  lines.push(`-- Generated at: ${new Date().toISOString()}`);
  lines.push("-- ");
  lines.push("-- Cara pakai di VPS:");
  lines.push("--   sudo -u postgres psql -d warungos -f /tmp/vps-import.sql");
  lines.push("-- ═══════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("BEGIN;");
  lines.push("");

  // Disable FK checks
  lines.push("-- Nonaktifkan FK constraint sementara");
  lines.push("SET session_replication_role = replica;");
  lines.push("");

  // TRUNCATE semua tabel dulu (urutan terbalik, child dulu)
  lines.push("-- ══════════════════════════════════════════════");
  lines.push("-- BERSIHKAN semua tabel dulu agar tidak bentrok");
  lines.push("-- ══════════════════════════════════════════════");
  const reversed = [...TABLE_ORDER].reverse();
  for (const table of reversed) {
    lines.push(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
  lines.push("");

  let totalRows = 0;

  for (const table of TABLE_ORDER) {
    const rows = data[table] ?? [];
    if (rows.length === 0) {
      lines.push(`-- Tabel "${table}": kosong (0 baris)`);
      lines.push("");
      continue;
    }

    lines.push(`-- ──────────────────────────────────────────`);
    lines.push(`-- Tabel "${table}": ${rows.length} baris`);
    lines.push(`-- ──────────────────────────────────────────`);

    const cols = Object.keys(rows[0]);
    const colsQuoted = cols.map(c => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = cols.map(c => escapeSQL(row[c])).join(", ");
      lines.push(
        `INSERT INTO "${table}" (${colsQuoted}) VALUES (${values});`
      );
    }

    lines.push("");
    totalRows += rows.length;
    console.log(`  ✅ "${table}": ${rows.length} baris`);
  }

  // Re-enable FK checks
  lines.push("-- Aktifkan kembali FK constraint");
  lines.push("SET session_replication_role = DEFAULT;");
  lines.push("");
  lines.push("COMMIT;");
  lines.push("");
  lines.push(`-- ✅ Total: ${totalRows} baris dari ${TABLE_ORDER.length} tabel`);
  lines.push("-- Jika ada error, semua perubahan akan di-rollback otomatis (TRANSACTION)");

  const sqlContent = lines.join("\n");
  writeFileSync("vps-import.sql", sqlContent, "utf8");

  console.log("");
  console.log("══════════════════════════════════════════════");
  console.log(`✅ File SQL berhasil dibuat: vps-import.sql`);
  console.log(`   Total: ${totalRows} baris INSERT`);
  console.log(`   Ukuran: ${(sqlContent.length / 1024).toFixed(1)} KB`);
  console.log("");
  console.log("📋 Langkah di VPS:");
  console.log("   1. Copy file: scp vps-import.sql user@IP_VPS:/tmp/");
  console.log("   2. Jalankan:  sudo -u postgres psql -d warungos -f /tmp/vps-import.sql");
  console.log("══════════════════════════════════════════════");
}

main();
