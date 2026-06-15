# Tabel Pengujian BAB IV

Hasil pengujian dijalankan dengan perintah `npm run test` pada 11 Juni 2026. Seluruh skenario menggunakan database in-memory `pg-mem` dan seed minimal TokoMu.

| Kode | Modul | Skenario Pengujian | Data Uji | Hasil yang Diharapkan | Hasil Aktual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TC-PROD-001 | Produk | Membuat produk baru dengan validasi server | Nama dengan spasi, harga beli Rp12.000, harga jual Rp15.000, stok 8 | Produk tersimpan, nama di-trim, stok sesuai | Produk tersimpan sebagai `Gula Pasir`, stok 8 | Lulus |
| TC-PROD-002 | Produk | Menolak stok negatif | Stok `-1` | Server menolak input invalid | Error validasi stok negatif diterima | Lulus |
| TC-PROD-003 | Produk | Update produk, restock, settings, expense, reset workspace | Produk roti, restock 5, reset data | Data berubah sesuai aksi dan reset mengosongkan transaksi operasional | Produk terupdate, stok menjadi 20, reset kembali ke `Warung Baru` | Lulus |
| TC-POS-001 | POS Checkout | Menjual 2 item dan mengurangi stok | `prd_kopi`, qty 2, harga Rp2.000 | Total Rp4.000 dan stok turun dari 20 ke 18 | Total Rp4.000, stok akhir 18 | Lulus |
| TC-POS-002 | POS Checkout | Menolak transaksi saat stok kurang | `prd_beras`, qty 99, stok 10 | Response 409 dan stok tidak berubah | Response 409, stok tetap 10 | Lulus |
| TC-DEBT-001 | Hutang | Membuat hutang, kirim reminder, lalu tandai lunas | Hutang Rp75.000 atas nama Pak Budi | Reminder tercatat, status paid, balance 0 secara status | `lastReminderAt` terisi dan `is_paid = 1` | Lulus |
| TC-DEBT-002 | Hutang | Menolak hutang invalid dan target paid yang tidak ada | Amount 0, debt id tidak ada | Validasi gagal dan data tidak ditemukan | Error validasi dan error `Data hutang tidak ditemukan` | Lulus |
| TC-PAYOUT-001 | Investor Payout | Menghitung murabahah 2,5% untuk 4 investor | Modal Rp1 jt, Rp2 jt, Rp1 jt, Rp3 jt | Payout Rp25 rb, Rp50 rb, Rp25 rb, Rp75 rb; total Rp175 rb | Payout per investor dan total sesuai | Lulus |
| TC-PAYOUT-002 | Investor Payout | Simpan draft payout, approve, paid, dan cegah duplikasi | Periode Juni 2026 | Draft tersimpan, status bisa berubah, periode sama tidak boleh digandakan | 4 payout tersimpan, status `disetujui` lalu `dibayar`, duplikasi ditolak | Lulus |
| TC-PAYOUT-003 | Investor Payout | Menghitung barang titip jual dari margin produk | 2 roti terjual, margin Rp2.000/item, share 15% | Base profit Rp4.000 dan payout Rp600 | Base profit Rp4.000, payout Rp600 | Lulus |
| TC-REPORT-001 | Laporan Laba Rugi | Menghitung formula laba rugi | Omzet Rp10 jt, HPP Rp7 jt, beban Rp1 jt | Net profit Rp2 jt | Net profit Rp2 jt | Lulus |
| TC-REPORT-002 | Laporan Operasional | Ringkasan harian, series, velocity, top products berbasis Asia/Jakarta | Transaksi produk roti hari berjalan | Range Jakarta konsisten, series terbentuk, top product benar | Range, series, velocity, dan top product sesuai | Lulus |
| TC-RBAC-001 | RBAC Investor | Kasir mengakses `GET /api/investors` | Role kasir | Ditolak 403 | Response 403 | Lulus |
| TC-RBAC-002 | RBAC Investor | Pimpinan mengakses `GET /api/investors` | Role pimpinan | Berhasil 200 | Response 200 | Lulus |

Ringkasan hasil otomatis:

| Perintah | Test Files | Tests | Lines | Statements | Functions | Branches | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `npm run test` | 6 passed | 13 passed | 84.21% | 83.89% | 85.56% | 57.67% | Lulus |
