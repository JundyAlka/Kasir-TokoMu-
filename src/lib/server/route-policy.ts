import { getRequestUser } from "@/lib/server/app-service";
import type { Role } from "@/lib/server/rbac";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type RouteAccess = readonly Role[] | "public";
type RoutePolicy = Partial<Record<HttpMethod, RouteAccess>>;

const ALL_ROLES = ["pimpinan", "pengelola_keuangan", "kasir"] as const satisfies readonly Role[];
const FINANCE_ROLES = ["pimpinan", "pengelola_keuangan"] as const satisfies readonly Role[];
const LEADERSHIP_ONLY = ["pimpinan"] as const satisfies readonly Role[];

/**
 * Single source of truth for API access. An absent path or method is denied by
 * requireRoutePolicy so a newly-created route cannot silently become public.
 */
export const routePolicy: Record<string, RoutePolicy> = {
  "/api/ai/chats": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/ai/chats/[id]": { DELETE: FINANCE_ROLES },
  "/api/ai/chats/[id]/messages": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/ai/scan-receipt": { POST: ALL_ROLES },
  "/api/ai/tools/commit": { POST: ALL_ROLES },
  "/api/audit-log": { GET: LEADERSHIP_ONLY },
  "/api/audit-log/export": { GET: LEADERSHIP_ONLY },
  "/api/auth/[...all]": { GET: "public", POST: "public" },
  "/api/bootstrap": { GET: ALL_ROLES },
  "/api/bootstrap/reset": { POST: LEADERSHIP_ONLY },
  "/api/dashboard/detail": { GET: ALL_ROLES },
  "/api/debts": { POST: ALL_ROLES },
  "/api/debts/[id]": { GET: ALL_ROLES, PATCH: ALL_ROLES },
  "/api/debts/[id]/payments": { POST: ALL_ROLES },
  "/api/debts/[id]/remind": { POST: ALL_ROLES },
  "/api/expenses": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/investments": { GET: FINANCE_ROLES, POST: FINANCE_ROLES },
  "/api/investments/batch": { POST: FINANCE_ROLES },
  "/api/investments/[id]": { PATCH: FINANCE_ROLES, DELETE: FINANCE_ROLES },
  "/api/investors": { GET: FINANCE_ROLES, POST: FINANCE_ROLES },
  "/api/investors/[id]": { GET: FINANCE_ROLES, PATCH: FINANCE_ROLES, DELETE: FINANCE_ROLES },
  "/api/kas-movements": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/titipan-intakes": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/payouts": { GET: FINANCE_ROLES, POST: FINANCE_ROLES },
  "/api/payouts/calculate": { POST: FINANCE_ROLES },
  "/api/payouts/[id]": { PATCH: FINANCE_ROLES },
  "/api/products": { POST: ALL_ROLES, DELETE: ALL_ROLES },
  "/api/products/import": { POST: ALL_ROLES },
  "/api/products/[id]": { PATCH: ALL_ROLES, DELETE: ALL_ROLES },
  "/api/products/[id]/restock": { POST: ALL_ROLES },
  "/api/reports/assets": { GET: ALL_ROLES },
  "/api/reports/cashier-ledger": { GET: ALL_ROLES },
  "/api/reports/monthly": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/reports/monthly-pcm": { GET: LEADERSHIP_ONLY, POST: LEADERSHIP_ONLY, PATCH: LEADERSHIP_ONLY },
  "/api/reports/monthly-pcm/[id]/pdf": { GET: LEADERSHIP_ONLY },
  "/api/reports/profit-loss": { GET: ALL_ROLES },
  "/api/reports/profit-loss/pdf": { GET: ALL_ROLES },
  "/api/restock/batch": { POST: ALL_ROLES },
  "/api/restock/history": { GET: ALL_ROLES },
  "/api/restock-plans": { GET: ALL_ROLES, POST: ALL_ROLES, PATCH: ALL_ROLES },
  "/api/session/[intent]": { POST: "public" },
  "/api/settings": { PUT: LEADERSHIP_ONLY },
  "/api/shift-sessions": { GET: ALL_ROLES, POST: ALL_ROLES },
  "/api/shift-sessions/[id]/close": { POST: ALL_ROLES },
  "/api/shifts": { GET: ALL_ROLES, POST: LEADERSHIP_ONLY },
  "/api/shifts/open": { POST: ALL_ROLES },
  "/api/shifts/close": { POST: ALL_ROLES },
  "/api/shifts/current": { GET: ALL_ROLES },
  "/api/shifts/[id]": { PATCH: LEADERSHIP_ONLY, DELETE: LEADERSHIP_ONLY },
  "/api/daily-reports": { GET: FINANCE_ROLES },
  "/api/daily-reports/lock": { POST: FINANCE_ROLES },
  "/api/transactions": { POST: ALL_ROLES },
  "/api/transactions/import": { GET: FINANCE_ROLES },
  "/api/transactions/import/preview": { POST: FINANCE_ROLES },
  "/api/transactions/import/aliases": { POST: FINANCE_ROLES },
  "/api/transactions/import/commit": { POST: FINANCE_ROLES },
  "/api/transactions/import/rollback": { POST: FINANCE_ROLES },
  "/api/users": { GET: LEADERSHIP_ONLY },
  "/api/users/invite": { POST: LEADERSHIP_ONLY },
  "/api/users/[id]": { PATCH: LEADERSHIP_ONLY, DELETE: LEADERSHIP_ONLY },
  "/api/users/[id]/role": { PATCH: LEADERSHIP_ONLY },
  "/api/users/[id]/salary": { PATCH: LEADERSHIP_ONLY },
  "/api/users/[id]/password": { POST: LEADERSHIP_ONLY },
};

export async function requireRoutePolicy(
  path: string,
  method: HttpMethod
): Promise<Awaited<ReturnType<typeof getRequestUser>>> {
  const access = routePolicy[path]?.[method];
  if (!access) throw new Error("FORBIDDEN");
  if (access === "public") throw new Error("PUBLIC_ROUTE_HAS_NO_USER_CONTEXT");

  const user = await getRequestUser();
  if (!access.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
