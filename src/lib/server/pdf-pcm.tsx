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

export type PcmExpenseCategoryRow = {
  category: string;
  amount: number;
  percentage?: string;
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
    profitDistribution?: number;
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
  expenseCategories?: PcmExpenseCategoryRow[];
  topProducts?: PcmTopProductRow[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 38,
    paddingHorizontal: 36,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#1e293b",
    lineHeight: 1.35,
  },
  // KOP HEADER RESMI
  headerContainer: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#92400e",
  },
  subHeaderLine: {
    marginTop: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: "#cbd5e1",
  },
  headerOrg: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#92400e",
    textAlign: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#0f172a",
    textAlign: "center",
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 8.5,
    color: "#475569",
    textAlign: "center",
    marginTop: 2,
  },
  metaBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  metaBadge: {
    fontSize: 7.5,
    color: "#64748b",
  },
  metaBadgeStatus: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#047857",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "#a7f3d0",
  },
  // MUQADDIMAH
  openingBox: {
    backgroundColor: "#fafaf9",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  greetingText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: "#44403c",
    marginBottom: 3,
  },
  openingParagraph: {
    fontSize: 8,
    color: "#57534e",
    lineHeight: 1.35,
    marginBottom: 3,
  },
  // IDENTITAS GRID
  identityContainer: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 7,
    marginBottom: 10,
  },
  identityCol: {
    flex: 1,
  },
  identityRow: {
    flexDirection: "row",
    marginBottom: 2.5,
  },
  identityLabel: {
    width: 82,
    fontSize: 8,
    color: "#64748b",
  },
  identitySep: {
    width: 8,
    fontSize: 8,
    color: "#64748b",
  },
  identityVal: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  // KPI CARDS GRID
  kpiGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 6,
  },
  kpiCardPrimary: {
    flex: 1,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 4,
    padding: 6,
  },
  kpiCardSuccess: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 4,
    padding: 6,
  },
  kpiLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
  },
  kpiLabelPrimary: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    textTransform: "uppercase",
  },
  kpiLabelSuccess: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginTop: 2,
  },
  kpiValuePrimary: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#78350f",
    marginTop: 2,
  },
  kpiValueSuccess: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#14532d",
    marginTop: 2,
  },
  kpiSubtext: {
    fontSize: 6.5,
    color: "#64748b",
    marginTop: 1.5,
  },
  // SECTION HEADERS
  section: {
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionBadge: {
    backgroundColor: "#92400e",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 5,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  // TABEL FORMATTING
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  tableHeaderDark: {
    flexDirection: "row",
    backgroundColor: "#475569",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headCell: {
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    fontSize: 7.5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#cbd5e1",
  },
  headCellDark: {
    fontFamily: "Helvetica-Bold",
    color: "#f8fafc",
    fontSize: 7.5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#64748b",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  tableRowAlternate: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  tableRowHighlight: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  tableRowTotal: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
  },
  tableRowGrandTotal: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderTopWidth: 1.5,
    borderTopColor: "#475569",
  },
  cell: {
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: "#e2e8f0",
    color: "#334155",
  },
  cellBold: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  lastCell: {
    borderRightWidth: 0,
  },
  right: {
    textAlign: "right",
  },
  center: {
    textAlign: "center",
  },
  // NOTES & SIGNATURES
  noteContainer: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
    borderRadius: 3,
    padding: 6,
  },
  noteText: {
    fontSize: 8,
    color: "#475569",
    lineHeight: 1.35,
  },
  signatures: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "44%",
    textAlign: "center",
  },
  signatureHeader: {
    fontSize: 8,
    color: "#64748b",
  },
  signatureRole: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginTop: 1,
  },
  signatureSpace: {
    height: 48,
  },
  signatureName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    paddingBottom: 2,
  },
  signaturePcmTitle: {
    fontSize: 7.5,
    color: "#64748b",
    marginTop: 1.5,
  },
  // FOOTER
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 7,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDateIndo(value: string) {
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

  const revenue = financial.revenue || 0;
  const cogs = financial.cogs || 0;
  const grossProfit = financial.grossProfit || 0;
  const expenses = financial.expenses || 0;
  const salaries = financial.salaries || 0;
  const expenseTotal = financial.expenseTotal || (expenses + salaries);
  const netProfit = financial.netProfit || (grossProfit - expenseTotal);

  const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";
  const netMarginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  // Filter or aggregate expense categories if provided
  const expenseCategories = (data.expenseCategories && data.expenseCategories.length > 0)
    ? data.expenseCategories
    : [
        { category: "Gaji & Honor Karyawan", amount: salaries, percentage: expenseTotal > 0 ? `${((salaries / expenseTotal) * 100).toFixed(1)}%` : "0%" },
        { category: "Operasional & Utilitas Toko", amount: expenses, percentage: expenseTotal > 0 ? `${((expenses / expenseTotal) * 100).toFixed(1)}%` : "0%" },
      ].filter((e) => e.amount > 0);

  const totalExpenseCategorySum = expenseCategories.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Document title={`Laporan Bulanan TokoMu ${periodLabel}`}>
      <Page size="A4" style={styles.page}>
        {/* KOP RESMI LAPORAN */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerOrg}>{identity.pcmName || "PCM MUHAMMADIYAH GRABAG"}</Text>
          <Text style={styles.headerTitle}>LAPORAN PERTANGGUNGJAWABAN KEUANGAN BULANAN</Text>
          <Text style={styles.headerSubtitle}>
            {identity.storeName || "TokoMu"} • {storeAddress || pcmAddress} • Periode: {periodLabel}
          </Text>
          <View style={styles.subHeaderLine} />
          <View style={styles.metaBadgeRow}>
            <Text style={styles.metaBadge}>
              Dokumen: TokoMu-LPJ/{data.period.year}/{String(data.period.month).padStart(2, "0")}
            </Text>
            <Text style={styles.metaBadgeStatus}>✓ Terverifikasi Sistem Kasir</Text>
          </View>
        </View>

        {/* MUQADDIMAH PENGANTAR RESMI */}
        <View style={styles.openingBox}>
          <Text style={styles.greetingText}>
            Assalamu&apos;alaikum Warahmatullahi Wabarakatuh
          </Text>
          <Text style={styles.openingParagraph}>
            Bersama ini kami sampaikan laporan pertanggungjawaban keuangan dan operasional bulanan TokoMu untuk periode <Text style={{ fontFamily: "Helvetica-Bold" }}>{periodLabel}</Text>. Laporan ini disusun secara transparan dan akuntabel sebagai bentuk amanah pengelolaan amal usaha ekonomi persyarikatan kepada {identity.pcmName || "Pimpinan Cabang Muhammadiyah"}.
          </Text>
        </View>

        {/* 1. IDENTITAS & INFORMASI AMAL USAHA */}
        <View style={styles.identityContainer}>
          <View style={styles.identityCol}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Unit Usaha</Text>
              <Text style={styles.identitySep}>:</Text>
              <Text style={styles.identityVal}>{identity.storeName || "TokoMu"}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Alamat Toko</Text>
              <Text style={styles.identitySep}>:</Text>
              <Text style={styles.identityVal}>{storeAddress}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Pimpinan Toko</Text>
              <Text style={styles.identitySep}>:</Text>
              <Text style={styles.identityVal}>{ownerName}</Text>
            </View>
          </View>
          <View style={styles.identityCol}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Badan Pembina</Text>
              <Text style={styles.identitySep}>:</Text>
              <Text style={styles.identityVal}>{identity.pcmName || "PCM Muhammadiyah Grabag"}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>{chairmanTitle}</Text>
              <Text style={styles.identitySep}>:</Text>
              <Text style={styles.identityVal}>{identity.pcmChairmanName || "-"}</Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>Periode Buku</Text>
              <Text style={styles.identitySep}>:</Text>
              <Text style={styles.identityVal}>{periodLabel}</Text>
            </View>
          </View>
        </View>

        {/* 2. RINGKASAN INDIKATOR KINERJA UTAMA (KPIs) */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Omzet Penjualan</Text>
            <Text style={styles.kpiValue}>{formatCurrency(revenue)}</Text>
            <Text style={styles.kpiSubtext}>{financial.transactionCount || 0} transaksi kasir</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Laba Kotor Usaha</Text>
            <Text style={styles.kpiValue}>{formatCurrency(grossProfit)}</Text>
            <Text style={styles.kpiSubtext}>Margin Kotor: {grossMarginPct}%</Text>
          </View>
          <View style={netProfit >= 0 ? styles.kpiCardSuccess : styles.kpiCard}>
            <Text style={netProfit >= 0 ? styles.kpiLabelSuccess : styles.kpiLabel}>Laba Bersih Toko</Text>
            <Text style={netProfit >= 0 ? styles.kpiValueSuccess : styles.kpiValue}>{formatCurrency(netProfit)}</Text>
            <Text style={styles.kpiSubtext}>Margin Bersih: {netMarginPct}%</Text>
          </View>
          <View style={styles.kpiCardPrimary}>
            <Text style={styles.kpiLabelPrimary}>Bagi Hasil PCM + Cadangan</Text>
            <Text style={styles.kpiValuePrimary}>
              {formatCurrency((financial.pcmShare || 0) + (financial.reserveShare || 0))}
            </Text>
            <Text style={styles.kpiSubtext}>Porsi PCM: {financial.profitSharePcmPct}%</Text>
          </View>
        </View>

        {/* 3. LAPORAN LABA RUGI KOMPREHENSIF */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionBadge}>1</Text>
            <Text style={styles.sectionTitle}>Laporan Laba Rugi Komprehensif (P&amp;L)</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeaderDark}>
              <Text style={[styles.headCellDark, col("55%")]}>Komponen Akun Keuangan</Text>
              <Text style={[styles.headCellDark, col("20%")]}>Keterangan Pos</Text>
              <Text style={[styles.headCellDark, styles.lastCell, styles.right, col("25%")]}>Jumlah (IDR)</Text>
            </View>
            
            {/* A. PENDAPATAN */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.cellBold, col("55%")]}>A. Omzet Penjualan Kasir</Text>
              <Text style={[styles.cell, col("20%")]}>Realisasi penjualan</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, col("25%")]}>{formatCurrency(revenue)}</Text>
            </View>

            {/* B. HPP */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, col("55%")]}>B. Harga Pokok Penjualan (HPP)</Text>
              <Text style={[styles.cell, col("20%")]}>Modal barang terjual</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, col("25%")]}>{formatCurrency(cogs)}</Text>
            </View>

            {/* LABA KOTOR */}
            <View style={styles.tableRowHighlight}>
              <Text style={[styles.cell, styles.cellBold, col("55%")]}>LABA KOTOR USAHA (A - B)</Text>
              <Text style={[styles.cell, styles.cellBold, col("20%")]}>Gross Margin: {grossMarginPct}%</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, col("25%")]}>
                {formatCurrency(grossProfit)}
              </Text>
            </View>

            {/* C. BEBAN OPERASIONAL */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, col("55%")]}>   • Beban Gaji &amp; Honor Karyawan</Text>
              <Text style={[styles.cell, col("20%")]}>Tenaga kerja toko</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, col("25%")]}>{formatCurrency(salaries)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cell, col("55%")]}>   • Beban Operasional &amp; Utilitas Toko</Text>
              <Text style={[styles.cell, col("20%")]}>Listrik, ATK, pemeliharaan</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, col("25%")]}>{formatCurrency(expenses)}</Text>
            </View>
            <View style={styles.tableRowTotal}>
              <Text style={[styles.cell, styles.cellBold, col("55%")]}>C. Total Beban Operasional Usaha</Text>
              <Text style={[styles.cell, col("20%")]}>Beban periode ini</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, col("25%")]}>
                {formatCurrency(expenseTotal)}
              </Text>
            </View>

            {/* LABA BERSIH */}
            <View style={styles.tableRowGrandTotal}>
              <Text style={[styles.cell, styles.cellBold, { fontSize: 9 }, col("55%")]}>
                LABA BERSIH USAHA TOKOMU (Laba Kotor - Beban)
              </Text>
              <Text style={[styles.cell, styles.cellBold, col("20%")]}>Net Margin: {netMarginPct}%</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, { fontSize: 9 }, col("25%")]}>
                {formatCurrency(netProfit)}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. ALOKASI & DISTRIBUSI HASIL USAHA PERSYARIKATAN */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionBadge}>2</Text>
            <Text style={styles.sectionTitle}>Alokasi &amp; Distribusi Hasil Usaha Persyarikatan</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headCell, col("45%")]}>Pos Alokasi / Penerima Manfaat</Text>
              <Text style={[styles.headCell, col("25%")]}>Dasar Porsi / Ketentuan</Text>
              <Text style={[styles.headCell, styles.lastCell, styles.right, col("30%")]}>Nominal Distribusi</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.cellBold, col("45%")]}>
                Bagian PCM Muhammadiyah
              </Text>
              <Text style={[styles.cell, col("25%")]}>{financial.profitSharePcmPct}% dari laba bersih</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, col("30%")]}>
                {formatCurrency(financial.pcmShare)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cell, col("45%")]}>
                Dana Cadangan Pengembangan Toko
              </Text>
              <Text style={[styles.cell, col("25%")]}>{financial.profitShareReservePct}% dari laba bersih</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, col("30%")]}>
                {formatCurrency(financial.reserveShare)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cell, col("45%")]}>
                Bagian Toko / Pengelola TokoMu
              </Text>
              <Text style={[styles.cell, col("25%")]}>Sisa alokasi laba toko</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, col("30%")]}>
                {formatCurrency(financial.storeShare)}
              </Text>
            </View>
            <View style={styles.tableRowTotal}>
              <Text style={[styles.cell, styles.cellBold, col("45%")]}>
                Total Hak Bagi Hasil Investor / Mitra
              </Text>
              <Text style={[styles.cell, col("25%")]}>{data.payouts.length} mitra terdaftar</Text>
              <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, col("30%")]}>
                {formatCurrency(financial.totalInvestorPayout || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. RINCIAN BAGI HASIL MITRA / INVESTOR (JIKA ADA) */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionBadge}>3</Text>
            <Text style={styles.sectionTitle}>Ringkasan Bagi Hasil Mitra / Investor</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headCell, col("28%")]}>Nama Mitra / Investor</Text>
              <Text style={[styles.headCell, col("18%")]}>Jenis Akad</Text>
              <Text style={[styles.headCell, styles.right, col("20%")]}>Modal / Omzet Basis</Text>
              <Text style={[styles.headCell, styles.right, col("14%")]}>Porsi Nisbah</Text>
              <Text style={[styles.headCell, styles.lastCell, styles.right, col("20%")]}>Bagi Hasil Diterima</Text>
            </View>
            {data.payouts.length > 0 ? (
              data.payouts.map((payout) => (
                <View key={payout.investmentId} style={styles.tableRow}>
                  <Text style={[styles.cell, col("28%")]}>{payout.investorName}</Text>
                  <Text style={[styles.cell, col("18%")]}>
                    {payout.type === "uang" ? "Murabahah Modal" : "Konsinyasi Barang"}
                  </Text>
                  <Text style={[styles.cell, styles.right, col("20%")]}>
                    {formatCurrency(payout.capital ?? payout.baseProfit)}
                  </Text>
                  <Text style={[styles.cell, styles.right, col("14%")]}>{payout.sharePct}%</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, col("20%")]}>
                    {formatCurrency(payout.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.lastCell, col("100%")]}>
                  Seluruh modal bersumber mandiri/toko, tidak ada kewajiban bagi hasil investor pihak ketiga pada periode ini.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 6. RINGKASAN KATEGORI PENGELUARAN OPERASIONAL */}
        {expenseCategories.length > 0 && (
          <View style={styles.section} wrap={false}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionBadge}>4</Text>
              <Text style={styles.sectionTitle}>Ringkasan Beban Operasional per Kategori</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headCell, col("8%"), styles.center]}>No</Text>
                <Text style={[styles.headCell, col("52%")]}>Kategori Pengeluaran Toko</Text>
                <Text style={[styles.headCell, styles.right, col("22%")]}>Porsi Beban</Text>
                <Text style={[styles.headCell, styles.lastCell, styles.right, col("18%")]}>Total Biaya</Text>
              </View>
              {expenseCategories.map((cat, idx) => (
                <View key={cat.category} style={idx % 2 === 1 ? styles.tableRowAlternate : styles.tableRow}>
                  <Text style={[styles.cell, col("8%"), styles.center]}>{idx + 1}</Text>
                  <Text style={[styles.cell, col("52%")]}>{cat.category}</Text>
                  <Text style={[styles.cell, styles.right, col("22%")]}>{cat.percentage || "-"}</Text>
                  <Text style={[styles.cell, styles.lastCell, styles.right, col("18%")]}>
                    {formatCurrency(cat.amount)}
                  </Text>
                </View>
              ))}
              <View style={styles.tableRowTotal}>
                <Text style={[styles.cell, styles.cellBold, col("60%")]}>Total Beban Operasional Terdata</Text>
                <Text style={[styles.cell, styles.right, styles.cellBold, col("22%")]}>100%</Text>
                <Text style={[styles.cell, styles.lastCell, styles.right, styles.cellBold, col("18%")]}>
                  {formatCurrency(totalExpenseCategorySum || expenseTotal)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 7. CATATAN & PESAN PERTANGGUNGJAWABAN */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionBadge}>5</Text>
            <Text style={styles.sectionTitle}>Catatan Evaluasi &amp; Rekomendasi Pengelolaan</Text>
          </View>
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>
              {data.note || "Kondisi operasional dan transaksi kasir toko berjalan stabil sesuai target pencatatan. Transparansi laporan dijaga melalui rekapitulasi data POS dan pembukuan rutin harian."}
            </Text>
          </View>
        </View>

        {/* 8. PENGESAHAN & TANDA TANGAN */}
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureHeader}>{city}, {formatDateIndo(generatedAt)}</Text>
            <Text style={styles.signatureRole}>Pihak Pengelola (Pimpinan TokoMu)</Text>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureName}>{ownerName}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureHeader}>Mengetahui &amp; Menyetujui,</Text>
            <Text style={styles.signatureRole}>{chairmanTitle}</Text>
            <View style={styles.signatureSpace} />
            <Text style={styles.signatureName}>{identity.pcmChairmanName || `Pimpinan PCM ${identity.pcmName ? identity.pcmName.replace(/^pcm\s+/i, "") : ""}`}</Text>
            <Text style={styles.signaturePcmTitle}>{identity.pcmName || "PCM Muhammadiyah Grabag"}</Text>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text>Dokumen Resmi Laporan Keuangan TokoMu • PCM Muhammadiyah Grabag</Text>
          <Text>Dicetak: {formatDateIndo(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}
