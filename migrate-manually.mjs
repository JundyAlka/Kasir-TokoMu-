import { Client } from "pg";
import fs from "fs";
import path from "path";

async function run() {
  const sqlPath = path.resolve("./drizzle/0015_lonely_scarecrow.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  const statements = sql.split("--> statement-breakpoint");

  const client = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5439/warungos" });
  await client.connect();
  
  for (const stmt of statements) {
    if (stmt.trim()) {
      console.log("Executing:", stmt.substring(0, 50) + "...");
      await client.query(stmt);
    }
  }
  await client.end();
  console.log("Done migration manually");
}

run().catch(console.error);
