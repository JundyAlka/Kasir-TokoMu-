import { db, pool } from "../src/db/client";

async function main() {
  const result = await pool.query(`SELECT DISTINCT "user_id" FROM "transactions"`);
  console.log("Distinct User IDs in transactions:");
  console.table(result.rows);
  await pool.end();
}
main().catch(console.error);
