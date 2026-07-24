import { Client } from "pg";

async function run() {
  const client = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5439/warungos" });
  await client.connect();
  
  console.log("Executing ALTER TABLE...");
  try {
    await client.query(`ALTER TABLE "restock_plans" ADD COLUMN "estimated_price" integer DEFAULT 0 NOT NULL;`);
    console.log("Success");
  } catch(e) {
    console.log("Already exists or error", e.message);
  }
  await client.end();
}

run().catch(console.error);
