# 🚀 Panduan Deploy WarungOS (Kasir TokoMu) ke VPS

> **Terakhir diperbarui:** 29 Juli 2026
> **Stack:** Next.js 16 · PostgreSQL 16 · Drizzle ORM · Better Auth · Gemini AI

---

## 📋 Prasyarat VPS

| Komponen          | Minimum              | Rekomendasi          |
|-------------------|----------------------|----------------------|
| **OS**            | Ubuntu 22.04 LTS     | Ubuntu 24.04 LTS     |
| **RAM**           | 1 GB                 | 2 GB+                |
| **CPU**           | 1 vCPU               | 2 vCPU               |
| **Disk**          | 20 GB SSD            | 40 GB SSD            |
| **Node.js**       | v20.x                | v22.x LTS            |
| **PostgreSQL**    | 15                   | 16                   |
| **Domain**        | Opsional             | Wajib jika pakai SSL |

### Software yang harus terinstall:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# (Opsional) Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
```

---

## 🔐 Environment Variables

Buat file `.env` di root project (`warungos/.env`):

```env
# ── Database ─────────────────────────────────────────────────
# Jika PostgreSQL di VPS lokal:
DATABASE_URL=postgresql://postgres:PASSWORD_KAMU@localhost:5432/warungos

# Jika tetap pakai InsForge cloud DB:
# DATABASE_URL=postgresql://postgres:xxx@rnuh6nq3.us-east.database.insforge.app:5432/insforge?sslmode=require

# ── Better Auth ──────────────────────────────────────────────
BETTER_AUTH_SECRET=GANTI_DENGAN_SECRET_RANDOM_32_CHAR
BETTER_AUTH_URL=https://domain-kamu.com

# ── AI (Gemini) ──────────────────────────────────────────────
# Opsi 1: Langsung pakai Google API Key
GEMINI_API_KEY=AIzaSy...
GEMINI_BASE_URL=
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_TEXT_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_TEXT_MODEL_PINNED=gemini-3.6-flash
GEMINI_VISION_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_VISION_MODEL=gemini-3.6-flash

# Opsi 2: Pakai InsForge Auth Key (awalan AQ.)
# GEMINI_API_KEY=AQ.xxxxx

# Opsi 3: Multiple Google API Keys (fallback)
GEMINI_GOOGLE_API_KEYS=AIzaSy_KEY1,AIzaSy_KEY2,AIzaSy_KEY3
```

> ⚠️ **PENTING:** Generate `BETTER_AUTH_SECRET` yang unik:
> ```bash
> openssl rand -base64 32
> ```

---

## 📦 Opsi A: Deploy dengan Docker (Rekomendasi)

### Step 1 — Clone & Setup

```bash
cd /opt
git clone https://github.com/JundyAlka/Kasir-TokoMu-.git warungos
cd warungos/warungos
```

### Step 2 — Buat file `.env`

```bash
nano .env
# Paste semua environment variables di atas, simpan (Ctrl+X, Y, Enter)
```

### Step 3 — Set password DB di docker-compose

```bash
export DB_PASSWORD=password_kuat_kamu
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export BETTER_AUTH_URL=https://domain-kamu.com
export GEMINI_API_KEY=api_key_kamu
```

### Step 4 — Update `docker-compose.yml` env

Pastikan `docker-compose.yml` memiliki semua env AI yang dibutuhkan.
Edit bagian `environment` pada service `app`:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - DATABASE_URL=postgresql://postgres:${DB_PASSWORD:-postgres}@postgres:5432/warungos
  - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
  - BETTER_AUTH_URL=${BETTER_AUTH_URL:-http://localhost:3000}
  - GEMINI_API_KEY=${GEMINI_API_KEY}
  - GEMINI_BASE_URL=
  - GEMINI_TEXT_MODEL=gemini-3.6-flash
  - GEMINI_FALLBACK_TEXT_MODEL=gemini-3.6-flash
  - GEMINI_FALLBACK_TEXT_MODEL_PINNED=gemini-3.6-flash
  - GEMINI_VISION_MODEL=gemini-3.6-flash
  - GEMINI_FALLBACK_VISION_MODEL=gemini-3.6-flash
  - GEMINI_GOOGLE_API_KEYS=${GEMINI_GOOGLE_API_KEYS:-}
```

### Step 5 — Build & Jalankan

```bash
docker compose up -d --build
```

### Step 6 — Jalankan Migrasi Database

```bash
docker compose exec app node -e "
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dir = './drizzle';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    const stmts = sql.split('--\> statement-breakpoint');
    for (const stmt of stmts) {
      if (stmt.trim()) {
        try { await client.query(stmt); console.log('OK', file); }
        catch (e) { console.log('SKIP', file, e.message); }
      }
    }
  }
  await client.end();
  console.log('Done!');
})();
"
```

### Step 7 — Verifikasi

```bash
docker compose ps          # Cek semua service running
docker compose logs app    # Cek log aplikasi
curl http://localhost:3000  # Test akses
```

---

## 📦 Opsi B: Deploy Manual (Tanpa Docker)

### Step 1 — Setup PostgreSQL

```bash
# Masuk ke PostgreSQL
sudo -u postgres psql

# Buat database & user
CREATE DATABASE warungos;
CREATE USER warungos_user WITH ENCRYPTED PASSWORD 'password_kuat_kamu';
GRANT ALL PRIVILEGES ON DATABASE warungos TO warungos_user;
ALTER DATABASE warungos OWNER TO warungos_user;
\q
```

### Step 2 — Clone & Install

```bash
cd /opt
git clone https://github.com/JundyAlka/Kasir-TokoMu-.git warungos
cd warungos/warungos

# Install dependencies
npm ci --production=false
```

### Step 3 — Buat file `.env`

```bash
nano .env
```

Isi dengan environment variables (lihat bagian **Environment Variables** di atas).
Pastikan `DATABASE_URL` mengarah ke PostgreSQL lokal:

```env
DATABASE_URL=postgresql://warungos_user:password_kuat_kamu@localhost:5432/warungos
```

### Step 4 — Migrasi Database

```bash
# Jalankan semua migrasi Drizzle
npm run db:migrate
```

### Step 5 — Build

```bash
npm run build
```

### Step 6 — Jalankan dengan PM2 (Process Manager)

```bash
# Install PM2 global
sudo npm install -g pm2

# Jalankan aplikasi
pm2 start npm --name "warungos" -- start

# Auto-start saat reboot
pm2 startup
pm2 save
```

### Step 7 — Verifikasi

```bash
pm2 status              # Cek status app
pm2 logs warungos       # Cek log
curl http://localhost:3000
```

---

## 🌐 Nginx Reverse Proxy + SSL

### Step 1 — Konfigurasi Nginx

```bash
sudo nano /etc/nginx/sites-available/warungos
```

Isi:

```nginx
server {
    listen 80;
    server_name domain-kamu.com www.domain-kamu.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout untuk AI yang butuh waktu proses
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

```bash
# Aktifkan site
sudo ln -s /etc/nginx/sites-available/warungos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2 — Pasang SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-kamu.com -d www.domain-kamu.com
```

> SSL akan auto-renew. Setelah ini, update `BETTER_AUTH_URL` di `.env`:
> ```
> BETTER_AUTH_URL=https://domain-kamu.com
> ```
> Lalu restart app (`pm2 restart warungos` atau `docker compose restart app`)

---

## 🔄 Prosedur Redeploy / Update

Jalankan langkah ini **setiap kali ada update kode**:

```bash
# 1. Masuk ke folder project
cd /opt/warungos/warungos

# 2. Pull kode terbaru
git pull origin publish-tokomu

# 3. Install dependencies baru (jika ada)
npm ci --production=false

# 4. Jalankan migrasi database (jika ada perubahan schema)
npm run db:migrate

# 5. Build ulang
npm run build

# 6. Restart aplikasi
pm2 restart warungos
# atau jika Docker:
# docker compose up -d --build
```

### Script Otomatis — simpan sebagai `redeploy.sh`:

```bash
#!/bin/bash
set -e

echo "🔄 Pulling latest code..."
cd /opt/warungos/warungos
git pull origin publish-tokomu

echo "📦 Installing dependencies..."
npm ci --production=false

echo "🗄️  Running database migrations..."
npm run db:migrate || echo "⚠️  Migration warning (mungkin sudah up-to-date)"

echo "🏗️  Building application..."
npm run build

echo "🔁 Restarting application..."
pm2 restart warungos

echo "✅ Redeploy selesai!"
echo "🌐 Cek: https://domain-kamu.com"
```

```bash
chmod +x redeploy.sh
./redeploy.sh
```

---

## 🔥 Firewall

```bash
# Buka port yang diperlukan
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

> ⚠️ **JANGAN** buka port 3000 dan 5432 ke publik. Biarkan Nginx handle traffic HTTP/HTTPS.

---

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| **App tidak start** | Cek `pm2 logs warungos` atau `docker compose logs app` |
| **Database connection refused** | Pastikan PostgreSQL running: `sudo systemctl status postgresql` |
| **AI tidak berfungsi** | Cek `GEMINI_API_KEY` di `.env`. Test: `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY"` |
| **502 Bad Gateway (Nginx)** | App belum start / crash. Cek `pm2 status` |
| **SSL error** | Jalankan `sudo certbot renew --dry-run` |
| **Port 3000 sudah dipakai** | `lsof -i :3000` lalu `kill -9 PID` |
| **Migrasi gagal** | Jalankan manual per-file SQL |
| **Memory habis saat build** | Tambah swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

---

## 📁 Struktur File Penting

```
warungos/
├── .env                 ← Environment variables (JANGAN COMMIT)
├── .env.deploy          ← Env untuk deploy InsForge (JANGAN COMMIT)
├── Dockerfile           ← Docker image builder
├── docker-compose.yml   ← Docker orchestration
├── drizzle/             ← File migrasi SQL (0000 - 0016)
├── next.config.ts       ← output: "standalone" untuk production
├── package.json         ← Scripts: build, start, db:migrate
├── scripts/
│   └── deploy-env.mjs   ← Script deploy ke InsForge
└── src/                 ← Source code aplikasi
```

---

## ✅ Checklist Sebelum Go-Live

- [ ] PostgreSQL running dan database sudah dibuat
- [ ] File `.env` sudah diisi dengan benar
- [ ] `BETTER_AUTH_URL` sudah mengarah ke domain production
- [ ] `BETTER_AUTH_SECRET` sudah di-generate (jangan pakai default)
- [ ] `GEMINI_API_KEY` sudah diisi dan valid
- [ ] Migrasi database berhasil (`npm run db:migrate`)
- [ ] Build berhasil (`npm run build`)
- [ ] Nginx reverse proxy terkonfigurasi
- [ ] SSL certificate terpasang
- [ ] Firewall aktif (port 22, 80, 443 saja)
- [ ] PM2 auto-start saat reboot (`pm2 startup && pm2 save`)
- [ ] Test akses dari browser → login → coba fitur kasir & AI
