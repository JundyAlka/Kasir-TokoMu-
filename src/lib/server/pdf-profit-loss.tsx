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
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#1e293b",
    lineHeight: 1.35,
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 14,
  },
  eyebrowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#059669",
    letterSpacing: 0.5,
  },
  printDate: {
    fontSize: 7.5,
    color: "#64748b",
  },
  title: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  storeName: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 8.5,
    color: "#475569",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 5,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#0f172a",
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
    paddingLeft: 5,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  summaryCard: {
    width: "48.5%",
    padding: 7,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  summaryCardFull: {
    width: "100%",
    padding: 7,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 7.5,
    color: "#64748b",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  summaryValue: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  summaryValueHighlight: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#059669",
  },
  summarySubtext: {
    marginTop: 1.5,
    fontSize: 7,
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
    padding: 4.5,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    fontSize: 8,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headCell: {
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    fontSize: 8,
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
  noteBox: {
    padding: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fffbeb",
    borderRadius: 3,
    fontSize: 8,
    color: "#92400e",
  },
  signatureSection: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  signatureBox: {
    width: "42%",
    alignItems: "center",
  },
  signatureRole: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginBottom: 40,
  },
  signatureLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#64748b",
    marginBottom: 3,
  },
  signatureName: {
    fontSize: 8,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 16,
    color: "#94a3b8",
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function formatCurrency(value: number) {
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
      <Text style={[styles.cell, isBold ? styles.boldCell : {}, col("60%")]}>{label}</Text>
      <Text style={[styles.cell, styles.lastCell, styles.right, isBold ? styles.boldCell : {}, col("40%")]}>
        {typeof value === "number" ? formatCurrency(value) : value}
      </Text>
    </View>
  );
}

function EmptyRow({ text }: Readonly<{ text: string }>) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.lastCell, col("100%"), { color: "#64748b", fontStyle: "italic", textAlign: "center", paddingVertical: 6 }]}>
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
            <Text style={styles.eyebrow}>TokoMu &bull; Dokumen Resmi Laporan Keuangan</Text>
            <Text style={styles.printDate}>Dicetak: {formatDate(data.generatedAt)}</Text>
          </View>
          <Text style={styles.title}>Laporan Keuangan & Kinerja Bulanan</Text>
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
          <Text style={styles.sectionTitle}>1. Ringkasan Finansial & Hasil Usaha</Text>
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

        {/* 2. POSISI ASET, MODAL & INVENTARIS */}
        {assets ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>2. Posisi Aset, Modal & Inventaris Toko</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("60%")]}>Komponen Aset / Modal</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("40%")]}>Nominal / Keterangan</Text>
              </View>
              <FinancialRow label="Total Modal Stok Barang (HPP)" value={assets.inventoryCapital} isBold />
              <FinancialRow label="Total Jenis Produk Aktif (SKU)" value={`${assets.totalActiveProducts} Jenis Barang (${assets.totalStockUnits} Unit Stok Fisik)`} />
              <FinancialRow label="Piutang Aktif Pelanggan (Kasbon Belum Lunas)" value={assets.activeReceivables} isBold />
              <FinancialRow label="Estimasi Total Aset Usaha (Barang + Piutang)" value={assets.totalAssets} isBold isHighlight />
              <FinancialRow label="Modal Uang Tunai Investor" value={assets.investorMoneyCapital} />
              <FinancialRow label="Modal Barang Titipan (Konsinyasi)" value={assets.consignmentCapital} />
              <FinancialRow label="Hutang Titipan Harian (Kewajiban Mitra)" value={assets.dailyConsignmentLiability} />
            </View>
          </View>
        ) : null}

        {/* 3. METRIK ARUS TRANSAKSI PENJUALAN */}
        {data.salesChannels && data.salesChannels.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>3. Distribusi Metode Pembayaran Penjualan</Text>
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

        {/* 4. DETAIL BEBAN PENGELUARAN */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>4. Rincian Kategori Pengeluaran & Beban</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headCell, col("50%")]}>Kategori Pengeluaran</Text>
              <Text style={[styles.cell, styles.headCell, styles.right, col("20%")]}>Porsi (%)</Text>
              <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Nominal</Text>
            </View>
            {data.expenseCategories.length > 0 ? (
              data.expenseCategories.map((item, idx) => (
                <View key={item.category} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("50%")]}>{item.category}</Text>
                  <Text style={[styles.cell, styles.right, col("20%")]}>{item.percentage || "-"}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, col("30%")]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyRow text="Tidak ada catatan pengeluaran pada periode ini." />
            )}
            <View style={styles.tableRowHighlight}>
              <Text style={[styles.cell, styles.boldCell, col("70%")]}>Total Beban Operasional</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("30%")]}>
                {formatCurrency(financial.expenseTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. KINERJA PRODUK TERLARIS */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>5. Kinerja Produk Terlaris (Top Selling)</Text>
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

        {/* 6. EVALUASI PRODUK KURANG DIMINATI */}
        {data.bottomProducts && data.bottomProducts.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>6. Evaluasi Produk Lambat Terjual (Slow Moving)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("50%")]}>Nama Produk</Text>
                <Text style={[styles.cell, styles.headCell, styles.right, col("20%")]}>Unit Terjual</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Total Omzet</Text>
              </View>
              {data.bottomProducts.map((product, idx) => (
                <View key={product.productId} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("50%")]}>{product.name}</Text>
                  <Text style={[styles.cell, styles.right, col("20%")]}>{product.sold}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, col("30%")]}>
                    {formatCurrency(product.revenue)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 7. PERINGATAN STOK MENIPIS & RESTOK */}
        {data.lowStockProducts && data.lowStockProducts.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>7. Peringatan Stok Menipis (Di Bawah Minimum)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("45%")]}>Nama Produk</Text>
                <Text style={[styles.cell, styles.headCell, col("25%")]}>Kategori</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Sisa Stok / Min.</Text>
              </View>
              {data.lowStockProducts.slice(0, 10).map((item, index) => (
                <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("45%")]}>{item.name}</Text>
                  <Text style={[styles.cell, col("25%")]}>{item.category}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("30%"), { color: "#dc2626" }]}>
                    {item.stock} / {item.minimumStock}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 8. BEBAN GAJI KARYAWAN */}
        {data.employeeSalaries && data.employeeSalaries.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>8. Rincian Beban Gaji Karyawan</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("45%")]}>Nama Karyawan</Text>
                <Text style={[styles.cell, styles.headCell, col("25%")]}>Role / Jabatan</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Gaji Pokok</Text>
              </View>
              {data.employeeSalaries.map((emp, index) => (
                <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("45%")]}>{emp.name}</Text>
                  <Text style={[styles.cell, col("25%")]}>{emp.role}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("30%")]}>
                    {formatCurrency(emp.monthlySalary)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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

        {/* 10. REKAP HARIAN */}
        {data.dailyReports.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>10. Lampiran Rekap Harian</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.headCell, col("28%")]}>Tanggal</Text>
                <Text style={[styles.cell, styles.headCell, styles.right, col("24%")]}>Omzet</Text>
                <Text style={[styles.cell, styles.headCell, styles.right, col("24%")]}>Beban</Text>
                <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("24%")]}>Laba</Text>
              </View>
              {data.dailyReports.map((report, idx) => (
                <View key={report.reportDate} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.cell, col("28%")]}>{formatDate(`${report.reportDate}T12:00:00.000Z`)}</Text>
                  <Text style={[styles.cell, styles.right, col("24%")]}>{formatCurrency(report.revenue)}</Text>
                  <Text style={[styles.cell, styles.right, col("24%")]}>{formatCurrency(report.expenseTotal)}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.boldCell, col("24%")]}>{formatCurrency(report.netProfit)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 11. CATATAN PENGELOLA & PENGESAHAN */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>11. Catatan & Analisis Pengelola Toko</Text>
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
