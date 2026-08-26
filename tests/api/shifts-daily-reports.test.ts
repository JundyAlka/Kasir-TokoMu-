import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CASHIER_ID, WORKSPACE_ID, setupTestDb } from "../setup";

const OTHER_WORKSPACE = "usr_workspace_lain";
const OPENED_AT = "2026-08-09T01:00:00.000Z";

async function seedShift(
  pool: Awaited<ReturnType<typeof setupTestDb>>["pool"],
  id: string,
  workspaceOwnerId = WORKSPACE_ID,
  cashierUserId = CASHIER_ID
) {
  await pool.query(
    `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
     values ($1, $2, 'Shift Pagi', '00:00', '23:59', 1, $3)`,
    [id, workspaceOwnerId, OPENED_AT]
  );
  await pool.query(
    `insert into shift_sessions (
      id, workspace_owner_id, shift_id, cashier_user_id, started_at, opening_cash,
      opening_coins, opening_savings, status, opened_at
    ) values ($1, $2, $3, $4, $5, 1000, 0, 0, 'open', $5)`,
    [`session_${id}`, workspaceOwnerId, id, cashierUserId, OPENED_AT]
  );
}

describe("shifts and daily reports API", () => {
  it("allows kasir to open and see the current shift", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    await pool.query(
      `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
       values ('shift_cashier', $1, 'Shift Pagi', '00:00', '23:59', 1, $2)`,
      [WORKSPACE_ID, OPENED_AT]
    );
    const { POST: open } = await import("@/app/api/shifts/open/route");
    const { GET: current } = await import("@/app/api/shifts/current/route");

    const openResponse = await open(new NextRequest("http://localhost/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({ shiftId: "shift_cashier", openingCash: 1000, openingCoins: 0, openingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));
    expect(openResponse.status).toBe(200);

    const currentResponse = await current();
    expect(currentResponse.status).toBe(200);
    expect(await currentResponse.json()).toMatchObject({ session: { cashierUserId: CASHIER_ID } });
  });

  it("allows a cashier to record an expense in the cashier flow", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    await pool.query(
      `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
       values ('shift_expense', $1, 'Shift Pagi', '00:00', '23:59', 1, $2)`,
      [WORKSPACE_ID, OPENED_AT]
    );
    const { POST: open } = await import("@/app/api/shifts/open/route");
    const { POST: createExpense } = await import("@/app/api/expenses/route");
    await open(new NextRequest("http://localhost/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({ shiftId: "shift_expense", openingCash: 1000, openingCoins: 0, openingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));

    const response = await createExpense(new NextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: JSON.stringify({ title: "Beli es", amount: 5000, expenseType: "operasional" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    const expense = await response.json();
    expect(expense.expense.shiftSessionId).toBeTruthy();
  });

  it("lets a cashier open, record an expense, and close a shift while daily reports stay forbidden", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    await pool.query(
      `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
       values ('shift_cashier_flow', $1, 'Shift Pagi', '00:00', '23:59', 1, $2)`,
      [WORKSPACE_ID, OPENED_AT]
    );
    const { POST: open } = await import("@/app/api/shifts/open/route");
    const { POST: close } = await import("@/app/api/shifts/close/route");
    const { POST: createExpense } = await import("@/app/api/expenses/route");
    const { GET: dailyReports } = await import("@/app/api/daily-reports/route");

    const opened = await open(new NextRequest("http://localhost/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({ shiftId: "shift_cashier_flow", openingCash: 10000, openingCoins: 0, openingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));
    expect(opened.status).toBe(200);
    const { session } = await opened.json();

    expect((await createExpense(new NextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: JSON.stringify({ title: "Beli es", amount: 2000, expenseType: "operasional" }),
      headers: { "content-type": "application/json" },
    }))).status).toBe(200);
    expect((await close(new NextRequest("http://localhost/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: session.id, closingCash: 8000, closingCoins: 0, closingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }))).status).toBe(200);
    expect((await dailyReports(new NextRequest("http://localhost/api/daily-reports"))).status).toBe(403);
  });

  it("allows finance to close a shift, but rejects kasir from daily reports", async () => {
    const finance = await setupTestDb({ role: "pengelola_keuangan" });
    await seedShift(finance.pool, "shift_finance");
    const { POST: close } = await import("@/app/api/shifts/close/route");
    const closeResponse = await close(new NextRequest("http://localhost/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session_shift_finance", closingCash: 1000, closingCoins: 0, closingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));
    expect(closeResponse.status).toBe(200);

    await setupTestDb({ role: "kasir" });
    const { GET } = await import("@/app/api/daily-reports/route");
    const { POST: lock } = await import("@/app/api/daily-reports/lock/route");
    expect((await GET(new NextRequest("http://localhost/api/daily-reports"))).status).toBe(403);
    expect((await lock(new NextRequest("http://localhost/api/daily-reports/lock", {
      method: "POST",
      body: JSON.stringify({ reportDate: "2026-08-09" }),
      headers: { "content-type": "application/json" },
    }))).status).toBe(403);
  });

  it.each(["pimpinan", "pengelola_keuangan", "kasir"] as const)("allows %s to open, close, and read current shift", async (role) => {
    const { pool } = await setupTestDb({ role });
    await pool.query(
      `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
       values ('shift_role', $1, 'Shift Pagi', '00:00', '23:59', 1, $2)`,
      [WORKSPACE_ID, OPENED_AT]
    );
    const { POST: open } = await import("@/app/api/shifts/open/route");
    const { POST: close } = await import("@/app/api/shifts/close/route");
    const { GET: current } = await import("@/app/api/shifts/current/route");
    const openResponse = await open(new NextRequest("http://localhost/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({ shiftId: "shift_role", openingCash: 1000, openingCoins: 0, openingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));
    expect(openResponse.status).toBe(200);
    const { session } = await openResponse.json();
    expect((await current()).status).toBe(200);
    expect((await close(new NextRequest("http://localhost/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: session.id, closingCash: 1000, closingCoins: 0, closingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }))).status).toBe(200);
  });

  it.each(["pimpinan", "pengelola_keuangan"] as const)("allows %s to read and lock daily reports", async (role) => {
    await setupTestDb({ role });
    const { GET } = await import("@/app/api/daily-reports/route");
    const { POST } = await import("@/app/api/daily-reports/lock/route");
    expect((await GET(new NextRequest("http://localhost/api/daily-reports?start=2026-08-01&end=2026-09-01"))).status).toBe(200);
    expect((await POST(new NextRequest("http://localhost/api/daily-reports/lock", {
      method: "POST",
      body: JSON.stringify({ reportDate: "2026-08-09" }),
      headers: { "content-type": "application/json" },
    }))).status).toBe(200);
  });

  it("limits a cashier shift list to the cashier's own sessions", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    await seedShift(pool, "shift_mine", WORKSPACE_ID, CASHIER_ID);
    await pool.query(
      `update shift_sessions set status = 'closed', ended_at = $2, closed_at = $2, closing_cash = 1000
       where id = 'session_shift_mine'`,
      [WORKSPACE_ID, "2026-08-09T02:00:00.000Z"]
    );
    await seedShift(pool, "shift_other_cashier", WORKSPACE_ID, WORKSPACE_ID);
    await pool.query(
      `update shift_sessions set status = 'closed', ended_at = $2, closed_at = $2, closing_cash = 1000
       where id = 'session_shift_other_cashier'`,
      [WORKSPACE_ID, "2026-08-09T02:00:00.000Z"]
    );
    const { GET } = await import("@/app/api/shifts/route");
    const response = await GET(new NextRequest("http://localhost/api/shifts?start=2026-08-08T17:00:00.000Z&end=2026-08-10T17:00:00.000Z"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.shifts).toEqual(expect.arrayContaining([expect.objectContaining({ cashierUserId: CASHIER_ID })]));
    expect(body.shifts).not.toEqual(expect.arrayContaining([expect.objectContaining({ cashierUserId: WORKSPACE_ID })]));
  });

  it("returns 404 instead of 403 for a shift id owned by another workspace", async () => {
    const { pool } = await setupTestDb({ role: "pimpinan" });
    await seedShift(pool, "shift_foreign", OTHER_WORKSPACE, OTHER_WORKSPACE);
    const { POST } = await import("@/app/api/shifts/close/route");
    const response = await POST(new NextRequest("http://localhost/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session_shift_foreign", closingCash: 1000, closingCoins: 0, closingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when a cashier tries to close another cashier's shift", async () => {
    const { pool } = await setupTestDb({ role: "kasir" });
    await seedShift(pool, "shift_other_cashier", WORKSPACE_ID, WORKSPACE_ID);
    const { POST } = await import("@/app/api/shifts/close/route");
    const response = await POST(new NextRequest("http://localhost/api/shifts/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session_shift_other_cashier", closingCash: 1000, closingCoins: 0, closingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(404);

    const { POST: legacyClose } = await import("@/app/api/shift-sessions/[id]/close/route");
    const legacyResponse = await legacyClose(new NextRequest("http://localhost/api/shift-sessions/session_shift_other_cashier/close", {
      method: "POST",
      body: JSON.stringify({ closingCash: 1000 }),
      headers: { "content-type": "application/json" },
    }), { params: Promise.resolve({ id: "session_shift_other_cashier" }) });
    expect(legacyResponse.status).toBe(404);
  });

  it("returns 404 for a foreign shift id while opening", async () => {
    const { pool } = await setupTestDb({ role: "pimpinan" });
    await pool.query(
      `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
       values ('shift_foreign_open', $1, 'Shift Lain', '00:00', '23:59', 1, $2)`,
      [OTHER_WORKSPACE, OPENED_AT]
    );
    const { POST } = await import("@/app/api/shifts/open/route");
    const response = await POST(new NextRequest("http://localhost/api/shifts/open", {
      method: "POST",
      body: JSON.stringify({ shiftId: "shift_foreign_open", openingCash: 0, openingCoins: 0, openingSavings: 0 }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(404);
  });
});
