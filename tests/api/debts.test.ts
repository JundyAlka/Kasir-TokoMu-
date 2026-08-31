import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

async function openDebtShift(pool: Awaited<ReturnType<typeof setupTestDb>>["pool"], id: string) {
  const openedAt = "2026-08-13T01:00:00.000Z";
  await pool.query(
    `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
     values ($1, $2, 'Shift Kasbon', '00:00', '23:59', 1, $3)`,
    [id, WORKSPACE_ID, openedAt]
  );
  const { openShift } = await import("@/lib/server/shift-service");
  return openShift(WORKSPACE_ID, WORKSPACE_ID, id, { cash: 0, coins: 0, savings: 0, openedAt });
}

describe("debts service", () => {
  it("creates debt, marks it paid, and stores reminder timestamp", async () => {
    const { pool } = await setupTestDb();
    const shift = await openDebtShift(pool, "shift_debt_paid");
    const { createDebt, markDebtPaid, remindDebt } = await import("@/lib/server/app-service");

    const debt = await createDebt(WORKSPACE_ID, {
      borrowerName: "Pak Budi",
      whatsapp: "081234567891",
      amount: 75000,
      dueDate: "2026-08-30",
    });

    const reminded = await remindDebt(WORKSPACE_ID, debt.id);
    expect(reminded.lastReminderAt).toBeTruthy();

    const paid = await markDebtPaid(WORKSPACE_ID, debt.id);
    expect(paid.isPaid).toBe(true);
    expect(paid.amount).toBe(75000);

    const row = await pool.query("select amount, paid_amount, status, is_paid, last_reminder_at, shift_session_id from debts where id = $1", [debt.id]);
    expect(row.rows[0].amount).toBe(75000);
    expect(row.rows[0].paid_amount).toBe(75000);
    expect(row.rows[0].status).toBe("lunas");
    expect(row.rows[0].is_paid).toBe(1);
    expect(row.rows[0].last_reminder_at).toBeTruthy();
    expect(row.rows[0].shift_session_id).toBe(shift.id);

    const payments = await pool.query("select amount, note, shift_session_id from debt_payments where debt_id = $1", [debt.id]);
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0]).toMatchObject({ amount: 75000, note: "Ditandai lunas", shift_session_id: shift.id });
  });

  it("creates debt items and records installment payments", async () => {
    const { pool } = await setupTestDb();
    const shift = await openDebtShift(pool, "shift_debt_installment");
    const { createDebt, getDebtDetail, recordDebtPayment } = await import("@/lib/server/app-service");

    const debt = await createDebt(WORKSPACE_ID, {
      borrowerName: "Bu Siti",
      whatsapp: "081234567892",
      amount: 1,
      dueDate: "2099-12-31",
      items: [
        {
          productId: "prd_kopi",
          name: "Kopi Sachet",
          quantity: 3,
          unitPrice: 2000,
        },
        {
          productId: null,
          name: "Catatan manual",
          quantity: 2,
          unitPrice: 5000,
        },
      ],
    });

    expect(debt.amount).toBe(16000);
    expect(debt.remainingAmount).toBe(16000);
    expect(debt.status).toBe("aktif");

    const detail = await getDebtDetail(WORKSPACE_ID, debt.id);
    expect(detail.items).toHaveLength(2);
    expect(detail.items[0]).toMatchObject({ name: "Kopi Sachet", quantity: 3, lineTotal: 6000 });

    const partial = await recordDebtPayment(WORKSPACE_ID, debt.id, {
      amount: 6000,
      note: "Cicilan pertama",
    });
    expect(partial.debt.paidAmount).toBe(6000);
    expect(partial.debt.remainingAmount).toBe(10000);
    expect(partial.debt.isPaid).toBe(false);

    const final = await recordDebtPayment(WORKSPACE_ID, debt.id, {
      amount: 10000,
      note: "Pelunasan",
    });
    expect(final.debt.paidAmount).toBe(16000);
    expect(final.debt.remainingAmount).toBe(0);
    expect(final.debt.status).toBe("lunas");

    const row = await pool.query("select paid_amount, status, is_paid from debts where id = $1", [debt.id]);
    expect(row.rows[0]).toMatchObject({ paid_amount: 16000, status: "lunas", is_paid: 1 });

    const payments = await pool.query("select amount, note, shift_session_id from debt_payments where debt_id = $1 order by amount", [debt.id]);
    expect(payments.rows).toEqual([
      { amount: 6000, note: "Cicilan pertama", shift_session_id: shift.id },
      { amount: 10000, note: "Pelunasan", shift_session_id: shift.id },
    ]);
  });

  it("allows an empty WhatsApp number and no due date", async () => {
    const { pool } = await setupTestDb();
    await openDebtShift(pool, "shift_debt_no_due");
    const { createDebt } = await import("@/lib/server/app-service");

    const debt = await createDebt(WORKSPACE_ID, {
      borrowerName: "Bu Rina",
      whatsapp: "",
      amount: 45000,
      dueDate: null,
    });

    expect(debt.whatsapp).toBe("");
    expect(debt.dueDate).toBeNull();

    const row = await pool.query("select whatsapp, due_date from debts where id = $1", [debt.id]);
    expect(row.rows[0]).toMatchObject({ whatsapp: "", due_date: null });
  });

  it("allows a due date to be cleared after a debt is created", async () => {
    const { pool } = await setupTestDb();
    await openDebtShift(pool, "shift_debt_clear_due");
    const { createDebt, updateDebt } = await import("@/lib/server/app-service");

    const debt = await createDebt(WORKSPACE_ID, {
      borrowerName: "Pak Agus",
      whatsapp: "081234567890",
      amount: 25000,
      dueDate: "2026-06-30",
    });
    const updated = await updateDebt(WORKSPACE_ID, debt.id, { dueDate: null });

    expect(updated.dueDate).toBeNull();
  });

  it("rejects invalid debt and missing paid target", async () => {
    await setupTestDb();
    const { createDebt, markDebtPaid } = await import("@/lib/server/app-service");

    await expect(
      createDebt(WORKSPACE_ID, {
        borrowerName: "A",
        whatsapp: "081",
        amount: 0,
        dueDate: "2026-06-30",
      })
    ).rejects.toThrow();

    await expect(markDebtPaid(WORKSPACE_ID, "debt_missing")).rejects.toThrow("NOT_FOUND");
  });

  it("never counts a debt without due_date as overdue", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into debts (id, user_id, borrower_name, whatsapp, amount, paid_amount, status, is_paid, created_at, due_date)
       values ('debt_no_due', $1, 'Tanpa Tempo', '', 50000, 0, 'aktif', 0, '2020-01-01T00:00:00.000Z', null)`,
      [WORKSPACE_ID]
    );
    const { getKasbonDetail } = await import("@/lib/server/reporting");

    await expect(createDebtWithoutOpenShift()).rejects.toThrow("Buka shift");
    await expect(getKasbonDetail(WORKSPACE_ID, new Date("2026-08-13T00:00:00.000Z"))).resolves.toMatchObject({ overdueCount: 0, overdueAmount: 0 });
  });
});

async function createDebtWithoutOpenShift() {
  const { createDebt } = await import("@/lib/server/app-service");
  return createDebt(WORKSPACE_ID, { borrowerName: "Tanpa Shift", whatsapp: "", amount: 1, dueDate: null });
}
