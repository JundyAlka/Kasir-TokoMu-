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

    const row = await pool.query("select amount, paid_amount, status, is_paid, last_reminder_at from debts where id = $1", [debt.id]);
    expect(row.rows[0].amount).toBe(75000);
    expect(row.rows[0].paid_amount).toBe(75000);
    expect(row.rows[0].status).toBe("lunas");
    expect(row.rows[0].is_paid).toBe(1);
    expect(row.rows[0].last_reminder_at).toBeTruthy();

    const payments = await pool.query("select amount, note from debt_payments where debt_id = $1", [debt.id]);
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0]).toMatchObject({ amount: 75000, note: "Ditandai lunas" });
  });

  it("creates debt items and records installment payments", async () => {
    const { pool } = await setupTestDb();
    const { createDebt, getDebtDetail, recordDebtPayment } = await import("@/lib/server/app-service");

    const debt = await createDebt(WORKSPACE_ID, {
      borrowerName: "Bu Siti",
      whatsapp: "081234567892",
      amount: 1,
      dueDate: "2026-06-30",
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

    const payments = await pool.query("select amount, note from debt_payments where debt_id = $1 order by amount", [debt.id]);
    expect(payments.rows).toEqual([
      { amount: 6000, note: "Cicilan pertama" },
      { amount: 10000, note: "Pelunasan" },
    ]);
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
