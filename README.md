# Kasir TokoMu

> **Retail Operating System** berbasis web — POS, Inventaris, Kasbon, Laporan, & AI Assistant dalam satu workspace.

---

## Tentang Proyek

**Kasir TokoMu** (kode internal: *WarungOS*) adalah sistem manajemen toko ritel modern yang dibangun dengan pendekatan *tablet-first*. Dirancang untuk warung, minimarket, dan UMKM yang membutuhkan sistem kasir ringan namun kaya fitur — tanpa ketergantungan pada *software* berbayar berlangganan.

Sistem ini menggabungkan seluruh alur operasional harian dalam satu platform terpadu: dari transaksi kasir, pengelolaan stok, pencatatan piutang pelanggan, transparansi keuangan investor, hingga laporan laba-rugi bulanan yang siap cetak.

---

## Fitur Utama

| Modul | Deskripsi |
|---|---|
| 🛒 **Point of Sale (Kasir)** | Antarmuka kasir *touch-friendly* dengan keranjang responsif, dukungan uang pas & kembalian otomatis, QRIS & transfer bank, cetak struk termal |
| 📦 **Manajemen Inventaris** | CRUD produk multi-kategori, notifikasi stok kritis, pencatatan restok harian, ekspor ke Excel |
| 💳 **Buku Hutang (Kasbon)** | Pencatatan hutang pelanggan, tracking cicilan, jatuh tempo, salin pesan tagihan via WhatsApp |
| 🤝 **Investor & Bagi Hasil** | Manajemen data investor, kalkulasi distribusi profit otomatis berdasarkan persentase akad per bulan |
| 📊 **Laporan Keuangan** | Rekap harian/mingguan/bulanan, laporan PCM (Pendapatan, Pengeluaran, Modal), ekspor PDF & CSV |
| 🤖 **Asisten AI** | Chatbot berbasis Gemini yang memahami konteks data toko — analisis penjualan, saran diskon, OCR struk belanja |
| 👥 **Manajemen Karyawan** | Role-based access (Pimpinan / Kasir / Admin), undang via email, audit log seluruh aktivitas |
| 🔐 **Shift & Keamanan** | Manajemen shift kasir, pengaturan harga & pajak, keamanan sesi berbasis database |

---

## Tech Stack

### Core
| Layer | Teknologi | Versi |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) | `16.2.1` |
| Language | TypeScript | `^5` |
| UI Runtime | React | `19.2.4` |

### Database & ORM
| Layer | Teknologi | Versi |
|---|---|---|
| Database | PostgreSQL | `≥ 15` |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | `^0.45` |
| Migrations | Drizzle Kit | `^0.31` |
| Client | `pg` (node-postgres) | `^8.20` |

### Autentikasi
| Layer | Teknologi | Versi |
|---|---|---|
| Auth Library | [Better Auth](https://better-auth.com) | `^1.5.6` |
| Strategy | Email + Password, sesi berbasis database | — |

### UI & Styling
| Layer | Teknologi |
|---|---|
| Component Primitives | [Base UI](https://base-ui.com) (`@base-ui/react`) |
| Component System | [shadcn/ui](https://ui.shadcn.com) |
| CSS Framework | Tailwind CSS `v4` |
| Icon Library | Lucide React |
| Toast / Notifikasi | Sonner |
| PDF Renderer | `@react-pdf/renderer` |

### AI & Integrasi
| Layer | Teknologi |
|---|---|
| AI Provider | Google Generative AI (Gemini 2.0 Flash) |
| QR Code | `qrcode` |
| Date Utils | `date-fns`, `date-fns-tz` |
| Validation | Zod v4 |

### Tooling & Testing
| Tool | Keterangan |
|---|---|
| Vitest | Unit & integration testing |
| Playwright | E2E testing |
| MSW | API mocking untuk testing |
| ESLint | Linting & code quality |
| tsx | TypeScript script runner |

---

## Struktur Direktori

```
warungos/
├── src/
│   ├── app/                    # Next.js App Router (pages & API routes)
│   │   ├── (dashboard)/        # Layout dashboard utama
│   │   └── api/                # REST API endpoints
│   ├── components/
│   │   ├── tokomu/             # Komponen domain bisnis (audit, struk, kasbon, dll)
│   │   ├── warung/             # Komponen layout & view utama (kasir, inventaris, dll)
│   │   └── ui/                 # Design system (shadcn/base-ui)
│   ├── db/
│   │   └── schema.ts           # Drizzle schema — single source of truth database
│   └── lib/
│       ├── server/             # Server-only: auth, AI, app-service, validasi
│       ├── types.ts            # TypeScript types terpusat
│       └── format.ts           # Formatter mata uang, tanggal, dll
├── drizzle/                    # File migrasi SQL (auto-generated)
├── scripts/                    # Utilitas: seed, reset-db, transfer-data, dll
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Orkestrasi: app + postgres
└── deploy_instructions.txt     # Panduan deployment & env variables
```

---

## Menjalankan Secara Lokal

### Prasyarat
- Node.js `≥ 20`
- PostgreSQL `≥ 15` (atau gunakan Docker)
- npm `≥ 10`

### Langkah Setup

**1. Clone & install dependensi:**
```bash
git clone https://github.com/JundyAlka/Kasir-TokoMu-.git
cd Kasir-TokoMu-
npm install
```

**2. Konfigurasi environment:**
```bash
cp .env.example .env
```
Isi file `.env` dengan konfigurasi database dan API key Anda (lihat bagian [Environment Variables](#environment-variables)).

**3. Jalankan migrasi & seed database:**
```bash
npm run db:push      # Terapkan skema ke database
npm run db:seed      # Isi database dengan data awal/dummy
```

**4. Jalankan dev server:**
```bash
npm run dev
```
Buka `http://localhost:3000`.

---

## Environment Variables

Buat file `.env` di root folder `warungos/` dengan isian berikut:

```env
# ── Database ──────────────────────────────────────────────────────────
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/warungos

# ── Better Auth ───────────────────────────────────────────────────────
# Generate secret: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-key-here
# URL publik aplikasi (ubah ke domain production saat deploy)
BETTER_AUTH_URL=http://localhost:3000

# ── Google Gemini AI ──────────────────────────────────────────────────
# Dapatkan API Key dari: https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-api-key
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_VISION_MODEL=gemini-2.0-flash
```

> **Lihat `deploy_instructions.txt`** di root repo untuk konfigurasi siap-pakai yang sudah diisi dengan environment aktual proyek ini.

---

## Deployment

### Via Vercel (Rekomendasi)
1. *Fork* / *import* repo ini ke Vercel.
2. Atur seluruh *Environment Variables* di *dashboard* Vercel.
3. Vercel akan otomatis menjalankan `npm run build` dan `npm start`.
4. Setelah deploy pertama, jalankan migrasi database dari lokal:
   ```bash
   # Arahkan DATABASE_URL ke database production
   npm run db:push
   ```

### Via Docker Compose (VPS/Self-hosted)
```bash
cp .env.example .env
# Edit .env sesuaikan dengan production
docker compose up -d --build
```

---

## Scripts yang Tersedia

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan dev server (Next.js) |
| `npm run build` | Build untuk production |
| `npm run start` | Jalankan server production |
| `npm run db:push` | Push skema Drizzle ke database |
| `npm run db:seed` | Isi database dengan data dummy |
| `npm run db:reset` | Reset ulang database (hapus semua data) |
| `npm run db:studio` | Buka Drizzle Studio (GUI database) |
| `npm run auth:migrate` | Jalankan migrasi tabel autentikasi |
| `npm test` | Jalankan semua unit test (Vitest) |

---

## Lisensi

Proyek ini dikembangkan sebagai sistem kasir mandiri untuk kebutuhan internal UMKM dan penelitian akademis.

---

*Dibangun dengan ❤️ untuk memajukan ritel dan UMKM Indonesia.*
