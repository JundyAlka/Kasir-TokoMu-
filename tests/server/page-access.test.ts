import { describe, expect, it, vi } from "vitest";

describe("restricted dashboard page access", () => {
  it("redirects cashier URL access to the dashboard instead of rendering a forbidden page", async () => {
    vi.resetModules();
    const redirect = vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    });
    vi.doMock("next/navigation", () => ({ redirect }));
    vi.doMock("@/lib/server/app-service", () => ({
      getRequestUser: vi.fn(async () => ({ role: "kasir" })),
    }));

    const { redirectCashierFromFinancePage } = await import("@/lib/server/page-access");
    await expect(redirectCashierFromFinancePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard?notice=akses-dibatasi");
  });

  it("keeps finance pages available to pengelola_keuangan", async () => {
    vi.resetModules();
    const redirect = vi.fn();
    vi.doMock("next/navigation", () => ({ redirect }));
    vi.doMock("@/lib/server/app-service", () => ({
      getRequestUser: vi.fn(async () => ({ role: "pengelola_keuangan", userId: "finance_1" })),
    }));

    const { redirectCashierFromFinancePage } = await import("@/lib/server/page-access");
    await expect(redirectCashierFromFinancePage()).resolves.toMatchObject({ role: "pengelola_keuangan" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
