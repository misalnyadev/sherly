// Render Motion Graphics client-side di Chromium lalu simpan MP4-nya.
// Dipakai untuk verifikasi manual hasil render (D-251).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8244;
const OUT = path.join(ROOT, '.tmp-render');
fs.mkdirSync(OUT, { recursive: true });

const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');

const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'public'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  env,
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 800 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

const cases = [
  { template: 'branded-intro', aspect: '9:16', props: { title: 'SherlyStudio', subtitle: 'Motion Graphics', tagline: 'Ruang kreasi kamu' } },
  { template: 'captioned-clip', aspect: '16:9', props: { captionsText: 'Halo dunia\nBaris kedua\n第三条' } },
  { template: 'stat-card', aspect: '1:1', props: { value: '2.4JT', label: 'Total Pendant', note: 'Naik 18% bulan ini' } },
];

for (const c of cases) {
  const b64 = await page.evaluate(async (cfg) => {
    const mod = await import('/motion-graphics.js');
    const out = await mod.renderMotionGraphicsOnClient({ template: cfg.template, aspect: cfg.aspect, duration: 3, props: cfg.props }, { onProgress: () => {} });
    const buf = new Uint8Array(await out.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s);
  }, c);
  const file = path.join(OUT, `${c.template}-${c.aspect.replace(':', 'x')}.mp4`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('saved', file, fs.statSync(file).size, 'bytes');
}

await browser.close();
server.kill('SIGTERM');
