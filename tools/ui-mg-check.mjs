// Simulasi alur UI Motion Graphics di Chromium (D-251).
// Meniru: pilih jenis konten Motion Graphics -> isi kolom -> klik Render ->
// cek progres -> cek hasil terunggah ke route aset.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = '/home/user/sherly';
const PORT = 8250;
const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + env.LD_LIBRARY_PATH;

const uploads = [];
const MG_TEMPLATES = [
  { id: 'branded-intro', label: 'Intro BerBrand', hint: 'Judul + subjudul + logo.', icon: 'sparkles',
    defaultDuration: 6, durations: [5, 6, 8], aspects: ['9:16', '16:9', '1:1'],
    fields: [{ key: 'title', label: 'Judul', placeholder: 'Judul', required: true },
      { key: 'subtitle', label: 'Subjudul', placeholder: 'Subjudul' }] },
];

const server = http.createServer((req, res) => {
  const u = req.url;
  if (u === '/api/studio/motion-graphics/asset' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      uploads.push(body.length);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, asset: { id: 'asset-x', file_name: 'mg.mp4', media_type: 'video', kind: 'generate' } }));
    });
    return;
  }
  if (u.includes('/api/studio/motion-graphics/templates')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, available: false, status: 'serverless', reason: 'Render di server tidak tersedia di hosting serverless — render berjalan di browser.', templates: MG_TEMPLATES }));
    return;
  }
  if (u.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, assets: [], models: [], providers: [], characters: [], entries: [], blocks: [] }));
    return;
  }
  let file = path.join(ROOT, 'public', decodeURIComponent(new URL(u, 'http://x').pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('nf'); return; }
  const body = fs.readFileSync(file);
  const ext = path.extname(file);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.gif': 'image/gif', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': body.length });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '0.0.0.0', r));

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  env,
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 900, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 600));
// Studio di-render eksplisit (di app asli dipanggil go('Studio')).
await page.evaluate(async () => { await window.renderStudio(); });
await new Promise((r) => setTimeout(r, 1200));

// 1. Pilih jenis konten Motion Graphics lewat panel Pengaturan.
const click = async (sel) => {
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, sel);
  if (!ok) throw new Error('tidak ketemu ' + sel);
  await new Promise((r) => setTimeout(r, 250));
};
await click('#stTypePill');
const picked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#stPop-settings [data-set-key="type"]')].find((x) => x.dataset.setV === 'motion');
  if (!b) return false;
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
});
console.log('pilih motion:', picked);
await new Promise((r) => setTimeout(r, 250));
await click('#stSetSave');
await new Promise((r) => setTimeout(r, 400));

// 2. Cek bar Motion Graphics tampil + ada kolom.
const barInfo = await page.evaluate(() => {
  const bar = document.getElementById('stMotionBar');
  return {
    hidden: bar?.classList.contains('st-hidden'),
    hasTitle: !!document.getElementById('stMotionField-title'),
    note: (bar?.innerHTML || '').includes('st-motion-note'),
    btnHidden: document.getElementById('stMotionBtn')?.classList.contains('st-hidden'),
    text: (bar?.innerText || '').slice(0, 200),
  };
});
console.log('bar:', JSON.stringify(barInfo, null, 2));

// 3. Isi kolom Judul.
await page.evaluate(() => {
  const i = document.getElementById('stMotionField-title');
  i.value = 'Uji Alur UI';
  i.dispatchEvent(new Event('input', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 150));

// 4. Klik Render & tunggu selesai.
await click('#stMotionBtn');
let lastProgress = '';
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const st = await page.evaluate(() => {
    const el = document.querySelector('#stMotionBar .st-motion-status, #stMotionBar [data-progress]');
    const toast = document.getElementById('toast')?.textContent || '';
    return { bar: (document.getElementById('stMotionBar')?.innerText || '').slice(0, 160), toast: toast.slice(0, 160) };
  });
  if (st.bar !== lastProgress) { lastProgress = st.bar; }
  if (uploads.length) { console.log('UPLOAD OK setelah ~' + ((i + 1) * 0.5) + 's, bytes=' + uploads[0]); break; }
}
console.log('uploads:', uploads.length);
const finalState = await page.evaluate(() => ({
  toast: document.getElementById('toast')?.textContent?.slice(0, 200) || '',
  gallery: document.querySelectorAll('#studioRoot [data-asset-id], #studioRoot .st-asset').length,
}));
console.log('final:', JSON.stringify(finalState, null, 2));
console.log('errors:', errors.slice(0, 8));

await page.screenshot({ path: '/tmp/ui-mg.png' });
await browser.close();
server.close();
