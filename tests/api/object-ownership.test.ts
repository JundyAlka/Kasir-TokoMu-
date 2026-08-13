import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb } from "../setup";

const OTHER_WORKSPACE_ID = "usr_workspace_lain";
const timestamp = "2026-06-11T03:00:00.000Z";

describe("API object ownership", () => {
  it("returns 404 for a debt from another workspace", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into debts (id, user_id, borrower_name, whatsapp, amount, paid_amount, status, created_at, is_paid)
       values ('debt_other', $1, 'Toko Lain', '', 5000, 0, 'aktif', $2, 0)`,
      [OTHER_WORKSPACE_ID, timestamp]
    );

    const { GET } = await import("@/app/api/debts/[id]/route");
    const response = await GET(new NextRequest("http://localhost/api/debts/debt_other"), {
      params: Promise.resolve({ id: "debt_other" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for an investor from another workspace", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into investors (id, workspace_owner_id, name, whatsapp, address, notes, is_active, created_at, updated_at)
       values ('inv_other', $1, 'Investor Lain', '', '', '', 1, $2, $2)`,
      [OTHER_WORKSPACE_ID, timestamp]
    );

    const { GET } = await import("@/app/api/investors/[id]/route");
    const response = await GET(new NextRequest("http://localhost/api/investors/inv_other"), {
      params: Promise.resolve({ id: "inv_other" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a payout from another workspace", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into investor_payouts (
        id, investment_id, investor_id, workspace_owner_id, period_start, period_end,
        base_profit, share_pct, amount, status, note, created_at, updated_at
      ) values ('pay_other', 'investment_other', 'inv_other', $1, $2, $2, 1000, 10, 100, 'draft', '', $2, $2)`,
      [OTHER_WORKSPACE_ID, timestamp]
    );

    const { PATCH } = await import("@/app/api/payouts/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/payouts/pay_other", {
        method: "PATCH",
        body: JSON.stringify({ status: "disetujui" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "pay_other" }) }
    );
    expect(response.status).toBe(404);
  });

  it("returns 404 for another user's AI chat", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into ai_chats (id, user_id, title, created_at, updated_at)
       values ('chat_other', $1, 'Privat', $2, $2)`,
      [OTHER_WORKSPACE_ID, timestamp]
    );

    const { GET } = await import("@/app/api/ai/chats/[id]/messages/route");
    const response = await GET(new NextRequest("http://localhost/api/ai/chats/chat_other/messages"), {
      params: Promise.resolve({ id: "chat_other" }),
    });
    expect(response.status).toBe(404);
  });
});
