import { db, pool } from "../src/db/client";
import {
  aiChats,
  aiMessages,
  debts,
  expenses,
  investments,
  investors,
  monthlyReports,
  products,
  restockLogs,
  storeProfiles,
  transactionItems,
  transactions,
  userRoles,
} from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const users = await pool.query(`SELECT id, email, name FROM "user"`);
  if (users.rows.length === 0) {
    console.log("BELUM ADA USER YANG MENDAFTAR.");
    process.exit(1);
  }

  const targetUser = users.rows[0];
  const newUserId = targetUser.id;
  const oldUserId = "seed-workspace";

  console.log(`Mengalihkan data dari '${oldUserId}' ke akun baru: '${targetUser.email}' (ID: ${newUserId})...`);

  await db.transaction(async (tx) => {
    // Delete newly auto-created profile and roles for the new user
    await tx.delete(storeProfiles).where(eq(storeProfiles.userId, newUserId));
    await tx.delete(userRoles).where(eq(userRoles.workspaceOwnerId, newUserId));
    await tx.delete(userRoles).where(eq(userRoles.userId, newUserId));

    // Move Profile
    const existingProfile = await tx.select().from(storeProfiles).where(eq(storeProfiles.userId, oldUserId));
    if (existingProfile.length > 0) {
      await tx.delete(storeProfiles).where(eq(storeProfiles.userId, oldUserId));
      await tx.insert(storeProfiles).values({
        ...existingProfile[0],
        userId: newUserId
      });
    }

    // Move Roles
    const existingRoles = await tx.select().from(userRoles).where(eq(userRoles.workspaceOwnerId, oldUserId));
    if (existingRoles.length > 0) {
        await tx.delete(userRoles).where(eq(userRoles.workspaceOwnerId, oldUserId));
        for (const role of existingRoles) {
            await tx.insert(userRoles).values({
                ...role,
                userId: newUserId,
                workspaceOwnerId: newUserId
            });
        }
    }

    // Move Data
    await tx.update(products).set({ userId: newUserId }).where(eq(products.userId, oldUserId));
    await tx.update(transactions).set({ userId: newUserId }).where(eq(transactions.userId, oldUserId));
    await tx.update(debts).set({ userId: newUserId }).where(eq(debts.userId, oldUserId));
    await tx.update(expenses).set({ userId: newUserId }).where(eq(expenses.userId, oldUserId));
    await tx.update(restockLogs).set({ workspaceOwnerId: newUserId, performedByUserId: newUserId }).where(eq(restockLogs.workspaceOwnerId, oldUserId));
    await tx.update(monthlyReports).set({ workspaceOwnerId: newUserId }).where(eq(monthlyReports.workspaceOwnerId, oldUserId));
    await tx.update(investments).set({ workspaceOwnerId: newUserId }).where(eq(investments.workspaceOwnerId, oldUserId));
    await tx.update(investors).set({ workspaceOwnerId: newUserId }).where(eq(investors.workspaceOwnerId, oldUserId));
    
    await tx.update(aiChats).set({ userId: newUserId }).where(eq(aiChats.userId, oldUserId));
    await tx.update(aiMessages).set({ userId: newUserId }).where(eq(aiMessages.userId, oldUserId));
  });

  console.log("✅ BERHASIL! SEMUA DATA LAMA TELAH KEMBALI KE AKUN ANDA!");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
