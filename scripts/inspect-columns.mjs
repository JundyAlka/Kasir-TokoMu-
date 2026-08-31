import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  const res = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const tables = {};
  for (const row of res.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(`${row.column_name} (${row.data_type}, nullable:${row.is_nullable}, default:${row.column_default})`);
  }

  for (const [tableName, cols] of Object.entries(tables)) {
    console.log(`\n=== ${tableName} ===`);
    console.log(cols.join('\n  '));
  }

  await pool.end();
}

main().catch(console.error);
