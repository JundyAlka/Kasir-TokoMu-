/**
 * dump-to-vps.mjs
 * Transfer semua data dari DB lokal ke VPS PostgreSQL
 *
 * Cara pakai:
 *   node scripts/dump-to-vps.mjs
 *
 * Env vars yang bisa di-override:
 *   LOCAL_DB_URL  = koneksi DB lokal  (default: postgres://postgres:postgres@localhost:5439/warungos)
 *   VPS_DB_URL    = koneksi DB VPS    (WAJIB diisi, atau edit langsung di bawah)
 */

import { Client } from 'pg';

// ──────────────────────────────────────────────
// EDIT BAGIAN INI SESUAI KONDISI ANDA
// ──────────────────────────────────────────────
const LOCAL_DB_URL =
  process.env.LOCAL_DB_URL ??
  "postgres://postgres:postgres@localhost:5439/warungos";

const VPS_DB_URL =
  process.env.VPS_DB_URL ??
  "postgresql://postgres:GANTI_PASSWORD_VPS@IP_VPS_KAMU:5432/warungos";
// ──────────────────────────────────────────────

// Urutan penting: parent table dulu, baru child table (foreign key)
const TABLES = [
  // 🔐 Auth (Better Auth) — harus paling pertama
  "user",
  "session",
  "account",
  "verification",

  // 🏪 Aplikasi — urutan berdasarkan dependency
  "store_profiles",
  "user_roles",
  "invitations",
  "investors",
  "products",
  "investments",
  "investor_payouts",
  "shifts",
  "shift_sessions",
  "transactions",
  "transaction_items",
  "debts",
  "debt_items",
  "debt_payments",
  "expenses",
  "restock_plans",
  "restock_logs",
  "monthly_reports",
  "ai_chats",
  "ai_messages",
  "audit_logs",
];

async function main() {
  if (VPS_DB_URL.includes("GANTI_PASSWORD_VPS") || VPS_DB_URL.includes("IP_VPS_KAMU")) {
    console.error("❌ ERROR: Harap edit VPS_DB_URL di scripts/dump-to-vps.mjs atau set env var VPS_DB_URL");
    console.error("   Contoh: VPS_DB_URL=postgresql://postgres:password@123.45.67.89:5432/warungos node scripts/dump-to-vps.mjs");
    process.exit(1);
  }

  const local = new Client({ connectionString: LOCAL_DB_URL });
  const vps   = new Client({ connectionString: VPS_DB_URL });

  try {
    console.log("🔌 Menghubungkan ke DB lokal...");
    await local.connect();
    console.log("✅ DB lokal terhubung:", LOCAL_DB_URL.replace(/:\/\/.*@/, "://***@"));

    console.log("🔌 Menghubungkan ke DB VPS...");
    await vps.connect();
    console.log("✅ DB VPS terhubung:", VPS_DB_URL.replace(/:\/\/.*@/, "://***@"));

    // Nonaktifkan foreign key constraint sementara agar insert bebas urutan
    console.log("\n⚙️  Menonaktifkan trigger FK sementara di VPS...");
    try {
      await vps.query("SET session_replication_role = replica;");
    } catch (e) {
      console.warn("⚠️  Tidak bisa nonaktifkan FK triggers:", e.message);
    }

    let totalCopied = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    console.log("\n📋 Mulai transfer data...\n");

    for (const table of TABLES) {
      process.stdout.write(`  Tabel "${table}"... `);

      // Ambil data dari lokal
      let rows;
      try {
        const res = await local.query(`SELECT * FROM "${table}"`);
        rows = res.rows;
      } catch (e) {
        console.log(`SKIP (tidak ada di lokal: ${e.message})`);
        totalSkipped++;
        continue;
      }

      if (rows.length === 0) {
        console.log("kosong (0 baris)");
        continue;
      }

      const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(", ");
      const params = Object.keys(rows[0]).map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO "${table}" (${cols}) VALUES (${params}) ON CONFLICT DO NOTHING`;

      let ok = 0;
      let err = 0;

      for (const row of rows) {
        const values = Object.values(row).map(val => {
          if (val !== null && typeof val === "object" && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        try {
          await vps.query(sql, values);
          ok++;
        } catch (e) {
          err++;
          if (err === 1) console.error(`\n    ⚠️  Error row: ${e.message}`);
        }
      }

      console.log(`${ok} baris disalin${err > 0 ? `, ${err} error` : ""}`);
      totalCopied += ok;
      totalErrors += err;
    }

    // Aktifkan kembali FK triggers
    try {
      await vps.query("SET session_replication_role = DEFAULT;");
    } catch (_) {}

    console.log("\n─────────────────────────────────────");
    console.log(`✅ Transfer selesai!`);
    console.log(`   Total baris berhasil : ${totalCopied}`);
    console.log(`   Tabel dilewati       : ${totalSkipped}`);
    console.log(`   Error insert         : ${totalErrors}`);
    console.log("─────────────────────────────────────");

    if (totalErrors > 0) {
      console.log("\n⚠️  Ada beberapa error insert (bisa diabaikan jika karena ON CONFLICT DO NOTHING).");
    }

  } catch (err) {
    console.error("\n❌ Transfer gagal:", err.message);
    process.exit(1);
  } finally {
    await local.end().catch(() => {});
    await vps.end().catch(() => {});
  }
}

main();
