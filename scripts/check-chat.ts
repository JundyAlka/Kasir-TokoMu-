import { pool } from "../src/db/client";
async function main() {
  const chats = await pool.query(`SELECT id, "user_id", title FROM "ai_chats"`);
  console.log("CHATS:");
  console.table(chats.rows);
  const msgs = await pool.query(`SELECT id, "user_id", "chat_id" FROM "ai_messages"`);
  console.log("MESSAGES:");
  console.table(msgs.rows);
  await pool.end();
}
main().catch(console.error);
