export const FIELD_HELP = {
  sku:
    "SKU (Stock Keeping Unit) adalah kode unik untuk membedakan barang di inventaris. Contoh: MIE-MKN-001 untuk Mi Instan kategori Makanan. SKU membantu kasir, restok, dan laporan supaya barang yang namanya mirip tidak tertukar.",
  reorderPoint:
    "Stok minimum adalah batas aman sebelum barang perlu direstok. Jika stok saat ini sama dengan atau di bawah angka ini, sistem akan menandai barang sebagai stok menipis.",
  costPrice:
    "Harga beli adalah modal per unit dari pemasok. Angka ini dipakai untuk menghitung nilai stok dan perkiraan laba, jadi isi sesuai biaya barang yang sebenarnya.",
  sellPrice:
    "Harga jual adalah harga yang dibayar pelanggan per unit. Pastikan lebih tinggi dari harga beli bila barang dijual untuk memperoleh margin.",
  margin:
    "Margin adalah selisih antara harga jual dan harga beli. Margin membantu melihat keuntungan kotor per barang sebelum biaya lain seperti listrik, kemasan, atau transport.",
  category:
    "Kategori membantu mengelompokkan barang, misalnya Makanan, Minuman, Sembako, atau Kebutuhan Harian. Ini memudahkan pencarian dan laporan.",
  consignment:
    "Barang titip jual adalah barang milik pemasok atau investor yang dijual di toko. Biasanya toko membagi margin sesuai kesepakatan, bukan membeli semua stok di awal.",
  stock:
    "Stok adalah jumlah barang yang tersedia saat ini. Angka ini berkurang saat transaksi dan bertambah saat restok.",
  initialStock:
    "Stok awal adalah jumlah barang saat pertama kali produk dibuat di sistem.",
} as const;

export type FieldHelpKey = keyof typeof FIELD_HELP;
