import { Client } from 'pg';

const localUrl = "postgres://postgres:postgres@localhost:5439/warungos";
const remoteUrl = "postgresql://postgres:0a8d012736ad8dabcd543d58c94fed1c@rnuh6nq3.us-east.database.insforge.app:5432/insforge?sslmode=require";

const tables = [
  "user", "session", "account", "verification",
  "store_profiles", "user_roles", "invitations",
  "investors", "products", "investments", "investor_payouts",
  "shifts", "shift_sessions", "transactions", "transaction_items",
  "debts", "debt_items", "debt_payments",
  "expenses", "restock_logs", "monthly_reports",
  "ai_chats", "ai_messages", "audit_logs"
];

async function main() {
  const localClient = new Client({ connectionString: localUrl });
  const remoteClient = new Client({ connectionString: remoteUrl });

  try {
    console.log("Connecting to local database...");
    await localClient.connect();
    console.log("Connecting to remote database...");
    await remoteClient.connect();

    console.log("Disabling foreign key constraints on remote...");
    try {
      await remoteClient.query("SET session_replication_role = replica;");
    } catch (e) {
      console.log("Could not disable triggers, relying on insertion order.", e.message);
    }

    for (const table of tables) {
      console.log(`Copying table: ${table}...`);
      
      let res;
      try {
          res = await localClient.query(`SELECT * FROM "${table}"`);
      } catch (e) {
          console.log(`Table ${table} might not exist in local. Skipping.`);
          continue;
      }
      
      const rows = res.rows;
      if (rows.length === 0) {
        console.log(`  No rows to copy for ${table}.`);
        continue;
      }
      
      const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
      const paramIndexes = Object.keys(rows[0]).map((_, i) => '$' + (i + 1)).join(', ');
      const queryText = `INSERT INTO "${table}" (${columns}) VALUES (${paramIndexes}) ON CONFLICT DO NOTHING`;
      
      for (let i = 0; i < rows.length; i++) {
        const values = Object.values(rows[i]).map(val => {
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        
        try {
            await remoteClient.query(queryText, values);
        } catch (e) {
            console.error(`  Error inserting row into ${table}:`, e.message);
        }
      }
      
      console.log(`  Copied ${rows.length} rows for ${table}.`);
    }
    
    try {
      await remoteClient.query("SET session_replication_role = DEFAULT;");
    } catch (e) {}

    console.log("Data migration completed successfully!");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

main();
