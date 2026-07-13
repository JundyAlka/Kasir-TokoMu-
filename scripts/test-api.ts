import { pool } from "../src/db/client";

async function main() {
  const userId = "qgbiufcgwgu2bCUNwn7AZrv3L58MLF8i";
  
  const chats = await pool.query("SELECT id FROM ai_chats WHERE \"user_id\" = $1 ORDER BY \"created_at\" DESC LIMIT 1", [userId]);
  const chatId = chats.rows[0]?.id;
  if (!chatId) {
    console.log("No chat found");
    return;
  }
  
  console.log("Calling POST /api/ai/chats/" + chatId + "/messages");
  
  const r = await fetch(`http://localhost:3030/api/ai/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-123",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: "test ping" })
  });
  
  const status = r.status;
  const text = await r.text();
  console.log("STATUS:", status);
  console.log("BODY:", text);
  
  await pool.end();
}

main().catch(console.error);
