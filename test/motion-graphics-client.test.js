// D-251: uji end-to-end render Motion Graphics di browser (Canvas 2D + WebCodecs).
//
// Menjalankan Chromium headless dengan server statis, memuat modul
// public/motion-graphics.js, lalu merender tiap komposisi client-side dan
// memverifikasi hasilnya MP4 yang valid (ftyp box + ukuran > 0).
//
// Di-skip otomatis kalau Chromium tidak tersedia di lingkungan test.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8231;

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

describe('D-251 Motion Graphics client-side render', () => {
  let server;
  let browser;
  let puppeteer;

  before(async () => {
    const chromium = findChromium();
    if (!chromium) return; // skip
    puppeteer = (await import('puppeteer-core')).default;
    server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'public'), String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((r) => setTimeout(r, 700));
    browser = await puppeteer.launch({
      executablePath: chromium,
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
        '--enable-features=SharedArrayBuffer',
        '--autoplay-policy=no-user-gesture-required',
      ],
      env: chromiumEnv(),
    });
  });

  after(async () => {
    try { await browser?.close(); } catch { /* ignore */ }
    try { server?.kill('SIGTERM'); } catch { /* ignore */ }
  });

  const needsChromium = () => !!findChromium();

  test('clientRenderSupported() true di Chromium modern', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    const supported = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      return mod.clientRenderSupported();
    });
    assert.equal(supported, true, 'Chromium modern harus mendukung WebCodecs');
    await page.close();
  });

  for (const c of [
    { template: 'branded-intro', aspect: '9:16' },
    { template: 'captioned-clip', aspect: '16:9' },
    { template: 'stat-card', aspect: '1:1' },
  ]) {
    test(`render client-side ${c.template} ${c.aspect} menghasilkan MP4 valid`, { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 480, height: 800 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

      const result = await page.evaluate(async (cfg) => {
        const mod = await import('/motion-graphics.js');
        if (!mod.clientRenderSupported()) {
          return { unsupported: true };
        }
        const props = cfg.template === 'stat-card'
          ? { value: '2.4JT', label: 'Total Pendant', note: 'Naik 18% bulan ini' }
          : cfg.template === 'captioned-clip'
            ? { captionsText: 'Halo dunia\nBaris kedua', title: 'Judul' }
            : { title: 'SherlyStudio', subtitle: 'Motion Graphics', tagline: 'Ruang kreasi kamu' };
        const out = await mod.renderMotionGraphicsOnClient({
          template: cfg.template,
          aspect: cfg.aspect,
          duration: 2,
          props,
        }, { onProgress: () => {} });
        const buf = new Uint8Array(await out.blob.arrayBuffer());
        return {
          unsupported: false,
          size: out.blob.size,
          type: out.blob.type,
          width: out.width,
          height: out.height,
          durationMs: out.durationMs,
          magic: String.fromCharCode(...buf.slice(4, 8)),
          boxSize: (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3],
        };
      }, c);

      assert.equal(result.unsupported, false, 'WebCodecs harus tersedia di Chromium test');
      assert.ok(result.size > 1000, 'hasil render harus punya ukuran wajar, dapat ' + result.size);
      assert.equal(result.type, 'video/mp4');
      // Box MP4: 4 byte ukuran big-endian, lalu tipe box "ftyp".
      assert.equal(result.magic, 'ftyp', 'harus MP4 valid (ftyp box)');
      assert.ok(result.boxSize > 0, 'ukuran box ftyp harus positif');
      assert.ok(result.durationMs > 0);
      assert.deepEqual(errors, [], 'halaman tidak boleh error: ' + errors.join(' | '));
      await page.close();
    });
  }

  test('render menolak template tak dikenal dengan pesan jelas', { skip: !needsChromium() && 'chromium tidak tersedia' }, async () => {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    const msg = await page.evaluate(async () => {
      const mod = await import('/motion-graphics.js');
      try {
        await mod.renderMotionGraphicsOnClient({ template: 'nope', aspect: '9:16', duration: 2, props: {} }, { onProgress: () => {} });
        return null;
      } catch (e) { return e.message; }
    });
    assert.ok(msg && /tidak dikenal/i.test(msg), 'pesan harus jelas: ' + msg);
    await page.close();
  });
});
