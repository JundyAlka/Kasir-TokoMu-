import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type ProfitLossPdfData = {
  generatedAt: string;
  period: {
    label: string;
    start: string;
    end: string;
  };
  identity: {
    storeName: string;
    storeTagline: string;
    storeAddress: string;
    city: string;
  };
  financial: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenseTotal: number;
    netProfit: number;
    profitDistribution: number;
    transactionCount: number;
    averageTicket: number;
  };
  physicalBalanceSheet?: {
    modalAwal: number;
    kas: number;
    stokDagangan: number;
    inventarisToko: number;
    showcase: number;
    piutangToko: number;
    totalAset: number;
    hutangToko: number;
    hutangSalesTitipan: number;
    hutangInvestasi: number;
    totalHutang: number;
    biayaAtk: number;
    totalKewajibanDanBiaya: number;
    labaRugiBerjalan: number;
    isSurplus: boolean;
  };
  debtors?: Array<{
    borrowerName: string;
    remainingAmount: number;
    whatsapp?: string | null;
  }>;
  stockCategories?: Array<{
    category: string;
    categoryValue: number;
    productCount: number;
    unitCount: number;
  }>;
  supplierDebts?: Array<{
    name: string;
    partnerType: string;
    liabilityAmount: number;
  }>;
  cashPositions?: {
    cash: number;
    coins: number;
    savings: number;
    total: number;
  };
  assetsAndCapital?: {
    inventoryCapital: number;
    activeReceivables: number;
    investorMoneyCapital: number;
    consignmentCapital: number;
    dailyConsignmentLiability: number;
    totalAssets: number;
    totalActiveProducts: number;
    totalStockUnits: number;
  };
  salesChannels?: Array<{
    method: string;
    count: number;
    total: number;
  }>;
  expenseItems?: Array<{
    id: string;
    title: string;
    category: string;
    amount: number;
    createdAt: string;
  }>;
  expenseCategories: Array<{
    category: string;
    amount: number;
    percentage?: string;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sold: number;
    revenue: number;
  }>;
  bottomProducts: Array<{
    productId: string;
    name: string;
    sold: number;
    revenue: number;
  }>;
  ownerNotes: string[];
  payouts: Array<{
    investorName: string;
    amount: number;
    note: string;
  }>;
  restockPlans: Array<{
    productName: string;
    note: string;
    estimatedPrice: number;
  }>;
  lowStockProducts: Array<{
    name: string;
    stock: number;
    minimumStock: number;
    category: string;
  }>;
  employeeSalaries: Array<{
    name: string;
    role: string;
    monthlySalary: number;
  }>;
  dailyReports: Array<{ reportDate: string; revenue: number; expenseTotal: number; netProfit: number }>;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1e293b",
    lineHeight: 1.35,
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 12,
  },
  eyebrowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#059669",
    letterSpacing: 0.5,
  },
  printDate: {
    fontSize: 7,
    color: "#64748b",
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  storeName: {
    marginTop: 1.5,
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  subtitle: {
    marginTop: 1.5,
    fontSize: 8,
    color: "#475569",
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    marginBottom: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#0f172a",
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
    paddingLeft: 4,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  summaryCard: {
    width: "49%",
    padding: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 3,
  },
  summaryLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  summaryValue: {
    marginTop: 1.5,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  summaryValueHighlight: {
    marginTop: 1.5,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#059669",
  },
  summarySubtext: {
    marginTop: 1,
    fontSize: 6.5,
    color: "#64748b",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tableRowHighlight: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#f0fdf4",
  },
  cell: {
    padding: 3.8,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    fontSize: 7.5,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headCell: {
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    fontSize: 7.5,
    textTransform: "uppercase",
  },
  boldCell: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  right: {
    textAlign: "right",
  },
  center: {
    textAlign: "center",
  },
  calloutBox: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  calloutSurplus: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  calloutDeficit: {
    borderColor: "#e11d48",
    backgroundColor: "#fff1f2",
  },
  calloutTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  calloutAmount: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  calloutFormula: {
    fontSize: 7,
    color: "#475569",
  },
  twoColContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  colHalf: {
    width: "49%",
  },
  noteBox: {
    padding: 5,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fffbeb",
    borderRadius: 3,
    fontSize: 7.5,
    color: "#92400e",
  },
  signatureSection: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  signatureBox: {
    width: "42%",
    alignItems: "center",
  },
  signatureRole: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginBottom: 36,
  },
  signatureLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#64748b",
    marginBottom: 2.5,
  },
  signatureName: {
    fontSize: 7.5,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 14,
    color: "#94a3b8",
    fontSize: 6.5,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function formatCurrency(value: number) {
  if (value < 0) {
    return `- Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.abs(value))}`;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function col(width: string | number) {
  return { width };
}

function FinancialRow({
  label,
  value,
  isBold = false,
  isHighlight = false,
}: Readonly<{
  label: string;
  value: number | string;
  isBold?: boolean;
  isHighlight?: boolean;
}>) {
  return (
    <View style={isHighlight ? styles.tableRowHighlight : styles.tableRow}>
      <Text style={[styles.cell, isBold ? styles.boldCell : {}, col("62%")]}>{label}</Text>
      <Text style={[styles.cell, styles.lastCell, styles.right, isBold ? styles.boldCell : {}, col("38%")]}>
        {typeof value === "number" ? formatCurrency(value) : value}
      </Text>
    </View>
  );
}

function EmptyRow({ text }: Readonly<{ text: string }>) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.lastCell, col("100%"), { color: "#64748b", fontStyle: "italic", textAlign: "center", paddingVertical: 5 }]}>
        {text}
      </Text>
    </View>
  );
}

export function ProfitLossReportDocument({
  data,
}: Readonly<{
  data: ProfitLossPdfData;
}>) {
  const financial = data.financial;
  const assets = data.assetsAndCapital;
  const neraca = data.physicalBalanceSheet;
  const debtors = data.debtors ?? [];
  const stockCategories = data.stockCategories ?? [];
  const supplierDebts = data.supplierDebts ?? [];

  const grossMargin =
    financial.revenue > 0 ? `${Math.round((financial.grossProfit / financial.revenue) * 1000) / 10}%` : "0%";
  const netMargin =
    financial.revenue > 0 ? `${Math.round((financial.netProfit / financial.revenue) * 1000) / 10}%` : "0%";

  return (
    <Document title={`Laporan Keuangan & Kinerja Bulanan ${data.period.label} - ${data.identity.storeName}`}>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>TokoMu &bull; Dokumen Resmi Laporan Keuangan &amp; Neraca Pembukuan</Text>
            <Text style={styles.printDate}>Dicetak: {formatDate(data.generatedAt)}</Text>
          </View>
          <Text style={styles.title}>Laporan Keuangan &amp; Neraca Laba / Rugi Bulanan</Text>
          <Text style={styles.storeName}>{data.identity.storeName}</Text>
          <Text style={styles.subtitle}>
            Periode: {data.period.label} ({formatDate(data.period.start)} s.d. {formatDate(data.period.end)})
          </Text>
          <Text style={styles.subtitle}>
            {[data.identity.storeTagline, data.identity.storeAddress, data.identity.city].filter(Boolean).join(" &bull; ")}
          </Text>
        </View>

        {/* 1. RINGKASAN FINANSIAL UTAMA */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>1. Ringkasan Finansial Arus Usaha</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Omzet Penjualan</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.revenue)}</Text>
              <Text style={styles.summarySubtext}>{financial.transactionCount} total transaksi (Rata-rata: {formatCurrency(financial.averageTicket)})</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Laba Kotor Toko</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.grossProfit)}</Text>
              <Text style={styles.summarySubtext}>Margin Laba Kotor: {grossMargin} (setelah HPP {formatCurrency(financial.cogs)})</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Beban Operasional / Pengeluaran</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.expenseTotal)}</Text>
              <Text style={styles.summarySubtext}>{data.expenseCategories.length} kategori pengeluaran tercatat</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Laba Bersih Usaha</Text>
              <Text style={styles.summaryValueHighlight}>{formatCurrency(financial.netProfit)}</Text>
              <Text style={styles.summarySubtext}>Margin Laba Bersih: {netMargin}</Text>
            </View>
          </View>
        </View>

        {/* 2. LAPORAN LABA / RUGI & NERACA FISIK TOKO (Format Sesuai Catatan Buku Fisik Toko - Image 2) */}
        {neraca ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>2. Laporan Neraca Fisik &amp; Laba / Rugi Berjalan</Text>
            
            <View style={styles.twoColContainer}>
              {/* Kolom Kiri: Sisi Harta / Aset Toko */}
              <View style={styles.colHalf}>
                <View style={styles.table}>
                  <View style={[styles.tableHeader, { backgroundColor: "#ecfdf5" }]}>
                    <Text style={[styles.cell, styles.headCell, col("65%"), { color: "#065f46" }]}>A. Posisi Harta / Aset Toko</Text>
                    <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("35%"), { color: "#065f46" }]}>Nominal</Text>
                  </View>
                  <FinancialRow label="1. Kas Toko (Laci kas/receh/tabungan)" value={neraca.kas} />
                  <FinancialRow label="2. Stok Barang Dagangan (Cek Stok)" value={neraca.stokDagangan} />
                  <FinancialRow label="3. Inventaris Toko" value={neraca.inventarisToko} />
                  <FinancialRow label="4. Show Case / Peralatan" value={neraca.showcase} />
                  <FinancialRow label="5. Piutang Toko (Kasbon Pelanggan)" value={neraca.piutangToko} />
                  <View style={[styles.tableRowHighlight, { backgroundColor: "#d1fae5", borderTopWidth: 1.5, borderTopColor: "#059669" }]}>
                    <Text style={[styles.cell, styles.boldCell, col("65%"), { color: "#065f46" }]}>Total Nilai Harta / Aset</Text>
                    <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("35%"), { color: "#065f46" }]}>
                      {formatCurrency(neraca.totalAset)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Kolom Kanan: Sisi Hutang, Modal Awal & Biaya */}
              <View style={styles.colHalf}>
                <View style={styles.table}>
                  <View style={[styles.tableHeader, { backgroundColor: "#fff1f2" }]}>
                    <Text style={[styles.cell, styles.headCell, col("65%"), { color: "#9f1239" }]}>B. Hutang, Modal &amp; Beban</Text>
                    <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("35%"), { color: "#9f1239" }]}>Nominal</Text>
                  </View>
                  <FinancialRow label="1. Modal Awal Toko" value={neraca.modalAwal} isBold />
                  <FinancialRow label="2. Hutang Toko (Supplier/Kulakan)" value={neraca.hutangToko} />
                  <FinancialRow label="3. Hutang Sales Titipan" value={neraca.hutangSalesTitipan} />
                  <FinancialRow label="4. Hutang Modal Investasi" value={neraca.hutangInvestasi} />
                  <FinancialRow label="5. Biaya ATK &amp; Pengeluaran" value={neraca.biayaAtk} />
                  <View style={[styles.tableRowHighlight, { backgroundColor: "#ffe4e6", borderTopWidth: 1.5, borderTopColor: "#e11d48" }]}>
                    <Text style={[styles.cell, styles.boldCell, col("65%"), { color: "#9f1239" }]}>Total Kewajiban &amp; Modal</Text>
                    <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("35%"), { color: "#9f1239" }]}>
                      {formatCurrency(neraca.totalKewajibanDanBiaya)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Callout Hasil Laba / Rugi Berjalan */}
            <View style={[styles.calloutBox, neraca.isSurplus ? styles.calloutSurplus : styles.calloutDeficit, { marginTop: 6 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={[styles.calloutTitle, { color: neraca.isSurplus ? "#065f46" : "#9f1239" }]}>
                    Hasil Pembukuan: {neraca.isSurplus ? "Surplus Laba Toko Berjalan" : "Rugi Toko Berjalan"} Periode {data.period.label}
                  </Text>
                  <Text style={styles.calloutFormula}>
                    Rumus: Total Harta ({formatCurrency(neraca.totalAset)}) − Total Kewajiban &amp; Modal ({formatCurrency(neraca.totalKewajibanDanBiaya)})
                  </Text>
                </View>
                <Text style={[styles.calloutAmount, { color: neraca.isSurplus ? "#059669" : "#e11d48" }]}>
                  {formatCurrency(neraca.labaRugiBerjalan)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 3. RINCIAN PIUTANG TOKO (Daftar Kasbon Pelanggan - Sesuai Image 1) */}
        {debtors.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>3. Rincian Piutang Toko (Daftar Kasbon Pelanggan Belum Lunas)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("10%"), styles.center]}>No</Text>
                <Text style={[styles.cell, styles.headCell, col("55%")]}>Nama Pelanggan (Peminjam)</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("35%")]}>Sisa Tagihan Piutang</Text>
              </View>
              {debtors.map((d, idx) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("10%"), styles.center]}>{idx + 1}</Text>
                  <Text style={[styles.cell, col("55%")]}>{d.borrowerName}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("35%")]}>
                    {formatCurrency(d.remainingAmount)}
                  </Text>
                </View>
              ))}
              <View style={styles.tableRowHighlight}>
                <Text style={[styles.cell, styles.boldCell, col("65%")]}>Total Akumulasi Piutang Toko</Text>
                <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("35%")]}>
                  {formatCurrency(debtors.reduce((sum, d) => sum + d.remainingAmount, 0))}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 4. RINCIAN CEK STOK BARANG DAGANGAN (HPP per Kategori - Sesuai Image 1) */}
        {stockCategories.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>4. Rincian Cek Stok Barang Dagangan (Nilai HPP per Bagian Rak)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("10%"), styles.center]}>No</Text>
                <Text style={[styles.cell, styles.headCell, col("45%")]}>Kategori / Bagian Rak</Text>
                <Text style={[styles.cell, styles.headCell, col("20%"), styles.right]}>Jumlah Produk</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("25%")]}>Nilai Beli (HPP)</Text>
              </View>
              {stockCategories.map((cat, idx) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("10%"), styles.center]}>{idx + 1}</Text>
                  <Text style={[styles.cell, col("45%")]}>{cat.category}</Text>
                  <Text style={[styles.cell, col("20%"), styles.right]}>{cat.productCount} SKU ({cat.unitCount} unit)</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("25%")]}>
                    {formatCurrency(cat.categoryValue)}
                  </Text>
                </View>
              ))}
              <View style={styles.tableRowHighlight}>
                <Text style={[styles.cell, styles.boldCell, col("75%")]}>Total Nilai Beli Stok Barang (HPP)</Text>
                <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("25%")]}>
                  {formatCurrency(stockCategories.reduce((sum, c) => sum + c.categoryValue, 0))}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 5. RINCIAN HUTANG TOKO, KONSINYASI & MODAL INVESTASI */}
        {supplierDebts.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>5. Rincian Hutang Toko &amp; Titipan Konsinyasi</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("10%"), styles.center]}>No</Text>
                <Text style={[styles.cell, styles.headCell, col("50%")]}>Nama Mitra / Supplier</Text>
                <Text style={[styles.cell, styles.headCell, col("20%")]}>Jenis Kemitraan</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("20%")]}>Kewajiban Hutang</Text>
              </View>
              {supplierDebts.map((s, idx) => {
                const partnerLabel =
                  s.partnerType === "titipan_bagihasil"
                    ? "Titipan Bagi Hasil"
                    : s.partnerType === "sales_harian"
                    ? "Sales Harian"
                    : "Investor Uang";

                return (
                  <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.cell, col("10%"), styles.center]}>{idx + 1}</Text>
                    <Text style={[styles.cell, col("50%")]}>{s.name}</Text>
                    <Text style={[styles.cell, col("20%")]}>{partnerLabel}</Text>
                    <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("20%")]}>
                      {formatCurrency(s.liabilityAmount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 6. METRIK ARUS TRANSAKSI PENJUALAN */}
        {data.salesChannels && data.salesChannels.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>6. Distribusi Metode Pembayaran Penjualan</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("45%")]}>Metode Pembayaran</Text>
                <Text style={[styles.cell, styles.headCell, styles.right, col("25%")]}>Jumlah Transaksi</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Total Nominal</Text>
              </View>
              {data.salesChannels.map((item, idx) => (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("45%")]}>{item.method}</Text>
                  <Text style={[styles.cell, styles.right, col("25%")]}>{item.count} transaksi</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("30%")]}>{formatCurrency(item.total)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 7. DETAIL BEBAN PENGELUARAN */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>7. Rincian Detail Pengeluaran &amp; Beban Toko</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headCell, col("8%"), styles.center]}>No</Text>
              <Text style={[styles.cell, styles.headCell, col("18%")]}>Tanggal</Text>
              <Text style={[styles.cell, styles.headCell, col("42%")]}>Keterangan / Keperluan</Text>
              <Text style={[styles.cell, styles.headCell, col("16%")]}>Kategori</Text>
              <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("16%")]}>Nominal</Text>
            </View>
            {data.expenseItems && data.expenseItems.length > 0 ? (
              data.expenseItems.map((item, idx) => (
                <View key={item.id || idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("8%"), styles.center]}>{idx + 1}</Text>
                  <Text style={[styles.cell, col("18%")]}>{formatDate(item.createdAt)}</Text>
                  <Text style={[styles.cell, col("42%")]}>{item.title}</Text>
                  <Text style={[styles.cell, col("16%")]}>{item.category}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("16%")]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))
            ) : data.expenseCategories.length > 0 ? (
              data.expenseCategories.map((item, idx) => (
                <View key={item.category} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("8%"), styles.center]}>{idx + 1}</Text>
                  <Text style={[styles.cell, col("18%")]}>-</Text>
                  <Text style={[styles.cell, col("42%")]}>{item.category}</Text>
                  <Text style={[styles.cell, col("16%")]}>Operasional</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("16%")]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyRow text="Tidak ada catatan pengeluaran pada periode ini." />
            )}
            <View style={styles.tableRowHighlight}>
              <Text style={[styles.cell, styles.boldCell, col("84%")]}>Total Beban Pengeluaran</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("16%")]}>
                {formatCurrency(financial.expenseTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* 8. KINERJA PRODUK TERLARIS */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>8. Kinerja Produk Terlaris (Top Selling)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headCell, col("50%")]}>Nama Produk</Text>
              <Text style={[styles.cell, styles.headCell, styles.right, col("20%")]}>Unit Terjual</Text>
              <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Total Omzet</Text>
            </View>
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product, idx) => (
                <View key={product.productId} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("50%")]}>{product.name}</Text>
                  <Text style={[styles.cell, styles.right, col("20%")]}>{product.sold}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("30%")]}>
                    {formatCurrency(product.revenue)}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyRow text="Belum ada data penjualan produk pada periode ini." />
            )}
          </View>
        </View>

        {/* 9. PEMBAGIAN HASIL INVESTOR */}
        {data.payouts && data.payouts.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>9. Pembagian Hasil Pemodal / Investor</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("35%")]}>Nama Pemodal</Text>
                <Text style={[styles.cell, styles.headCell, col("35%")]}>Skema / Keterangan</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Bagi Hasil</Text>
              </View>
              {data.payouts.map((payout, index) => (
                <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("35%")]}>{payout.investorName}</Text>
                  <Text style={[styles.cell, col("35%")]}>{payout.note}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("30%")]}>
                    {formatCurrency(payout.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 10. CATATAN PENGELOLA & PENGESAHAN */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>10. Catatan &amp; Analisis Pengelola Toko</Text>
          {data.ownerNotes.length > 0 ? (
            data.ownerNotes.map((note, index) => (
              <View key={`${note}-${index}`} style={styles.noteBox}>
                <Text>&bull; {note}</Text>
              </View>
            ))
          ) : (
            <View style={styles.noteBox}>
              <Text>Tidak ada catatan tambahan untuk periode ini.</Text>
            </View>
          )}
        </View>

        {/* LEMBAR PENGESAHAN */}
        <View style={styles.signatureSection} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Dibuat Oleh (Kasir / Petugas):</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>Tanggal: ___________________</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Disetujui Oleh (Pimpinan / Pengelola):</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>Tanggal: ___________________</Text>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text>{data.identity.storeName} &bull; Dokumen Laporan Resmi</Text>
          <Text>Halaman dicetak otomatis dari sistem TokoMu</Text>
        </View>
      </Page>
    </Document>
  );
}
