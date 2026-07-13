<p align="center">
  <img src="docs/logo.png" alt="Kasir TokoMu Logo" width="180" />
</p>

<h1 align="center">Kasir TokoMu</h1>

<p align="center">
  <em>Satu Platform. Semua Kebutuhan Toko Anda.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-Gemini%20%2F%20DeepSeek-FF6B35?logo=google&logoColor=white" />
</p>

---

**Kasir TokoMu** adalah *Retail Operating System* (ROS) modern berbasis web yang dirancang khusus untuk perangkat tablet. Sistem ini menggabungkan seluruh alur operasional toko ritel dalam satu workspace terpadu — dari transaksi kasir, manajemen stok, pencatatan piutang, transparansi investor, hingga laporan keuangan bulanan siap cetak — semuanya tersedia offline-ready dan tanpa biaya langganan.

---

## ✨ Highlights

- **Point of Sale (Kasir)** — Antarmuka kasir *touch-friendly* dengan keranjang responsif, uang pas & kembalian otomatis, dukungan QRIS, transfer bank, dan cetak struk termal 80mm
- **Manajemen Inventaris** — CRUD produk multi-kategori, notifikasi stok kritis, pencatatan restok harian, ekspor laporan ke Excel
- **Buku Hutang (Kasbon)** — Tracking piutang pelanggan per item, cicilan, jatuh tempo otomatis, dan satu klik salin pesan tagihan ke WhatsApp
- **Investor & Bagi Hasil** — Manajemen data investor, kalkulasi distribusi profit otomatis sesuai persentase akad per periode bulan
- **Laporan Cerdas (PCM)** — Rekap harian / mingguan / bulanan, laporan PCM (Pendapatan–Pengeluaran–Modal), ekspor PDF & CSV
- **Asisten AI** — Chatbot AI (DeepSeek / Kimi) yang memahami konteks data toko: analisis penjualan, saran strategi, dan OCR struk belanja lewat kamera
- **Manajemen Karyawan** — RBAC penuh (Pimpinan / Kasir / Admin), undang via email, audit log seluruh aktivitas toko
- **Shift & Pengaturan** — Manajemen jadwal shift, konfigurasi harga, pajak, dan profil toko

---

## 🛠 Tech Stack

| Layer | Teknologi |
|---|---|
| **Framework** | Next.js 16.2 (App Router), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS v4, shadcn/ui, Base UI, Lucide React |
| **Database** | PostgreSQL (cloud via InsForge) |
| **ORM** | Drizzle ORM v0.45 + Drizzle Kit |
| **Autentikasi** | Better Auth v1.5 — sesi berbasis database |
| **AI** | DeepSeek-V4-Flash (teks), Kimi-K2.6 (vision/OCR) |
| **PDF & Export** | @react-pdf/renderer, ExcelJS, Papaparse |
| **Validasi** | Zod v4 |
| **Testing** | Vitest, Playwright, MSW |
| **Deploy** | Docker, Vercel, Node.js |

---

## 🚀 Quick Start

```bash
# 1. Clone repo
git clone https://github.com/JundyAlka/Kasir-TokoMu-.git
cd Kasir-TokoMu-

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env — isi DATABASE_URL, BETTER_AUTH_SECRET, dan GEMINI_API_KEY

# 4. Push skema & seed database
npm run db:push
npm run db:seed

# 5. Jalankan server
npm run dev
# → http://localhost:3000
```

---

## ⚙️ Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
BETTER_AUTH_SECRET=your-32-char-secret
BETTER_AUTH_URL=http://localhost:3000

GEMINI_API_KEY=your-ai-api-key
GEMINI_BASE_URL=https://api.hcnsec.cn/v1
GEMINI_TEXT_MODEL=DeepSeek-V4-Flash
GEMINI_VISION_MODEL=Kimi-K2.6
```

> Lihat `.env.example` untuk template lengkap.

---

## 🚢 Deployment

### Vercel
1. Import repo ke [vercel.com](https://vercel.com/new)
2. Set semua *Environment Variables* di dashboard Vercel
3. Deploy — Vercel otomatis menjalankan `npm run build`
4. Setelah deploy, jalankan `npm run db:push` dari lokal untuk sinkronisasi skema database

### Docker / VPS
```bash
cp .env.example .env  # isi nilai production
docker compose up -d --build
docker compose exec app npm run db:push
```

---

## 📁 Struktur Proyek

```
warungos/
├── src/
│   ├── app/              # Next.js App Router — pages & API routes
│   ├── components/
│   │   ├── tokomu/       # Domain: kasbon, struk, audit, laporan
│   │   ├── warung/       # Layout views: kasir, inventaris, dashboard
│   │   └── ui/           # Design system (shadcn + Base UI)
│   ├── db/schema.ts      # Drizzle schema — sumber kebenaran database
│   └── lib/
│       ├── server/       # AI, auth, app-service, validasi
│       └── types.ts      # TypeScript types terpusat
├── drizzle/              # File migrasi SQL
├── scripts/              # seed.ts, reset-db.mjs
├── Dockerfile
└── docker-compose.yml
```

---

## 📜 Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm run start` | Jalankan production |
| `npm run db:push` | Push skema Drizzle ke database |
| `npm run db:seed` | Isi database dengan data dummy |
| `npm run db:reset` | Reset database |
| `npm run db:studio` | Buka Drizzle Studio |
| `npm run auth:migrate` | Migrasi tabel Better Auth |
| `npm test` | Jalankan unit test (Vitest) |

---

<p align="center">
  Dibangun dengan ❤️ untuk memajukan ritel dan UMKM Indonesia
</p>
