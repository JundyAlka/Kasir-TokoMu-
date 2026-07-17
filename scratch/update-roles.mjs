import fs from 'fs/promises';
import path from 'path';

async function walk(dir, fileList = []) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const stat = await fs.stat(path.join(dir, file));
    if (stat.isDirectory()) {
      await walk(path.join(dir, file), fileList);
    } else {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

async function run() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = await walk(srcDir);
  const targetFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

  for (const file of targetFiles) {
    // Skip strictly pimpinan folders
    if (file.includes('laporan-pcm') || file.includes('karyawan') || file.includes('audit-log') || file.includes('api\\users')) {
      continue;
    }

    const originalContent = await fs.readFile(file, 'utf8');
    let content = originalContent;

    // For shifts API: GET is everyone, others are pimpinan only
    if (file.includes('api\\shifts')) {
      if (file.endsWith('route.ts')) { // This is api/shifts/route.ts or api/shifts/[id]/route.ts
         content = content.replace(
           /export async function GET[\s\S]*?requireRole\(\["pimpinan", "pengelola_keuangan"\]\)/g,
           match => match.replace('["pimpinan", "pengelola_keuangan"]', '["pimpinan", "pengelola_keuangan", "kasir"]')
         );
         // For POST, PATCH, DELETE in shifts, it should be ONLY pimpinan!
         content = content.replace(
           /requireRole\(\["pimpinan", "pengelola_keuangan"\]\)/g,
           '["pimpinan"]'
         );
      }
    } else if (file.includes('api\\settings')) {
      // GET settings is everyone, PATCH settings is pimpinan
      content = content.replace(
        /export async function GET[\s\S]*?requireRole\(\["pimpinan", "pengelola_keuangan"\]\)/g,
        match => match.replace('["pimpinan", "pengelola_keuangan"]', '["pimpinan", "pengelola_keuangan", "kasir"]')
      );
      content = content.replace(
        /requireRole\(\["pimpinan", "pengelola_keuangan"\]\)/g,
        '["pimpinan"]'
      );
    } else {
      // For all other files (dashboard pages, investors API, payouts API, reports API, products API)
      // replace ["pimpinan", "pengelola_keuangan"] with ["pimpinan", "pengelola_keuangan", "kasir"]
      content = content.replace(/requireRole\(\["pimpinan", "pengelola_keuangan"\]\)/g, '["pimpinan", "pengelola_keuangan", "kasir"]');
      content = content.replace(/requireRole\(\["pengelola_keuangan", "pimpinan"\]\)/g, '["pimpinan", "pengelola_keuangan", "kasir"]');
    }

    if (content !== originalContent) {
      await fs.writeFile(file, content, 'utf8');
      console.log(`Updated: ${file}`);
    }
  }
}

run().catch(console.error);
