// D-251: uji end-to-end alur Motion Graphics di browser sungguhan.
//
// Menjalankan Chromium headless + server statis, memuat halaman Studio,
// lalu memanggil modul client-side untuk merender komposisi, mengunggah
// hasilnya sebagai multipart ke route aset, dan memverifikasi file MP4
// yang diterima server valid.
//
// Di-skip otomatis kalau Chromium tidak tersedia di lingkungan test.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8232;

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/tmp/chromedeps/chromium',
    path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/chromium'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch { /* ignore */ }
  }
  return null;
}

function chromiumEnv() {
  const libDir = '/tmp/chromedeps/root/lib';
  const env = { ...process.env };
  if (fs.existsSync(libDir)) {
    env.LD_LIBRARY_PATH = libDir + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
  }
  return env;
}

/**
 * Server statis + endpoint tiru /api/studio/motion-graphics/asset yang
 * menerima multipart dan menyimpan file ke disk supaya bisa diperiksa.
 */
function startServer() {
  const uploads = [];
  const server = http.createServer((req, res) => {
    if (req.url === '/api/studio/motion-graphics/asset' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        // Multipart: ambil bagian file (nama field "file") & isinya.
        const raw = body.toString('latin1');
        const fileIdx = raw.indexOf('name="file"');
        if (fileIdx < 0) { res.writeHead(400).end('{}'); return; }
        // Header bagian file berakhir di baris kosong ganda sebelum isi.
        const partStart = raw.indexOf('\r\n\r\n', fileIdx) + 4;
        const partEnd = raw.indexOf('\r\n--', partStart);
        const partHead = raw.slice(fileIdx, partStart);
        const file = body.subarray(partStart, partEnd);
        uploads.push({
          size: file.length,
          contentType: (partHead.match(/Content-Type:\s*([^\r\n]+)/) || [])[1] || '',
          filename: (partHead.match(/filename="([^"]+)"/) || [])[1] || '',
          meta: (raw.match(/name="meta"\r\n\r\n([^\r\n]*)/) || [])[1] || '',
          head: file.subarray(0, 12),
        });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, asset: { id: 'a1', file_name: 'mg.mp4', media_type: 'video' } }));
      });
      return;
    }
    // Static.
    let file = path.join(ROOT, 'public', decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('nf'); return; }
    const body = fs.readFileSync(file);
    const ext = path.extname(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': body.length });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(PORT, '0.0.0.0', () => resolve({ server, uploads }));
  });
}

describe('D-251 alur Motion Graphics end-to-end di browser', () => {
  let browser;
  let server;
  let uploads;
  let puppeteer;

  const needsChromium = () => !!findChromium();

  before(async () => {
    const chromium = findChromium();
    if (!chromium) return;
    puppeteer = (await import('puppeteer-core')).default;
    ({ server, uploads } = await startServer());
    browser = await puppeteer.launch({
      executablePath: chromium,
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
      env: chromiumEnv(),
    });
  });

  after(async () => {
    try { await browser?.close(); } catch { /* ignore */ }
    try { server?.close(); } catch { /* ignore */ }
  });

  test('render -> upload multipart MP4 ke route aset', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

    const out = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      const result = await mod.renderMotionGraphicsOnClient({
        template: 'stat-card',
        aspect: '1:1',
        duration: 2,
        props: { value: '9.9JT', label: 'Uji E2E', note: 'catatan' },
      }, { onProgress: () => {} });

      const fd = new FormData();
      fd.append('file', result.blob, 'motion-graphics-stat-card.mp4');
      fd.append('prompt', 'Uji E2E');
      fd.append('meta', JSON.stringify({ kind: 'motion-graphics', template: 'stat-card', renderer: 'client' }));
      fd.append('width', String(result.width));
      fd.append('height', String(result.height));
      fd.append('durationMs', String(result.durationMs));
      const up = await fetch('/api/studio/motion-graphics/asset', { method: 'POST', body: fd });
      return { ok: up.ok, status: up.status, json: await up.json(), size: result.blob.size, width: result.width, height: result.height };
    });

    assert.equal(out.ok, true, 'upload harus sukses, dapat ' + JSON.stringify(out.json));
    assert.equal(out.status, 201);
    assert.equal(out.json.asset.id, 'a1');
    assert.equal(uploads.length, 1, 'server harus menerima 1 file');
    const up0 = uploads[0];
    assert.ok(up0.size > 1000, 'file MP4 harus punya isi, dapat ' + up0.size);
    assert.match(up0.contentType, /video\/mp4/, 'content-type harus video/mp4');
    assert.match(up0.filename, /\.mp4$/);
    assert.match(up0.meta, /motion-graphics/, 'meta harus menandai motion graphics');
    // MP4 signature: 'ftyp' di byte 4-8.
    assert.equal(String.fromCharCode(...up0.head.subarray(4, 8)), 'ftyp');
    assert.deepEqual(errors, [], 'halaman tidak boleh error: ' + errors.join(' | '));
    await page.close();
  });

  test('D-253: request upload memakai Content-Type multipart (bukan JSON)', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    // Reproduksi persis cara UI mengunggah: FormData + header dari app.
    const out = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      const result = await mod.renderMotionGraphicsOnClient({
        template: 'branded-intro', aspect: '9:16', duration: 2, props: { title: 'Cek Header' },
      }, { onProgress: () => {} });
      const fd = new FormData();
      fd.append('file', result.blob, 'motion-graphics-branded-intro.mp4');
      fd.append('prompt', 'Cek Header');
      fd.append('meta', JSON.stringify({ kind: 'motion-graphics', renderer: 'client' }));
      // Header harus TANPA Content-Type — sama seperti authHeadersMultipart().
      const res = await fetch('/api/studio/motion-graphics/asset', {
        method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: fd,
      });
      return { ok: res.ok, status: res.status };
    });
    assert.equal(out.ok, true, 'upload multipart harus sukses, dapat status ' + out.status);
    assert.equal(out.status, 201);
    await page.close();
  });

  test('D-252: hasil render muat di bawah batas upload (4 MB)', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    // Kasus terberat: 16:9 durasi 10 detik (rasio paling lebar).
    const out = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      const r = await mod.renderMotionGraphicsOnClient({
        template: 'branded-intro', aspect: '16:9', duration: 10,
        props: { title: 'Uji Batas Ukuran', subtitle: 'Subjudul panjang untuk menambah variasi' },
      }, { onProgress: () => {} });
      return { size: r.blob.size, bytes: r.bytes, max: mod.MG_UPLOAD_MAX_BYTES };
    });
    assert.ok(out.size > 1000, 'hasil harus punya isi');
    assert.ok(out.size <= out.max,
      'hasil ' + (out.size / 1024 / 1024).toFixed(2) + ' MB harus <= batas ' + (out.max / 1024 / 1024).toFixed(0) + ' MB');
    assert.ok(out.size <= 4.5 * 1024 * 1024,
      'harus di bawah batas platform Vercel 4,5 MB');
    await page.close();
  });

  test('komposisi branded-intro 9:16 menghasilkan MP4 client-side', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    const out = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      const r = await mod.renderMotionGraphicsOnClient({
        template: 'branded-intro', aspect: '9:16', duration: 2,
        props: { title: 'SherlyStudio', subtitle: 'Motion Graphics', tagline: 'Ruang kreasi' },
      }, { onProgress: () => {} });
      const buf = new Uint8Array(await r.blob.arrayBuffer());
      return { size: r.blob.size, width: r.width, height: r.height, magic: String.fromCharCode(...buf.subarray(4, 8)) };
    });
    assert.equal(out.width, 1080);
    assert.equal(out.height, 1920);
    assert.ok(out.size > 1000);
    assert.equal(out.magic, 'ftyp');
    await page.close();
  });

  test('progress callback melaporkan fase render sampai selesai', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    const phases = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      const seen = [];
      await mod.renderMotionGraphicsOnClient({
        template: 'branded-intro', aspect: '16:9', duration: 2, props: { title: 'X' },
      }, { onProgress: ({progress, phase}) => seen.push([progress, phase]) });
      return seen;
    });
    assert.ok(phases.length > 3, 'progress harus dilaporkan berkali-kali');
    assert.equal(phases[0][0], 0);
    assert.equal(phases[phases.length - 1][0], 100);
    assert.equal(phases[phases.length - 1][1], 'done');
    // Progres harus monoton naik.
    for (let i = 1; i < phases.length; i++) {
      assert.ok(phases[i][0] >= phases[i - 1][0], 'progres tidak boleh turun');
    }
    await page.close();
  });
});
