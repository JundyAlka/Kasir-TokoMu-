# Laporan Perkembangan Terbaru Web TokoMu / WarungOS

Tanggal laporan: 12 Juni 2026, 20:36 WIB
Lokasi proyek: `D:\project\Kasir TokoMu\warungos`
Status web saat diperiksa: berjalan di `http://localhost:3000`, terbuka di `http://localhost:3000/auth`
Status database lokal: embedded PostgreSQL berjalan di `localhost:5439`
Basis pemeriksaan: pembacaan repo, diff worktree, route Next.js, validasi browser, `npm run lint`, `npm test`, dan `npm run build`.

## 1. Ringkasan Eksekutif

TokoMu / WarungOS sudah berkembang dari aplikasi kasir dasar menjadi web operasional warung yang cukup lengkap untuk demo, pengujian SUS, dan pilot terbatas. Modul inti yang sudah tersedia meliputi autentikasi, workspace multi-user, RBAC, dashboard, kasir/POS, inventaris, buku hutang, investor, bagi hasil, laporan laba rugi, laporan PCM PDF, restok AI, AI assistant, pengaturan warung, manajemen karyawan, dan audit log.

Pemeriksaan terbaru menunjukkan kondisi teknis membaik dibanding laporan audit sebelumnya:

- `npm run lint` lulus tanpa error.
- `npm test` lulus: 6 file test, 13 test, semua passed.
- Coverage terbaru: statements 83,89%, branches 57,67%, functions 85,56%, lines 84,21%.
- `npm run build` lulus dengan Next.js 16.2.1 dan Turbopack.
- Browser lokal berhasil membuka halaman auth dengan title `Warung OS` tanpa console error saat pemeriksaan awal.
- Validasi server-side berbasis Zod sudah ditambahkan untuk produk, transaksi, hutang, restok, dan pengaturan.
- Timezone bisnis sudah distandarkan ke `Asia/Jakarta` melalui helper server.
- AI tool yang mengubah data sekarang memakai flow preview/konfirmasi, signature, commit endpoint, dan audit log.
- Audit log sudah punya tabel, service, API route, dan halaman pengaturan khusus untuk pimpinan.

Kesimpulan: aplikasi saat ini kuat sebagai demo operasional dan sudah lebih siap untuk pilot internal. Namun aplikasi belum production-ready penuh karena masih ada beberapa gap penting: integrasi WhatsApp masih simulatif, laporan umum belum punya export PDF aktif, voice input AI belum tersedia, copy UI inventaris masih menyebut "state mock", schema database belum sepenuhnya memakai foreign key eksplisit, dan beberapa modul besar seperti AI/OCR/PCM PDF belum memiliki test otomatis yang memadai.

## 2. Status Runtime Saat Ini

Web berhasil dijalankan dengan kondisi berikut:

- Next.js dev server: `http://localhost:3000`
- Redirect awal: `/auth`
- Judul halaman: `Warung OS`
- Halaman yang tampak: layar login/daftar dengan mode tampilan terang/gelap/sistem.
- Console error browser saat cek awal: tidak ada.
- Embedded PostgreSQL: listening di `127.0.0.1:5439` dan `::1:5439`.

Catatan: halaman auth terbuka normal, tetapi pemeriksaan end-to-end setelah login belum dilakukan karena laporan ini fokus pada status perkembangan kode dan build.

## 3. Status Git dan Perubahan Terbaru

Branch/worktree memiliki banyak perubahan belum commit. Commit terakhir yang tercatat:

- `f8cac51 Implement TokoMu modules and backend integration`
- `73c78a4 Delete CLAUDE.md`
- `bae68b6 Initial TokoMu release`

Ringkasan diff terbaru:

- 33 file terlacak berubah.
- 2.888 baris ditambahkan.
- 724 baris dihapus.
- Ada file/folder baru seperti `.github/`, `docs/`, migration baru, `tests/`, `vitest.config.ts`, audit log route, AI tools commit route, timezone helper, validation helper, dan reset DB script.

Area perubahan paling penting:

- Validasi input server: `src/lib/server/validation.ts`
- Audit log: `src/lib/server/audit.ts`, `src/app/api/audit-log/route.ts`, `src/app/(dashboard)/pengaturan/audit-log/page.tsx`
- AI commit/action safety: `src/app/api/ai/tools/commit/route.ts`, `src/lib/server/ai/tools.ts`, `src/lib/server/ai/persist.ts`
- Timezone Jakarta: `src/lib/server/timezone.ts`
- Test suite: `tests/api/*.test.ts`
- Schema database: `src/db/schema.ts`, migration `drizzle/0005_explicit_schema.sql`, `drizzle/0006_audit_logs.sql`

## 4. Stack Teknologi Aktif

Frontend:

- Next.js 16.2.1 App Router.
- React 19.2.4.
- Tailwind CSS 4.
- Komponen internal dengan pola shadcn/ui dan Base UI.
- `lucide-react` untuk ikon.
- `sonner` untuk toast.
- `next-themes` untuk dark/light/system theme.

Backend:

- Next.js API Routes.
- Drizzle ORM.
- PostgreSQL.
- Better Auth untuk autentikasi.
- RBAC custom server-side.
- React PDF renderer untuk laporan PCM PDF.
- Gemini API untuk assistant dan OCR struk.

Testing:

- Vitest 4.1.8.
- `@testing-library/react`.
- `pg-mem` untuk test database logic.
- Coverage V8.
- ESLint 9.

## 5. Arsitektur Aplikasi

Arsitektur aktif masih monolit Next.js:

```text
Browser / Tablet
  -> Next.js App Router UI
  -> AppStateProvider
  -> Next.js API Routes
  -> Service layer server
  -> Drizzle ORM / PostgreSQL
```

Model auth dan workspace:

```text
User login
  -> Better Auth session
  -> getRequestUser()
  -> user_roles
  -> workspaceOwnerId
  -> requireRole()
  -> data scoped per workspace
```

Model AI assistant:

```text
User prompt
  -> /api/ai/chats/:id/messages
  -> runUserTurn()
  -> AI model
  -> tool read/action preview
  -> user confirmation
  -> /api/ai/tools/commit
  -> executeCommittedTool()
  -> audit log
```

Pola ini sudah lebih aman daripada AI langsung menulis data, karena aksi tulis membutuhkan payload tertanda dan konfirmasi.

## 6. Modul dan Fitur yang Sudah Ada

### 6.1 Autentikasi dan Workspace

Status: sudah tersedia.

Kemampuan:

- Login dan daftar akun melalui Better Auth.
- User pertama menjadi pemilik workspace/pimpinan.
- Workspace memakai `workspaceOwnerId` agar data warung bisa dipakai bersama oleh beberapa user.
- Role aktif: `pimpinan`, `pengelola_keuangan`, `kasir`.
- Route dashboard dilindungi server-side melalui RBAC.

Catatan:

- Invite user saat ini terlihat membuat akses/password, belum invitation email/token penuh.
- Perlu kebijakan reset password dan verifikasi email untuk production.

### 6.2 Dashboard

Status: sudah tersedia.

Kemampuan:

- Ringkasan omzet hari ini.
- Jumlah transaksi.
- Stok menipis.
- Kasbon aktif.
- Transaksi terakhir.
- Timeline aktivitas.
- Daftar stok yang perlu perhatian.
- Kasbon terbaru.

Perkembangan terbaru:

- Perhitungan harian sudah terbantu helper timezone Jakarta, sehingga risiko beda hari karena UTC/browser berkurang.

Gap:

- Belum ada filter periode langsung dari dashboard.
- Belum ada drill-down dari kartu metrik ke halaman detail.

### 6.3 Kasir / POS

Status: sudah tersedia dan sudah punya test transaksi.

Kemampuan:

- Pilih produk.
- Tambah ke keranjang.
- Validasi stok di client dan server.
- Pilih metode pembayaran.
- Checkout ke API transaksi.
- Total dihitung dari database.
- Stok otomatis berkurang.
- Struk dapat diprint melalui browser.

Test terkait:

- Checkout dua item, stok berkurang, total sesuai.
- Stok tidak cukup menghasilkan HTTP 409 dan stok tidak berubah.

Gap:

- Belum ada pembayaran kasbon langsung dari POS.
- Belum ada retur/refund/void.
- Belum ada diskon, pajak, atau catatan transaksi.
- Belum ada mode offline.
- Belum ada integrasi printer thermal langsung.

### 6.4 Inventaris

Status: sudah tersedia dan validasi server meningkat.

Kemampuan:

- Tambah produk.
- Edit produk.
- Restok manual.
- Pencarian produk.
- Indikator stok menipis.
- Role kasir dibatasi agar tidak bisa mutasi inventaris.

Perkembangan terbaru:

- Validasi produk sudah memakai Zod: nama wajib, kategori enum, harga/stok numerik, stok tidak negatif, harga jual harus positif.
- Test produk sudah mencakup create, reject stok negatif, update, restock, reset workspace, dan update settings.

Gap:

- Copy UI masih menyebut "state mock" pada halaman inventaris, padahal data sudah tersambung backend. Ini harus diperbaiki sebelum demo ke stakeholder.
- Belum ada delete/archive produk.
- Belum ada barcode/SKU, supplier, satuan barang, dan histori harga.

### 6.5 Restok AI / Scan Struk

Status: sudah tersedia sebagai fitur demo.

Kemampuan:

- Upload/foto struk.
- Gambar dikompresi sebelum dikirim ke AI.
- AI mencoba membaca item struk.
- User mengonfirmasi item sebelum stok bertambah.
- Batch restock API tersedia.

Kekuatan:

- Ada human confirmation sebelum data stok berubah.
- Role dibatasi untuk pimpinan/pengelola keuangan.

Gap:

- Akurasi OCR belum punya test otomatis.
- Belum ada penyimpanan file struk ke storage production.
- Belum ada retry/quality scoring gambar.

### 6.6 Buku Hutang / Kasbon

Status: sudah tersedia dan sudah punya test service.

Kemampuan:

- Tambah hutang.
- Filter semua/belum lunas/lunas.
- Tandai lunas.
- Simpan timestamp pengingat.
- Validasi nama, WhatsApp, nominal, dan tanggal jatuh tempo.

Test terkait:

- Create debt.
- Reminder timestamp tersimpan.
- Mark paid berhasil.
- Invalid debt ditolak.
- Missing paid target ditolak.

Gap:

- Pengingat WhatsApp masih berupa timestamp/simulasi, belum provider nyata.
- Belum ada cicilan/sebagian bayar.
- Belum ada histori pembayaran kasbon.

### 6.7 Investor dan Investasi

Status: sudah tersedia.

Kemampuan:

- Daftar investor.
- Detail investor.
- Tambah investor.
- Update/delete investor.
- Daftar dan tambah investasi.
- Investasi uang dan barang titip jual.
- Role dibatasi untuk pimpinan/pengelola keuangan.

Test terkait:

- RBAC investors API menolak kasir dengan 403.
- Pimpinan boleh akses dengan 200.

Gap:

- Belum ada test detail untuk CRUD investor/investasi.
- Deaktivasi investasi perlu aturan bisnis lebih kuat jika barang titip masih terkait stok aktif.

### 6.8 Bagi Hasil

Status: sudah tersedia dan sudah punya test calculation.

Kemampuan:

- Hitung profit periode.
- Hitung payout investor uang.
- Hitung payout barang titip jual berdasarkan margin produk.
- Simpan draft payout.
- Update status payout: draft, disetujui, dibayar.

Test terkait:

- Payout 2,5% untuk empat investor.
- Draft payout tersimpan.
- Status payout berubah ke disetujui/dibayar.
- Duplicate draft ditolak.
- Consignment payout dari margin produk.

Gap:

- Belum ada skenario UI test untuk alur approval.
- Belum ada export bukti payout.

### 6.9 Laporan Laba Rugi

Status: sudah tersedia dan coverage meningkat.

Kemampuan:

- Revenue.
- COGS/HPP.
- Expense total.
- Net profit.
- Series harian, mingguan, bulanan.
- Velocity produk.
- Top products per periode.

Test terkait:

- Revenue 10 juta, COGS 7 juta, expense 1 juta menghasilkan net profit 2 juta.
- Range periode bulanan Jakarta benar.
- Series dan top products dihitung.

Gap:

- Tombol print di laporan umum masih menampilkan toast "Mode print browser belum diaktifkan."
- Belum ada PDF/export untuk laporan umum.
- UI CRUD expense belum terlihat sebagai modul penuh.

### 6.10 Laporan PCM

Status: sudah tersedia.

Kemampuan:

- Laporan PCM bulanan.
- Snapshot data laporan.
- Status draft/final.
- PDF on-demand.
- Audit log untuk perubahan/finalisasi laporan.

Gap:

- `pdfUrl` ada di schema, tetapi PDF saat ini masih dirender on-demand, belum persist/upload file.
- Perlu test khusus untuk create/finalize/PDF report.

### 6.11 AI Assistant

Status: sudah tersedia dan safety meningkat.

Kemampuan:

- Chat tersimpan di database.
- Riwayat pesan AI tersimpan.
- Quick prompt.
- Tool untuk membaca data usaha.
- Tool action dapat membuat preview.
- Aksi tulis membutuhkan konfirmasi.
- Commit endpoint memverifikasi signature.
- Aksi AI tercatat di audit log.

Perkembangan terbaru:

- Ada endpoint `/api/ai/tools/commit`.
- Ada `getToolMessageForCommit()`, `updateToolMessageResult()`, dan signature verification.
- UI menampilkan bahwa aksi AI yang mengubah data butuh konfirmasi.

Gap:

- Voice input belum tersedia.
- Belum ada masking/anonymization data sensitif sebelum dikirim ke provider AI eksternal.
- Belum ada test otomatis untuk tool AI, commit signature, dan prompt flow.
- `GEMINI_API_KEY` wajib ada untuk mengaktifkan AI.

### 6.12 Pengaturan, Karyawan, dan Audit Log

Status: sudah tersedia.

Kemampuan:

- Edit profil warung.
- Edit identitas PCM.
- Edit metode pembayaran.
- Edit persentase pembagian laba.
- Kelola karyawan.
- Audit log untuk pimpinan.
- Filter audit log berdasarkan event, actor, start, end, limit.

Perkembangan terbaru:

- Tabel `audit_logs` sudah masuk schema.
- API audit log sudah tersedia.
- Halaman `/pengaturan/audit-log` sudah tersedia.

Gap:

- Audit event belum dipastikan mencakup semua operasi penting.
- Belum ada export audit log.

## 7. Database dan Schema

Tabel utama yang tersedia:

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
- `audit_logs`

Perkembangan terbaru:

- Ada migration eksplisit baru untuk schema dan audit logs.
- Schema sudah memiliki sejumlah index dan check constraint untuk role, tipe investasi, status payout, status laporan, dan source restock.
- Runtime startup database lokal diperbaiki melalui `scripts/start-db.mjs`.
- `scripts/reset-db.mjs` tersedia untuk reset data lokal.

Risiko database:

- Banyak relasi masih belum memakai foreign key eksplisit.
- Naming workspace belum sepenuhnya seragam: sebagian tabel memakai `user_id`, sebagian memakai `workspace_owner_id`.
- Masih perlu keputusan apakah production akan tetap memakai PostgreSQL langsung atau migrasi ke backend managed.

## 8. API Route Aktif

Build produksi mendeteksi route berikut:

- `/api/auth/[...all]`
- `/api/bootstrap`
- `/api/bootstrap/reset`
- `/api/products`
- `/api/products/[id]`
- `/api/products/[id]/restock`
- `/api/transactions`
- `/api/debts`
- `/api/debts/[id]`
- `/api/debts/[id]/remind`
- `/api/investors`
- `/api/investors/[id]`
- `/api/investments`
- `/api/investments/[id]`
- `/api/payouts`
- `/api/payouts/[id]`
- `/api/payouts/calculate`
- `/api/reports/profit-loss`
- `/api/reports/monthly-pcm`
- `/api/reports/monthly-pcm/[id]/pdf`
- `/api/restock/batch`
- `/api/ai/chats`
- `/api/ai/chats/[id]/messages`
- `/api/ai/scan-receipt`
- `/api/ai/tools/commit`
- `/api/audit-log`
- `/api/settings`
- `/api/users`
- `/api/users/invite`
- `/api/session/[intent]`

Catatan: route sudah cukup lengkap untuk aplikasi operasional internal.

## 9. Halaman Web Aktif

Build produksi mendeteksi halaman berikut:

- `/`
- `/auth`
- `/dashboard`
- `/kasir`
- `/inventaris`
- `/inventaris/restok-ai`
- `/buku-hutang`
- `/investor`
- `/investor/baru`
- `/investor/[id]`
- `/bagi-hasil`
- `/laporan`
- `/laporan-pcm`
- `/pengaturan`
- `/pengaturan/karyawan`
- `/pengaturan/audit-log`

Halaman ini menutup mayoritas scope produk yang dijelaskan di README.

## 10. Hasil QA Terbaru

### 10.1 Lint

Perintah:

```text
npm run lint
```

Hasil:

```text
Lulus tanpa error.
```

### 10.2 Unit/Service/API Tests

Perintah:

```text
npm test
```

Hasil:

```text
Test Files: 6 passed
Tests: 13 passed
Duration: 24,86s
```

Coverage:

| Area | Coverage |
| --- | ---: |
| Statements | 83,89% |
| Branches | 57,67% |
| Functions | 85,56% |
| Lines | 84,21% |

Coverage per file utama:

| File | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `app-service.ts` | 79,87% | 48,80% | 91,66% | 79,33% |
| `profit-sharing.ts` | 92,59% | 57,14% | 91,66% | 92,45% |
| `rbac.ts` | 76,47% | 62,50% | 80,00% | 76,47% |
| `reporting.ts` | 85,07% | 64,28% | 79,16% | 87,09% |
| `route-error.ts` | 71,42% | 76,92% | 100,00% | 71,42% |
| `timezone.ts` | 89,65% | 75,00% | 87,50% | 89,65% |
| `validation.ts` | 88,46% | 100,00% | 72,72% | 91,66% |

### 10.3 Production Build

Perintah:

```text
npm run build
```

Hasil:

```text
Compiled successfully.
TypeScript finished successfully.
Static page generation finished successfully.
```

Build memakai:

- Next.js 16.2.1
- Turbopack
- Environment loaded dari `.env.local` dan `.env`
- Experimental `authInterrupts`

## 11. Perbandingan dengan Audit Lama

Beberapa risiko pada laporan audit sebelumnya sudah membaik:

- Validasi backend tidak lagi lemah di produk/transaksi/hutang/settings, karena sudah ada `validation.ts`.
- Coverage test tidak lagi kosong untuk hutang dan laporan, karena sekarang ada test debts dan reports.
- Timezone sudah distandarkan ke Asia/Jakarta.
- AI action tidak lagi langsung menulis data tanpa confirmation gate, karena sudah ada preview/commit/signature flow.
- Audit log sudah mulai diimplementasikan secara nyata.

Risiko yang masih sama:

- WhatsApp reminder belum integrasi provider nyata.
- PDF laporan umum belum aktif.
- Voice input belum ada.
- Beberapa operasi penting mungkin belum semua masuk audit log.
- Production data model masih perlu foreign key dan naming workspace yang lebih konsisten.

## 12. Risiko dan Kelemahan Saat Ini

### Risiko Tinggi

1. Integrasi WhatsApp belum nyata.

Fitur kasbon dan reminder stok akan terasa belum lengkap jika target user mengharapkan pengingat otomatis lewat WhatsApp.

2. AI mengirim konteks ke provider eksternal.

Belum terlihat masking data sensitif sebelum dikirim ke provider AI. Untuk production, perlu kebijakan data minimization.

3. Relasi database belum sepenuhnya enforceable.

Tanpa foreign key eksplisit, risiko orphan data dan inkonsistensi meningkat saat data sudah besar.

### Risiko Sedang

1. Branch coverage masih 57,67%.

Banyak cabang error/edge case belum dites.

2. Laporan umum belum punya PDF/export.

Fitur laporan terlihat ada, tetapi output formal belum lengkap selain laporan PCM.

3. Audit log belum mencakup semua aksi.

Sudah ada fondasi, tetapi perlu checklist event penting.

4. Worktree belum commit.

Perubahan besar belum dikunci dalam commit sehingga risiko kehilangan konteks atau conflict lebih tinggi.

### Risiko Rendah

1. Copy UI "state mock" masih muncul.

Ini tidak merusak fungsi, tetapi buruk untuk demo dan dapat mengurangi kepercayaan evaluator.

2. Voice input AI belum tersedia.

UI sudah menampilkan tombol mic, tetapi fitur belum aktif.

## 13. Prioritas Rekomendasi Berikutnya

### P0: Sebelum Demo Stakeholder Besar

1. Ganti copy inventaris yang masih menyebut "state mock".
2. Pastikan semua halaman dashboard setelah login sudah dicek secara visual di browser.
3. Tambahkan seed/admin demo yang jelas agar evaluator bisa login cepat.
4. Commit perubahan besar saat ini setelah review.
5. Buat daftar audit event wajib dan pastikan operasi kritikal masuk audit log.

### P1: Sebelum Pilot Operasional

1. Integrasikan WhatsApp provider nyata untuk reminder hutang dan stok.
2. Tambahkan export PDF/CSV untuk laporan umum.
3. Tambahkan test untuk laporan PCM create/finalize/PDF.
4. Tambahkan test untuk AI commit signature dan tool action.
5. Tambahkan foreign key eksplisit pada schema utama.
6. Seragamkan naming workspace antara `user_id` dan `workspace_owner_id`.

### P2: Peningkatan Produk

1. Tambah barcode/SKU, satuan barang, supplier, dan histori harga.
2. Tambah pembayaran kasbon/cicilan.
3. Tambah retur/refund/void transaksi.
4. Tambah printer thermal support.
5. Tambah mode offline queue untuk kasir.
6. Tambah subscription/plan limit jika aplikasi akan dikomersialkan.

## 14. Status Kesiapan

| Area | Status | Catatan |
| --- | --- | --- |
| Demo UI | Siap | Halaman auth terbuka normal, build sukses. |
| Demo operasional | Siap | Modul utama lengkap untuk simulasi toko. |
| SUS testing | Siap | Scope fitur cukup lengkap, test teknis lulus. |
| Pilot internal terbatas | Hampir siap | Butuh akun demo, visual QA setelah login, dan commit stabil. |
| Production publik | Belum siap | Butuh WhatsApp nyata, hardening DB, audit menyeluruh, privacy AI, backup/deploy plan. |

## 15. Kesimpulan

Perkembangan terbaru TokoMu / WarungOS signifikan. Aplikasi sudah bukan sekadar prototipe tampilan, melainkan web app dengan backend, auth, role, database, laporan, AI, audit log, dan test otomatis. Secara teknis, kondisi terbaru lulus lint, test, dan production build.

Fokus berikutnya sebaiknya bukan menambah fitur besar baru, tetapi merapikan kesiapan pilot: bersihkan copy demo, pastikan semua flow setelah login mulus, tambah akun/seed demo, perluas audit log, commit perubahan, dan tentukan integrasi WhatsApp. Setelah itu barulah masuk ke hardening production seperti foreign key, export laporan, privacy AI, backup, deployment, dan observability.
