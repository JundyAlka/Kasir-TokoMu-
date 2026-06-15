import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/warungos";

const pool = new Pool({ connectionString });

async function waitUntilReady() {
  let lastError;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

try {
  await waitUntilReady();
  await pool.query(`
    drop schema if exists drizzle cascade;
    drop schema if exists public cascade;
    create schema public;
    grant all on schema public to postgres;
    grant all on schema public to public;
  `);
  console.log("Database schema reset complete.");
} finally {
  await pool.end();
}
