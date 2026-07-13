# Laporan & Daftar Lengkap Screenshot TokoMu

Dokumentasi ini berisi daftar menyeluruh setiap halaman, tab, modal, filter, hingga interaksi Asisten AI pada aplikasi **TokoMu (WarungOS)**. Seluruh screenshot diambil menggunakan automated testing Playwright pada resolusi **1440x900 (deviceScaleFactor: 2 - Retina Display)** dengan mode **full-page**.

---

## Tabel Daftar Screenshot Menyeluruh (31 Gambar)

| No | File PNG | Modul & Bagian | Deskripsi Lengkap |
| :---: | :--- | :--- | :--- |
| 1 | `gambar_4.5_login.png` | **Autentikasi** <br> *Login Form* | Halaman login utama dengan form email & password untuk masuk ke workspace. |
| 2 | `02_auth_signup_form.png` | **Autentikasi** <br> *Sign Up Form* | Form pendaftaran akun baru dengan validasi nama, email, dan password. |
| 3 | `gambar_4.6_dashboard.png` | **Dashboard** <br> *Tampilan Utama* | Ringkasan operasional harian, grafik omzet 7 hari, produk menipis, dan kasbon terbaru. |
| 4 | `08_dashboard_timeline_modal.png` | **Dashboard** <br> *Modal Timeline* | Daftar riwayat 10 transaksi terbaru berserta status dan kasir yang bertugas. |
| 5 | `gambar_4.7_kasir_pos.png` | **Kasir / POS** <br> *Tampilan Utama* | Antarmuka Point of Sale dengan filter kategori, pencarian cepat, dan panel keranjang. |
| 6 | `11_kasir_pos_filter_makanan.png` | **Kasir / POS** <br> *Filter Kategori* | Katalog produk difilter khusus menampilkan kategori Makanan. |
| 7 | `12_kasir_pos_cart_filled.png` | **Kasir / POS** <br> *Keranjang Terisi* | Daftar belanja pelanggan dengan kalkulasi subtotal dan pilihan metode bayar. |
| 8 | `13_kasir_pos_qris_preview.png` | **Kasir / POS** <br> *Pembayaran QRIS* | Tampilan QRIS yang siap dipindai oleh e-wallet atau m-banking pelanggan. |
| 9 | `14_kasir_pos_transfer_modal.png` | **Kasir / POS** <br> *Pembayaran Transfer* | Instruksi transfer rekening bank dan e-wallet beserta tombol konfirmasi pembayaran. |
| 10 | `gambar_4.8_inventaris.png` | **Inventaris** <br> *Tabel Produk* | Daftar lengkap produk, SKU, harga beli, harga jual, margin keuntungan, dan stok minimum. |
| 11 | `20_inventaris_modal_add_product.png` | **Inventaris** <br> *Modal Tambah Produk* | Formulir penambahan barang dengan kalkulasi otomatis margin keuntungan. |
| 12 | `21_inventaris_modal_edit_product.png` | **Inventaris** <br> *Modal Edit Produk* | Formulir pengubahan data produk, harga dasar, dan batas stok minimum. |
| 13 | `22_inventaris_modal_restock_product.png` | **Inventaris** <br> *Modal Restok Cepat* | Jendela penambahan jumlah stok persediaan produk secara instan. |
| 14 | `gambar_4.12_ai.png` | **Restok AI** <br> *OCR Scanner* | Pemindai struk belanja supplier dengan kecerdasan buatan untuk restok massal otomatis. |
| 15 | `gambar_4.9_buku_hutang.png` | **Buku Hutang** <br> *Tab Semua* | Daftar lengkap kasbon pelanggan, sisa tagihan, dan tenggat waktu pembayaran. |
| 16 | `25_buku_hutang_tab_aktif.png` | **Buku Hutang** <br> *Tab Aktif* | Filter kasbon yang sedang berjalan dan belum memasuki batas jatuh tempo. |
| 17 | `26_buku_hutang_tab_lewat_tempo.png` | **Buku Hutang** <br> *Tab Lewat Tempo* | Daftar tagihan yang melebihi batas waktu pembayaran dan siap dikirimi pengingat WhatsApp. |
| 18 | `27_buku_hutang_tab_lunas.png` | **Buku Hutang** <br> *Tab Lunas* | Arsip kasbon dan cicilan pelanggan yang telah dibayar lunas sepenuhnya. |
| 19 | `30_buku_hutang_modal_detail_debt.png` | **Buku Hutang** <br> *Modal Detail & Cicilan* | Riwayat pembayaran cicilan pelanggan dan tombol kirim pengingat tagihan via WA. |
| 20 | `gambar_4.10_investor.png` | **Investor** <br> *Tampilan Daftar* | Kelola porsi kepemilikan saham/investasi dan persentase bagi hasil mitra pemodal. |
| 21 | `33_investor_form_tambah_baru.png` | **Investor** <br> *Tambah Investor* | Formulir pendaftaran mitra investor baru beserta kesepakatan porsi modal awal. |
| 22 | `34_bagi_hasil_pengeluaran_main.png` | **Bagi Hasil & Pengeluaran** <br> *Tampilan Utama* | Pencatatan pengeluaran rutin warung (listrik, sewa, gaji) dan riwayat distribusi laba. |
| 23 | `gambar_4.11_laporan.png` | **Laporan Bulanan** <br> *Tampilan Utama (Bulan)* | Laporan laba rugi komprehensif, HPP, kurva tren omzet bulanan, dan valuasi bisnis. |
| 24 | `37_laporan_tab_mingguan.png` | **Laporan Bulanan** <br> *Tren 1 Minggu* | Analisis performa dan kurva pendapatan harian dalam rentang 1 minggu terakhir. |
| 25 | `38_laporan_pcm_main.png` | **Laporan PCM** <br> *Tampilan Utama* | Laporan pertanggungjawaban dan transparansi keekonomian khusus untuk persyarikatan PCM. |
| 26 | `gambar_4.14_pengaturan.png` | **Pengaturan** <br> *Tab Profil Warung* | Pengaturan identitas toko, alamat, batas alert stok menipis, dan opsi metode pembayaran. |
| 27 | `gambar_4.13_admin.png` | **Pengaturan** <br> *Tab Shift Kasir* | Pembukaan dan penutupan sesi shift kasir beserta rekonsiliasi saldo kas tunai laci. |
| 28 | `41_pengaturan_karyawan_list.png` | **Manajemen Karyawan** <br> *Daftar & Invite* | Kelola hak akses (RBAC) pimpinan, kasir, bendahara, serta pengundangan anggota baru. |
| 29 | `42_pengaturan_audit_log_table.png` | **Audit Log** <br> *Tabel Riwayat Log* | Catatan kronologis setiap aktivitas login, perubahan data, restok, dan transaksi kasir. |
| 30 | `44_ai_assistant_sidebar_open.png` | **Asisten AI** <br> *Panel Terbuka* | Panel percakapan cerdas dengan prompt rekomendasi cepat untuk analisis bisnis. |
| 31 | `45_ai_assistant_sidebar_chatting.png` | **Asisten AI** <br> *Respons Analisis* | Kecerdasan buatan menyajikan insight bisnis, kartu data interaktif, dan saran tindakan. |

---

## Panduan Pemanfaatan Laporan
- Semua gambar tersimpan di direktori: `d:\project\Kasir TokoMu\warungos\screenshots\`
- Dapat langsung dilampirkan ke laporan akhir proyek, buku panduan pengguna (User Manual), atau lampiran presentasi teknis.
