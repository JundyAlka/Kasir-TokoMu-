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
    transactionCount: number;
    averageTicket: number;
  };
  expenseCategories: Array<{
    category: string;
    amount: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sold: number;
    revenue: number;
  }>;
  ownerNotes: string[];
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1f2937",
    lineHeight: 1.35,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 12,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 9,
    textTransform: "uppercase",
    color: "#6b7280",
  },
  title: {
    marginTop: 4,
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 10,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cell: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headCell: {
    fontFamily: "Helvetica-Bold",
  },
  right: {
    textAlign: "right",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryCard: {
    width: "48%",
    padding: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  summaryLabel: {
    color: "#6b7280",
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  formula: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  noteBox: {
    padding: 7,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff7ed",
  },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 20,
    color: "#6b7280",
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
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
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function col(width: string | number) {
  return { width };
}

function FinancialRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: number | string;
}>) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, col("62%")]}>{label}</Text>
      <Text style={[styles.cell, styles.lastCell, styles.right, col("38%")]}>
        {typeof value === "number" ? formatCurrency(value) : value}
      </Text>
    </View>
  );
}

function EmptyRow({ text }: Readonly<{ text: string }>) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.lastCell, col("100%")]}>{text}</Text>
    </View>
  );
}

export function ProfitLossReportDocument({
  data,
}: Readonly<{
  data: ProfitLossPdfData;
}>) {
  const financial = data.financial;
  const grossMargin =
    financial.revenue > 0 ? `${Math.round((financial.grossProfit / financial.revenue) * 1000) / 10}%` : "0%";
  const netMargin =
    financial.revenue > 0 ? `${Math.round((financial.netProfit / financial.revenue) * 1000) / 10}%` : "0%";

  return (
    <Document title={`Laporan Untung Rugi ${data.period.label}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TokoMu report</Text>
          <Text style={styles.title}>Laporan Untung Rugi</Text>
          <Text style={styles.subtitle}>{data.identity.storeName}</Text>
          <Text style={styles.subtitle}>
            {data.period.label} - {formatDate(data.period.start)} s.d. sebelum {formatDate(data.period.end)}
          </Text>
          <Text style={styles.subtitle}>
            {[data.identity.storeTagline, data.identity.city].filter(Boolean).join(" - ")}
          </Text>
          <Text style={styles.subtitle}>{data.identity.storeAddress}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Omzet</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.revenue)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Laba kotor</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.grossProfit)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Pengeluaran</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.expenseTotal)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Laba bersih</Text>
              <Text style={styles.summaryValue}>{formatCurrency(financial.netProfit)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detail Perhitungan</Text>
          <View style={styles.table}>
            <FinancialRow label="Omzet penjualan" value={financial.revenue} />
            <FinancialRow label="Harga pokok penjualan (HPP)" value={financial.cogs} />
            <FinancialRow label="Laba kotor" value={financial.grossProfit} />
            <FinancialRow label="Beban operasional" value={financial.expenseTotal} />
            <FinancialRow label="Laba bersih" value={financial.netProfit} />
            <FinancialRow label="Jumlah transaksi" value={`${financial.transactionCount} transaksi`} />
            <FinancialRow label="Rata-rata transaksi" value={financial.averageTicket} />
            <FinancialRow label="Margin kotor" value={grossMargin} />
            <FinancialRow label="Margin bersih" value={netMargin} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rumus</Text>
          <View style={styles.formula}>
            <Text>Omzet = total nilai transaksi penjualan pada periode aktif.</Text>
            <Text>HPP = jumlah costPrice x quantity dari item transaksi yang terjual.</Text>
            <Text>Laba kotor = omzet - HPP.</Text>
            <Text>Laba bersih = laba kotor - pengeluaran.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catatan untuk Pemilik Warung</Text>
          {data.ownerNotes.length > 0 ? (
            data.ownerNotes.map((note, index) => (
              <View key={`${note}-${index}`} style={styles.noteBox}>
                <Text>{note}</Text>
              </View>
            ))
          ) : (
            <View style={styles.noteBox}>
              <Text>Tidak ada catatan tambahan untuk periode ini.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori Pengeluaran</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headCell, col("65%")]}>Kategori</Text>
              <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("35%")]}>Nominal</Text>
            </View>
            {data.expenseCategories.length > 0 ? (
              data.expenseCategories.map((item) => (
                <View key={item.category} style={styles.tableRow}>
                  <Text style={[styles.cell, col("65%")]}>{item.category}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, col("35%")]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyRow text="Tidak ada pengeluaran pada periode ini." />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produk Terlaris</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headCell, col("50%")]}>Produk</Text>
              <Text style={[styles.cell, styles.headCell, styles.right, col("20%")]}>Terjual</Text>
              <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("30%")]}>Omzet</Text>
            </View>
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product) => (
                <View key={product.productId} style={styles.tableRow}>
                  <Text style={[styles.cell, col("50%")]}>{product.name}</Text>
                  <Text style={[styles.cell, styles.right, col("20%")]}>{product.sold}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, col("30%")]}>
                    {formatCurrency(product.revenue)}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyRow text="Belum ada penjualan produk pada periode ini." />
            )}
          </View>
        </View>

        <Text style={styles.footer}>
          Dibuat otomatis oleh TokoMu pada {formatDate(data.generatedAt)}. Data diambil dari transaksi, item transaksi,
          dan pengeluaran periode aktif.
        </Text>
      </Page>
    </Document>
  );
}
