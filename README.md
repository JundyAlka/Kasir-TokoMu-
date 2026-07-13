# TokoMu

TokoMu adalah sistem operasi ritel (_retail operating system_) berbasis web yang dioptimalkan untuk perangkat tablet. Aplikasi ini menggabungkan alur kerja kasir (POS), manajemen inventaris, pencatatan piutang (kasbon), catatan investor, pembagian hasil, dan pelaporan bulanan dalam satu ruang kerja.

## 🚀 Quick Start (Development Lokal)

Untuk menjalankan proyek ini secara lokal, ikuti langkah berikut:

### 1. Persiapan Environment
TokoMu menggunakan variabel environment untuk konfigurasi keamanan dan database.

1. Salin file template ke file `.env` dan `.env.local`:
   ```bash
   cp .env.example .env.local
   cp .env.example .env
   ```
2. Buka `.env.local` dan sesuaikan nilainya:
   - `DATABASE_URL`: Biarkan default (`postgres://postgres:postgres@localhost:5439/warungos`) jika menggunakan script bawaan.
   - `BETTER_AUTH_SECRET`: Generate kunci rahasia acak 32 karakter (bisa gunakan `openssl rand -base64 32`).
   - `BETTER_AUTH_URL`: Biarkan default (`http://localhost:3000`).
   - `GEMINI_API_KEY`: Masukkan API Key dari Google AI Studio jika ingin menggunakan fitur AI.

### 2. Instalasi & Menjalankan Server Lokal
Aplikasi ini sudah membundel PostgreSQL secara tertanam (_embedded_) untuk mempermudah development.
```bash
npm install
npm run dev
```
Perintah `npm run dev` otomatis akan:
- Menjalankan PostgreSQL di background (port `5439`).
- Menjalankan Next.js di `http://localhost:3000`.

### 3. Migrasi & Data Dummy (Reset)
Jika database masih kosong, jalankan langkah ini di terminal terpisah:
```bash
npm run db:reset
npm run db:push
npm run auth:migrate
npm run db:seed
```
Ini akan membuat semua skema tabel dan mengisi aplikasi dengan data dummy lengkap.

---

## 🚢 Deployment ke VPS (Production)

TokoMu sudah disiapkan untuk bisa di-deploy dengan mudah menggunakan **Docker Compose**. Ini sangat disarankan agar aplikasi lebih hemat memori berkat metode _multi-stage standalone build_.

### 1. Clone & Set Environment VPS
Masuk ke VPS Anda via SSH, clone repo ini, lalu siapkan `.env`:
```bash
cp .env.example .env
nano .env
```
Sesuaikan konfigurasi `.env` untuk **production**:
```env
# URL Database untuk docker compose
DATABASE_URL=postgresql://postgres:PasswordAman123!@postgres:5432/warungos
DB_PASSWORD=PasswordAman123!

# URL Publik website Anda
BETTER_AUTH_URL=https://kasir.tokomu.com
BETTER_AUTH_SECRET=RahasiaPanjangAndaDisini
```

### 2. Build & Jalankan via Docker
Jalankan perintah ini:
```bash
docker compose up -d --build
```

### 3. Setup Database (Migrasi Awal di Server)
Masuk ke container aplikasi untuk memvalidasi dan memigrasi database:
```bash
docker compose exec app sh
npx better-auth migrate --config src/lib/auth.ts
node --import tsx ./scripts/reset-db.mjs
node --import tsx ./scripts/seed.ts
exit
```

### 4. Ekspos Domain
Setup Nginx / Caddy sebagai _reverse proxy_ di VPS Anda yang mem-forward request port 80/443 ke `localhost:3000`.

---

## 🛠 Teknologi

- **Framework**: Next.js App Router (React)
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL (Drizzle ORM)
- **Autentikasi**: Better Auth
- **AI**: Google Gemini API (untuk receipt OCR & chat assistant)
- **Laporan PDF**: React PDF renderer
