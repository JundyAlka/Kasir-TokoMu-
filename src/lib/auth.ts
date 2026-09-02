import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { pool } from "@/db/client";

function toOrigin(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return new URL(value).origin;
  }

  return `https://${value}`;
}

function getTrustedAuthOrigins(request?: Request) {
  const origins = new Set<string>([
    "http://localhost:8090",
    "http://localhost:3030",
    "http://localhost:3000",
    "http://127.0.0.1:3030",
    "http://127.0.0.1:3000",
  ]);

  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]) {
    if (!value) {
      continue;
    }

    origins.add(toOrigin(value));
  }

  // Support daftar origin tambahan dipisah koma
  // Contoh: BETTER_AUTH_TRUSTED_ORIGINS=https://domain.com,http://1.2.3.4:3000
  const extraOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (extraOrigins) {
    for (const raw of extraOrigins.split(",")) {
      const trimmed = raw.trim();
      if (trimmed) origins.add(toOrigin(trimmed));
    }
  }

  if (request) {
    origins.add(new URL(request.url).origin);
  }

  return Array.from(origins);
}

function resolveAuthBaseUrl() {
  const localPort = process.env.PORT;

  if (localPort && process.env.BETTER_AUTH_URL) {
    const configuredUrl = new URL(process.env.BETTER_AUTH_URL);

    if (
      configuredUrl.hostname === "localhost" &&
      configuredUrl.port &&
      configuredUrl.port !== localPort
    ) {
      configuredUrl.port = localPort;
      return configuredUrl.toString().replace(/\/$/, "");
    }
  }

  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_BRANCH_URL ??
    process.env.VERCEL_URL;

  if (vercelHost) {
    // Vercel exposes hostnames without a protocol.
    return `https://${vercelHost}`;
  }

  return `http://localhost:${localPort ?? "3000"}`;
}

export const auth = betterAuth({
  database: pool,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "warungos-dev-secret-please-change-this-in-production",
  baseURL: resolveAuthBaseUrl(),
  // RBAC uses session.user.id as the stable key and resolves workspace roles server-side.
  trustedOrigins: async (request) => getTrustedAuthOrigins(request),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [bearer()],
});
