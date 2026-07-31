# 🗄️ Panduan Migrasi Database ke VPS — Kasir TokoMu (WarungOS)

> **Terakhir diperbarui:** 31 Juli 2026  
> **Stack:** PostgreSQL 16 · Drizzle ORM · Better Auth  
> **DB Lokal:** `postgres://postgres:postgres@localhost:5439/warungos`  
> **Target:** PostgreSQL di VPS

---

## ⚡ PENTING — Baca Ini Dulu!

Masalah paling umum saat redeploy ke VPS:

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Login gagal / user tidak dikenali | Data auth (`user`, `account`) ada di lokal, belum masuk VPS | **Ikuti Bagian 2 di bawah** |
| "Invalid origin" saat login | `BETTER_AUTH_URL` di VPS masih `localhost` | Ganti ke IP/domain VPS + tambah `NEXT_PUBLIC_BETTER_AUTH_URL` |
| Tabel belum ada | Migrasi belum dijalankan | `npm run db:migrate` |
| Data kosong setelah migrasi | Hanya skema yang dibuat, data belum ditransfer | Ikuti **Bagian 2 — Transfer Data** |

---

## 📋 Daftar Tabel (24 total)

### 🔐 Auth — 4 tabel (dikelola Better Auth)
| Tabel | Isi |
|-------|-----|
| `user` | Akun pengguna (email, password hash, nama) |
| `session` | Sesi login aktif |
| `account` | Credential / OAuth |
| `verification` | Token verifikasi email |

### 🏪 Aplikasi — 20 tabel (dikelola Drizzle ORM)
`store_profiles`, `user_roles`, `invitations`, `products`, `transactions`, `transaction_items`, `debts`, `debt_items`, `debt_payments`, `expenses`, `restock_plans`, `restock_logs`, `shifts`, `shift_sessions`, `investors`, `investments`, `investor_payouts`, `monthly_reports`, `ai_chats`, `ai_messages`, `audit_logs`

---

## 🗺️ Alur Lengkap (Baca Urutan Ini)

```
[1] Siapkan DB di VPS          → buat database kosong
[2] Buat skema tabel           → npm run db:migrate
[3] Transfer data dari lokal   → node scripts/dump-to-vps.mjs
[4] Update .env VPS            → DATABASE_URL + BETTER_AUTH_URL
[5] Build & restart app        → npm run build + pm2 restart
```

---

## BAGIAN 1 — Siapkan Database di VPS

### 1.1 Buat Database PostgreSQL

SSH ke VPS, lalu:

```bash
sudo -u postgres psql

-- Buat database dan user
CREATE DATABASE warungos;
CREATE USER warungos_user WITH ENCRYPTED PASSWORD 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON DATABASE warungos TO warungos_user;
ALTER DATABASE warungos OWNER TO warungos_user;
\q
```

### 1.2 Buat file .env di VPS

```bash
nano /opt/warungos/warungos/.env
```

Isi (sesuaikan IP/domain dan password):

```env
# ── Database (PostgreSQL lokal di VPS) ────────────────────
DATABASE_URL=postgresql://warungos_user:GANTI_PASSWORD_KUAT@localhost:5432/warungos

# ── Better Auth ────────────────────────────────────────────
# WAJIB: ganti ke URL/IP VPS yang diakses browser
BETTER_AUTH_SECRET=JALANKAN_openssl_rand_-base64_32
BETTER_AUTH_URL=http://IP_VPS_KAMU:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://IP_VPS_KAMU:3000

# Jika sudah pakai domain + SSL:
# BETTER_AUTH_URL=https://domain-kamu.com
# NEXT_PUBLIC_BETTER_AUTH_URL=https://domain-kamu.com

# Jika diakses dari beberapa URL berbeda:
# BETTER_AUTH_TRUSTED_ORIGINS=http://IP_VPS:3000,https://domain-kamu.com

# ── AI (Gemini) ────────────────────────────────────────────
GEMINI_API_KEY=AIzaSy...
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_TEXT_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_TEXT_MODEL_PINNED=gemini-3.6-flash
GEMINI_VISION_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_VISION_MODEL=gemini-3.6-flash
GEMINI_GOOGLE_API_KEYS=AIzaSy_KEY1,AIzaSy_KEY2
```

> ⚠️ `NEXT_PUBLIC_BETTER_AUTH_URL` di-embed saat `npm run build`.
> Harus sudah ada di `.env` **sebelum** build dijalankan!

### 1.3 Jalankan Migrasi Skema

```bash
cd /opt/warungos/warungos
npm run db:migrate
```

> Cek hasilnya — harus muncul 24+ tabel saat `\dt` di psql.

---

## BAGIAN 2 — Transfer Data dari Lokal ke VPS

> **Gunakan bagian ini jika:** data asli (akun 123@gmail.com, produk, transaksi, dll)
> ada di database lokal (`localhost:5439`) dan belum masuk VPS.

Ada **2 cara**, pilih salah satu:

### CARA 2A — Transfer Langsung via Script (Paling Mudah)

Script `scripts/dump-to-vps.mjs` sudah tersedia di repo.
Script ini konek ke DB lokal, baca semua tabel, dan insert langsung ke VPS.

**Langkah di PC Lokal (Windows):**

```powershell
# Pastikan DB lokal sedang berjalan (embedded postgres atau Docker)
# Cek dengan: node scripts/check-schema.mjs

# Jalankan transfer (edit VPS_DB_URL sesuai VPS kamu):
$env:LOCAL_DB_URL = "postgres://postgres:postgres@localhost:5439/warungos"
$env:VPS_DB_URL   = "postgresql://warungos_user:GANTI_PASSWORD_KUAT@IP_VPS_KAMU:5432/warungos"

node scripts/dump-to-vps.mjs
```

> ⚠️ Port **5432** (PostgreSQL VPS) harus bisa diakses dari PC lokal.
> Buka sementara di VPS: `sudo ufw allow 5432/tcp`
> Setelah transfer selesai, **tutup lagi**: `sudo ufw deny 5432/tcp`

**Hasil yang diharapkan:**

```
✅ DB lokal terhubung
✅ DB VPS terhubung
  Tabel "user"... 2 baris disalin
  Tabel "session"... 0 baris disalin
  Tabel "account"... 2 baris disalin
  ...
✅ Transfer selesai!
   Total baris berhasil : 150
```

### CARA 2B — pg_dump + scp + pg_restore (Manual tapi Offline)

Gunakan ini jika VPS tidak bisa dibuka port 5432 dari luar.

**Step 1 — Dump dari lokal (PowerShell):**

```powershell
# DB lokal berjalan di port 5439
$env:PGPASSWORD = "postgres"
pg_dump `
  "postgres://postgres:postgres@localhost:5439/warungos" `
  --no-owner --no-acl `
  --format=custom `
  --file=warungos_lokal.dump

# Verifikasi
dir warungos_lokal.dump
```

> Jika `pg_dump` tidak ada, download dari:
> https://www.postgresql.org/download/windows/
> (install hanya "Command Line Tools")

**Step 2 — Upload ke VPS:**

```powershell
scp warungos_lokal.dump user@IP_VPS_KAMU:/tmp/warungos_lokal.dump
```

**Step 3 — Restore di VPS:**

```bash
# SSH ke VPS
ssh user@IP_VPS_KAMU

# Restore (pastikan DB warungos sudah ada)
pg_restore \
  --dbname="postgresql://warungos_user:GANTI_PASSWORD_KUAT@localhost:5432/warungos" \
  --no-owner --no-acl \
  --verbose \
  /tmp/warungos_lokal.dump

# Jika ada error "already exists" → itu normal, lanjut saja
# Jika error kritis → jalankan npm run db:migrate ulang setelah restore
```

**Step 4 — Jalankan migrasi ulang (pastikan skema terbaru):**

```bash
cd /opt/warungos/warungos
npm run db:migrate
```

### Verifikasi Data Berhasil Masuk VPS

```bash
sudo -u postgres psql -d warungos

-- Cek user yang terdaftar (harus ada 123@gmail.com)
SELECT id, email, "createdAt" FROM "user";

-- Cek credential (password hash)
SELECT id, "userId", "providerId" FROM account;

-- Cek produk
SELECT COUNT(*) as total_produk FROM products;

-- Cek transaksi
SELECT COUNT(*) as total_transaksi FROM transactions;

\q
```

---

## BAGIAN 3 — Build & Redeploy

Setelah data masuk dan `.env` sudah benar:

```bash
cd /opt/warungos/warungos

# Pull kode terbaru (termasuk fix "Invalid origin")
git pull origin publish-tokomu

# Install dependencies
npm ci --production=false

# Jalankan migrasi (aman diulang, idempotent)
npm run db:migrate

# Build — NEXT_PUBLIC_BETTER_AUTH_URL di-embed di sini
npm run build

# Restart
pm2 restart warungos
# atau: docker compose up -d --build
```

### Script Redeploy Otomatis

Simpan sebagai `/opt/warungos/warungos/redeploy.sh`:

```bash
#!/bin/bash
set -e
cd /opt/warungos/warungos

echo "🔄 Pull kode terbaru..."
git pull origin publish-tokomu

echo "📦 Install dependencies..."
npm ci --production=false

echo "🗄️  Migrasi database..."
npm run db:migrate || echo "⚠️  Sudah up-to-date"

echo "🏗️  Build..."
npm run build

echo "🔁 Restart..."
pm2 restart warungos

echo "✅ Redeploy selesai!"
```

```bash
chmod +x redeploy.sh
./redeploy.sh
```

---

## BAGIAN 4 — Migrasi Manual (Jika `npm run db:migrate` Gagal)

Jalankan per file SQL satu per satu:

```bash
sudo -u postgres psql -d warungos

\i /opt/warungos/warungos/drizzle/0000_bent_emma_frost.sql
\i /opt/warungos/warungos/drizzle/0001_better_auth.sql
\i /opt/warungos/warungos/drizzle/0002_rich_thing.sql
\i /opt/warungos/warungos/drizzle/0003_ai_chat.sql
\i /opt/warungos/warungos/drizzle/0004_tokomu_extensions.sql
\i /opt/warungos/warungos/drizzle/0005_explicit_schema.sql
\i /opt/warungos/warungos/drizzle/0006_audit_logs.sql
\i /opt/warungos/warungos/drizzle/0006_invitations.sql
\i /opt/warungos/warungos/drizzle/0007_akad_fields.sql
\i /opt/warungos/warungos/drizzle/0007_audit_log_enhancements.sql
\i /opt/warungos/warungos/drizzle/0008_chairman_title.sql
\i /opt/warungos/warungos/drizzle/0008_debt_items_payments.sql
\i /opt/warungos/warungos/drizzle/0009_product_sku.sql
\i /opt/warungos/warungos/drizzle/0009_shifts.sql
\i /opt/warungos/warungos/drizzle/0010_transaction_cash_change.sql
\i /opt/warungos/warungos/drizzle/0014_puzzling_magma.sql
\i /opt/warungos/warungos/drizzle/0015_lonely_scarecrow.sql
\i /opt/warungos/warungos/drizzle/0016_investment_unit_amount.sql

\q
```

---

## 🐛 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Login gagal / user tidak ada | Data auth belum ditransfer | Ikuti **Bagian 2** |
| "Invalid origin" | `BETTER_AUTH_URL` masih localhost | Ganti ke `http://IP_VPS:3000` |
| `dump-to-vps.mjs` gagal konek VPS | Port 5432 VPS tertutup | Buka sementara: `sudo ufw allow 5432` |
| `pg_dump` tidak dikenal | pg_dump belum terinstall | Download PostgreSQL client tools |
| `relation already exists` | Tabel sudah ada | Pakai `npm run db:migrate` (idempotent) |
| `ECONNREFUSED 5432` | PostgreSQL VPS tidak jalan | `sudo systemctl start postgresql` |
| `password authentication failed` | Password salah di `.env` | Periksa `DATABASE_URL` |
| Build kehabisan memory | RAM VPS kurang | Tambah swap 2GB |

### Cara Tambah Swap (Jika RAM Habis saat Build)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Permanent:
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## ✅ Checklist Final

### Persiapan VPS
- [ ] PostgreSQL terinstall (`sudo systemctl status postgresql`)
- [ ] Database `warungos` sudah dibuat
- [ ] File `.env` sudah diisi benar (DATABASE_URL, BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL)
- [ ] `BETTER_AUTH_SECRET` sudah di-generate ulang (bukan default)

### Transfer Data
- [ ] DB lokal berjalan (port 5439)
- [ ] `scripts/dump-to-vps.mjs` berhasil dijalankan ATAU pg_dump+restore berhasil
- [ ] Verifikasi: `SELECT COUNT(*) FROM "user"` → harus > 0
- [ ] Verifikasi: akun `123@gmail.com` ada di tabel `user`

### Build & Deploy
- [ ] `git pull origin publish-tokomu` berhasil
- [ ] `npm run db:migrate` berhasil (24+ tabel)
- [ ] `npm run build` berhasil
- [ ] `pm2 restart warungos` / `docker compose up -d --build` berhasil
- [ ] Akses dari browser → login dengan `123@gmail.com` berhasil
- [ ] Data produk & transaksi tampil di dashboard
