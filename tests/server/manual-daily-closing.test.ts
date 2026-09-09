import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("manual daily closing (buku kas harian)", () => {
  it("saves daily closing from notebook data and links day-to-day cash automatically", async () => {
    const { pool } = await setupTestDb();
    const {
      getPreviousDayClosing,
      saveManualClosing,
      getManualClosingForDate,
      listManualClosings,
    } = await import("@/lib/server/manual-daily-closing-service");

    // Hari 1: 2026-09-01 (Data sesuai buku catatan foto pengguna)
    const day1 = await saveManualClosing(WORKSPACE_ID, WORKSPACE_ID, {
      reportDate: "2026-09-01",
      openingCash: 0,
      revenue: 1896300,
      cashierIncome: 1638800,
      otherIncome: 257500,
      storeExpenses: [
        { name: "Plastik", amount: 143000 },
        { name: "Telur", amount: 470000 },
        { name: "TOKEN LISTRIK", amount: 54000 },
      ],
      titipanExpenses: [
        { name: "Roti padimor", amount: 27000 },
        { name: "Parfum arshaka", amount: 17000 },
      ],
      closingCash: 150000, // Kas tutup yang ditinggal di laci untuk besok
      closingCoins: 135300, // Receh
      closingSavings: 900000, // Tabungan
      note: "Catatan buku kas 01 Sept",
    });

    expect(day1.totalStoreExpense).toBe(667000);
    expect(day1.totalTitipanExpense).toBe(44000);
    expect(day1.totalExpense).toBe(711000);
    expect(day1.netCash).toBe(1185300);
    expect(day1.closingTotal).toBe(1185300);
    expect(day1.variance).toBe(0); // Klop!

    // Cek Hari 2: 2026-09-02 harus otomatis mendeteksi kas tutup hari 1 sebagai kas awal
    const prevClosing = await getPreviousDayClosing(WORKSPACE_ID, "2026-09-02");
    expect(prevClosing).not.toBeNull();
    expect(prevClosing?.reportDate).toBe("2026-09-01");
    expect(prevClosing?.closingCash).toBe(150000); // Kas awal hari 2 = 150.000

    // Simpan Hari 2 dengan kas awal dari hari 1
    const day2 = await saveManualClosing(WORKSPACE_ID, WORKSPACE_ID, {
      reportDate: "2026-09-02",
      openingCash: prevClosing!.closingCash,
      revenue: 2100000,
      storeExpenses: [{ name: "Plastik kresek", amount: 50000 }],
      titipanExpenses: [{ name: "Roti padimor", amount: 30000 }],
      closingCash: 200000,
      closingCoins: 120000,
      closingSavings: 1700000,
      note: "Catatan buku kas 02 Sept",
    });

    expect(day2.openingCash).toBe(150000);
    expect(day2.closingCash).toBe(200000);

    // Cek Hari 3: Kas awal harus 200.000 (dari hari 2)
    const prevClosingDay3 = await getPreviousDayClosing(WORKSPACE_ID, "2026-09-03");
    expect(prevClosingDay3?.closingCash).toBe(200000);

    // Cek list bulanan
    const monthList = await listManualClosings(WORKSPACE_ID, "2026-09-01", "2026-09-30");
    expect(monthList).toHaveLength(2);
    expect(monthList[0].reportDate).toBe("2026-09-01");
    expect(monthList[0].closingCash).toBe(150000);
    expect(monthList[1].reportDate).toBe("2026-09-02");
    expect(monthList[1].openingCash).toBe(150000);
  });

  it("saves multiple daily closings in batch and automatically chains opening cash", async () => {
    await setupTestDb();
    const { saveBatchManualClosing, listManualClosings } = await import(
      "@/lib/server/manual-daily-closing-service"
    );

    const batch = [
      {
        reportDate: "2026-09-10",
        openingCash: 100000,
        revenue: 1500000,
        storeExpenses: [{ name: "Plastik", amount: 100000 }],
        titipanExpenses: [],
        closingCash: 250000,
        closingCoins: 50000,
        closingSavings: 1100000,
        note: "Hari 10 batch",
      },
      {
        reportDate: "2026-09-11",
        openingCash: 0, // Sengaja dikosongkan agar sistem menyambungkan otomatis dari hari 10
        revenue: 1800000,
        storeExpenses: [{ name: "Telur", amount: 200000 }],
        titipanExpenses: [{ name: "Roti", amount: 50000 }],
        closingCash: 300000,
        closingCoins: 50000,
        closingSavings: 1200000,
        note: "Hari 11 batch",
      },
      {
        reportDate: "2026-09-12",
        openingCash: 0, // Menyambung dari hari 11 (300000)
        revenue: 2000000,
        storeExpenses: [],
        titipanExpenses: [],
        closingCash: 200000,
        closingCoins: 100000,
        closingSavings: 1700000,
        note: "Hari 12 batch",
      },
    ];

    const savedBatch = await saveBatchManualClosing(WORKSPACE_ID, WORKSPACE_ID, batch);
    expect(savedBatch).toHaveLength(3);

    expect(savedBatch[0].reportDate).toBe("2026-09-10");
    expect(savedBatch[0].closingCash).toBe(250000);

    // Hari 11 harus otomatis dapat openingCash = 250.000 dari hari 10
    expect(savedBatch[1].reportDate).toBe("2026-09-11");
    expect(savedBatch[1].openingCash).toBe(250000);
    expect(savedBatch[1].closingCash).toBe(300000);

    // Hari 12 harus otomatis dapat openingCash = 300.000 dari hari 11
    expect(savedBatch[2].reportDate).toBe("2026-09-12");
    expect(savedBatch[2].openingCash).toBe(300000);
    expect(savedBatch[2].closingCash).toBe(200000);

    const list = await listManualClosings(WORKSPACE_ID, "2026-09-10", "2026-09-12");
    expect(list).toHaveLength(3);
  });
});
