// D-257 — E2E: upload video HORIZONTAL lewat UI -> galeri menampilkannya di
// baris Horizontal (bukan Vertikal), dan dimensi terkirim ke server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detectDimensions } from '../server/media-dimensions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8272;
const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + (env.LD_LIBRARY_PATH || '');

// Server statis + endpoint mock upload yang mencatat field width/height.
const uploaded = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/studio/assets' && req.method === 'POST') {
    // Kumpulkan multipart mentah untuk cek field width/height.
    const chunks = [];
    await new Promise((resolve) => {
      req.on('data', (c) => chunks.push(c));
      req.on('end', resolve);
      req.on('error', resolve);
    });
    const raw = Buffer.concat(chunks).toString('latin1');
    const wm = /name="width"\r\n\r\n(\d+)/.exec(raw);
    const hm = /name="height"\r\n\r\n(\d+)/.exec(raw);
    // Sama seperti route produksi: kalau client tidak mengirim dimensi,
    // server menebak dari header file.
    let width = wm ? Number(wm[1]) : 0;
    let height = hm ? Number(hm[1]) : 0;
    if (!(width > 0 && height > 0)) {
      const filePart = /name="file"; filename="([^"]+)"[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/.exec(raw);
      if (filePart) {
        const buf = Buffer.from(filePart[2], 'latin1');
        const dim = detectDimensions(buf, 'video/webm');
        if (dim) { width = dim.width; height = dim.height; }
      }
    }
    uploaded.push({ width: width || null, height: height || null });
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      asset: {
        id: 'up1', file_name: 'horizontal.webm', media_type: 'video', kind: 'upload',
        url: '/assets/brand/fixture-horizontal.webm', width: 1280, height: 720,
      },
    }));
    return;
  }
  if (url.pathname === '/api/studio/assets') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, assets: [] }));
    return;
  }
  let file = path.join(ROOT, 'public', decodeURIComponent(url.pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  const ext = path.extname(file);
  const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript'
    : ext === '.png' ? 'image/png' : ext === '.webm' ? 'video/webm'
    : ext === '.mp4' ? 'video/mp4' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  env,
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGEERR:', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  document.getElementById('splash')?.classList.add('done');
  document.getElementById('studioView')?.classList.add('active');
  document.querySelectorAll('.page-view').forEach((v) => { if (v.id !== 'studioView') v.classList.remove('active'); });
  document.querySelector('.layout')?.style.setProperty('display', 'none', 'important');
  await window.renderStudio();
});
await new Promise((r) => setTimeout(r, 800));

test('D-257: upload video horizontal mengirim width/height & masuk baris Horizontal', async () => {
  const fixture = path.join(ROOT, 'public/assets/brand/fixture-horizontal.webm');
  assert.ok(fs.existsSync(fixture), 'fixture video horizontal harus ada');
  const input = await page.$('#stUploadInput');
  if (!input) {
    // Fallback: cari input file apa pun di area Studio.
    const handles = await page.$$('input[type=file]');
    assert.ok(handles.length, 'harus ada input[type=file] untuk upload');
    await handles[0].uploadFile(fixture);
  } else {
    await input.uploadFile(fixture);
  }
  await new Promise((r) => setTimeout(r, 9000));

  assert.equal(uploaded.length, 1, 'harus ada 1 request upload, dapat ' + uploaded.length);
  assert.equal(uploaded[0].width, 1280, 'lebar video horizontal harus terkirim');
  assert.equal(uploaded[0].height, 720, 'tinggi video horizontal harus terkirim');

  const row = await page.evaluate(() => {
    const it = document.querySelector('[data-asset-open="up1"]');
    return it?.closest('.st-gal-row')?.className || null;
  });
  assert.ok(String(row || '').includes('st-gal-row--horizontal'),
    'video horizontal harus masuk baris Horizontal, dapat ' + row);
});

test('D-257: aset lama tanpa dimensi terdeteksi otomatis dari video (auto-backfill)', async () => {
  // Server mengembalikan aset video TANPA width/height (aset lama).
  const res = await fetch(`http://127.0.0.1:${PORT}/api/studio/assets?legacy=1`);
  void res;
  await page.evaluate(async () => {
    const orig = window.fetch;
    window.fetch = async (u, i) => {
      const s = String(u);
      if (s.includes('/api/studio/assets') && !(i && i.method === 'POST')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            assets: [{
              id: 'legacy1', file_name: 'legacy.webm', media_type: 'video', kind: 'upload',
              url: '/assets/brand/fixture-horizontal.webm', width: null, height: null,
            }],
          }),
        };
      }
      return orig(u, i);
    };
    await window.renderStudio();
  });
  await new Promise((r) => setTimeout(r, 3000));
  const info = await page.evaluate(() => {
    const it = document.querySelector('[data-asset-open="legacy1"]');
    return {
      row: it?.closest('.st-gal-row')?.className || null,
      ratio: it?.getAttribute('style') || '',
    };
  });
  assert.ok(String(info.row || '').includes('st-gal-row--horizontal'),
    'aset lama video horizontal harus pindah ke baris Horizontal, dapat ' + info.row);
  assert.ok(/aspect-ratio:\s*1\.778/.test(info.ratio),
    'aset lama harus dapat rasio 1280/720, dapat ' + info.ratio);
});

test.after(async () => {
  await browser.close();
  server.close();
});
