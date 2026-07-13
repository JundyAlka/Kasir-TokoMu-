/**
 * capture-screenshots.mjs
 * Playwright automation: Ambil full-page screenshot MENYELURUH untuk setiap halaman,
 * tab, modal, popup, filter, dan Asisten AI TokoMu.
 * 
 * Jalankan: node scripts/capture-screenshots.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots");
const BASE_URL = "http://localhost:3000";

// Credentials
const DEMO_EMAIL = "pimpinan@tokomu.demo";
const DEMO_PASSWORD = "TokoMu2025!";
const DEMO_NAME = "Pimpinan TokoMu";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function waitReady(page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  } catch (err) {
    if (!String(err).includes('ERR_ABORTED') && !String(err).includes('Navigation interrupted')) {
      throw err;
    }
    await page.waitForTimeout(500);
  }
}

async function snap(page, filename, description) {
  const outPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`  ✔ ${filename.padEnd(42)} — ${description}`);
}

/** Close dialog via Escape key */
async function closeDialog(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
}

/** Signup via form UI */
async function signupViaUI(page, email, password, name) {
  await safeGoto(page, `${BASE_URL}/auth?mode=signup`);
  await page.waitForTimeout(800);

  await page.locator('#signup-name').fill(name);
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);

  await page.locator('button[type="submit"][form="signup-form"]').click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 20_000 }).catch(() => {});
  await waitReady(page);
}

/** Signin via form UI */
async function signinViaUI(page, email, password) {
  await safeGoto(page, `${BASE_URL}/auth`);
  await page.waitForTimeout(600);

  await page.locator('#signin-email').fill(email);
  await page.locator('#signin-password').fill(password);

  await page.locator('button[type="submit"][form="signin-form"]').click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 20_000 }).catch(() => {});
  await waitReady(page);
}

/** Ensure logged in */
async function ensureLoggedIn(page, email, password, name) {
  await signinViaUI(page, email, password);
  const url = page.url();
  if (url.includes("/dashboard")) {
    console.log(`  ✓ Signed in as ${email}`);
    return;
  }
  console.log(`  ⚠ Sign-in failed, trying registration…`);
  await signupViaUI(page, email, password, name);
  const urlAfter = page.url();
  if (urlAfter.includes("/dashboard")) {
    console.log(`  ✓ Registered & signed in as ${email}`);
  } else {
    console.log(`  ⚠ Could not auto-login. URL: ${urlAfter}`);
  }
}

// ─── Main Execution ─────────────────────────────────────────────────────────
async function main() {
  ensureDir(SCREENSHOTS_DIR);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 60,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  });

  const page = await context.newPage();
  const daftar = [];

  function record(filename, modul, bagian, description) {
    daftar.push({ filename, modul, bagian, description });
  }

  try {
    // ════════════════════════════════════════════════════════════════════════
    // 1. AUTH / LOGIN & REGISTER
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[1/15] Halaman Autentikasi (/auth)…");
    await safeGoto(page, `${BASE_URL}/auth`);
    await page.waitForTimeout(1000);
    await snap(page, "gambar_4.5_login.png", "Halaman Login utama (form sign in)");
    record("gambar_4.5_login.png", "Autentikasi", "Login Form", "Halaman login utama dengan form email & password untuk masuk ke workspace.");

    await safeGoto(page, `${BASE_URL}/auth?mode=signup`);
    await page.waitForTimeout(800);
    await page.locator('#signup-name').fill("Calon Mitra TokoMu");
    await page.locator('#signup-email').fill("mitra@tokomu.demo");
    await page.locator('#signup-password').fill("Rahasia123!");
    await snap(page, "02_auth_signup_form.png", "Halaman Sign Up (form pendaftaran terisi)");
    record("02_auth_signup_form.png", "Autentikasi", "Sign Up Form", "Form pendaftaran akun baru dengan validasi nama, email, dan password.");

    // Login sebagai pimpinan utama
    console.log("\n[Setup] Login sebagai Pimpinan…");
    await ensureLoggedIn(page, DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME);

    // ════════════════════════════════════════════════════════════════════════
    // 2. DASHBOARD & STAT DIALOGS
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[2/15] Halaman Dashboard (/dashboard)…");
    await safeGoto(page, `${BASE_URL}/dashboard`);
    await waitReady(page);
    await snap(page, "gambar_4.6_dashboard.png", "Dashboard utama Pimpinan (laba, omzet, grafik, stok menipis)");
    record("gambar_4.6_dashboard.png", "Dashboard", "Tampilan Utama", "Ringkasan operasional harian, grafik omzet 7 hari, produk menipis, dan kasbon terbaru.");

    // Dialog Stat: Omzet Hari Ini
    const cardOmzet = page.locator('.rounded-\\[24px\\]:has-text("Omzet hari ini")').first();
    if (await cardOmzet.isVisible()) {
      await cardOmzet.click();
      await page.waitForTimeout(800);
      await snap(page, "04_dashboard_stat_dialog_omzet.png", "Modal detail statistik Omzet Hari Ini");
      record("04_dashboard_stat_dialog_omzet.png", "Dashboard", "Modal Stat Omzet", "Rincian kontribusi transaksi dan metode bayar pada omzet hari ini.");
      await closeDialog(page);
    }

    // Dialog Stat: Transaksi
    const cardTrx = page.locator('.rounded-\\[24px\\]:has-text("Transaksi")').first();
    if (await cardTrx.isVisible()) {
      await cardTrx.click();
      await page.waitForTimeout(800);
      await snap(page, "05_dashboard_stat_dialog_transaksi.png", "Modal detail statistik Transaksi Hari Ini");
      record("05_dashboard_stat_dialog_transaksi.png", "Dashboard", "Modal Stat Transaksi", "Perincian jumlah transaksi, tiket rata-rata, dan kecepatan kasir.");
      await closeDialog(page);
    }

    // Dialog Stat: Stok Menipis
    const cardStok = page.locator('.rounded-\\[24px\\]:has-text("Stok menipis")').first();
    if (await cardStok.isVisible()) {
      await cardStok.click();
      await page.waitForTimeout(800);
      await snap(page, "06_dashboard_stat_dialog_stok.png", "Modal detail statistik Stok Menipis");
      record("06_dashboard_stat_dialog_stok.png", "Dashboard", "Modal Stat Stok", "Daftar produk yang perlu segera direstok sebelum kehabisan.");
      await closeDialog(page);
    }

    // Dialog Stat: Kasbon Aktif
    const cardKasbon = page.locator('.rounded-\\[24px\\]:has-text("Kasbon aktif")').first();
    if (await cardKasbon.isVisible()) {
      await cardKasbon.click();
      await page.waitForTimeout(800);
      await snap(page, "07_dashboard_stat_dialog_kasbon.png", "Modal detail statistik Kasbon Aktif");
      record("07_dashboard_stat_dialog_kasbon.png", "Dashboard", "Modal Stat Kasbon", "Daftar piutang pelanggan dan sisa tagihan yang belum lunas.");
      await closeDialog(page);
    }

    // Timeline transaksi modal
    const btnTimeline = page.locator('button:has-text("Timeline transaksi")').first();
    if (await btnTimeline.isVisible()) {
      await btnTimeline.click();
      await page.waitForTimeout(800);
      await snap(page, "08_dashboard_timeline_modal.png", "Modal Timeline 10 transaksi terakhir");
      record("08_dashboard_timeline_modal.png", "Dashboard", "Modal Timeline", "Daftar riwayat 10 transaksi terbaru berserta status dan kasir yang bertugas.");
      await closeDialog(page);
    }

    // Klik salah satu item aktivitas/transaksi terbaru untuk membuka detail struk
    const trCard = page.locator('button:has-text("Rp")').filter({ hasText: /08|202|WIB/ }).first();
    if (await trCard.isVisible()) {
      await trCard.click();
      await page.waitForTimeout(800);
      await snap(page, "09_dashboard_transaction_detail_modal.png", "Modal detail transaksi & item terjual");
      record("09_dashboard_transaction_detail_modal.png", "Dashboard", "Modal Detail Transaksi", "Rincian barang yang dibeli pelanggan, harga satuan, diskon, dan metode bayar.");
      await closeDialog(page);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. KASIR / POS (/kasir) & SUB MENU PEMBAYARAN
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[3/15] Halaman Kasir / POS (/kasir)…");
    await safeGoto(page, `${BASE_URL}/kasir`);
    await waitReady(page);
    await snap(page, "gambar_4.7_kasir_pos.png", "Halaman Kasir POS utama (katalog produk & keranjang kosong)");
    record("gambar_4.7_kasir_pos.png", "Kasir / POS", "Tampilan Utama", "Antarmuka Point of Sale dengan filter kategori, pencarian cepat, dan panel keranjang.");

    // Filter Kategori
    await page.locator('button:has-text("Makanan")').first().click();
    await page.waitForTimeout(600);
    await snap(page, "11_kasir_pos_filter_makanan.png", "Kasir POS saat filter kategori Makanan aktif");
    record("11_kasir_pos_filter_makanan.png", "Kasir / POS", "Filter Kategori", "Katalog produk difilter khusus menampilkan kategori Makanan.");

    await page.locator('button:has-text("Semua")').first().click();
    await page.waitForTimeout(500);

    // Tambah 2 produk ke keranjang
    const btnAdd = page.locator('button:has-text("Tambah ke keranjang")');
    const countAdd = await btnAdd.count();
    if (countAdd >= 2) {
      await btnAdd.nth(0).click();
      await btnAdd.nth(1).click();
    } else if (countAdd === 1) {
      await btnAdd.nth(0).click();
    }
    await page.waitForTimeout(600);
    await snap(page, "12_kasir_pos_cart_filled.png", "Kasir POS dengan keranjang belanja terisi produk");
    record("12_kasir_pos_cart_filled.png", "Kasir / POS", "Keranjang Terisi", "Daftar belanja pelanggan dengan kalkulasi subtotal dan pilihan metode bayar.");

    // Preview QRIS
    const btnQris = page.locator('button:has-text("QRIS")').first();
    if (await btnQris.isVisible()) {
      await btnQris.click();
      await page.waitForTimeout(600);
      await snap(page, "13_kasir_pos_qris_preview.png", "Preview QR Code QRIS dinamis untuk pembayaran");
      record("13_kasir_pos_qris_preview.png", "Kasir / POS", "Pembayaran QRIS", "Tampilan QRIS yang siap dipindai oleh e-wallet atau m-banking pelanggan.");
    }

    // Preview Transfer Modal
    const btnTransfer = page.locator('button:has-text("Transfer")').first();
    if (await btnTransfer.isVisible()) {
      await btnTransfer.click();
      await page.waitForTimeout(800);
      await snap(page, "14_kasir_pos_transfer_modal.png", "Modal instruksi pembayaran Transfer Bank/DANA");
      record("14_kasir_pos_transfer_modal.png", "Kasir / POS", "Pembayaran Transfer", "Instruksi transfer rekening bank dan e-wallet beserta tombol konfirmasi pembayaran.");
      await closeDialog(page);
    }

    // Checkout Tunai -> Struk
    await page.locator('button:has-text("Tunai")').first().click();
    await page.waitForTimeout(400);
    const inputTunai = page.locator('input[placeholder*="0"]').first();
    if (await inputTunai.isVisible()) {
      await inputTunai.fill("100000");
    }
    const btnBayar = page.locator('button:has-text("Bayar & Simpan")').first();
    if (await btnBayar.isVisible()) {
      await btnBayar.click();
      await page.waitForTimeout(1000);
      await snap(page, "15_kasir_pos_receipt_dialog.png", "Modal Bukti Struk Penjualan setelah berhasil bayar");
      record("15_kasir_pos_receipt_dialog.png", "Kasir / POS", "Struk Transaksi", "Struk digital dengan rincian kembalian, QR transaksi, dan tombol cetak struk.");
      await closeDialog(page);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. INVENTARIS (/inventaris) & MODAL BARANG
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[4/15] Halaman Inventaris / Produk (/inventaris)…");
    await safeGoto(page, `${BASE_URL}/inventaris`);
    await waitReady(page);
    await snap(page, "gambar_4.8_inventaris.png", "Inventaris barang jadi lengkap dengan status stok & margin");
    record("gambar_4.8_inventaris.png", "Inventaris", "Tabel Produk", "Daftar lengkap produk, SKU, harga beli, harga jual, margin keuntungan, dan stok minimum.");

    // Stat Dialog: Total SKU
    const cardSku = page.locator('.rounded-\\[24px\\]:has-text("Total SKU")').first();
    if (await cardSku.isVisible()) {
      await cardSku.click();
      await page.waitForTimeout(800);
      await snap(page, "17_inventaris_stat_dialog_sku.png", "Modal summary statistik Total SKU Produk");
      record("17_inventaris_stat_dialog_sku.png", "Inventaris", "Modal Stat SKU", "Rincian sebaran kategori dan status aktif seluruh SKU di warung.");
      await closeDialog(page);
    }

    // Modal Tambah Barang
    const btnTambah = page.locator('button:has-text("Tambah barang")').first();
    if (await btnTambah.isVisible()) {
      await btnTambah.click();
      await page.waitForTimeout(800);
      await page.locator('input[id*="name"], input[placeholder*="kopi"], input[placeholder*="Nama"]').first().fill("Kopi Susu Aren Spesial");
      await page.locator('input[type="number"]').nth(0).fill("5000");
      await page.locator('input[type="number"]').nth(1).fill("8000");
      await snap(page, "20_inventaris_modal_add_product.png", "Modal form Tambah Produk Baru terisi draft");
      record("20_inventaris_modal_add_product.png", "Inventaris", "Modal Tambah Produk", "Formulir penambahan barang dengan kalkulasi otomatis margin keuntungan.");
      await closeDialog(page);
    }

    // Modal Edit Produk
    const btnEdit = page.locator('table button:has-text("Edit")').first();
    if (await btnEdit.isVisible()) {
      await btnEdit.click();
      await page.waitForTimeout(800);
      await snap(page, "21_inventaris_modal_edit_product.png", "Modal form Edit Produk & ubah stok/harga");
      record("21_inventaris_modal_edit_product.png", "Inventaris", "Modal Edit Produk", "Formulir pengubahan data produk, harga dasar, dan batas stok minimum.");
      await closeDialog(page);
    }

    // Modal Restok
    const btnRestok = page.locator('table button:has-text("Restok")').first();
    if (await btnRestok.isVisible()) {
      await btnRestok.click();
      await page.waitForTimeout(800);
      await snap(page, "22_inventaris_modal_restock_product.png", "Modal Restok cepat jumlah barang masuk");
      record("22_inventaris_modal_restock_product.png", "Inventaris", "Modal Restok Cepat", "Jendela penambahan jumlah stok persediaan produk secara instan.");
      await closeDialog(page);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. RESTOK AI OCR (/inventaris/restok-ai)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[5/15] Halaman Restok AI OCR (/inventaris/restok-ai)…");
    await safeGoto(page, `${BASE_URL}/inventaris/restok-ai`);
    await waitReady(page);
    await snap(page, "gambar_4.12_ai.png", "Halaman Restok via Scan Struk OCR & riwayat scan");
    record("gambar_4.12_ai.png", "Restok AI", "OCR Scanner", "Pemindai struk belanja supplier dengan kecerdasan buatan untuk restok massal otomatis.");

    // ════════════════════════════════════════════════════════════════════════
    // 6. BUKU HUTANG / KASBON (/buku-hutang) & TAB SUB MENU
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[6/15] Halaman Buku Hutang / Kasbon (/buku-hutang)…");
    await safeGoto(page, `${BASE_URL}/buku-hutang`);
    await waitReady(page);
    await snap(page, "gambar_4.9_buku_hutang.png", "Buku Hutang pelanggan tab Semua (daftar kasbon & jatuh tempo)");
    record("gambar_4.9_buku_hutang.png", "Buku Hutang", "Tab Semua", "Daftar lengkap kasbon pelanggan, sisa tagihan, dan tenggat waktu pembayaran.");

    // Tab Aktif
    await page.locator('button[role="tab"]:has-text("Aktif")').first().click();
    await page.waitForTimeout(600);
    await snap(page, "25_buku_hutang_tab_aktif.png", "Buku Hutang tab Aktif (tagihan berjalan)");
    record("25_buku_hutang_tab_aktif.png", "Buku Hutang", "Tab Aktif", "Filter kasbon yang sedang berjalan dan belum memasuki batas jatuh tempo.");

    // Tab Lewat Tempo
    await page.locator('button[role="tab"]:has-text("Lewat tempo")').first().click();
    await page.waitForTimeout(600);
    await snap(page, "26_buku_hutang_tab_lewat_tempo.png", "Buku Hutang tab Lewat Tempo (perlu ditagih)");
    record("26_buku_hutang_tab_lewat_tempo.png", "Buku Hutang", "Tab Lewat Tempo", "Daftar tagihan yang melebihi batas waktu pembayaran dan siap dikirimi pengingat WhatsApp.");

    // Tab Lunas
    await page.locator('button[role="tab"]:has-text("Lunas")').first().click();
    await page.waitForTimeout(600);
    await snap(page, "27_buku_hutang_tab_lunas.png", "Buku Hutang tab Lunas (riwayat selesai)");
    record("27_buku_hutang_tab_lunas.png", "Buku Hutang", "Tab Lunas", "Arsip kasbon dan cicilan pelanggan yang telah dibayar lunas sepenuhnya.");
    await page.locator('button[role="tab"]:has-text("Semua")').first().click();

    // Modal Catat Kasbon Baru
    const btnCatat = page.locator('button:has-text("Catat kasbon")').first();
    if (await btnCatat.isVisible()) {
      await btnCatat.click();
      await page.waitForTimeout(800);
      await snap(page, "29_buku_hutang_modal_add_debt.png", "Modal form Catat Kasbon Baru beserta rincian item");
      record("29_buku_hutang_modal_add_debt.png", "Buku Hutang", "Modal Catat Kasbon", "Form pencatatan hutang baru dengan pilihan produk, tenor, dan nomor WhatsApp.");
      await closeDialog(page);
    }

    // Modal Detail & Cicilan Kasbon
    const debtCard = page.locator('button:has-text("Dicatat:")').first();
    if (await debtCard.isVisible()) {
      await debtCard.click();
      await page.waitForTimeout(800);
      await snap(page, "30_buku_hutang_modal_detail_debt.png", "Modal Detail Kasbon & Catat Pembayaran Cicilan");
      record("30_buku_hutang_modal_detail_debt.png", "Buku Hutang", "Modal Detail & Cicilan", "Riwayat pembayaran cicilan pelanggan dan tombol kirim pengingat tagihan via WA.");
      await closeDialog(page);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. INVESTOR & TAMBAH INVESTOR (/investor)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[7/15] Halaman Manajemen Investor (/investor)…");
    await safeGoto(page, `${BASE_URL}/investor`);
    await waitReady(page);
    await snap(page, "gambar_4.10_investor.png", "Daftar pemodal/investor aktif & persentase bagi hasil");
    record("gambar_4.10_investor.png", "Investor", "Tampilan Daftar", "Kelola porsi kepemilikan saham/investasi dan persentase bagi hasil mitra pemodal.");

    // Modal detail investor / bagi hasil
    const btnDetailInv = page.locator('button:has-text("Detail"), button:has-text("Bayar"), div.rounded-\\[26px\\] button').first();
    if (await btnDetailInv.isVisible()) {
      await btnDetailInv.click();
      await page.waitForTimeout(800);
      await snap(page, "32_investor_modal_detail_pembagian.png", "Modal rincian bagi hasil / edit profil investor");
      record("32_investor_modal_detail_pembagian.png", "Investor", "Modal Detail / Bayar", "Rincian perhitungan dividen keuntungan bulanan yang dibagikan kepada pemodal.");
      await closeDialog(page);
    }

    await safeGoto(page, `${BASE_URL}/investor/baru`);
    await waitReady(page);
    await snap(page, "33_investor_form_tambah_baru.png", "Halaman/Form Tambah Investor Baru & porsi modal");
    record("33_investor_form_tambah_baru.png", "Investor", "Tambah Investor", "Formulir pendaftaran mitra investor baru beserta kesepakatan porsi modal awal.");

    // ════════════════════════════════════════════════════════════════════════
    // 8. BAGI HASIL & PENGELUARAN (/bagi-hasil)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[8/15] Halaman Bagi Hasil & Pengeluaran (/bagi-hasil)…");
    await safeGoto(page, `${BASE_URL}/bagi-hasil`);
    await waitReady(page);
    await snap(page, "34_bagi_hasil_pengeluaran_main.png", "Manajemen biaya operasional & catatan bagi hasil");
    record("34_bagi_hasil_pengeluaran_main.png", "Bagi Hasil & Pengeluaran", "Tampilan Utama", "Pencatatan pengeluaran rutin warung (listrik, sewa, gaji) dan riwayat distribusi laba.");

    // ════════════════════════════════════════════════════════════════════════
    // 9. LAPORAN BULANAN (/laporan) & TREN MINGGUAN
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[9/15] Halaman Laporan Bulanan (/laporan)…");
    await safeGoto(page, `${BASE_URL}/laporan`);
    await waitReady(page);
    await snap(page, "gambar_4.11_laporan.png", "Ringkasan Untung Rugi Bulanan, kurva tren & acuan bisnis");
    record("gambar_4.11_laporan.png", "Laporan Bulanan", "Tampilan Utama (Bulan)", "Laporan laba rugi komprehensif, HPP, kurva tren omzet bulanan, dan valuasi bisnis.");

    // Filter Tren Mingguan
    const btnMinggu = page.locator('button:has-text("1 Minggu")').first();
    if (await btnMinggu.isVisible()) {
      await btnMinggu.click();
      await page.waitForTimeout(800);
      await snap(page, "37_laporan_tab_mingguan.png", "Laporan Untung Rugi dengan kurva tren 1 Minggu terpilih");
      record("37_laporan_tab_mingguan.png", "Laporan Bulanan", "Tren 1 Minggu", "Analisis performa dan kurva pendapatan harian dalam rentang 1 minggu terakhir.");
    }

    // ════════════════════════════════════════════════════════════════════════
    // 10. LAPORAN PCM (/laporan-pcm)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[10/15] Halaman Laporan PCM (/laporan-pcm)…");
    await safeGoto(page, `${BASE_URL}/laporan-pcm`);
    await waitReady(page);
    await snap(page, "38_laporan_pcm_main.png", "Laporan khusus transparansi bagi hasil PCM Muhammadiyah");
    record("38_laporan_pcm_main.png", "Laporan PCM", "Tampilan Utama", "Laporan pertanggungjawaban dan transparansi keekonomian khusus untuk persyarikatan PCM.");

    // ════════════════════════════════════════════════════════════════════════
    // 11. PENGATURAN (/pengaturan) - PROFIL & SHIFT
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[11/15] Halaman Pengaturan Warung (/pengaturan)…");
    await safeGoto(page, `${BASE_URL}/pengaturan`);
    await waitReady(page);
    await snap(page, "gambar_4.14_pengaturan.png", "Pengaturan Profil Warung, notifikasi stok & metode bayar");
    record("gambar_4.14_pengaturan.png", "Pengaturan", "Tab Profil Warung", "Pengaturan identitas toko, alamat, batas alert stok menipis, dan opsi metode pembayaran.");

    // Tab Shift Kasir
    await page.locator('button[role="tab"]:has-text("Shift Kasir")').first().click();
    await page.waitForTimeout(800);
    await snap(page, "gambar_4.13_admin.png", "Pengaturan Shift Kasir (manajemen sesi & saldo kas awal/akhir)");
    record("gambar_4.13_admin.png", "Pengaturan", "Tab Shift Kasir", "Pembukaan dan penutupan sesi shift kasir beserta rekonsiliasi saldo kas tunai laci.");

    // ════════════════════════════════════════════════════════════════════════
    // 12. KARYAWAN (/pengaturan/karyawan)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[12/15] Halaman Karyawan (/pengaturan/karyawan)…");
    await safeGoto(page, `${BASE_URL}/pengaturan/karyawan`);
    await waitReady(page);
    await snap(page, "41_pengaturan_karyawan_list.png", "Daftar Karyawan di workspace & formulir Invite User baru");
    record("41_pengaturan_karyawan_list.png", "Manajemen Karyawan", "Daftar & Invite", "Kelola hak akses (RBAC) pimpinan, kasir, bendahara, serta pengundangan anggota baru.");

    // ════════════════════════════════════════════════════════════════════════
    // 13. AUDIT LOG (/pengaturan/audit-log)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[13/15] Halaman Audit Log (/pengaturan/audit-log)…");
    await safeGoto(page, `${BASE_URL}/pengaturan/audit-log`);
    await waitReady(page);
    await snap(page, "42_pengaturan_audit_log_table.png", "Tabel Audit Log (riwayat aktivitas keamanan & transaksi sistem)");
    record("42_pengaturan_audit_log_table.png", "Audit Log", "Tabel Riwayat Log", "Catatan kronologis setiap aktivitas login, perubahan data, restok, dan transaksi kasir.");

    // Klik salah satu baris audit log untuk melihat modal detail JSON
    const logBtn = page.locator('button:has-text("Detail"), table tbody tr button').first();
    if (await logBtn.isVisible()) {
      await logBtn.click();
      await page.waitForTimeout(800);
      await snap(page, "43_pengaturan_audit_log_detail_modal.png", "Modal detail spesifik & metadata payload Audit Log");
      record("43_pengaturan_audit_log_detail_modal.png", "Audit Log", "Modal Detail Log", "Rincian lengkap metadata, IP address, timestamp, dan payload aktivitas sistem.");
      await closeDialog(page);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 14. ASISTEN AI SIDEBAR (AIAssistantPanel) - TERBUKA & CHATTING
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n[14/15] Asisten AI Sidebar & Interaksi Chatting…");
    await safeGoto(page, `${BASE_URL}/dashboard`);
    await waitReady(page);

    // Buka sidebar AI dengan mengklik tombol trigger AI
    const btnAi = page.locator('button:has-text("Asisten AI"), button[title*="Asisten"], button[aria-label*="Asisten"]').first();
    if (await btnAi.isVisible()) {
      await btnAi.click();
      await page.waitForTimeout(1000);
      await snap(page, "44_ai_assistant_sidebar_open.png", "Sidebar Asisten AI terbuka lebar di sisi kanan layar");
      record("44_ai_assistant_sidebar_open.png", "Asisten AI", "Panel Terbuka", "Panel percakapan cerdas dengan prompt rekomendasi cepat untuk analisis bisnis.");

      // Klik salah satu quick prompt atau ketik prompt
      const quickBtn = page.locator('button:has-text("Analisis omzet"), button:has-text("Produk menipis"), button:has-text("stok")').first();
      if (await quickBtn.isVisible()) {
        await quickBtn.click();
      } else {
        const inputAi = page.locator('textarea[placeholder*="tanya"], input[placeholder*="tanya"], textarea').first();
        if (await inputAi.isVisible()) {
          await inputAi.fill("Berikan analisis singkat performa penjualan hari ini dan produk yang perlu segera direstok.");
          await page.keyboard.press("Enter");
        }
      }
      // Tunggu respons AI selesai render
      await page.waitForTimeout(2500);
      await snap(page, "45_ai_assistant_sidebar_chatting.png", "Asisten AI memberikan respons analisis data & rekomendasi");
      record("45_ai_assistant_sidebar_chatting.png", "Asisten AI", "Respons Analisis", "Kecerdasan buatan menyajikan insight bisnis, kartu data interaktif, dan saran tindakan.");
    }

    console.log("\n[15/15] Selesai mengambil semua screenshot menyeluruh!");

  } catch (err) {
    console.error("\n❌ Error selama pengambilan screenshot:", err);
  } finally {
    // ─── Tulis DAFTAR.txt & screenshot_report.md ──────────────────────────
    const txtContent = daftar
      .map(
        (d, i) =>
          `${String(i + 1).padStart(2, "0")}. [${d.filename}] | Modul: ${d.modul} (${d.bagian})\n    Keterangan: ${d.description}`
      )
      .join("\n\n");

    const daftarPath = path.join(SCREENSHOTS_DIR, "DAFTAR.txt");
    fs.writeFileSync(daftarPath, `DAFTAR SCREENSHOT DOKUMENTASI TOKOMU (MENYELURUH)\n=======================================================\nTotal: ${daftar.length} File PNG Full-Page High-Res (1440x900 @2x Retina)\n\n${txtContent}\n`, "utf8");
    console.log(`\n  📝 Berhasil memperbarui index di: ${daftarPath}`);

    const mdRows = daftar
      .map(
        (d, i) =>
          `| ${i + 1} | \`${d.filename}\` | **${d.modul}** <br> *${d.bagian}* | ${d.description} |`
      )
      .join("\n");

    const mdContent = `# Laporan & Daftar Lengkap Screenshot TokoMu

Dokumentasi ini berisi daftar menyeluruh setiap halaman, tab, modal, filter, hingga interaksi Asisten AI pada aplikasi **TokoMu (WarungOS)**. Seluruh screenshot diambil menggunakan automated testing Playwright pada resolusi **1440x900 (deviceScaleFactor: 2 - Retina Display)** dengan mode **full-page**.

---

## Tabel Daftar Screenshot Menyeluruh (${daftar.length} Gambar)

| No | File PNG | Modul & Bagian | Deskripsi Lengkap |
| :---: | :--- | :--- | :--- |
${mdRows}

---

## Panduan Pemanfaatan Laporan
- Semua gambar tersimpan di direktori: \`d:\\project\\Kasir TokoMu\\warungos\\screenshots\\\`
- Dapat langsung dilampirkan ke laporan akhir proyek, buku panduan pengguna (User Manual), atau lampiran presentasi teknis.
`;

    const reportPath = path.join(ROOT, "screenshot_report.md");
    fs.writeFileSync(reportPath, mdContent, "utf8");
    console.log(`  📝 Berhasil memperbarui laporan markdown di: ${reportPath}`);

    await context.close();
    await browser.close();
  }
}

main();
