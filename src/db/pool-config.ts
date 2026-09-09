import type { PoolConfig } from "pg";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function needsSsl(connectionString: string) {
  const databaseUrl = new URL(connectionString);
  const sslMode = databaseUrl.searchParams.get("sslmode");

  if (sslMode === "disable") {
    return false;
  }

  return !LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname);
}

export function createPoolConfig(connectionString: string): PoolConfig {
  const isTest = process.env.NODE_ENV === "test";
  const config: PoolConfig = {
    connectionString,
    max: process.env.PG_MAX_POOL ? parseInt(process.env.PG_MAX_POOL, 10) : 10,
    idleTimeoutMillis: isTest ? 2000 : 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: isTest,
  };

  if (needsSsl(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}
