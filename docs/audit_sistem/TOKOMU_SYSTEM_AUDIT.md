# LAPORAN AUDIT STRUKTUR SISTEM TOKOMU (WARUNGOS)
**Audit Teknis Menyeluruh untuk Penyusunan Dokumentasi & Laporan Kerja Praktik BAB IV**

---

## RINGKASAN EKSEKUTIF

Laporan audit teknis ini disusun 100% berdasarkan source code aktual aplikasi **TokoMu (WarungOS)**, sebuah sistem informasi manajemen warung dan kasir (POS) berbasis **Next.js 16 App Router**, **Drizzle ORM**, **PostgreSQL**, **Better Auth**, dan **Tailwind CSS/Radix UI**. Laporan ini ditujukan sebagai sumber kebenaran (*single source of truth*) dalam merancang Entity Relationship Diagram (ERD), UML Class Diagram, UML Use Case Diagram, UML Activity Diagram, serta dokumentasi BAB IV Laporan Kerja Praktik.

### Statistik Utama Hasil Audit
- **Total Tabel Database**: **24 Tabel** (4 Tabel internal Better Auth + 20 Tabel bisnis utama).
- **Total Role / Aktor Database**: **3 Role Staf** (`pimpinan`, `pengelola_keuangan`, `kasir`) + **3 Aktor Sistem Eksternal** (Google Gemini AI, Better Auth, dan @react-pdf Engine).
- **Total Route Halaman Frontend**: **16 Routes** (termasuk penanganan redirect alur modal baru).
- **Total API Endpoints Backend**: **40 Endpoints** (meliputi POS, hutang, investor, laporan, audit log, dan AI).
- **Arsitektur Sistem**: Menggunakan **Modular Functional Architecture** pada layer service (`src/lib/server/*`) yang dipetakan ke dalam 8 layer konseptual kelas.

---

## A. ATURAN & METODOLOGI AUDIT
Audit dilakukan dengan mematuhi prinsip **Strict Source-of-Truth Validation**:
1. **Verifikasi Skema & Migrasi**: Seluruh tabel, kolom, tipe data, *primary key*, *foreign key*, dan *constraint* diverifikasi langsung dari `src/db/schema.ts` dan `migrations/20260608134501_tokoku-schema.sql`.
2. **Verifikasi RBAC & Otorisasi**: Hak akses dipetakan berdasarkan pemeriksaan middleware, fungsi `requireRole(["role1", "role2"])` di `src/lib/server/rbac.ts`, serta *route guards* pada halaman frontend dan controller API.
3. **Verifikasi Alur Bisnis**: Alur aktivitas diverifikasi dari implementasi fungsi transaksi, kasbon, restok, investasi, dan kalkulasi laporan di `src/lib/server/app-service.ts`, `investor-service.ts`, `shift-service.ts`, dan `profit-sharing.ts`.

---

## B. DAFTAR BERKAS DOKUMENTASI TERSTRUKTUR (JSON & MERMAID)
Untuk memudahkan generasi diagram di aplikasi UML (StarUML, Enterprise Architect, Draw.io) dan pemrosesan data lebih lanjut, hasil audit telah diekspor ke dalam **10 berkas terstruktur** di direktori root `warungos`:

| Nama Berkas | Deskripsi Isi |
|---|---|
| [`tokomu_database_schema.json`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_database_schema.json) | Spesifikasi lengkap 24 tabel, tipe kolom, PK/FK, constraint, default value, dan relasi. |
| [`tokomu_rbac_matrix.json`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_rbac_matrix.json) | Matriks hak akses 3 role terhadap 15 modul utama beserta bukti rute & controller. |
| [`tokomu_use_cases.json`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_use_cases.json) | Detail 27 use cases beserta aktor, precondition, main flow, dan relasi `<<include>>`/`<<extend>>`. |
| [`tokomu_activity_flows.json`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_activity_flows.json) | Struktur node dan percabangan keputusan (*decisions*) untuk 22 alur aktivitas bisnis. |
| [`tokomu_class_structure.json`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_class_structure.json) | Pemetaan 8 layer konseptual kelas, atribut, metode service, dan ketergantungan modul. |
| [`tokomu_routes.json`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_routes.json) | Daftar 16 rute halaman frontend dan 40 endpoint API backend beserta perlindungan role. |
| [`tokomu_erd_mermaid.md`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_erd_mermaid.md) | Draft diagram ERD lengkap dalam format sintaks Mermaid (`erDiagram`). |
| [`tokomu_class_mermaid.md`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_class_mermaid.md) | Draft diagram konseptual kelas dalam format sintaks Mermaid (`classDiagram`). |
| [`tokomu_usecase_recommendation.md`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_usecase_recommendation.md) | Rekomendasi penyusunan Use Case Diagram, spesifikasi aktor, dan relasi asosiasi. |
| [`tokomu_activity_recommendation.md`](file:///d:/project/Kasir%20TokoMu/warungos/tokomu_activity_recommendation.md) | Prioritas 8 Activity Diagram terbaik untuk disertakan dalam laporan akademis BAB IV. |

---

## C. STRUKTUR DATABASE & ENTITY RELATIONSHIP (ERD)

### Kategori 1: Better Auth Internal Tables (Autentikasi & Sesi)
1. **`user`**: Menyimpan profil akun utama (`id`, `name`, `email`, `image`). Berelasi 1:N ke `session` dan `account`, serta 1:1 ke `store_profiles` dan `user_roles`.
2. **`session`**: Menyimpan sesi aktif JWT/Bearer token (`token`, `expiresAt`, `ipAddress`, `userAgent`). Berelasi N:1 ke `user`.
3. **`account`**: Menyimpan kredensial autentikasi eksternal atau password hash (`password`, `providerId`). Berelasi N:1 ke `user`.
4. **`verification`**: Menyimpan token verifikasi email atau reset kata sandi (`identifier`, `value`, `expiresAt`).

### Kategori 2: Core Business & Operational Tables
5. **`store_profiles`**: Profil warung (`store_name`, `pcm_name`, `stock_alert_threshold`, `profit_share_pcm_pct`, `enabled_payments`). Relasi 1:1 dengan `user.id`.
6. **`user_roles`**: Penugasan role RBAC (`role`, `workspace_owner_id`, `is_active`). Relasi N:1 ke `user` pemilik workspace.
7. **`invitations`**: Undangan bergabung staf (`email`, `role`, `token`, `status`). Relasi N:1 ke `user` pengundang dan pemilik workspace.
8. **`products`**: Katalog barang (`sku`, `name`, `buy_price`, `sell_price`, `stock`, `minimum_stock`). Relasi 1:N ke `transaction_items`, `debt_items`, `investments`, dan `restock_logs`.
9. **`investors`**: Profil pemilik modal/penitip barang (`name`, `whatsapp`, `address`, `is_active`). Relasi 1:N ke `investments` dan `investor_payouts`.
10. **`investments`**: Akad investasi uang atau barang titip jual/konsinyasi (`type`, `akad_type`, `amount`, `monthly_return_rate_pct`, `unit_count`, `profit_share_per_unit_pct`). Relasi N:1 ke `investors` dan `products`.
11. **`investor_payouts`**: Riwayat dan kalkulasi bagi hasil bulanan (`base_profit`, `share_pct`, `amount`, `status: draft|disetujui|dibayar`). Relasi N:1 ke `investments`.
12. **`shifts`**: Jadwal operasional shift (`name`, `start_time`, `end_time`). Relasi 1:N ke `shift_sessions`.
13. **`shift_sessions`**: Sesi kerja kasir aktif (`opening_cash`, `closing_cash`, `expected_cash`, `difference`). Relasi N:1 ke `shifts` dan `user`.
14. **`transactions`**: Header transaksi POS (`total`, `paid_amount`, `change_amount`, `payment_method`). Relasi 1:N ke `transaction_items` dan N:1 ke `shift_sessions`.
15. **`transaction_items`**: Baris item terjual (`quantity`, `unit_price`, `cost_price`). Relasi N:1 ke `transactions` dan `products`.
16. **`debts`**: Buku hutang/kasbon pelanggan (`borrower_name`, `whatsapp`, `amount`, `paid_amount`, `status: aktif|lunas|lewat_tempo`). Relasi 1:N ke `debt_items` dan `debt_payments`.
17. **`debt_items`**: Rincian barang dikasbon (`quantity`, `unit_price`, `line_total`). Relasi N:1 ke `debts`.
18. **`debt_payments`**: Riwayat cicilan bayar kasbon (`amount`, `paid_at`, `note`). Relasi N:1 ke `debts`.
19. **`expenses`**: Catatan pengeluaran warung (`title`, `amount`, `category: Operasional|Belanja|Utilitas`). Relasi N:1 ke `user`.
20. **`restock_logs`**: Log penambahan stok (`source: manual|ai_chat|ai_ocr`, `quantity`, `ocr_raw`, `receipt_image_url`). Relasi N:1 ke `products` dan `user`.
21. **`monthly_reports`**: Snapshot rekap laba rugi bulanan (`data: JSONB`, `status: draft|final`, `finalized_at`). Relasi N:1 ke `user`.
22. **`ai_chats`**: Sesi percakapan AI Assistant (`title`). Relasi 1:N ke `ai_messages`.
23. **`ai_messages`**: Isi pesan dan eksekusi tool calling (`role`, `content`, `tool_calls`, `tool_result`). Relasi N:1 ke `ai_chats`.
24. **`audit_logs`**: Rekam jejak keamanan sistem (`event_type`, `entity_type`, `payload`, `before`, `after`). Relasi N:1 ke `user`.

---

## D. MATRIKS HAK AKSES (RBAC) & PERAN AKTOR
Sistem RBAC TokoMu dikendalikan oleh fungsi `requireRole(allowedRoles)` di `src/lib/server/rbac.ts` dan pengecekan tingkat modul:

| Modul / Fitur Utama | Pimpinan (`pimpinan`) | Bendahara (`pengelola_keuangan`) | Kasir (`kasir`) |
|---|:---:|:---:|:---:|
| **Dashboard & Ringkasan** | Akses Penuh | Akses Penuh | Akses Penuh |
| **POS Penjualan & Cetak Struk** | Akses Penuh | Akses Penuh | Akses Penuh |
| **Shift Kasir (Buka/Tutup Sesi)** | Kelola & Sesi | Kelola & Sesi | Buka & Tutup Sesi Sendiri |
| **Katalog & Inventaris (Tambah/Edit)** | Akses Penuh | Akses Penuh | Akses Penuh |
| **Restok (Manual / OCR / AI Chat)** | Akses Penuh | Akses Penuh | Akses Penuh |
| **Buku Hutang / Kasbon & Cicilan** | Akses Penuh | Akses Penuh | Akses Penuh |
| **Investor & Investasi (Uang/Barang)** | Akses Penuh | Akses Penuh | Lihat / Mandat Form |
| **Bagi Hasil (Kalkulasi & Payout)** | Akses Penuh | Akses Penuh | Hanya Melihat |
| **Pengeluaran Operasional** | Akses Penuh | Akses Penuh | Pencatatan Harian |
| **Laporan Bulanan & Finalisasi** | Akses Penuh | Akses Penuh | Hanya Melihat |
| **Laporan PCM (Unduh PDF Resmi)** | Akses Penuh | Akses Penuh | Hanya Melihat |
| **Pengaturan Profil Toko** | Akses Penuh | Lihat / Ubah (RBAC diperluas) | Lihat / Ubah Dasar |
| **Kelola Karyawan & Undangan** | Akses Penuh | Hanya Melihat | Hanya Melihat |
| **Reset Data Workspace (Danger Zone)**| **Akses Eksklusif** | Dilarang (Blocked) | Dilarang (Blocked) |
| **Audit Log Keamanan** | Akses Penuh | Hanya Melihat | Hanya Melihat |

---

## E. REKOMENDASI IMPLEMENTASI BAB IV LAPORAN KERJA PRAKTIK

Dalam penulisan BAB IV (Implementasi dan Pembahasan Sistem), mahasiswa disarankan untuk menonjolkan **3 keunggulan teknis utama** yang membedakan TokoMu dari aplikasi kasir konvensional:

1. **Integritas Transaksi Atomik dan Keamanan Audit Log**  
   Jelaskan bagaimana pemrosesan transaksi penjualan (`AppService.createTransaction`) dan pembayaran kasbon (`AppService.recordDebtPayment`) dibungkus dalam *database transaction* Drizzle ORM (`db.transaction()`). Hal ini mencegah terjadinya inkonsistensi stok saat banyak kasir beroperasi bersamaan, sekaligus mencatat setiap perubahan data ke tabel `audit_logs` untuk pelacakan jejak keamanan (*security audit trail*).

2. **Inovasi AI Vision OCR & Function Tool Calling LLM**  
   Bahs secara mendalam arsitektur modul AI di `src/lib/server/ai/*`. Jelaskan bagaimana alur pemrosesan gambar struk menggunakan Google Gemini Vision OCR (`gemini-2.5-flash`) yang diteruskan ke `receipt-matcher.ts` untuk mencocokkan nama barang dengan database secara otomatis, serta bagaimana AI Assistant mampu menjalankan *function calling* (`restock_product_tool`) untuk mengupdate database langsung dari perintah percakapan biasa.

3. **Akuntansi Syariah & Pembagian Laba Konsinyasi (Konsinyasi & PCM)**  
   Soroti kelengkapan domain akuntansi UMKM pada modul investor dan laporan PCM. Jelaskan perbedaan algoritma perhitungan bagi hasil untuk modal uang (*murabahah/mudharabah* dengan persentase bulanan) versus barang titip jual (*konsinyasi* yang dihitung dari jumlah item terjual dikali harga unit dan persentase bagi hasil), serta otomatisasi alokasi laba bersih untuk Pimpinan Cabang Muhammadiyah (PCM) dan dana cadangan warung di `ProfitSharingService` dan `ReportingService`.

---

### Verifikasi Akhir
Laporan ini telah ditinjau dan dicocokkan baris-demi-baris (*line-by-line*) dengan seluruh kode di `src/db/schema.ts`, `src/lib/server/app-service.ts`, `investor-service.ts`, `shift-service.ts`, `profit-sharing.ts`, `reporting.ts`, `rbac.ts`, serta seluruh komponen frontend dan API routes di dalam workspace TokoMu. Seluruh data siap digunakan untuk presentasi dan penyusunan buku laporan akhir Kerja Praktik.
