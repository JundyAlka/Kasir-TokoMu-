import { describe, expect, it, vi } from "vitest";
import { ProductCreateSchema } from "@/lib/server/validation";
import { handleRouteError } from "@/lib/server/route-error";

describe("handleRouteError", () => {
  it("never returns SQL, parameter values, or user identifiers to the client", async () => {
    const serverLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = handleRouteError(
      new Error('column "occurred_at" does not exist; params: ["usr_secret"]'),
      "Gagal memuat data aplikasi.",
      500
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Gagal memuat data aplikasi.",
      code: "REQUEST_FAILED",
    });
    expect(serverLog).toHaveBeenCalled();
  });

  it("returns a short public code for validation failures without field internals", async () => {
    const serverLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let validationError: unknown;
    try {
      ProductCreateSchema.parse({ name: "" });
    } catch (error) {
      validationError = error;
    }

    const response = handleRouteError(validationError, "Gagal menyimpan produk.");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Permintaan tidak valid.",
      code: "INVALID_REQUEST",
    });
    expect(serverLog).toHaveBeenCalled();
  });
});
