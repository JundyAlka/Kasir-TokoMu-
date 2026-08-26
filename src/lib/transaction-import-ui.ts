export type ImportIssueCode =
  | "PRODUK_TIDAK_DITEMUKAN"
  | "TANGGAL_TIDAK_VALID"
  | "JUMLAH_TIDAK_VALID"
  | "KOLOM_WAJIB_KOSONG"
  | "METODE_BAYAR_TIDAK_DIKENAL"
  | "TOTAL_NOTA_TIDAK_SEIMBANG"
  | "PENYESUAIAN_TANPA_INDUK"
  | "NOTA_TOTAL_TIDAK_WAJAR"
  | "STOK_MINUS"
  | "NOTA_SUDAH_ADA"
  | "HARGA_BEDA_DARI_MASTER"
  | "MARGIN_MINUS"
  | "ADA_BARIS_PENYESUAIAN";

export const importIssueLabel: Record<ImportIssueCode, string> = {
  PRODUK_TIDAK_DITEMUKAN: "Nama produk tidak ada di daftar barang.",
  TANGGAL_TIDAK_VALID: "Tanggal transaksi tidak valid.",
  JUMLAH_TIDAK_VALID: "Jumlah harus berupa bilangan bulat lebih dari nol.",
  KOLOM_WAJIB_KOSONG: "Ada kolom wajib yang belum diisi.",
  METODE_BAYAR_TIDAK_DIKENAL: "Metode bayar harus Tunai, QRIS, atau Transfer.",
  TOTAL_NOTA_TIDAK_SEIMBANG: "Total nota tidak sama dengan jumlah subtotal item.",
  PENYESUAIAN_TANPA_INDUK: "Baris penyesuaian tidak memiliki nota produk pada tanggal dan shift yang sama.",
  NOTA_TOTAL_TIDAK_WAJAR: "Total nota harus lebih dari nol.",
  STOK_MINUS: "Stok akan menjadi minus setelah impor.",
  NOTA_SUDAH_ADA: "Nota ini sudah pernah diimpor dan akan dilewati.",
  HARGA_BEDA_DARI_MASTER: "Harga jual berbeda dari harga produk saat ini.",
  MARGIN_MINUS: "Harga jual berada di bawah harga beli (margin minus).",
  ADA_BARIS_PENYESUAIAN: "Ada baris penyesuaian catatan; stok tidak diubah.",
};

export function canContinueTransactionImport(
  errorCount: number,
  warningCount: number,
  warningsAcknowledged: boolean
) {
  return errorCount === 0 && (warningCount === 0 || warningsAcknowledged);
}

export function isCashierRestrictedPath(role: string, pathname: string) {
  if (role !== "kasir") return false;
  return ["/investor", "/bagi-hasil", "/laporan-pcm"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
