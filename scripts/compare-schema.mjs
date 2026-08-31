import { Pool } from 'pg';
import * as schema from '../src/db/schema.js';

const url = process.env.DATABASE_URL;

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  // Fetch all db tables and columns
  const res = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public';
  `);

  const dbTables = {};
  for (const row of res.rows) {
    if (!dbTables[row.table_name]) dbTables[row.table_name] = new Set();
    dbTables[row.table_name].add(row.column_name);
  }

  console.log('--- TABLES IN SCHEMA VS DB ---');
  for (const [exportName, tableObj] of Object.entries(schema)) {
    if (!tableObj || typeof tableObj !== 'object' || !('_' in tableObj)) continue;
    const tableName = tableObj[Symbol.for('drizzle:Name')] || tableObj._.name;
    if (!tableName) continue;

    if (!dbTables[tableName]) {
      console.log(`❌ TABLE MISSING: ${tableName}`);
      continue;
    }

    const schemaCols = Object.keys(tableObj._.columns || {});
    const missingCols = [];
    for (const colKey of schemaCols) {
      const colName = tableObj[colKey]?.name || colKey;
      if (!dbTables[tableName].has(colName)) {
        missingCols.push(colName);
      }
    }

    if (missingCols.length > 0) {
      console.log(`⚠️ TABLE ${tableName} MISSING COLUMNS: ${missingCols.join(', ')}`);
    } else {
      console.log(`✅ TABLE ${tableName} IS SYNCED`);
    }
  }

  await pool.end();
}

main().catch(console.error);
