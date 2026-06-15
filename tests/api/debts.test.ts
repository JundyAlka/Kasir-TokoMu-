import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("debts service", () => {
  it("creates debt, marks it paid, and stores reminder timestamp", async () => {
    const { pool } = await setupTestDb();
    const { createDebt, markDebtPaid, remindDebt } = await import("@/lib/server/app-service");

    const debt = await createDebt(WORKSPACE_ID, {
      borrowerName: "Pak Budi",
      whatsapp: "081234567891",
      amount: 75000,
      dueDate: "2026-06-30",
    });

    const reminded = await remindDebt(WORKSPACE_ID, debt.id);
    expect(reminded.lastReminderAt).toBeTruthy();

    const paid = await markDebtPaid(WORKSPACE_ID, debt.id);
    expect(paid.isPaid).toBe(true);
    expect(paid.amount).toBe(75000);

    const row = await pool.query("select amount, is_paid, last_reminder_at from debts where id = $1", [debt.id]);
    expect(row.rows[0].amount).toBe(75000);
    expect(row.rows[0].is_paid).toBe(1);
    expect(row.rows[0].last_reminder_at).toBeTruthy();
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

    await expect(markDebtPaid(WORKSPACE_ID, "debt_missing")).rejects.toThrow(
      "Data hutang tidak ditemukan."
    );
  });
});
