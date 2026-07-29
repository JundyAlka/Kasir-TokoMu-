import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type PcmPayoutRow = {
  investmentId: string;
  investorId: string;
  investorName: string;
  type: "uang" | "barang_titip_jual";
  capital?: number;
  baseProfit: number;
  sharePct: number;
  amount: number;
  note: string;
};

export type PcmTopProductRow = {
  productId: string;
  name: string;
  sold: number;
  revenue: number;
};

export type PcmMonthlyReportData = {
  version: number;
  generatedAt: string;
  note: string;
  period: {
    year: number;
    month: number;
    label: string;
    start: string;
    end: string;
  };
  identity: {
    storeName: string;
    storeTagline: string;
    storeAddress: string;
    city: string;
    ownerName: string;
    pcmName: string;
    pcmChairmanName: string;
    pcmChairmanTitle: string;
    pcmAddress: string;
  };
  financial: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    salaries: number;
    expenseTotal: number;
    netProfit: number;
    transactionCount: number;
    averageTicket: number;
    totalInvestorPayout: number;
    pcmShare: number;
    reserveShare: number;
    storeShare: number;
    profitSharePcmPct: number;
    profitShareReservePct: number;
  };
  payouts: PcmPayoutRow[];
  topProducts: PcmTopProductRow[];
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
    paddingBottom: 10,
    marginBottom: 14,
    textAlign: "center",
  },
  org: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    lineHeight: 1.15,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 9,
    textTransform: "capitalize",
    lineHeight: 1.2,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#111827",
  },
  identityRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  identityLabel: {
    width: 108,
    color: "#4b5563",
  },
  identitySeparator: {
    width: 10,
    color: "#4b5563",
  },
  identityValue: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  opening: {
    marginBottom: 12,
  },
  openingGreeting: {
    marginBottom: 5,
    lineHeight: 1.3,
  },
  openingParagraph: {
    marginTop: 7,
    lineHeight: 1.4,
  },
  openingClosing: {
    marginTop: 7,
    lineHeight: 1.3,
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
  note: {
    minHeight: 48,
    padding: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  signatures: {
    marginTop: "auto",
    paddingTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "42%",
    textAlign: "center",
  },
  signatureSpace: {
    height: 64,
  },
  signatureName: {
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 2,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
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

function formatPeriodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function col(width: string | number) {
  return { width };
}

function normalizeOwnerName(value: string) {
  if (!value || value.includes("[Nama Bapak]")) {
    return "Pimpinan TokoMu";
  }

  return value;
}

function normalizeAddress(value: string) {
  if (!value || value.includes("[Alamat") || value === "Grabag, Magelang") {
    return "Grabag, Purworejo";
  }

  return value;
}

function normalizeCity(value: string) {
  if (!value || value === "Magelang") {
    return "Purworejo";
  }

  return value;
}

function FinancialRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: number;
}>) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, col("65%")]}>{label}</Text>
      <Text style={[styles.cell, styles.lastCell, styles.right, col("35%")]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

export function PcmMonthlyReportDocument({
  data,
}: Readonly<{
  data: PcmMonthlyReportData;
}>) {
  const identity = data.identity;
  const financial = data.financial;
  const generatedAt = data.generatedAt || new Date().toISOString();
  const storeAddress = normalizeAddress(identity.storeAddress);
  const pcmAddress = normalizeAddress(identity.pcmAddress);
  const ownerName = normalizeOwnerName(identity.ownerName);
  const city = normalizeCity(identity.city);
  const chairmanTitle = identity.pcmChairmanTitle || "Ketua PCM";
  const periodLabel = formatPeriodLabel(data.period.year, data.period.month);

  return (
    <Document title={`Laporan Bulanan TokoMu ${periodLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.org}>{identity.pcmName || "PCM Muhammadiyah Grabag"}</Text>
          <Text style={styles.title}>Laporan Bulanan TokoMu</Text>
          <Text style={styles.subtitle}>{periodLabel}</Text>
          <Text style={styles.subtitle}>{pcmAddress || storeAddress}</Text>
        </View>

        {/* Formal Opening */}
        <View style={styles.opening}>
          <Text style={styles.openingGreeting}>
            Assalamu&apos;alaikum Warahmatullahi Wabarakatuh
          </Text>
          <Text style={styles.openingGreeting}>
            Dengan hormat,
          </Text>
          <Text style={styles.openingParagraph}>
            Bersama laporan ini kami sampaikan laporan keuangan dan operasional bulanan TokoMu untuk periode {periodLabel}. Laporan ini disusun sebagai bentuk pertanggungjawaban dan transparansi pengelolaan toko amal usaha kepada {identity.pcmName || "PCM"}.
          </Text>
          <Text style={styles.openingParagraph}>
            Semoga laporan ini dapat menjadi bahan evaluasi dan masukan bagi kemajuan amal usaha kita bersama. Atas perhatian dan bimbingan Bapak/Ibu {chairmanTitle}, kami mengucapkan terima kasih.
          </Text>
          <Text style={styles.openingClosing}>Wassalamu&apos;alaikum Warahmatullahi Wabarakatuh.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Identitas</Text>
          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Nama toko</Text>
            <Text style={styles.identitySeparator}>:</Text>
            <Text style={styles.identityValue}>{identity.storeName}</Text>
          </View>
          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Alamat toko</Text>
            <Text style={styles.identitySeparator}>:</Text>
            <Text style={styles.identityValue}>{storeAddress}</Text>
          </View>
          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>{chairmanTitle}</Text>
            <Text style={styles.identitySeparator}>:</Text>
            <Text style={styles.identityValue}>{identity.pcmChairmanName || "-"}</Text>
          </View>
          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Periode</Text>
            <Text style={styles.identitySeparator}>:</Text>
            <Text style={styles.identityValue}>{periodLabel}</Text>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>2. Ringkasan Keuangan</Text>
          <View style={styles.table}>
            <FinancialRow label="Omzet penjualan" value={financial.revenue} />
            <FinancialRow label="Harga pokok penjualan (HPP)" value={financial.cogs} />
            <FinancialRow label="Laba kotor" value={financial.grossProfit} />
            <FinancialRow label="Biaya operasional" value={financial.expenses || 0} />
            <FinancialRow label="Gaji karyawan" value={financial.salaries || 0} />
            <FinancialRow label="Laba bersih" value={financial.netProfit} />
            <FinancialRow label={`Bagian PCM (${financial.profitSharePcmPct}%)`} value={financial.pcmShare} />
            <FinancialRow label={`Dana cadangan (${financial.profitShareReservePct}%)`} value={financial.reserveShare} />
            <FinancialRow label="Bagian toko" value={financial.storeShare} />
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>3. Detail Bagi Hasil Investor</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headCell, col("28%")]}>Investor</Text>
              <Text style={[styles.cell, styles.headCell, col("15%")]}>Tipe</Text>
              <Text style={[styles.cell, styles.headCell, styles.right, col("18%")]}>Modal</Text>
              <Text style={[styles.cell, styles.headCell, styles.right, col("12%")]}>Share</Text>
              <Text style={[styles.cell, styles.headCell, styles.lastCell, styles.right, col("27%")]}>Payout</Text>
            </View>
            {data.payouts.length > 0 ? (
              data.payouts.map((payout) => (
                <View key={payout.investmentId} style={styles.tableRow}>
                  <Text style={[styles.cell, col("28%")]}>{payout.investorName}</Text>
                  <Text style={[styles.cell, col("15%")]}>
                    {payout.type === "uang" ? "Uang" : "Barang"}
                  </Text>
                  <Text style={[styles.cell, styles.right, col("18%")]}>
                    {formatCurrency(payout.capital ?? payout.baseProfit)}
                  </Text>
                  <Text style={[styles.cell, styles.right, col("12%")]}>{payout.sharePct}%</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, col("27%")]}>
                    {formatCurrency(payout.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.lastCell, col("100%")]}>
                  Tidak ada payout investor pada periode ini.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>4. Top 5 Produk Terlaris</Text>
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
              <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.lastCell, col("100%")]}>
                  Belum ada penjualan produk pada periode ini.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>5. Catatan Tambahan Laporan</Text>
          <Text style={styles.note}>{data.note || "Tidak ada catatan tambahan."}</Text>
        </View>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBox}>
            <Text>{city}, {formatDate(generatedAt)}</Text>
            <Text>Pimpinan TokoMu</Text>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureName}>{ownerName}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Mengetahui,</Text>
            <Text>{chairmanTitle}</Text>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureName}>{identity.pcmChairmanName || chairmanTitle}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Dicetak dari TokoMu pada {formatDate(generatedAt)}. Dokumen ini memakai snapshot data laporan bulanan.
        </Text>
      </Page>
    </Document>
  );
}
