import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Clear old screenshots
fs.readdirSync(outDir).forEach(f => {
  if (f.endsWith('.png') || f.endsWith('.txt')) fs.unlinkSync(path.join(outDir, f));
});

const daftarFile = path.join(outDir, 'DAFTAR.txt');
const daftar: string[] = [];
daftar.push("NAMA FILE | ROUTE | PERAN LOGIN | DESKRIPSI SINGKAT");
daftar.push("---------------------------------------------------------");

function addToList(filename: string, route: string, role: string, description: string) {
  daftar.push(`${filename} | ${route} | ${role} | ${description}`);
}

async function hideSensitiveData(page: Page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue) {
        node.nodeValue = node.nodeValue.replace(/08\d{8,11}/g, '081234567890');
        // Mask specific names if known, or let it be
      }
    }
  });
}

async function checkForErrors(page: Page, context: string) {
  await page.waitForTimeout(1000);
  const errorToast = await page.locator('.text-red-500, [data-variant="destructive"], .toast-error, [role="alert"]').first();
  if (await errorToast.isVisible()) {
    const errorText = await errorToast.innerText();
    console.error(`[ERROR DETECTED in ${context}]: ${errorText}`);
    // Still capture but notify
  }
}

async function capture(page: Page, url: string, filename: string, role: string, options: any = {}) {
  console.log(`Navigating to ${url} for ${filename}...`);
  await page.goto(`http://localhost:3000${url}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log('goto error (ignoring)', e));
  
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  if (options.action) {
    console.log(`  Executing action for ${filename}...`);
    try {
      await options.action(page);
    } catch (e) {
      console.log(`  Action failed or elements not found: ${(e as Error).message}`);
    }
    // Wait for network idle again if action triggered fetches
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000); // Give extra time for animations/popups
  } else {
    await page.waitForTimeout(1500);
  }

  await checkForErrors(page, filename);
  await hideSensitiveData(page);

  console.log(`  Capturing screenshot ${filename}...`);
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
  addToList(filename, url, role, options.desc);
}

async function login(page: Page) {
  console.log('Logging in with 123@gmail.com / 12345678...');
  await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', '123@gmail.com');
  await page.locator('input[type="password"], input[name="password"]').first().fill('12345678');
  await page.click('button[type="submit"]');
  console.log('Waiting for login to complete...');
  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(async () => {
    console.log('Timeout waiting for dashboard URL. Let us check if login succeeded.');
  });
  await page.waitForTimeout(3000);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();

  // 1. Login Page
  console.log('Capturing Login Screen...');
  await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await hideSensitiveData(page);
  await page.screenshot({ path: path.join(outDir, 'gambar_4.5_login.png'), fullPage: true });
  addToList('gambar_4.5_login.png', '/auth', 'Guest', 'Halaman Login / Autentikasi');

  // Perform Login
  await login(page);

  // 2. Dashboard
  await capture(page, '/dashboard', 'gambar_4.6_dashboard.png', 'Pimpinan', { desc: 'Dashboard ringkasan' });

  // 3. Kasir POS Transaction
  await capture(page, '/kasir', 'gambar_4.7_kasir_pos.png', 'Kasir', {
    desc: 'Modul Kasir (POS) kondisi ada transaksi',
    action: async (p: Page) => {
      // Buka shift jika perlu
      const openShiftBtn = await p.locator('button:has-text("Buka Shift")').first();
      if (await openShiftBtn.isVisible()) {
         await openShiftBtn.click();
         await p.waitForTimeout(1000);
         const submitShift = await p.locator('button[type="submit"], button:has-text("Simpan")').first();
         if (await submitShift.isVisible()) await submitShift.click();
         await p.waitForTimeout(2000);
      }
      
      const productCard = await p.locator('.cursor-pointer, button:has-text("Tambah")').first();
      if (await productCard.isVisible()) {
        await productCard.click();
        await p.waitForTimeout(1000);
        await productCard.click(); // Click twice to add 2 qty
      }
      const cashInput = await p.locator('input[placeholder*="Bayar"], input[name="cash"]').first();
      if (await cashInput.isVisible()) await cashInput.fill('100000');
    }
  });

  // 4. Inventaris
  await capture(page, '/inventaris', 'gambar_4.8_inventaris.png', 'Pengelola Keuangan', { desc: 'Manajemen produk & stok' });

  // 5. Investor
  await capture(page, '/investor', 'gambar_4.9_investor.png', 'Pengelola Keuangan', { desc: 'Investor & bagi hasil' });

  // 6. Buku Hutang
  await capture(page, '/buku-hutang', 'gambar_4.10_hutang.png', 'Pengelola Keuangan', { desc: 'Buku hutang' });

  // 7. Laporan PDF
  await capture(page, '/laporan', 'gambar_4.11_laporan_pdf.png', 'Pengelola Keuangan', {
    desc: 'Laporan bulanan (preview PDF)',
    action: async (p: Page) => {
      // Filter by Month to ensure data
      const cetakBtn = await p.locator('button:has-text("Cetak PDF"), button:has-text("Generate PDF"), button:has-text("Preview")').first();
      if (await cetakBtn.isVisible()) {
        await cetakBtn.click();
        await p.waitForTimeout(5000); // Wait for PDF generation
      }
    }
  });

  // 8. AI Chat (OCR / Restok)
  await capture(page, '/inventaris/restok-ai', 'gambar_4.12_ai.png', 'Pengelola Keuangan', {
    desc: 'AI chat restok + OCR struk',
    action: async (p: Page) => {
       await p.waitForTimeout(2000);
    }
  });

  // AI Sidebar (Obrolan & Menu Kiri)
  await capture(page, '/dashboard', 'gambar_extra_ai_sidebar.png', 'Pimpinan', {
    desc: 'Sidebar AI Chat beserta Obrolan & Menu Kiri',
    action: async (p: Page) => {
      const aiToggle = await p.locator('button[aria-label="Buka asisten AI"]').first();
      if (await aiToggle.isVisible()) {
         await aiToggle.click();
         await p.waitForTimeout(2000);
         
         const chatInput = await p.locator('textarea').first();
         if (await chatInput.isVisible()) {
            await chatInput.fill('Sisa stok semua produk?');
            const sendBtn = await p.locator('button[aria-label="Kirim pesan"]').first();
            if (await sendBtn.isVisible()) {
               await sendBtn.click();
               // Tunggu pesan muncul
               await p.waitForTimeout(7000);
            }
         }
      }
    }
  });

  // 9. Manajemen Pengguna
  await capture(page, '/pengaturan/karyawan', 'gambar_4.13_pengguna.png', 'Pimpinan', { desc: 'Manajemen pengguna & undangan' });

  // 10. Shift Kasir
  await capture(page, '/kasir', 'gambar_4.14_shift.png', 'Pimpinan', {
    desc: 'Manajemen shift & sesi kasir',
    action: async (p: Page) => {
      const shiftBtn = await p.locator('button:has-text("Shift"), button:has-text("Tutup Shift"), button:has-text("Buka Shift")').first();
      if (await shiftBtn.isVisible()) await shiftBtn.click();
    }
  });

  // 11. Pengeluaran
  await capture(page, '/buku-hutang', 'gambar_4.15_pengeluaran.png', 'Pengelola Keuangan', {
    desc: 'Pengeluaran operasional',
    action: async (p: Page) => {
      const expTab = await p.locator('button:has-text("Pengeluaran"), [role="tab"]:has-text("Pengeluaran")').first();
      if (await expTab.isVisible()) await expTab.click();
    }
  });

  // 12. Pengaturan
  await capture(page, '/pengaturan', 'gambar_4.16_pengaturan.png', 'Pimpinan', { desc: 'Pengaturan toko & konfigurasi bagi hasil' });


  // --- EXTRA PAGES & POPUPS ---
  await capture(page, '/inventaris', 'gambar_extra_inventaris_tambah.png', 'Pengelola Keuangan', {
    desc: 'Inventaris - Form tambah produk',
    action: async (p: Page) => {
      const addBtn = await p.locator('button:has-text("Tambah"), button:has-text("Produk Baru")').first();
      if (await addBtn.isVisible()) await addBtn.click();
      await p.waitForTimeout(2000); // Wait for popup to render
    }
  });

  await capture(page, '/buku-hutang', 'gambar_extra_hutang_detail.png', 'Pengelola Keuangan', {
    desc: 'Buku Hutang - Detail/Bayar',
    action: async (p: Page) => {
      const detailBtn = await p.locator('button:has-text("Detail"), button:has-text("Bayar"), tr').nth(1);
      if (await detailBtn.isVisible()) await detailBtn.click();
      await p.waitForTimeout(2000); // Wait for details to load
    }
  });

  await capture(page, '/dashboard', 'gambar_extra_dashboard_metric.png', 'Pimpinan', {
    desc: 'Dashboard - Detail Metrik (Pop-up)',
    action: async (p: Page) => {
      // Klik salah satu kartu metrik (misal Pemasukan)
      const metricCard = await p.locator('.cursor-pointer, .hover\\:bg-muted\\/50').first();
      if (await metricCard.isVisible()) {
         await metricCard.click();
         await p.waitForTimeout(2500); // Wait for dialog data
      }
    }
  });

  await capture(page, '/dashboard', 'gambar_extra_transaction_detail.png', 'Pimpinan', {
    desc: 'Detail Transaksi (Pop-up)',
    action: async (p: Page) => {
      // Klik salah satu row transaksi di tabel recent transactions
      const trRow = await p.locator('tr.cursor-pointer, table tbody tr').first();
      if (await trRow.isVisible()) {
         await trRow.click();
         await p.waitForTimeout(2500); // Wait for dialog data
      }
    }
  });

  await capture(page, '/investor', 'gambar_extra_investor_action.png', 'Pengelola Keuangan', {
    desc: 'Investor - Aksi (Tarik Dana / Edit)',
    action: async (p: Page) => {
      const actionBtn = await p.locator('button:has-text("Tarik Dana"), button:has-text("Aksi")').first();
      if (await actionBtn.isVisible()) {
         await actionBtn.click();
         await p.waitForTimeout(2000); // Wait for dialog
      }
    }
  });

  await capture(page, '/buku-hutang', 'gambar_extra_pengeluaran_detail.png', 'Pengelola Keuangan', {
    desc: 'Pengeluaran - Detail (Pop-up)',
    action: async (p: Page) => {
      const expTab = await p.locator('button:has-text("Pengeluaran"), [role="tab"]:has-text("Pengeluaran")').first();
      if (await expTab.isVisible()) {
         await expTab.click();
         await p.waitForTimeout(1000);
         const trRow = await p.locator('table tbody tr').first();
         if (await trRow.isVisible()) {
            await trRow.click();
            await p.waitForTimeout(2500);
         }
      }
    }
  });

  await capture(page, '/pengaturan/karyawan', 'gambar_extra_pengguna_nonaktif.png', 'Pimpinan', {
    desc: 'Pengguna - Konfirmasi Nonaktifkan',
    action: async (p: Page) => {
      const nonaktifBtn = await p.locator('button:has-text("Nonaktifkan")').first();
      if (await nonaktifBtn.isVisible()) {
         await nonaktifBtn.click();
         await p.waitForTimeout(1500); // Wait for dialog
      }
    }
  });

  await capture(page, '/kasir', 'gambar_extra_kasir_cetak_struk.png', 'Kasir', {
    desc: 'Kasir - Pop-up Cetak Struk / Transaksi Sukses',
    action: async (p: Page) => {
      // Buka modal riwayat transaksi / history, lalu klik salah satu transaksi untuk cetak struk
      const historyBtn = await p.locator('button[aria-label*="riwayat"], button[title*="Riwayat"]').first();
      if (await historyBtn.isVisible()) {
         await historyBtn.click();
         await p.waitForTimeout(1500);
         const firstItem = await p.locator('tr.cursor-pointer, .hover\\:bg-muted').first();
         if (await firstItem.isVisible()) {
            await firstItem.click();
            await p.waitForTimeout(2000);
         }
      }
    }
  });

  await capture(page, '/bagi-hasil', 'gambar_extra_bagi_hasil.png', 'Pimpinan', { desc: 'Bagi Hasil' });
  await capture(page, '/laporan-pcm', 'gambar_extra_laporan_pcm.png', 'Pimpinan', { desc: 'Laporan PCM' });
  await capture(page, '/pengaturan/audit-log', 'gambar_extra_audit_log.png', 'Pimpinan', { desc: 'Audit Log' });
  
  await capture(page, '/admin/login', 'gambar_extra_admin_login.png', 'Admin', { desc: 'Admin Login' });
  await capture(page, '/admin', 'gambar_extra_admin_dashboard.png', 'Admin', { desc: 'Admin Dashboard' });
  await capture(page, '/', 'gambar_extra_landing_page.png', 'Guest', { desc: 'Landing Page' });

  fs.writeFileSync(daftarFile, daftar.join('\n'));
  console.log('All screenshots captured successfully!');
  await browser.close();
}

main().catch(console.error);
