import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('--- TABLE ROW COUNTS ---');
  for (const row of res.rows) {
    try {
      const countRes = await pool.query(`SELECT count(*) FROM "${row.table_name}"`);
      console.log(`${row.table_name.padEnd(30)}: ${countRes.rows[0].count}`);
    } catch (e) {
      console.log(`${row.table_name.padEnd(30)}: ERROR: ${e.message}`);
    }
  }

  console.log('\n--- USERS ---');
  const users = await pool.query(`SELECT id, email, name, role FROM "user"`);
  console.log(users.rows);

  console.log('\n--- USER ROLES ---');
  const userRoles = await pool.query(`SELECT * FROM user_roles`);
  console.log(userRoles.rows);

  console.log('\n--- STORE PROFILES ---');
  const stores = await pool.query(`SELECT * FROM store_profiles`);
  console.log(stores.rows);

  await pool.end();
}

main().catch(console.error);
