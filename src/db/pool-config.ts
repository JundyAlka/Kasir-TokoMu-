import type { PoolConfig } from "pg";

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
  "db",
  "postgres",
]);

export function isSslDisabled(connectionString?: string): boolean {
  const envSslMode = (
    process.env.PGSSLMODE ||
    process.env.DATABASE_SSLMODE ||
    process.env.DB_SSLMODE ||
    process.env.SSLMODE ||
    ""
  )
    .trim()
    .toLowerCase();

  if (
    envSslMode === "disable" ||
    envSslMode === "allow" ||
    envSslMode === "false" ||
    envSslMode === "0"
  ) {
    return true;
  }

  const envDatabaseSsl = (
    process.env.DATABASE_SSL ||
    process.env.DB_SSL ||
    process.env.PGSSL ||
    ""
  )
    .trim()
    .toLowerCase();

  if (
    envDatabaseSsl === "false" ||
    envDatabaseSsl === "0" ||
    envDatabaseSsl === "disable" ||
    envDatabaseSsl === "off"
  ) {
    return true;
  }

  const target = (connectionString || process.env.DATABASE_URL || "").trim();
  if (!target) {
    return false;
  }

  if (
    /[?&]sslmode=disable(?:\b|&|$)/i.test(target) ||
    /[?&]ssl=false(?:\b|&|$)/i.test(target) ||
    /[?&]ssl=0(?:\b|&|$)/i.test(target) ||
    /[?&]sslmode=allow(?:\b|&|$)/i.test(target)
  ) {
    return true;
  }

  try {
    const url = new URL(target);
    const mode = url.searchParams.get("sslmode")?.trim().toLowerCase();
    if (mode === "disable" || mode === "allow") {
      return true;
    }

    const ssl = url.searchParams.get("ssl")?.trim().toLowerCase();
    if (ssl === "false" || ssl === "0" || ssl === "disable") {
      return true;
    }
  } catch {
    // If URL parsing fails, regex test above is sufficient
  }

  return false;
}

export function needsSsl(connectionString: string): boolean {
  if (isSslDisabled(connectionString)) {
    return false;
  }

  if (
    /[?&]sslmode=(?:require|prefer|verify-ca|verify-full)(?:\b|&|$)/i.test(
      connectionString
    )
  ) {
    return true;
  }

  try {
    const databaseUrl = new URL(connectionString);
    const sslMode = databaseUrl.searchParams.get("sslmode")?.trim().toLowerCase();

    if (sslMode === "disable") {
      return false;
    }

    if (
      sslMode &&
      ["require", "prefer", "verify-ca", "verify-full"].includes(sslMode)
    ) {
      return true;
    }

    return !LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");

    if (sslMode && ["require", "prefer", "verify-ca"].includes(sslMode)) {
      if (!url.searchParams.has("uselibpqcompat")) {
        url.searchParams.set("uselibpqcompat", "true");
      }
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

export function createPoolConfig(rawConnectionString: string): PoolConfig {
  const connectionString = normalizeConnectionString(rawConnectionString);
  const isTest = process.env.NODE_ENV === "test";
  const config: PoolConfig = {
    connectionString,
    max: process.env.PG_MAX_POOL ? parseInt(process.env.PG_MAX_POOL, 10) : 5,
    idleTimeoutMillis: isTest ? 2000 : 15000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  };

  if (needsSsl(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  } else {
    delete config.ssl;
  }

  return config;
}

