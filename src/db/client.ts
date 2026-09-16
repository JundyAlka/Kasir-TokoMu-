import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { createPoolConfig } from "@/db/pool-config";

const globalForDatabase = globalThis as typeof globalThis & {
  __warungosPool?: Pool;
  __warungosDb?: ReturnType<typeof drizzle>;
};

function createPool() {
  const p = new Pool(
    createPoolConfig(
      process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@127.0.0.1:5432/warungos"
    )
  );

  p.on("error", (err) => {
    console.error("PostgreSQL client pool error:", err.message);
  });

  return p;
}

export const pool = globalForDatabase.__warungosPool ?? createPool();
globalForDatabase.__warungosPool = pool;

export const db = globalForDatabase.__warungosDb ?? drizzle({ client: pool, schema });
globalForDatabase.__warungosDb = db;
