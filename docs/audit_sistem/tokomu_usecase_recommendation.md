# Rekomendasi Pemodelan Use Case Diagram - BAB IV Laporan Kerja Praktik

Dokumen ini berisi spesifikasi teknis untuk menyusun Use Case Diagram aplikasi **TokoMu (WarungOS)** menggunakan perangkat lunak pemodelan UML standar (seperti StarUML, Enterprise Architect, Visual Paradigm, atau Draw.io).

---

## 1. Daftar Aktor dan Generalisasi

Aplikasi TokoMu memiliki **3 aktor utama** yang terdaftar di sistem RBAC (`src/lib/server/rbac.ts`) dan **3 aktor sistem eksternal**:

### Aktor Utama (Human Actors / Staf Warung)
1. **Pimpinan (`pimpinan`)**  
   - *Peran*: Pemilik warung atau Super Admin workspace.  
   - *Hak Akses*: Memiliki seluruh izin operasional kasir, administrasi keuangan, manajemen karyawan, pengaturan bagi hasil PCM, serta hak eksklusif untuk reset data workspace.
2. **Bendahara (`pengelola_keuangan`)**  
   - *Peran*: Staf administrasi keuangan warung.  
   - *Hak Akses*: Mengelola buku hutang, investor, investasi, bagi hasil, pengeluaran operasional, serta menghitung dan menyusun draft/finalisasi laporan keuangan bulanan dan PCM.
3. **Kasir (`kasir`)**  
   - *Peran*: Staf pelayanan harian warung.  
   - *Hak Akses*: Membuka/menutup sesi shift kasir pribadi, melayani transaksi penjualan di POS, mencetak struk, mencatat kasbon pelanggan, serta melakukan restok inventaris.

### Aktor Sistem Eksternal (System Actors)
4. **Google Gemini AI Engine (`ai_assistant`)**  
   - *Peran*: Mesin kecerdasan buatan berbasis LLM dan Vision.  
   - *Fungsi*: Memproses percakapan interaktif (`/api/ai/chats`), menjalankan *function tool calling* (seperti restok otomatis), dan melakukan OCR ekstraksi teks pada gambar struk belanja.
5. **Better Auth System (`auth_engine`)**  
   - *Peran*: Mesin autentikasi dan otorisasi sesi.  
   - *Fungsi*: Mengelola siklus hidup sesi pengguna (`user`, `session`, `account`, `verification`), verifikasi token *Bearer*, dan enkripsi kata sandi.
6. **PDF Rendering Engine (`@react-pdf/renderer`)**  
   - *Peran*: Komponen generator dokumen resmi.  
   - *Fungsi*: Mengonversi struktur data keuangan bulanan dan laporan PCM menjadi *stream* file PDF yang siap dicetak/diunduh.

---

## 2. Pemetaan Asosiasi Use Case dengan Aktor

| No | Nama Use Case | Aktor Terkait (Association) | Rute / Modul Bukti Kode |
|---|---|---|---|
| UC-01 | **Login & Autentikasi** | Pimpinan, Bendahara, Kasir, Better Auth System | `src/app/auth/page.tsx` & `/api/auth/[...all]` |
| UC-02 | **Logout Sesi** | Pimpinan, Bendahara, Kasir, Better Auth System | `src/components/tokomu/app-sidebar.tsx` |
| UC-03 | **Lihat Ringkasan Dashboard** | Pimpinan, Bendahara, Kasir | `src/app/(dashboard)/dashboard/page.tsx` |
| UC-04 | **Buka Sesi Shift Kasir** | Pimpinan, Bendahara, Kasir | `/api/shift-sessions` & `src/lib/server/shift-service.ts` |
| UC-05 | **Tutup Sesi Shift Kasir & Rekap** | Pimpinan, Bendahara, Kasir | `/api/shift-sessions/[id]/close` |
| UC-06 | **Melakukan Transaksi Penjualan POS** | Pimpinan, Bendahara, Kasir | `/api/transactions` & `createTransaction()` |
| UC-07 | **Cetak Struk Transaksi** | Pimpinan, Bendahara, Kasir | `src/components/tokomu/receipt-dialog.tsx` |
| UC-08 | **Kelola Katalog Produk** | Pimpinan, Bendahara, Kasir | `/api/products` & `createProduct()` |
| UC-09 | **Restok Produk Manual** | Pimpinan, Bendahara, Kasir | `/api/restock` & `restockProduct()` |
| UC-10 | **Scan & Parsing Struk OCR** | Pimpinan, Bendahara, Kasir, Google Gemini AI Engine | `/api/ai/scan-receipt` & `src/lib/server/ai/vision.ts` |
| UC-11 | **Restok & Query via AI Chat** | Pimpinan, Bendahara, Kasir, Google Gemini AI Engine | `/api/ai/chats/[id]/messages` & `tools.ts` |
| UC-12 | **Pencatatan Hutang / Kasbon Baru** | Pimpinan, Bendahara, Kasir | `/api/debts` & `createDebt()` |
| UC-13 | **Pencatatan Cicilan / Bayar Hutang** | Pimpinan, Bendahara, Kasir | `/api/debts/[id]/payments` & `recordDebtPayment()` |
| UC-14 | **Kelola Investor via Modal Pop-up** | Pimpinan, Bendahara, Kasir | `src/components/tokomu/investor-form-dialog.tsx` |
| UC-15 | **Kelola Akad Investasi (Uang & Titip Jual)** | Pimpinan, Bendahara | `/api/investments` & `createInvestment()` |
| UC-16 | **Kalkulasi & Simpan Bagi Hasil Investor** | Pimpinan, Bendahara | `/api/payouts` & `profit-sharing.ts` |
| UC-17 | **Pencatatan Pengeluaran Operasional** | Pimpinan, Bendahara, Kasir | `createExpense()` di `app-service.ts` |
| UC-18 | **Penyusunan Draft Laporan Bulanan** | Pimpinan, Bendahara | `/api/reports/monthly` & `reporting.ts` |
| UC-19 | **Finalisasi & Pengunci Laporan Bulanan** | Pimpinan, Bendahara | `/api/reports/monthly/[id]/finalize` |
| UC-20 | **Penyusunan & Kalkulasi Laporan PCM** | Pimpinan, Bendahara | `src/app/(dashboard)/laporan-pcm/page.tsx` |
| UC-21 | **Unduh PDF Laporan Resmi (Laba Rugi & PCM)**| Pimpinan, Bendahara, PDF Rendering Engine | `/api/reports/monthly/[id]/pdf` & `/api/reports/pcm/pdf` |
| UC-22 | **Manajemen Jadwal Shift** | Pimpinan, Bendahara | `/api/shifts` & `shift-service.ts` |
| UC-23 | **Undang & Kelola Staf Workspace** | Pimpinan | `/api/users/invite` & `/api/users/[id]` |
| UC-24 | **Konfigurasi Identitas & Bisnis Toko** | Pimpinan | `/api/settings` & `updateStoreSettings()` |
| UC-25 | **Reset Data Workspace (Danger Zone)** | Pimpinan | `/api/settings/reset` & `resetWorkspace()` |
| UC-26 | **Telaah Audit Log Keamanan** | Pimpinan, Bendahara, Kasir | `/api/audit-log` & `audit.ts` |

---

## 3. Relasi Khusus (`<<include>>` dan `<<extend>>`)

Dalam laporan BAB IV, penambahan relasi `<<include>>` dan `<<extend>>` memberikan nilai tambah akademis yang tinggi karena memperlihatkan modularitas arsitektur sistem:

### Relasi `<<include>>` (Keharusan / Bagian Fungsional Terintegrasi)
1. **(UC-06: Transaksi Penjualan POS) `<<include>>` (Validasi & Kurangi Stok Produk)**  
   - *Alasan*: Setiap pembuatan transaksi di `AppService.createTransaction()` selalu wajib mengecek ketersediaan stok di tabel `products` dan langsung mengurangkannya di dalam satu transaksi *database* atomik.
2. **(UC-10: Scan & Parsing Struk OCR) `<<include>>` (pencocokan Item Produk - Receipt Matcher)**  
   - *Alasan*: Setelah Google Gemini Vision mengembalikan JSON teks struk, sistem wajib menjalankan `matchReceiptItemsWithProducts()` untuk mencocokkan nama barang sebelum pratinjau ditampilkan.
3. **(UC-11: Restok via AI Chat) `<<include>>` (Eksekusi Tool `restock_product_tool`)**  
   - *Alasan*: Saat LLM mendeteksi intent restok, sistem wajib memanggil *function calling handler* di `tools.ts` untuk memproses perubahan database.
4. **(UC-20: Penyusunan Laporan PCM) `<<include>>` (Kalkulasi Porsi PCM & Cadangan)**  
   - *Alasan*: Rute `/laporan-pcm` secara sistematis memetakan persentase dari `store_profiles.profitSharePcmPct` dan `profitShareReservePct` terhadap laba bersih periode tersebut.

### Relasi `<<extend>>` (Opsi Tambahan / Kondisional)
1. **(UC-06: Transaksi Penjualan POS) `<<extend>>` (UC-07: Cetak Struk Transaksi)**  
   - *Alasan*: Cetak struk tidak wajib dilakukan untuk setiap transaksi (misalnya pelanggan tidak meminta struk), namun tombol *Lihat/Cetak Struk* selalu tersedia sebagai opsi kondisional setelah transaksi sukses.
2. **(UC-08: Kelola Katalog Produk) `<<extend>>` (UC-09: Restok Produk Manual)**  
   - *Alasan*: Restok barang merupakan aksi spesifik penambahan stok yang dapat dipanggil langsung dari baris tabel katalog inventaris.
3. **(UC-18: Penyusunan Draft Laporan Bulanan) `<<extend>>` (UC-19: Finalisasi Laporan Bulanan)**  
   - *Alasan*: Setelah draft laporan disimpan, Bendahara/Pimpinan dapat memilih untuk melanjutkan ke tahap finalisasi/penguncian jika seluruh konsolidasi bulan tersebut telah selesai.
4. **(UC-19: Finalisasi Laporan Bulanan) `<<extend>>` (UC-21: Unduh PDF Laporan Resmi)**  
   - *Alasan*: Unduh dokumen PDF Laba Rugi menjadi aktif setelah laporan bulanan memiliki status atau kalkulasi yang valid.
