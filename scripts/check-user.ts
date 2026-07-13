import { pool } from "../src/db/client";

async function main() {
  const users = await pool.query(`SELECT id, email FROM "user"`);
  console.log("Users in DB:");
  console.table(users.rows);
  await pool.end();
}
main().catch(console.error);
