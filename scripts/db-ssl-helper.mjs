/**
 * Helper to dynamically manage PostgreSQL SSL configuration for scripts and migrations.
 * Detects sslmode=disable in .env or connection strings and strips ssl config so
 * local Docker PostgreSQL connections succeed without requiring SSL certificates.
 */

const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'host.docker.internal',
  'db',
  'postgres',
]);

export function isSslDisabled(connectionString) {
  const envSslMode = (
    process.env.PGSSLMODE ||
    process.env.DATABASE_SSLMODE ||
    process.env.DB_SSLMODE ||
    process.env.SSLMODE ||
    ''
  ).trim().toLowerCase();

  if (
    envSslMode === 'disable' ||
    envSslMode === 'allow' ||
    envSslMode === 'false' ||
    envSslMode === '0'
  ) {
    return true;
  }

  const envDatabaseSsl = (
    process.env.DATABASE_SSL ||
    process.env.DB_SSL ||
    process.env.PGSSL ||
    ''
  ).trim().toLowerCase();

  if (
    envDatabaseSsl === 'false' ||
    envDatabaseSsl === '0' ||
    envDatabaseSsl === 'disable' ||
    envDatabaseSsl === 'off'
  ) {
    return true;
  }

  const target = (connectionString || process.env.DATABASE_URL || '').trim();
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
    const mode = url.searchParams.get('sslmode')?.trim().toLowerCase();
    if (mode === 'disable' || mode === 'allow') {
      return true;
    }

    const ssl = url.searchParams.get('ssl')?.trim().toLowerCase();
    if (ssl === 'false' || ssl === '0' || ssl === 'disable') {
      return true;
    }
  } catch {
    // If URL parsing fails, regex check already covered it
  }

  return false;
}

export function shouldUseSsl(connectionString) {
  if (isSslDisabled(connectionString)) {
    return false;
  }

  const target = (connectionString || process.env.DATABASE_URL || '').trim();
  if (
    /[?&]sslmode=(?:require|prefer|verify-ca|verify-full)(?:\b|&|$)/i.test(target)
  ) {
    return true;
  }

  try {
    const url = new URL(target);
    const mode = url.searchParams.get('sslmode')?.trim().toLowerCase();
    if (mode === 'disable') {
      return false;
    }
    if (mode && ['require', 'prefer', 'verify-ca', 'verify-full'].includes(mode)) {
      return true;
    }
    return !LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getPoolConfig(connectionString, extraOptions = {}) {
  const conn = (connectionString || process.env.DATABASE_URL || '').trim();
  const config = {
    connectionString: conn,
    ...extraOptions,
  };

  if (shouldUseSsl(conn)) {
    config.ssl = { rejectUnauthorized: false };
  } else {
    delete config.ssl;
  }

  return config;
}

export function getClientConfig(connectionString, extraOptions = {}) {
  return getPoolConfig(connectionString, extraOptions);
}
