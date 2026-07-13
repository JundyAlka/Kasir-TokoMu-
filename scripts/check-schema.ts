import { pool } from '../src/db/client';

async function main() {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`
  );
  console.log('Columns in transactions:', result.rows.map(r => r.column_name).join(', '));

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
}

main().finally(() => pool.end());
