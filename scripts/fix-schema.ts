import { pool } from '../src/db/client';

async function main() {
  await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_amount integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS change_amount integer NOT NULL DEFAULT 0`);
  console.log('✔ Columns paid_amount and change_amount added to transactions');

  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`
  );
  console.log('Columns now:', result.rows.map(r => r.column_name).join(', '));
}

main().finally(() => pool.end());
