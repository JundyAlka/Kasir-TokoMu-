# Rekomendasi Pemilihan Activity Diagram untuk BAB IV Laporan Kerja Praktik

Dalam penulisan BAB IV Laporan Kerja Praktik (Implementasi & Pembahasan Pembahasan Sistem), menyajikan 22 Activity Diagram sekaligus sering kali terlalu padat dan repetitif (misalnya operasi CRUD standar seperti Tambah/Edit/Hapus Produk). 

Oleh karena itu, kami merekomendasikan **8 Activity Diagram utama** yang paling representatif, kompleks, dan menunjukkan keunggulan arsitektur teknis TokoMu (termasuk integrasi LLM/Vision AI, transaksi POS atomik, manajemen kasbon, dan bagi hasil akuntansi syariah/konsinyasi).

---

## Daftar 8 Activity Diagram Rekomendasi Prioritas BAB IV

### 1. Alur Transaksi Penjualan POS Kasir (Dengan Validasi Stok Atomik)
- **Alasan Pemilihan**: Ini adalah inti bisnis operasional toko (*core business process*). Alur ini memperlihatkan percabangan (*decision node*) metode pembayaran (Tunai/QRIS/Transfer), pengecekan kecukupan uang tunai, serta verifikasi stok barang yang dieksekusi di dalam *database transaction* Drizzle ORM (`tx.update`) secara atomik.
- **Komponen Kunci**: `AppService.createTransaction()`, tabel `transactions`, `transaction_items`, dan `products`.

### 2. Alur Pembukaan & Penutupan Sesi Shift Kasir (Dengan Rekap Selisih Kas)
- **Alasan Pemilihan**: Menunjukkan kontrol keamanan kasir (`audit_logs`) dan rekonsiliasi keuangan fisik vs sistem. Alur ini memiliki perhitungan otomatis `expectedCash = openingCash + totalTunai` dan penentuan selisih (`difference`) yang mencegah kecurangan di kasir.
- **Komponen Kunci**: `ShiftService.openShiftSession()` & `closeShiftSession()`, tabel `shift_sessions` dan `transactions`.

### 3. Alur Restok via AI Vision OCR Scan Struk
- **Alasan Pemilihan**: Menunjukkan inovasi teknologi tinggi (*High-Tech Value*) yang membedakan TokoMu dari aplikasi kasir biasa. Alur ini melibatkan pemanggilan eksternal Google Gemini Vision (`gemini-2.5-flash`), ekstraksi JSON tabular, dan eksekusi algoritma pencocokan string (`receipt-matcher.ts`) sebelum konfirmasi pengguna.
- **Komponen Kunci**: `/api/ai/scan-receipt`, `vision.ts`, `receipt-matcher.ts`, tabel `restock_logs`.

### 4. Alur Restok & Interaksi via AI Assistant Chat (Function Tool Calling)
- **Alasan Pemilihan**: Memperlihatkan penerapan *LLM Function Tool Calling* di mana AI tidak hanya menjawab teks biasa, tetapi mampu mengenali *intent* pengguna dan mengeksekusi fungsi *backend* (`restock_product_tool`) secara otonom lalu menyimpan log eksekusi ke `ai_messages`.
- **Komponen Kunci**: `/api/ai/chats/[id]/messages`, `tools.ts`, tabel `ai_messages` dan `products`.

### 5. Alur Pencatatan & Pembayaran Kasbon (Buku Hutang dengan Auto-Lunas)
- **Alasan Pemilihan**: Menunjukkan alur logika bisnis yang cerdas di mana setiap pembayaran cicilan (`debt_payments`) diakumulasikan ke `paid_amount`, dan sistem memiliki *decision node* yang secara otomatis merubah status hutang menjadi `lunas` (`is_paid = 1`) ketika cicilan telah memenuhi total tagihan.
- **Komponen Kunci**: `AppService.recordDebtPayment()`, tabel `debts` dan `debt_payments`.

### 6. Alur Penambahan Investor via Modal Pop-up (Refaktor Alur Tanpa Navigasi)
- **Alasan Pemilihan**: Menyoroti perbaikan efisiensi UX (*User Experience*) dan arsitektur *dialog component* (`InvestorFormDialog`). Alur ini memperlihatkan bagaimana pengguna tetap berada pada *context* tabel investor saat menambahkan data baru, sekaligus pengamanan *route redirect* pada `/investor/baru`.
- **Komponen Kunci**: `investor-form-dialog.tsx`, `src/app/(dashboard)/investor/page.tsx`, tabel `investors`.

### 7. Alur Kalkulasi & Persetujuan Bagi Hasil Investor (Akuntansi Syariah & Konsinyasi)
- **Alasan Pemilihan**: Menunjukkan kedalaman domain akuntansi UMKM syariah di mana sistem membedakan perhitungan *return* modal uang (`monthlyReturnRatePct`) dan perhitungan unit terjual barang konsinyasi (`unitCount * profitSharePerUnitPct`) yang diakumulasikan dari riwayat transaksi bulanan.
- **Komponen Kunci**: `ProfitSharingService.calculateProfitSharing()`, tabel `investments` dan `investor_payouts`.

### 8. Alur Finalisasi Laporan Bulanan & Unduh PDF Resmi (@react-pdf Stream)
- **Alasan Pemilihan**: Menunjukkan bagaimana sistem mengunci data laporan (`monthly_reports.status = 'final'`) untuk mencegah manipulasi data masa lalu, dan bagaimana *engine* `@react-pdf/renderer` mengonversi struktur JSON menjadi *binary stream* PDF laba rugi maupun Laporan PCM secara dinamis di server.
- **Komponen Kunci**: `ReportingService.finalizeMonthlyReport()`, `/api/reports/monthly/[id]/pdf`, dan `pdf-profit-loss.tsx`.

---

## Tips Penggambaran Diagram Aktivitas di StarUML / Enterprise Architect
1. Gunakan **Swimlanes (Partitions)** untuk memisahkan tanggung jawab antara:
   - **User / Client UI** (Kasir / Bendahara / Pimpinan)
   - **Next.js Server / API Controller** (`src/app/api/...`)
   - **Service / Business Logic Layer** (`src/lib/server/...`)
   - **Database / External Engine** (PostgreSQL / Gemini AI / Better Auth)
2. Setiap kali terjadi perubahan data, cantumkan *Activity Node* pencatatan **Audit Log** (`AuditLogService.logEvent()`) untuk menunjukkan bahwa sistem menerapkan standar keamanan informasi industri.
