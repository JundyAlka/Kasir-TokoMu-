import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

const OTHER_WORKSPACE_ID = "usr_workspace_lain";
const DAY = "2026-08-09";
const OPENED_AT = `${DAY}T01:00:00.000Z`;

async function createShiftFor(
  pool: Awaited<ReturnType<typeof setupTestDb>>["pool"],
  workspaceOwnerId: string,
  id: string
) {
  await pool.query(
    `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
     values ($1, $2, 'Shift Pagi', '00:00', '23:59', 1, $3)`,
    [id, workspaceOwnerId, OPENED_AT]
  );
}

describe("shift daily reporting", () => {
  it("rejects a second open shift in the same workspace and isolates another workspace", async () => {
    const { pool } = await setupTestDb();
    await createShiftFor(pool, WORKSPACE_ID, "shift_main");
    await createShiftFor(pool, OTHER_WORKSPACE_ID, "shift_other");
    const { openShift } = await import("@/lib/server/shift-service");

    await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_main", { cash: 10_000, coins: 0, savings: 0, openedAt: OPENED_AT });
    await expect(
      openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_main", { cash: 10_000, coins: 0, savings: 0, openedAt: OPENED_AT })
    ).rejects.toThrow("masih terbuka");

    await expect(
      openShift(OTHER_WORKSPACE_ID, OTHER_WORKSPACE_ID, "shift_other", { cash: 0, coins: 0, savings: 0, openedAt: OPENED_AT })
    ).resolves.toMatchObject({ workspaceOwnerId: OTHER_WORKSPACE_ID });
  });

  it("uses the prior closing total as the next opening and records an operator override", async () => {
    const { pool } = await setupTestDb();
    await createShiftFor(pool, WORKSPACE_ID, "shift_chain_1");
    await createShiftFor(pool, WORKSPACE_ID, "shift_chain_2");
    const { closeShift, openShift } = await import("@/lib/server/shift-service");

    const first = await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_chain_1", { cash: 10_000, coins: 500, savings: 0, openedAt: OPENED_AT });
    await closeShift(WORKSPACE_ID, first.id, { cash: 10_000, coins: 500, savings: 0, closedAt: `${DAY}T04:00:00.000Z` });
    const next = await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_chain_2");
    expect(next.openingTotal).toBe(10_500);

    await closeShift(WORKSPACE_ID, next.id, { cash: 10_000, coins: 500, savings: 0, closedAt: `${DAY}T06:00:00.000Z` });
    const overridden = await openShift(
      WORKSPACE_ID,
      WORKSPACE_ID,
      "shift_chain_2",
      { cash: 12_000, coins: 0, savings: 0, openedAt: `${DAY}T07:00:00.000Z` },
      "Hitungan kas awal diverifikasi ulang."
    );
    expect(overridden.varianceNote).toContain("Kas awal berbeda");
  });

  it("does not treat Kasbon sales as cash, but adds debt repayment and subtracts cash expenses", async () => {
    const { pool } = await setupTestDb();
    await createShiftFor(pool, WORKSPACE_ID, "shift_cash");
    const { closeShift, openShift } = await import("@/lib/server/shift-service");
    const session = await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_cash", { cash: 1_000, coins: 0, savings: 0, openedAt: OPENED_AT });

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, shift_session_id, created_at, occurred_at)
       values
         ('trx_cash', $1, 4000, 'Tunai', $2, $3, $3)`,
      [WORKSPACE_ID, session.id, `${DAY}T02:00:00.000Z`]
    );
    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, shift_session_id, created_at, occurred_at)
       values ('trx_debt', $1, 9000, 'Kasbon', $2, $3, $3)`,
      [WORKSPACE_ID, session.id, `${DAY}T02:00:00.000Z`]
    );
    await pool.query(
      `insert into debts (id, user_id, borrower_name, whatsapp, amount, paid_amount, status, is_paid, created_at)
       values ('debt_1', $1, 'Pelanggan', '', 10000, 0, 'aktif', 0, $2)`,
      [WORKSPACE_ID, OPENED_AT]
    );
    await pool.query(
      `insert into debt_payments (id, debt_id, amount, paid_at, note, recorded_by_user_id, shift_session_id)
       values ('payment_1', 'debt_1', 3000, $1, '', $2, $3)`,
      [`${DAY}T03:00:00.000Z`, WORKSPACE_ID, session.id]
    );
    await pool.query(
      `insert into expenses (id, user_id, title, amount, created_at, category, shift_session_id, is_cash_movement)
       values ('expense_cash', $1, 'Belanja', 500, $2, 'operasional', $3, false)`,
      [WORKSPACE_ID, `${DAY}T03:00:00.000Z`, session.id]
    );

    const summary = await closeShift(WORKSPACE_ID, session.id, { cash: 7_500, coins: 0, savings: 0, closedAt: `${DAY}T04:00:00.000Z` });
    expect(summary.expectedClosing).toBe(7_500); // 1,000 + 4,000 + 3,000 - 500; Kasbon 9,000 excluded
    expect(summary.variance).toBe(0);
  });

  it("keeps savings deposits out of profit while retaining a one-shift daily report", async () => {
    const { pool } = await setupTestDb();
    await createShiftFor(pool, WORKSPACE_ID, "shift_daily");
    const { openShift } = await import("@/lib/server/shift-service");
    const { buildDailyReport, lockDailyReport } = await import("@/lib/server/daily-report-service");
    const session = await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_daily", { cash: 1_000, coins: 0, savings: 0, openedAt: OPENED_AT });

    await pool.query(
      `insert into transactions (id, user_id, total, payment_method, shift_session_id, created_at, occurred_at)
       values ('trx_report', $1, 10000, 'Tunai', $2, $3, $3)`,
      [WORKSPACE_ID, session.id, `${DAY}T02:00:00.000Z`]
    );
    await pool.query(
      `insert into transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, cost_price)
       values ('item_report', 'trx_report', 'prd_roti', 'Roti', 1, 10000, 6000)`
    );
    for (const [id, title, amount, type, isCashMovement] of [
      ["expense_operational", "Listrik", 1000, "operasional", false],
      ["expense_savings", "Tabungan", 2000, "setoran_tabungan", true],
      ["expense_payout", "Bagi hasil", 500, "bagi_hasil_investor", true],
    ] as const) {
      await pool.query(
        `insert into expenses (id, user_id, title, amount, created_at, category, shift_session_id, expense_type, is_cash_movement)
         values ($1, $2, $3, $4, $5, 'operasional', $6, $7, $8)`,
        [id, WORKSPACE_ID, title, amount, `${DAY}T03:00:00.000Z`, session.id, type, isCashMovement]
      );
    }

    const report = await buildDailyReport(WORKSPACE_ID, DAY);
    expect(report).toMatchObject({ revenue: 10_000, cogs: 6_000, expenseTotal: 1_000, grossProfit: 4_000, netProfit: 3_000, profitDistribution: 500, transactionCount: 1 });
    await expect(lockDailyReport(WORKSPACE_ID, DAY, WORKSPACE_ID)).rejects.toThrow("masih ada shift terbuka");
  });

  it("records bucket mutations without changing expected total cash or net profit", async () => {
    const { pool } = await setupTestDb();
    await createShiftFor(pool, WORKSPACE_ID, "shift_mutation");
    const { openShift, closeShift, getShiftCashMovement } = await import("@/lib/server/shift-service");
    const { createKasMovement } = await import("@/lib/server/kas-movement-service");
    const { buildDailyReport } = await import("@/lib/server/daily-report-service");
    const session = await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_mutation", { cash: 0, coins: 0, savings: 500_000, openedAt: OPENED_AT });
    const before = await getShiftCashMovement(WORKSPACE_ID, session.id);
    const reportBefore = await buildDailyReport(WORKSPACE_ID, DAY);

    const movement = await createKasMovement(WORKSPACE_ID, { fromBucket: "savings", toBucket: "cash", amount: 500_000, note: "Bayar supplier" }, WORKSPACE_ID);
    expect(movement.shiftSessionId).toBe(session.id);
    const after = await getShiftCashMovement(WORKSPACE_ID, session.id);
    const reportAfter = await buildDailyReport(WORKSPACE_ID, DAY);
    expect(after).toEqual(before);
    expect(reportAfter.netProfit).toBe(reportBefore.netProfit);

    const closed = await closeShift(WORKSPACE_ID, session.id, { cash: 500_000, coins: 0, savings: 0, closedAt: `${DAY}T04:00:00.000Z` });
    expect(closed.expectedClosing).toBe(500_000);
    expect(closed.variance).toBe(0);
  });

  it("records shift-bound expense effects, consignment settlement, restock, and keeps sales-harian out of capital", async () => {
    const { pool } = await setupTestDb();
    await createShiftFor(pool, WORKSPACE_ID, "shift_expense_flow");
    const { openShift, closeShift } = await import("@/lib/server/shift-service");
    const { createShiftExpense } = await import("@/lib/server/expense-service");
    const { createInvestor, createTitipanIntake } = await import("@/lib/server/investor-service");
    const { getAssetCapitalSummary } = await import("@/lib/server/reporting");
    const { buildDailyReport } = await import("@/lib/server/daily-report-service");
    const session = await openShift(WORKSPACE_ID, WORKSPACE_ID, "shift_expense_flow", { cash: 60_000, coins: 0, savings: 0, openedAt: OPENED_AT });
    const salesPartner = await createInvestor(WORKSPACE_ID, { name: "Sales Harian", partnerType: "sales_harian" });
    const moneyInvestor = await createInvestor(WORKSPACE_ID, { name: "Investor Uang", partnerType: "investor_uang" });
    const intake = await createTitipanIntake(WORKSPACE_ID, { investorId: salesPartner.id, productId: "prd_roti", intakeDate: DAY, qtyIn: 5, unitCost: 1000, unitPrice: 1500, shiftSessionId: session.id });
    await pool.query("update titipan_intakes set qty_sold = 3 where id = $1", [intake.id]);

    await createShiftExpense(WORKSPACE_ID, { title: "Setoran tabungan", amount: 2_000, expenseType: "setoran_tabungan", settleIntakeIds: [] }, WORKSPACE_ID);
    await createShiftExpense(WORKSPACE_ID, { title: "Bagi hasil", amount: 500, expenseType: "bagi_hasil_investor", investorId: moneyInvestor.id, settleIntakeIds: [] }, WORKSPACE_ID);
    await createShiftExpense(WORKSPACE_ID, { title: "Pelunasan titipan", amount: 3_000, expenseType: "sales_titipan", investorId: salesPartner.id, settleIntakeIds: [intake.id] }, WORKSPACE_ID);
    await createShiftExpense(WORKSPACE_ID, { title: "Belanja beras", amount: 50_000, expenseType: "sales_toko", settleIntakeIds: [], restock: { productId: "prd_beras", quantity: 2, unitCost: 50_000 } }, WORKSPACE_ID);

    const [restocked, settled] = await Promise.all([
      pool.query("select stock from products where id = 'prd_beras'"),
      pool.query("select settled_amount from titipan_intakes where id = $1", [intake.id]),
    ]);
    expect(restocked.rows[0].stock).toBe(12);
    expect(settled.rows[0].settled_amount).toBe(3000);
    const assets = await getAssetCapitalSummary(WORKSPACE_ID);
    expect(assets.dailyConsignmentLiability).toBe(0);
    expect(assets.investorMoneyCapital).toBe(0); // sales_harian never becomes capital
    const report = await buildDailyReport(WORKSPACE_ID, DAY);
    expect(report.expenseTotal).toBe(50_000); // tabungan and bagi hasil are not operational expense
    expect(report.profitDistribution).toBe(500);
    const closed = await closeShift(WORKSPACE_ID, session.id, { cash: 4_500, coins: 0, savings: 0, closedAt: `${DAY}T07:00:00.000Z` });
    expect(closed.expectedClosing).toBe(4_500); // all cash outflows reduce closing cash
  });
});
