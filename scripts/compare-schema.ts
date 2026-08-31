import { Pool } from 'pg';
import { getTableColumns, getTableName, isTable } from 'drizzle-orm';
import * as schema from '../src/db/schema';

const url = process.env.DATABASE_URL;

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  const res = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public';
  `);

  const dbTables: Record<string, Set<string>> = {};
  for (const row of res.rows) {
    if (!dbTables[row.table_name]) dbTables[row.table_name] = new Set();
    dbTables[row.table_name].add(row.column_name);
  }

  console.log('--- TABLES IN SCHEMA VS DB ---');
  for (const [exportName, tableObj] of Object.entries(schema)) {
    if (!isTable(tableObj)) continue;
    const tableName = getTableName(tableObj);

    if (!dbTables[tableName]) {
      console.log(`❌ TABLE MISSING: ${tableName}`);
      continue;
    }

    const columns = getTableColumns(tableObj);
    const missingCols: string[] = [];
    for (const col of Object.values(columns)) {
      if (!dbTables[tableName].has(col.name)) {
        missingCols.push(col.name);
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
