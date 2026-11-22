// D-252: cek ukuran file hasil render client-side untuk semua kombinasi
// template/aspect/durasi — semuanya harus muat di bawah batas upload.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = '/home/user/sherly';
const PORT = 8251;
const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + env.LD_LIBRARY_PATH;

const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'public'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  env,
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

const cases = [];
for (const aspect of ['9:16', '16:9', '1:1']) {
  for (const duration of [4, 5, 6, 8, 10]) {
    cases.push({ template: 'branded-intro', aspect, duration });
  }
}
cases.push({ template: 'stat-card', aspect: '9:16', duration: 6 });
cases.push({ template: 'captioned-clip', aspect: '16:9', duration: 10 });

const rows = [];
for (const c of cases) {
  const out = await page.evaluate(async (cfg) => {
    const mod = await import('/motion-graphics.js');
    const r = await mod.renderMotionGraphicsOnClient({
      template: cfg.template, aspect: cfg.aspect, duration: cfg.duration,
      props: { title: 'Uji Ukuran', subtitle: 'Sub', value: '1.2JT', label: 'Label', note: 'note', captionsText: 'satu\ndua' },
    }, { onProgress: () => {} });
    return { size: r.blob.size, bytes: r.bytes, w: r.width, h: r.height };
  }, c);
  const mb = out.size / 1024 / 1024;
  const ok = out.size <= 4 * 1024 * 1024;
  rows.push({ ...c, ...out, mb, ok });
  console.log(
    `${c.template.padEnd(14)} ${c.aspect.padEnd(5)} ${String(c.duration).padStart(2)}d  ` +
    `${String(out.w).padStart(4)}x${String(out.h).padEnd(4)}  ` +
    `${mb.toFixed(2).padStart(6)} MB  ${ok ? 'OK' : '<<< LEBIH DARI 4MB'}`
  );
}
await browser.close();
server.kill('SIGTERM');

const bad = rows.filter((r) => !r.ok);
console.log('\nTotal:', rows.length, '| gagal batas:', bad.length);
if (bad.length) process.exit(1);
