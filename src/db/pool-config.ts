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
  const config: PoolConfig = { connectionString };

  if (needsSsl(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}
