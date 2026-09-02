/**
 * Migrasi database production InsForge
 * - Cek _migration_log, jika kosong tapi DB sudah ada → seed log dulu
 * - Hanya jalankan migration file yang belum ada di log
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL tidak diset!');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function run() {
  await client.connect();
  console.log('✅ Terhubung ke database production InsForge\n');

  // 1. Buat tabel tracking migrasi jika belum ada
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migration_log (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 2. Cek apakah log kosong tapi database sudah ada (migrasi pernah dijalankan manual)
  const { rows: logRows } = await client.query('SELECT COUNT(*) as cnt FROM _migration_log');
  const logCount = parseInt(logRows[0].cnt, 10);

  if (logCount === 0) {
    // Cek apakah tabel utama sudah ada
    const { rows: tableRows } = await client.query(`
      SELECT COUNT(*) as cnt FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('products', 'transactions', 'debts', 'users')
    `);
    const tableCount = parseInt(tableRows[0].cnt, 10);

    if (tableCount > 0) {
      // DB sudah ada tapi log kosong → seed log dengan semua migration lama
      console.log('⚠️  _migration_log kosong tapi skema DB sudah ada.');
      console.log('   Menginisialisasi log dari migration files yang sudah ada...\n');

      const allFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of allFiles) {
        await client.query(
          'INSERT INTO _migration_log (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        console.log(`  📝 Ditandai sudah dijalankan: ${file}`);
      }
      console.log('\n✅ Inisialisasi log selesai.');
    }
  }

  // 3. Ambil migration yang sudah diaplikasikan
  const { rows: applied } = await client.query(
    'SELECT filename FROM _migration_log ORDER BY filename'
  );
  const appliedSet = new Set(applied.map(r => r.filename));
  console.log(`\n📋 Total migration sudah diaplikasikan: ${appliedSet.size}`);

  // 4. Baca semua file migration, urutkan secara leksikografis
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pending = files.filter(f => !appliedSet.has(f));
  console.log(`🔍 Migration pending (belum dijalankan): ${pending.length}\n`);

  if (pending.length === 0) {
    console.log('✅ Database sudah up-to-date! Tidak ada migration baru.');
    await client.end();
    return;
  }

  let ran = 0;
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`  🔄 Menjalankan: ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migration_log (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✅ Berhasil: ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`\n  ❌ GAGAL: ${file}`);
      console.error(`     Error: ${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\n🎉 Migrasi selesai! ${ran} migration baru dijalankan.`);
  await client.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
