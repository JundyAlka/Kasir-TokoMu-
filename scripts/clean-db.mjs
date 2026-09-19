import pg from "pg";
import { getPoolConfig } from "./db-ssl-helper.mjs";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:7a3487df62b84e9a4f03c459bc530e56@ehtm9kdz.ap-southeast.database.insforge.app:5432/insforge?sslmode=require&uselibpqcompat=true";

const pool = new Pool(getPoolConfig(connectionString));


async function main() {
  console.log("Setting database timeouts...");
  await pool.query("ALTER DATABASE insforge SET idle_session_timeout = '30s';");
  await pool.query("ALTER ROLE postgres SET idle_session_timeout = '30s';");
  await pool.query("ALTER DATABASE insforge SET idle_in_transaction_session_timeout = '60s';");

  console.log("Terminating zombie idle connections...");
  const res = await pool.query(`
    SELECT pid, application_name, state, query, backend_start,
           pg_terminate_backend(pid) as terminated
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid()
      AND state = 'idle'
      AND query NOT LIKE 'LISTEN%';
  `);

  console.log(`Terminated ${res.rows.length} zombie connections.`);

  const status = await pool.query(`
    SELECT state, count(*) 
    FROM pg_stat_activity 
    GROUP BY state;
  `);
  console.log("Current connection states:", status.rows);
}

main()
  .catch(console.error)
  .finally(() => pool.end());
