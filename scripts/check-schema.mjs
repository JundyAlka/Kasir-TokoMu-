import { pool } from '../src/db/client.js';

const result = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`
);
console.log('Columns in transactions:', result.rows.map(r => r.column_name).join(', '));
await pool.end();
