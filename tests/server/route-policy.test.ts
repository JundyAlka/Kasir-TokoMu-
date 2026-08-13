import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { requireRoutePolicy, routePolicy } from "@/lib/server/route-policy";

const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return routeFiles(entryPath);
      return entry.name === "route.ts" ? [entryPath] : [];
    })
  );
  return nested.flat();
}

function apiPath(routeFile: string) {
  const relative = path.relative(path.join(process.cwd(), "src", "app", "api"), path.dirname(routeFile));
  return `/api/${relative.split(path.sep).join("/")}`.replace(/\/api\/$/, "/api");
}

function exportedMethods(source: string) {
  const methods = new Set<string>();
  for (const match of source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)) {
    methods.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+const\s+\{\s*([^}]+)\s*\}\s*=\s*toNextJsHandler/g)) {
    for (const method of match[1].matchAll(/\b(GET|POST|PATCH|PUT|DELETE)\b/g)) methods.add(method[1]);
  }
  return [...methods] as (typeof HTTP_METHODS)[number][];
}

describe("route policy coverage", () => {
  it("denies an unregistered path before reading any user session", async () => {
    await expect(requireRoutePolicy("/api/not-registered", "GET")).rejects.toThrow("FORBIDDEN");
  });

  it("registers every exported API route method and routes private handlers through the policy helper", async () => {
    const files = await routeFiles(path.join(process.cwd(), "src", "app", "api"));

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const policy = routePolicy[apiPath(file)];

      for (const method of exportedMethods(source)) {
        expect(policy?.[method], `${apiPath(file)} ${method} is missing from route-policy.ts`).toBeDefined();
        if (policy?.[method] !== "public" && !apiPath(file).startsWith("/api/auth/")) {
          expect(source, `${apiPath(file)} ${method} bypasses requireRoutePolicy`).toContain("requireRoutePolicy");
        }
      }
    }
  });
});
