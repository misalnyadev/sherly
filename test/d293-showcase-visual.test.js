// D-293 — Uji VISUAL (Chromium): Beranda menampilkan section "Portfolio"
// (aset portfolio user) dan baris horizontal konten publik.
//
// Memakai CSS + markup ASLI dari public/index.html, hanya data showcase yang
// di-stub (server tidak bisa dijangkau dari sandbox).
// Kalau Chromium tidak tersedia, test di-skip (bukan fail).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const showJs = readFileSync(path.join(ROOT, 'public/showcase.js'), 'utf8');

const CHROMIUM_LIB = '/tmp/chromedeps/root/lib';
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${process.env.LD_LIBRARY_PATH}:${CHROMIUM_LIB}`
  : CHROMIUM_LIB;

let puppeteer = null;
let chromium = null;
try {
  puppeteer = (await import('puppeteer-core')).default;
  chromium = (await import('@sparticuz/chromium')).default;
} catch {
  /* browser tidak tersedia -> skip */
}

const SKIP = { skip: 'Chromium tidak tersedia di lingkungan ini' };

// PNG 1x1 transparan (dipakai sebagai thumb).
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ITEMS = [
  { id: 'p1', assetId: 'a1', slot: 'portfolio', title: 'Karya Portfolio 1', caption: '', mediaType: 'image', width: 1200, height: 800, createdAt: '2026-01-02T00:00:00Z', publicUrl: PIXEL },
  { id: 'p2', assetId: 'a2', slot: 'portfolio', title: 'Karya Portfolio 2', caption: '', mediaType: 'image', width: 900, height: 900, createdAt: '2026-01-01T00:00:00Z', publicUrl: PIXEL },
  { id: 'u1', assetId: 'a3', slot: 'public', title: 'Konten Publik Potret', caption: 'Deskripsi konten', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-03T00:00:00Z', publicUrl: PIXEL },
  { id: 'u2', assetId: 'a4', slot: 'public', title: 'Konten Publik Landscape', caption: 'Deskripsi lain', mediaType: 'image', width: 1920, height: 1080, createdAt: '2026-01-04T00:00:00Z', publicUrl: PIXEL },
];

async function renderHome(browser, w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  // Halaman harness: CSS asli + markup Beranda + showcase.js dengan fetch stub.
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const bodyMatch = html.match(/<div class="layout">([\s\S]*?)<footer class="page-sign">/);
  const body = bodyMatch ? bodyMatch[1] : '';
  const file = path.join(ROOT, 'public', '__d293_home.html');
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styles}</style></head><body>
<div class="layout">${body}</div>
<script>
  window.__fetchStub = ${JSON.stringify(JSON.stringify({ items: ITEMS }))};
  const origFetch = window.fetch;
  window.fetch = async (url, opts) => {
    if (String(url).includes('/api/public/showcase')) {
      return { ok: true, json: async () => JSON.parse(window.__fetchStub) };
    }
    return origFetch(url, opts);
  };
</script>
<script>${showJs}</script>
</body></html>`);
  try {
    await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.sherlyLoadHomeShowcase && window.sherlyLoadHomeShowcase(true));
    await new Promise((r) => setTimeout(r, 350));
    return await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const all = (s) => [...document.querySelectorAll(s)];
      const pf = q('#homePortfolio');
      const hrow = q('#homePublicRow');
      const vrow = q('#homeLatestRow');
      const head = q('#homeProdPanel .section-head h2');
      return {
        heading: head ? head.textContent.trim() : '',
        portfolioCount: pf ? pf.querySelectorAll('.sc-card').length : -1,
        portfolioEmpty: pf ? !!pf.querySelector('.empty-state') : false,
        horizontalCount: hrow ? hrow.querySelectorAll('.sc-card').length : -1,
        verticalCount: vrow ? vrow.querySelectorAll('.sc-card').length : -1,
        horizontalTitles: hrow ? [...hrow.querySelectorAll('.sc-card .sc-meta b')].map((b) => b.textContent.trim()) : [],
        verticalTitles: vrow ? [...vrow.querySelectorAll('.sc-card .sc-meta b')].map((b) => b.textContent.trim()) : [],
        hasPortfolioHeading: /Portfolio/i.test(head ? head.textContent : ''),
        noProduksi: !/Produksi Terbaru/.test(head ? head.textContent : ''),
      };
    });
  } finally {
    await page.close();
    try { unlinkSync(file); } catch { /* abaikan */ }
  }
}

async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

test('D-293: Beranda menampilkan section "Portfolio" (bukan "Produksi Terbaru")', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => renderHome(b, 1440, 900));
  assert.ok(m.hasPortfolioHeading, 'judul section harus "Portfolio"');
  assert.ok(m.noProduksi, 'judul "Produksi Terbaru" harus hilang');
});

test('D-293: section Portfolio menampilkan aset slot portfolio', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => renderHome(b, 1440, 900));
  assert.equal(m.portfolioCount, 2, '2 aset portfolio harus tampil');
  assert.ok(!m.portfolioEmpty, 'tidak boleh tampil empty-state kalau ada aset');
});

test('D-293: baris horizontal menampilkan konten publik landscape', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => renderHome(b, 1440, 900));
  assert.equal(m.horizontalCount, 1, '1 konten publik landscape (1920x1080)');
  assert.deepEqual(m.horizontalTitles, ['Konten Publik Landscape']);
});

test('D-293: baris vertikal menampilkan konten publik potret', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => renderHome(b, 1440, 900));
  assert.equal(m.verticalCount, 1, '1 konten publik potret (1080x1920)');
  assert.deepEqual(m.verticalTitles, ['Konten Publik Potret']);
});

test('D-293: Beranda HP juga menampilkan Portfolio + konten publik', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => renderHome(b, 390, 844));
  assert.equal(m.portfolioCount, 2);
  assert.equal(m.horizontalCount, 1);
  assert.equal(m.verticalCount, 1);
});
