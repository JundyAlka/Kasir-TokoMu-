# Laporan Audit Terakhir Aplikasi TokoMu / WarungOS

Tanggal audit: 11 Juni 2026
Lokasi proyek: `D:\project\Kasir TokoMu\warungos`
Status pemeriksaan: berbasis pembacaan kode, dokumentasi proyek, skema database, laporan TestSprite, `npm run lint`, dan `npm run build`.

## 1. Ringkasan Eksekutif

Aplikasi TokoMu / WarungOS saat ini sudah berbentuk web app operasional berbasis Next.js App Router. Aplikasi tidak lagi hanya berisi MVP kasir sederhana, tetapi sudah berkembang menjadi sistem operasional warung yang mencakup:

- Autentikasi dan workspace multi-user.
- Role-based access control untuk `pimpinan`, `pengelola_keuangan`, dan `kasir`.
- Dashboard operasional.
- POS / kasir cepat.
- Inventaris dan restok manual.
- Scan struk AI untuk restok.
- Buku hutang / kasbon.
- Laporan laba rugi.
- Investor dan investasi.
- Bagi hasil investor.
- Laporan PCM bulanan dengan snapshot dan PDF.
- AI assistant dengan tool untuk membaca dan melakukan aksi pada data usaha.
- Pengaturan profil warung, identitas PCM, metode pembayaran, dan karyawan.

Secara teknis, aplikasi berhasil lolos:

- `npm run lint`
- `npm run build`

Build produksi Next.js berhasil dan semua route aplikasi/API terdeteksi oleh build.

Kesimpulan utama: aplikasi sudah layak disebut sebagai demo / SUS testing build yang cukup lengkap, namun belum siap dianggap production-ready penuh. Risiko terbesar ada pada validasi backend yang belum merata, integrasi WhatsApp yang masih simulasi, beberapa fitur PDF/laporan yang belum setara, manajemen schema yang bercampur antara migration file dan runtime `CREATE TABLE`, serta coverage test yang belum menyentuh hutang dan laporan secara memadai.

## 2. Stack Teknologi Saat Ini

Frontend:

- Next.js 16.2.1 App Router.
- React 19.2.4.
- Tailwind CSS 4.
- Komponen UI internal berbasis pola shadcn/ui dan Base UI.
- `lucide-react` untuk ikon.
- `sonner` untuk toast notification.
- `next-themes` untuk dark/light theme.

Backend:

- Next.js API Routes di folder `src/app/api`.
- Drizzle ORM.
- PostgreSQL.
- Better Auth untuk autentikasi email/password.
- Server-side RBAC custom.
- React PDF renderer untuk laporan PCM PDF.
- Gemini API integration untuk AI assistant dan OCR struk.

Database:

- PostgreSQL via `pg`.
- Local Docker Compose memakai Postgres 16 Alpine pada host port `5439`.
- Ada migration Drizzle di folder `drizzle`.
- Ada runtime table bootstrap di `src/lib/server/app-service.ts`.

Testing dan QA:

- ESLint berhasil.
- Production build berhasil.
- Ada TestSprite frontend test suite dengan 26 skenario.
- TestSprite report terakhir bertanggal 28 Maret 2026, bukan hasil run hari ini.

## 3. Arsitektur Sistem

Arsitektur aktif yang terbaca dari kode adalah monolit Next.js:

```text
Browser / Tablet
  -> Next.js App Router UI
  -> AppStateProvider client state
  -> Next.js API Routes
  -> Service layer server
  -> Drizzle ORM / raw pg query
  -> PostgreSQL
```

Untuk auth:

```text
User
  -> Better Auth session cookie
  -> getRequestUser()
  -> ensureWorkspace()
  -> user_roles
  -> RBAC per page/API route
```

Untuk AI:

```text
AI Assistant UI
  -> /api/ai/chats
  -> /api/ai/chats/:id/messages
  -> runUserTurn()
  -> Gemini API
  -> tool execution
  -> database action/read
```

Catatan penting: `AGENTS.md` menyebut InsForge sebagai backend yang tersedia untuk proyek ini. Namun kode aplikasi aktif yang diaudit masih memakai Postgres langsung, Better Auth, Drizzle, dan env Gemini API. Belum terlihat penggunaan `@insforge/sdk` dalam kode aplikasi. Ini perlu diputuskan secara arsitektural: tetap monolit Postgres langsung, atau migrasi penuh ke pola InsForge.

## 4. Struktur Modul UI

### 4.1 App Shell dan Navigasi

File utama: `src/components/app-shell.tsx`

Fungsi:

- Sidebar desktop dengan navigasi role-aware.
- Sheet menu mobile.
- Account panel.
- Theme toggle.
- AI assistant panel global.
- Sidebar dapat collapse, dan otomatis collapse saat AI assistant dibuka.

Navigasi yang tersedia:

- Dashboard
- Kasir
- Inventaris
- Buku Hutang
- Investor
- Bagi Hasil
- Laporan
- Laporan PCM
- Pengaturan
- Kelola Karyawan

Kekuatan UI:

- Navigasi sudah dipisah berdasarkan role.
- Layout mendukung desktop/tablet dan mobile.
- AI assistant selalu tersedia sebagai panel global.

Catatan perbaikan:

- Banyak elemen memakai card besar dan radius besar. Untuk aplikasi operasional harian, desain sudah rapi tetapi bisa dibuat lebih padat agar kasir dan pengelola cepat membaca data.
- Beberapa copy UI masih menyebut "mock" di halaman Inventaris, padahal data sudah masuk backend. Ini berpotensi membingungkan evaluator.
- Perlu audit visual responsif langsung di browser untuk memastikan semua halaman nyaman di tablet kecil.

### 4.2 Dashboard

File utama: `src/components/warung/dashboard-view.tsx`

Fitur:

- Omzet hari ini.
- Jumlah transaksi hari ini.
- Stok menipis.
- Kasbon aktif.
- Transaksi terakhir.
- Timeline transaksi.
- Daftar stok perlu perhatian.
- Kasbon terbaru.
- Jumlah SKU aktif.

Kekuatan:

- Dashboard sudah fokus ke ringkasan operasional.
- Data diambil dari app state hasil bootstrap backend.

Catatan perbaikan:

- Belum ada filter periode.
- Belum ada drill-down langsung dari kartu metrik ke data terkait.
- Perhitungan "hari ini" memakai timezone runtime browser, belum eksplisit Asia/Jakarta.

### 4.3 Kasir / POS

File utama: `src/components/warung/kasir-view.tsx`

Fitur:

- Produk visual berbentuk kartu.
- Search produk.
- Filter kategori.
- Tap produk ke keranjang.
- Quantity plus/minus.
- Remove item.
- Validasi stok di client.
- Pilihan metode bayar berdasarkan pengaturan.
- Checkout ke `/api/transactions`.
- Stok otomatis berkurang di backend.
- Toast transaksi berhasil.
- Dialog struk siap print/simpan PDF via browser print.
- Warning stok menipis setelah transaksi.

Kekuatan:

- Flow POS sudah cukup dekat dengan target "tap-to-sell".
- Ada pembatasan stok di client dan server.
- Data transaksi tersimpan dan masuk laporan.

Catatan perbaikan:

- Belum ada mode bayar hutang/kasbon langsung dari POS.
- Belum ada diskon, pajak, retur/refund, void transaksi, atau catatan transaksi.
- Belum ada offline queue. Jika koneksi putus, kasir tidak bisa transaksi.
- Belum ada optimasi khusus "transaksi di bawah 5 detik" yang terukur.
- Belum ada printer thermal langsung, baru browser print.

### 4.4 Inventaris

File utama: `src/components/warung/inventaris-view.tsx`

Fitur:

- Daftar produk.
- Total SKU.
- Jumlah stok menipis.
- Nilai stok.
- Search nama/kategori/catatan.
- Tambah produk.
- Edit produk.
- Restok produk.
- Tombol Restok via Scan Struk.
- Role `kasir` tidak bisa mutasi inventaris.

Kekuatan:

- CRUD utama produk sudah ada.
- Role-based UI sudah diterapkan.
- Ada penanda stok menipis.

Catatan perbaikan:

- Server-side validasi produk masih belum sekuat modul investor/restock batch.
- Belum ada delete/archive produk.
- Belum ada histori perubahan harga.
- Belum ada satuan barang, barcode/SKU, supplier, atau kategori custom.
- Belum ada rekonsiliasi stok fisik.

### 4.5 Restok via Scan Struk AI

File utama:

- `src/app/(dashboard)/inventaris/restok-ai/page.tsx`
- `src/components/tokomu/receipt-restock-page.tsx`
- `src/components/tokomu/receipt-scanner.tsx`
- `src/components/tokomu/restock-confirm-form.tsx`
- `src/app/api/ai/scan-receipt/route.ts`
- `src/app/api/restock/batch/route.ts`

Fitur:

- Upload/foto struk sebagai base64 image data URL.
- Batas ukuran gambar 5MB.
- OCR/vision via AI gateway.
- Matching item struk ke produk.
- Konfirmasi hasil scan sebelum stok bertambah.
- Restock batch dengan log `restock_logs`.

Kekuatan:

- Sudah ada flow manusia mengecek hasil AI sebelum data berubah.
- Role dibatasi ke `pimpinan` dan `pengelola_keuangan`.
- Batch restock memakai transaksi database.

Catatan perbaikan:

- Perlu handling kualitas foto, rotasi, crop, dan confidence UI yang lebih jelas.
- Perlu storage file struk jika nanti ingin audit bukti restok.
- Saat ini env AI harus tersedia; jika tidak, fitur akan gagal dan butuh fallback manual yang lebih ramah.

### 4.6 Buku Hutang / Kasbon

File utama: `src/components/warung/buku-hutang-view.tsx`

Fitur:

- Tambah kasbon.
- Search nama/WhatsApp.
- Filter semua/belum lunas/lunas.
- Total kasbon aktif.
- Jumlah pelanggan lunas.
- Jumlah pengingat terkirim.
- Tandai lunas.
- Kirim pengingat.

Kekuatan:

- Fitur inti kasbon sudah tersedia dan tersimpan.
- Ada histori `lastReminderAt`.

Catatan perbaikan:

- Pengingat WhatsApp masih simulasi, belum integrasi provider seperti Fonnte/Wablas/Twilio.
- Mark paid hanya mendukung lunas penuh, belum cicilan/sebagian bayar.
- Belum ada template pesan, status pengiriman, retry, atau audit log pesan.
- Belum ada due-date automation / reminder otomatis.

### 4.7 Laporan Laba Rugi

File utama:

- `src/components/warung/laporan-view.tsx`
- `src/app/api/reports/profit-loss/route.ts`
- `src/lib/server/profit-sharing.ts`
- `src/lib/reporting.ts`

Fitur:

- Pilih periode bulanan.
- Omzet.
- HPP.
- Laba kotor.
- Pengeluaran.
- Laba bersih.
- Jumlah transaksi.
- Rata-rata tiket.
- Tren omzet 6 bulan.
- Produk paling bergerak.
- Preview layout laporan.

Kekuatan:

- Ringkasan laba rugi sudah memakai API database, bukan hanya mock.
- Perhitungan HPP memakai `transaction_items.costPrice`, sehingga harga beli saat transaksi tersimpan sebagai snapshot.

Catatan perbaikan:

- Tombol "Cetak PDF" di laporan umum masih toast "menunggu generator PDF".
- Pengeluaran belum punya UI CRUD penuh yang jelas selain bisa dicatat via AI tool.
- Periode chart memakai state transaksi client, sementara summary memakai API. Potensi mismatch jika state belum sync.
- Perlu timezone eksplisit Asia/Jakarta untuk periode laporan.

### 4.8 Investor dan Investasi

File utama:

- `src/app/(dashboard)/investor/page.tsx`
- `src/app/(dashboard)/investor/[id]/page.tsx`
- `src/app/(dashboard)/investor/baru/page.tsx`
- `src/components/tokomu/investor-form.tsx`
- `src/components/tokomu/investment-form.tsx`
- `src/lib/server/investor-service.ts`

Fitur:

- Daftar investor aktif/nonaktif.
- Tambah investor.
- Detail investor.
- Tambah investasi modal uang.
- Tambah investasi barang titip jual.
- Edit/deaktivasi investasi.
- Deaktivasi investor.
- Barang titip jual otomatis menambah stok produk.
- Restock log untuk modal barang investor.

Kekuatan:

- Service investor punya parsing dan validasi yang relatif kuat.
- Data investor discoped dengan `workspaceOwnerId`.
- Mendukung dua model investasi: uang dan barang titip jual.

Catatan perbaikan:

- Belum ada kontrak/dokumen investor.
- Belum ada approval flow investor.
- Belum ada audit trail perubahan investasi.
- Deaktivasi investasi belum mengoreksi stok jika barang titip masih belum terjual.

### 4.9 Bagi Hasil

File utama:

- `src/app/(dashboard)/bagi-hasil/page.tsx`
- `src/components/tokomu/payout-preview-table.tsx`
- `src/lib/server/profit-sharing.ts`
- `src/app/api/payouts/*`

Fitur:

- Hitung laba periode.
- Hitung laba bersih yang dapat dibagikan.
- Bagi hasil investor modal uang berdasarkan persentase laba bersih.
- Bagi hasil barang titip jual berdasarkan margin produk terjual.
- Alokasi PCM dan cadangan dari pengaturan.
- Preview payout.
- Simpan draft payout.
- Update status payout ke `disetujui` atau `dibayar`.

Kekuatan:

- Perhitungan sudah cukup terstruktur dan ada pemisahan service.
- Menggunakan snapshot cost price item transaksi untuk HPP.
- Status payout punya constraint database.

Catatan perbaikan:

- Belum ada bukti pembayaran / upload receipt.
- Belum ada approval multi-step.
- Belum ada test otomatis untuk formula bagi hasil.
- Perlu validasi bisnis apakah `storeShare` boleh negatif ketika total persentase investor + PCM + cadangan melebihi laba bersih.

### 4.10 Laporan PCM

File utama:

- `src/app/(dashboard)/laporan-pcm/page.tsx`
- `src/components/tokomu/monthly-report-preview.tsx`
- `src/app/api/reports/monthly-pcm/route.ts`
- `src/app/api/reports/monthly-pcm/[id]/pdf/route.ts`
- `src/lib/server/pdf-pcm.tsx`

Fitur:

- Buat snapshot laporan bulanan.
- Simpan data laporan ke `monthly_reports`.
- Preview laporan.
- Finalize laporan.
- Download PDF laporan PCM.
- Data mencakup store profile, profit summary, top products, payout, modal investor, PCM allocation, reserve, dan catatan.

Kekuatan:

- Ini modul laporan paling matang dibanding laporan umum.
- PDF sudah benar-benar dirender via React PDF.
- Ada konsep snapshot sehingga laporan yang sudah dibuat tidak berubah diam-diam.

Catatan perbaikan:

- `pdfUrl` ada di schema tetapi PDF saat ini dirender on-demand, belum upload/persist file.
- Perlu nomor dokumen, tanda tangan, dan metadata finalisasi yang lebih lengkap jika dipakai resmi.
- Perlu kontrol revisi setelah final.

### 4.11 Pengaturan dan Karyawan

File utama:

- `src/components/warung/pengaturan-view.tsx`
- `src/components/warung/karyawan-client.tsx`
- `src/app/api/settings/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/invite/route.ts`

Fitur:

- Profil warung.
- Identitas PCM.
- Nomor WhatsApp pemilik.
- Kota/alamat/catatan.
- Threshold stok.
- Persentase alokasi PCM dan cadangan.
- Metode pembayaran aktif.
- Reset workspace.
- Daftar karyawan.
- Invite/create user baru dengan role.

Kekuatan:

- Settings disimpan server-side.
- Reset workspace dibatasi role `pimpinan`.
- Kelola karyawan dibatasi role `pimpinan`.

Catatan perbaikan:

- Invite user tampaknya membuat user/password langsung, belum invitation email/token.
- Belum ada ubah role user existing dari UI yang jelas.
- Belum ada audit log reset workspace.
- Reset workspace menghapus data operasional besar, perlu confirmation yang lebih kuat untuk production.

### 4.12 AI Assistant

File utama:

- `src/components/warung/ai-assistant-panel.tsx`
- `src/app/api/ai/chats/route.ts`
- `src/app/api/ai/chats/[id]/messages/route.ts`
- `src/lib/server/ai/chat.ts`
- `src/lib/server/ai/tools.ts`
- `src/lib/server/ai/gemini.ts` (OpenAI-compatible Gemini client)
- `src/lib/server/ai/persist.ts`

Fitur:

- Chat list.
- Chat messages persisted.
- System context dari profil, jumlah produk, dan kasbon.
- Tool calling untuk:
  - ringkasan inventaris
  - cari produk
  - tambah produk
  - restok produk
  - catat penjualan
  - ringkasan penjualan
  - daftar kasbon belum lunas
  - catat kasbon
  - tandai kasbon lunas
  - catat pengeluaran
  - rekomendasi profit/restok

Kekuatan:

- AI bukan hanya Q&A, tetapi sudah bisa action melalui tool.
- Tool membaca database real.
- Riwayat tool call disimpan.

Catatan perbaikan:

- Aksi AI dapat menulis database langsung setelah model memanggil tool. Secara produk, sebaiknya aksi berisiko memakai confirmation step eksplisit.
- Belum ada masking data sensitif sebelum dikirim ke provider AI.
- Belum ada rate limit dan quota AI per user/workspace.
- Belum ada voice input, meskipun PRD menyebut perintah suara.

## 5. Backend dan API

API utama yang tersedia:

- `/api/auth/*`
- `/api/session/:intent`
- `/api/bootstrap`
- `/api/bootstrap/reset`
- `/api/products`
- `/api/products/:id`
- `/api/products/:id/restock`
- `/api/transactions`
- `/api/debts`
- `/api/debts/:id`
- `/api/debts/:id/remind`
- `/api/settings`
- `/api/users`
- `/api/users/invite`
- `/api/investors`
- `/api/investors/:id`
- `/api/investments`
- `/api/investments/:id`
- `/api/payouts`
- `/api/payouts/:id`
- `/api/payouts/calculate`
- `/api/reports/profit-loss`
- `/api/reports/monthly-pcm`
- `/api/reports/monthly-pcm/:id/pdf`
- `/api/ai/chats`
- `/api/ai/chats/:id/messages`
- `/api/ai/scan-receipt`
- `/api/restock/batch`

Kekuatan backend:

- Semua route penting diproteksi auth kecuali auth/session.
- Workspace scoping sudah diterapkan lewat `workspaceOwnerId`.
- Banyak modul keuangan memakai query SQL agregasi yang efisien.
- Error response distandarkan melalui `handleRouteError`.
- Ada Bearer token test mode untuk API testing, aktif hanya jika env test di-set.

Catatan teknis backend:

- Validasi request belum konsisten. Modul investor dan restock batch cukup kuat, tetapi produk/transaksi/hutang masih menerima bentuk body lebih bebas.
- Tidak terlihat penggunaan schema validation library seperti Zod/Valibot.
- Beberapa operasi penting belum memakai audit log.
- `ensureTables()` membuat/alter tabel saat runtime. Ini praktis untuk demo, tetapi sebaiknya diganti migration-only untuk production.
- Ada campuran Drizzle ORM dan raw SQL. Ini tidak salah, tetapi perlu standar agar maintenance lebih mudah.
- Belum ada rate limiting, CSRF policy eksplisit, atau request size guard umum di semua endpoint.

## 6. Database

Tabel aplikasi utama:

- `store_profiles`
- `user_roles`
- `products`
- `transactions`
- `transaction_items`
- `debts`
- `expenses`
- `investors`
- `investments`
- `investor_payouts`
- `restock_logs`
- `monthly_reports`
- `ai_chats`
- `ai_messages`

Kekuatan model data:

- Ada pemisahan transaksi dan item transaksi.
- Harga beli saat transaksi tersimpan di `transaction_items.cost_price`, penting untuk laporan historis.
- Workspace scoping ada di data multi-user.
- Investor, payout, restock, dan monthly report sudah memiliki index dasar.
- Status penting diberi check constraint.

Catatan perbaikan database:

- Banyak tabel belum punya foreign key eksplisit.
- Beberapa tabel masih memakai `user_id` sebagai workspace owner, sementara tabel lain memakai `workspace_owner_id`. Secara konsep bisa diterima, tetapi naming sebaiknya diseragamkan.
- Tidak terlihat unique constraint periode laporan/payout per workspace. Saat ini ada pengecekan aplikasi, tetapi constraint database akan lebih aman.
- Tidak ada soft-delete untuk produk/transaksi/hutang.
- Tidak ada audit table untuk aksi kritis.
- Tidak ada RLS database-level. Keamanan workspace bergantung pada service layer.

## 7. Auth, Role, dan Keamanan

Role:

- `pimpinan`
- `pengelola_keuangan`
- `kasir`

Hak akses yang terlihat:

- `kasir`: kasir, inventaris read-ish, buku hutang.
- `pengelola_keuangan`: akses operasional dan laporan/investor/bagi hasil/pengaturan.
- `pimpinan`: akses penuh termasuk kelola karyawan dan reset workspace.

Kekuatan:

- Page-level role gate sudah ada.
- API-level `requireRole()` sudah diterapkan pada banyak endpoint sensitif.
- Auth menggunakan Better Auth.
- Secret auth punya fallback dev, tetapi env production dapat override.

Risiko:

- Jika `BETTER_AUTH_SECRET` tidak di-set di production, fallback secret dev berbahaya.
- AI tool action belum memiliki confirmation gate untuk aksi tulis.
- Bearer test token aman hanya jika env tidak aktif di production nyata.
- Belum ada rate limit login/API.
- Belum ada audit log login, invite, reset, finalisasi laporan, payout paid, dan aksi AI.

## 8. Status Testing

Verifikasi yang dijalankan pada audit ini:

- `npm run lint`: lulus.
- `npm run build`: lulus.

Hasil build:

- Next.js berhasil compile.
- TypeScript selesai tanpa error.
- Static generation selesai.
- Semua route aplikasi dan API terdaftar.

Laporan TestSprite yang tersedia:

- Tanggal eksekusi: 28 Maret 2026.
- Total test: 26.
- Passed: 21.
- Failed: 5.
- Pass rate: 80.77%.

Ringkasan gap TestSprite:

- Auth basic lulus.
- Dashboard lulus.
- POS sebagian besar lulus, tetapi checkout happy path gagal karena session instability saat suite panjang.
- Inventaris sebagian besar lulus, tetapi validasi create/edit belum tuntas.
- Pengaturan sebagian besar lulus, tetapi beberapa test gagal karena session instability.
- Buku Hutang tidak ter-cover.
- Reporting tidak ter-cover.

Catatan: hasil TestSprite bukan hasil run hari ini, jadi sebaiknya dijalankan ulang setelah laporan ini bila ingin status QA aktual.

## 9. Kesesuaian Terhadap PRD Awal

Sudah terpenuhi:

- Web app tablet-first secara umum.
- POS tap-to-sell.
- Metode bayar Tunai/QRIS/Transfer.
- Stok berkurang otomatis saat checkout.
- Inventaris barang jadi.
- Kasbon dasar.
- Laporan laba/rugi.
- Autentikasi user.
- AI assistant dasar dan tool action.

Terpenuhi sebagian:

- PDF laporan: laporan PCM sudah PDF, laporan umum belum.
- WhatsApp: pengingat masih simulasi, belum provider nyata.
- Notifikasi stok menipis: toast/peringatan UI sudah ada, WhatsApp otomatis belum.
- Voice-to-text AI: belum terlihat.
- Freemium/business model: belum ada subscription/billing/plan limit.

Melampaui PRD:

- Investor.
- Investasi modal uang dan barang titip jual.
- Bagi hasil investor.
- Laporan PCM.
- Scan struk AI untuk restok.
- Kelola karyawan dengan role.

## 10. Risiko Utama

1. Integrasi WhatsApp belum nyata.

Fitur hutang dan stok menipis sangat bergantung pada WhatsApp dalam PRD. Saat ini reminder hanya simulasi frontend/backend timestamp. Untuk demo masih cukup, untuk production belum.

2. Validasi backend belum merata.

Produk, transaksi, dan hutang masih perlu normalisasi dan validasi lebih ketat di server. Validasi client tidak cukup karena API bisa dipanggil langsung.

3. Runtime schema bootstrap.

`ensureTables()` berguna untuk demo, tetapi production sebaiknya memakai migration yang eksplisit, repeatable, dan dapat diaudit.

4. Test coverage belum menyentuh modul besar.

Hutang, laporan, investor, bagi hasil, laporan PCM, AI assistant, dan restok AI belum punya coverage memadai.

5. Aksi AI bisa menulis database.

Secara UX bagus, tetapi secara risiko perlu confirmation step, audit log, dan permission enforcement yang lebih eksplisit.

6. Timezone belum distandarkan.

Bisnis di Indonesia perlu periode harian/bulanan Asia/Jakarta. Saat ini banyak perhitungan memakai Date runtime lokal/UTC campuran.

7. Belum ada audit log.

Untuk sistem kasir/keuangan, aksi seperti reset workspace, payout dibayar, laporan final, transaksi, restok, dan AI action perlu jejak audit.

8. Belum ada offline mode.

Target kasir warung rentan koneksi internet. PRD menyebut online, tetapi untuk pengalaman nyata, offline queue akan sangat membantu.

## 11. Rekomendasi Dev Ulang / Perbaikan Prioritas

### Prioritas P0: Wajib sebelum production pilot

1. Tambahkan server-side schema validation untuk semua API.

Gunakan satu pola validasi untuk products, transactions, debts, settings, investors, investments, payouts, reports, dan AI tools. Validasi angka harus menolak NaN, negatif yang tidak valid, string kosong, enum salah, dan body yang tidak sesuai.

2. Integrasi WhatsApp provider nyata.

Buat service `notification-service` untuk:

- reminder kasbon manual
- reminder kasbon otomatis
- notifikasi stok menipis
- status sent/failed
- retry
- log pesan

3. Rapikan schema management.

Pindahkan runtime `CREATE TABLE IF NOT EXISTS` ke migration resmi. Runtime hanya boleh menjalankan health check, bukan membuat schema production.

4. Audit log.

Minimal log:

- login/signout penting
- invite user
- reset workspace
- create/update/restock product
- checkout
- mark debt paid
- reminder sent
- payout approved/paid
- monthly report finalized
- AI tool action

5. Tambahkan test otomatis untuk alur kritis.

Minimal:

- POS checkout happy path.
- Stok tidak boleh minus.
- Produk invalid ditolak.
- Kasbon create/paid/remind.
- Profit-loss formula.
- Payout formula.
- Laporan PCM create/final/pdf.
- RBAC kasir tidak bisa akses endpoint keuangan.

### Prioritas P1: Penting untuk usability dan akurasi

1. Timezone Asia/Jakarta.

Standarkan periode hari, minggu, bulan, laporan, dan dashboard memakai timezone bisnis, bukan timezone server/browser acak.

2. Laporan umum PDF.

Aktifkan PDF untuk halaman `Laporan`, bukan hanya `Laporan PCM`.

3. Expense management UI.

Tambahkan CRUD pengeluaran supaya laporan laba rugi tidak bergantung pada AI tool.

4. Confirmation step untuk AI action.

AI boleh menyusun draft aksi, tetapi user perlu klik konfirmasi sebelum transaksi/restok/kasbon/pengeluaran disimpan.

5. Perbaiki copy UI yang masih menyebut mock/state mock.

Ubah menjadi istilah production seperti "data warung", "database", atau "workspace".

6. Tambahkan fitur pembayaran kasbon sebagian.

Kasbon nyata sering dicicil. Tambahkan tabel payment history untuk debt.

### Prioritas P2: Pengembangan lanjutan

1. Barcode/SKU dan scanner.

Cocok untuk warung/toko dengan banyak barang.

2. Supplier dan purchase order sederhana.

Membantu restok dan pembelian.

3. Offline mode / local queue.

Kasir tetap bisa menjual saat internet bermasalah, lalu sync saat online.

4. Subscription/freemium.

Jika produk akan dijual umum, butuh plan, limit, billing, dan admin dashboard.

5. Role granular.

Contoh permission: transaksi, lihat HPP, edit stok, lihat laporan, finalisasi laporan, bayar payout.

6. Backup/export data.

Export CSV/PDF untuk produk, transaksi, hutang, laporan, dan investor.

## 12. Catatan Inkonsistensi yang Perlu Diputuskan

1. Nama produk: README menyebut TokoMu, PRD menyebut WarungOS.

Rekomendasi: pilih satu brand utama. Bisa pakai "TokoMu" sebagai brand aplikasi dan "WarungOS" sebagai nama internal/engine, tetapi harus konsisten di UI, README, laporan, dan dokumen.

2. Backend: AGENTS.md menyebut InsForge, kode aktif memakai Postgres langsung/Better Auth.

Rekomendasi: putuskan:

- Tetap Next.js + Postgres langsung + Better Auth, atau
- Migrasi penuh ke InsForge auth/database/storage/AI/deployments.

Jangan campur setengah-setengah tanpa batas yang jelas karena akan menyulitkan auth, env, deployment, dan debugging.

3. PDF: Laporan PCM sudah nyata, Laporan umum masih preview/toast.

Rekomendasi: samakan ekspektasi UI. Jika tombol ada, hasil harus nyata.

4. WhatsApp: PRD menempatkan WhatsApp sebagai fitur inti, implementasi masih simulasi.

Rekomendasi: tandai jelas sebagai simulasi di demo, atau langsung implementasikan provider.

## 13. Kondisi Git / Workspace

Saat audit dimulai, worktree sudah memiliki perubahan yang belum dicommit pada:

- `.gitignore`
- `scripts/start-db.mjs`
- `src/components/app-shell.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/warung/dashboard-view.tsx`
- `src/components/warung/pengaturan-view.tsx`

File laporan ini ditambahkan sebagai file baru dan tidak mengubah file aplikasi yang sudah ada.

## 14. Keputusan Rekomendasi

Status aplikasi saat ini: kuat sebagai demo operasional dan bahan evaluasi user, belum production-ready penuh.

Rekomendasi dev berikutnya:

1. Jangan rombak UI besar dulu sebelum P0 selesai.
2. Fokuskan sprint berikutnya pada backend hardening, WhatsApp nyata, audit log, dan test coverage.
3. Setelah backend stabil, lakukan polishing UI tablet dan tambah fitur kasbon cicilan/laporan PDF umum.
4. Tentukan keputusan arsitektur InsForge vs Postgres langsung sebelum menambah fitur cloud/deployment lebih jauh.

Dengan kondisi sekarang, aplikasi sudah punya fondasi fitur yang luas. Perbaikan terbesar bukan menambah halaman baru, tetapi memperkuat akurasi, keamanan, validasi, integrasi nyata, dan pembuktian lewat test.
