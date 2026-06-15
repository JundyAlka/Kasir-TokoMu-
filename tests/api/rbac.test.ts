import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb } from "../setup";

describe("RBAC investors API", () => {
  it("rejects kasir with 403", async () => {
    await setupTestDb({ role: "kasir" });
    const { GET } = await import("@/app/api/investors/route");

    const response = await GET(new NextRequest("http://localhost/api/investors"));
    expect(response.status).toBe(403);
  });

  it("allows pimpinan with 200", async () => {
    await setupTestDb({ role: "pimpinan" });
    const { GET } = await import("@/app/api/investors/route");

    const response = await GET(new NextRequest("http://localhost/api/investors"));
    const body = await response.json();
    expect({ status: response.status, body }).toMatchObject({ status: 200 });
  });
});
