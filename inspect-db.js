const { Pool } = require('pg');

async function inspect() {
  const pool = new Pool({
    connectionString: "postgres://postgres:postgres@localhost:5439/warungos"
  });

  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_roles';
    `);
    console.log(res.rows);
  } catch (error) {
    console.error("Query failed:", error);
  } finally {
    await pool.end();
  }
}

inspect();
