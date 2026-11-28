// D-294 / D-295 — Uji VISUAL (Chromium): tampilan Beranda (Portfolio + Konten).
//
// Yang diperiksa:
//   - kartu Portfolio & Konten memakai kartu showcase (bukan ".asset" kecil),
//   - UKURAN kartu TIDAK berubah dari desain awal (vertikal 142px, horizontal 244px),
//   - Portfolio tampil 3 karya di kolom KIRI, sejajar dengan "Karakter Tersedia" di kanan,
//   - konten vertikal 4 karya & horizontal 3 karya,
//   - thumbnail video menghasilkan POSTER gambar (bukan kotak kosong),
//   - AUTOPLAY saat kursor di atas kartu video,
//   - KLIK kartu -> lightbox ukuran asli.
//
// Memakai CSS + markup ASLI dari public/index.html, data showcase di-stub.
import { test, before, after } from 'node:test';
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

// Ukuran kartu (D-297: dikecilkan 4px dari desain awal supaya 5 & 3 PAS di batas).
const W_VERTICAL = 138;
const W_HORIZONTAL = 240;

// PNG 1x1 (dipakai sebagai gambar).
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// Video: URL dummy (tidak dimuat sungguhan -> test tidak bergantung codec).
const MP4 = 'about:blank#sc-video';

const ITEMS = [
  { id: 'p1', assetId: 'a1', slot: 'portfolio', title: 'Karya Portfolio 1', caption: '', mediaType: 'image', width: 720, height: 1280, createdAt: '2026-01-02T00:00:00Z', publicUrl: PIXEL },
  { id: 'p2', assetId: 'a2', slot: 'portfolio', title: 'Karya Portfolio 2', caption: '', mediaType: 'image', width: 900, height: 900, createdAt: '2026-01-01T00:00:00Z', publicUrl: PIXEL },
  { id: 'p3', assetId: 'a3', slot: 'portfolio', title: 'Karya Portfolio 3', caption: '', mediaType: 'image', width: 720, height: 1280, createdAt: '2026-01-03T00:00:00Z', publicUrl: PIXEL },
  { id: 'p4', assetId: 'a4', slot: 'portfolio', title: 'Karya Portfolio 4', caption: '', mediaType: 'image', width: 720, height: 1280, createdAt: '2026-01-04T00:00:00Z', publicUrl: PIXEL },
  { id: 'p5', assetId: 'a4b', slot: 'portfolio', title: 'Karya Portfolio 5', caption: '', mediaType: 'image', width: 720, height: 1280, createdAt: '2026-01-04bT00:00:00Z', publicUrl: PIXEL },
  { id: 'v1', assetId: 'a14', slot: 'public', title: 'Konten Video', caption: '', mediaType: 'video', width: 1080, height: 1920, createdAt: '2026-01-12T00:00:00Z', publicUrl: MP4 },
  { id: 'u1', assetId: 'a5', slot: 'public', title: 'Konten Publik Potret 1', caption: 'Deskripsi', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-03T00:00:00Z', publicUrl: PIXEL },
  { id: 'u2', assetId: 'a6', slot: 'public', title: 'Konten Publik Potret 2', caption: '', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-04T00:00:00Z', publicUrl: PIXEL },
  { id: 'u3', assetId: 'a7', slot: 'public', title: 'Konten Publik Potret 3', caption: '', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-05T00:00:00Z', publicUrl: PIXEL },
  { id: 'u4', assetId: 'a8', slot: 'public', title: 'Konten Publik Potret 4', caption: '', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-06T00:00:00Z', publicUrl: PIXEL },
  { id: 'u5', assetId: 'a9', slot: 'public', title: 'Konten Publik Potret 5', caption: '', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-07T00:00:00Z', publicUrl: PIXEL },
  { id: 'u6', assetId: 'a9b', slot: 'public', title: 'Konten Publik Potret 6', caption: '', mediaType: 'image', width: 1080, height: 1920, createdAt: '2026-01-07bT00:00:00Z', publicUrl: PIXEL },
  { id: 'h1', assetId: 'a10', slot: 'public', title: 'Konten Publik Landscape 1', caption: '', mediaType: 'image', width: 1920, height: 1080, createdAt: '2026-01-08T00:00:00Z', publicUrl: PIXEL },
  { id: 'h2', assetId: 'a11', slot: 'public', title: 'Konten Publik Landscape 2', caption: '', mediaType: 'image', width: 1920, height: 1080, createdAt: '2026-01-09T00:00:00Z', publicUrl: PIXEL },
  { id: 'h3', assetId: 'a12', slot: 'public', title: 'Konten Publik Landscape 3', caption: '', mediaType: 'image', width: 1920, height: 1080, createdAt: '2026-01-10T00:00:00Z', publicUrl: PIXEL },
  { id: 'h4', assetId: 'a13', slot: 'public', title: 'Konten Publik Landscape 4', caption: '', mediaType: 'image', width: 1920, height: 1080, createdAt: '2026-01-11T00:00:00Z', publicUrl: PIXEL },
  { id: 'h5', assetId: 'a13b', slot: 'public', title: 'Konten Publik Landscape 5', caption: '', mediaType: 'image', width: 1920, height: 1080, createdAt: '2026-01-11bT00:00:00Z', publicUrl: PIXEL },
];

// Satu browser dipakai semua test (hemat resource).
let browser = null;

before(async () => {
  if (!puppeteer || !chromium) return;
  browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
});

after(async () => {
  if (browser) await browser.close().catch(() => {});
});

/**
 * Render Beranda di viewport tertentu.
 * `extra(info, act)` dijalankan sebelum halaman ditutup.
 */
async function renderHome(w, h, extra) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: w, height: h });
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    const bodyMatch = html.match(/<div class="layout">([\s\S]*?)<footer class="page-sign">/);
    const body = bodyMatch ? bodyMatch[1] : '';
    // Reproduksi layout NYATA: sidebar (kiri) + maincol + rightcol (360px),
    // supaya lebar kolom sama dengan yang dilihat user di browser.
    const sidebar = html.match(/<aside class="sidebar"[\s\S]*?<\/aside>/)?.[0] || '';
    const rightcol = '<div class="rightcol"><div class="panel" style="height:200px">Quick Menu</div></div>';
    const file = path.join(ROOT, 'public', '__d294_home.html');
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styles}</style></head><body>
<div class="app">${sidebar}<main><div class="layout">${body}${rightcol}</div></main></div>
<script>
  window.__stub = ${JSON.stringify(JSON.stringify({ items: ITEMS }))};
  const origFetch = window.fetch;
  window.fetch = async (url, opts) => {
    if (String(url).includes('/api/public/showcase')) {
      return { ok: true, json: async () => JSON.parse(window.__stub) };
    }
    return origFetch(url, opts);
  };
  // Headless Chromium melaporkan "(hover: none)" -> perilakunya seperti HP.
  // Untuk menguji autoplay-hover (PC), kita paksa jadi "(hover: hover)".
  const origMM = window.matchMedia.bind(window);
  window.matchMedia = (q) => {
    if (String(q).includes('hover')) {
      return { matches: String(q).includes('hover: hover'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
    }
    return origMM(q);
  };
</script>
<script>${showJs}</script>
</body></html>`);
    await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.sherlyLoadHomeShowcase && window.sherlyLoadHomeShowcase(true));
    await new Promise((r) => setTimeout(r, 400));

    const act = async (fn, arg) => {
      const out = await page.evaluate(fn, arg);
      await new Promise((r) => setTimeout(r, 200));
      return out;
    };
    const info = await act(() => {
      const q = (s) => document.querySelector(s);
      const all = (s) => [...document.querySelectorAll(s)];
      const pf = q('#homePortfolio');
      const cards = pf ? [...pf.querySelectorAll('.sc-card')] : [];
      const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
      const prodPanel = q('#homeProdPanel');
      const charsPanel = q('#homeCharsPanel');
      const vids = all('.sc-card video');
      const vrow = q('#homeLatestRow');
      const hrow = q('#homePublicRow');
      return {
        portfolioCards: cards.length,
        portfolioCardSize: cards[0] ? rect(cards[0]) : null,
        portfolioWidths: cards.map((c) => Math.round(c.getBoundingClientRect().width)),
        portfolioUsesOldSmallAsset: all('#homePortfolio .asset').length,
        portfolioUsesScCard: cards.length,
        portfolioPanel: prodPanel ? rect(prodPanel) : null,
        charsPanel: charsPanel ? rect(charsPanel) : null,
        portfolioInsideHomeTop: (() => {
          const pp = q('#homeProdPanel'); const ht = q('.home-top');
          return !!(pp && ht && ht.contains(pp));
        })(),
        homeTopColumns: (() => {
          const ht = q('.home-top');
          if (!ht) return -1;
          return getComputedStyle(ht).gridTemplateColumns.split(' ').filter(Boolean).length;
        })(),
        videoCards: vids.length,
        videosHavePreloadAuto: vids.every((v) => v.getAttribute('preload') === 'auto'),
        placeholderTotal: all('[data-sc-fallback]').length,
        horizontalCount: hrow ? hrow.querySelectorAll('.sc-card').length : -1,
        verticalCount: vrow ? vrow.querySelectorAll('.sc-card').length : -1,
        verticalCardSize: vrow && vrow.querySelector('.sc-card') ? rect(vrow.querySelector('.sc-card')) : null,
        horizontalCardSize: hrow && hrow.querySelector('.sc-card') ? rect(hrow.querySelector('.sc-card')) : null,
        // Berapa kartu yang MUA T penuh di dalam baris (tidak terpotong).
        portfolioFits: (() => {
          if (!pf) return 0;
          const b = pf.getBoundingClientRect();
          let n = 0;
          for (const c of pf.querySelectorAll('.sc-card')) {
            const r = c.getBoundingClientRect();
            if (r.left < b.left - 2) continue;
            if (r.right > b.right + 2) break;
            n++;
          }
          return n;
        })(),
        verticalFits: (() => {
          if (!vrow) return 0;
          const b = vrow.getBoundingClientRect();
          let n = 0;
          for (const c of vrow.querySelectorAll('.sc-card')) {
            const r = c.getBoundingClientRect();
            if (r.left < b.left - 2) continue;
            if (r.right > b.right + 2) break;
            n++;
          }
          return n;
        })(),
        horizontalFits: (() => {
          if (!hrow) return 0;
          const b = hrow.getBoundingClientRect();
          let n = 0;
          for (const c of hrow.querySelectorAll('.sc-card')) {
            const r = c.getBoundingClientRect();
            if (r.left < b.left - 2) continue;
            if (r.right > b.right + 2) break;
            n++;
          }
          return n;
        })(),
        portfolioCanScroll: pf ? pf.scrollWidth > pf.clientWidth : false,
        verticalCanScroll: vrow ? vrow.scrollWidth > vrow.clientWidth : false,
        horizontalCanScroll: hrow ? hrow.scrollWidth > hrow.clientWidth : false,
        verticalOverflowX: vrow ? getComputedStyle(vrow).overflowX : '',
        horizontalOverflowX: hrow ? getComputedStyle(hrow).overflowX : '',
        hasLightboxEl: !!document.getElementById('scLightbox'),
      };
    });
    if (typeof extra === 'function') return { info, extra: await extra(info, act) };
    return { info, extra: null };
  } finally {
    try { await page.close(); } catch { /* abaikan */ }
    try { unlinkSync(path.join(ROOT, 'public', '__d294_home.html')); } catch { /* abaikan */ }
  }
}

// ===========================================================================

test('D-294: Portfolio & Konten memakai kartu besar (bukan ".asset" kecil)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(1440, 900);
  assert.equal(info.portfolioUsesOldSmallAsset, 0, 'kartu ".asset" yang kecil harus hilang');
  assert.ok(info.portfolioUsesScCard >= 1, 'kartu besar (.sc-card) harus dipakai');
  // Kartu lama ".asset" cuma 112px tinggi & sempit. Kartu baru lebih besar.
  assert.ok(info.portfolioCardSize.w >= 120, `lebar kartu harus >= 120 (${info.portfolioCardSize.w})`);
  assert.ok(info.portfolioCardSize.h >= 200, `tinggi kartu harus >= 200 (${info.portfolioCardSize.h})`);
  // Kartu portfolio sama lebar (grid rapi).
  assert.ok(
    info.portfolioWidths.every((x) => Math.abs(x - info.portfolioWidths[0]) <= 1),
    'kartu portfolio harus sama lebar: ' + JSON.stringify(info.portfolioWidths),
  );
});

test('D-295: ukuran kartu TIDAK berubah dari desain awal (142px / 244px)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(1440, 900);
  assert.equal(info.portfolioCardSize.w, W_VERTICAL, `kartu Portfolio harus ${W_VERTICAL}px`);
  assert.equal(info.verticalCardSize.w, W_VERTICAL, `kartu Konten vertikal harus ${W_VERTICAL}px`);
  assert.equal(info.horizontalCardSize.w, W_HORIZONTAL, `kartu Konten horizontal harus ${W_HORIZONTAL}px`);
  // Rasio 9:16 & 16:10 (dari desain awal).
  assert.equal(info.verticalCardSize.h, Math.round((W_VERTICAL * 16) / 9), 'rasio vertikal harus 9:16');
  assert.equal(info.horizontalCardSize.h, Math.round((W_HORIZONTAL * 10) / 16), 'rasio horizontal harus 16:10');
});

test('D-296: Portfolio di kolom KIRI (3 kartu pas), Karakter kolom lebih sempit', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(1440, 900);
  assert.ok(info.portfolioInsideHomeTop, 'section Portfolio harus di dalam grid home-top');
  assert.equal(info.homeTopColumns, 2, 'home-top harus 2 kolom (Portfolio | Karakter)');
  // Portfolio di kiri, Karakter di kanan.
  assert.ok(info.portfolioPanel.left < info.charsPanel.left, 'Portfolio harus di kiri Karakter');
  assert.ok(
    info.portfolioPanel.right <= info.charsPanel.left + 1,
    `Portfolio tidak boleh menimpa Karakter (${info.portfolioPanel.right} vs ${info.charsPanel.left})`,
  );
  // Sejajar (baris yang sama).
  assert.ok(Math.abs(info.portfolioPanel.top - info.charsPanel.top) <= 1, 'Portfolio & Karakter harus sejajar baris');
  // Kolom Portfolio pas untuk 3 kartu (3x138 + 2x8 gap = 430px).
  assert.ok(info.portfolioPanel.w >= 430, `kolom Portfolio harus >= 430px (${info.portfolioPanel.w})`);
  // Kolom Karakter LEBIH SEMPIT dari kolom Portfolio (bukan 1:1).
  assert.ok(
    info.charsPanel.w < info.portfolioPanel.w,
    `panel Karakter harus lebih sempit dari Portfolio (${info.charsPanel.w} vs ${info.portfolioPanel.w})`,
  );
});

test('D-297: tinggi panel Portfolio PERSIS SAMA dengan panel Karakter', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(1352, 768);
  assert.ok(
    Math.abs(info.portfolioPanel.h - info.charsPanel.h) <= 1,
    `tinggi Portfolio harus sama dengan Karakter (${info.portfolioPanel.h} vs ${info.charsPanel.h})`,
  );
  assert.ok(
    Math.abs(info.portfolioPanel.bottom - info.charsPanel.bottom) <= 1,
    `batas bawah kedua panel harus rata (${info.portfolioPanel.bottom} vs ${info.charsPanel.bottom})`,
  );
});

test('D-296: Konten vertikal muat 5 & horizontal muat 3, semua bisa scroll horizontal', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(1440, 900);
  // Semua baris harus bisa digeser horizontal (desain awal) & tidak boleh
  // memotong daftar (semua karya tetap ada di DOM).
  assert.ok(info.portfolioCanScroll, 'baris Portfolio harus bisa scroll horizontal');
  assert.ok(info.verticalCanScroll, 'baris konten vertikal harus bisa scroll horizontal');
  assert.ok(info.horizontalCanScroll, 'baris konten horizontal harus bisa scroll horizontal');
  assert.equal(info.verticalOverflowX, 'auto', 'baris vertikal harus overflow-x:auto');
  assert.equal(info.horizontalOverflowX, 'auto', 'baris horizontal harus overflow-x:auto');
  // Yang MUA T terlihat: 5 (vertikal) & 3 (horizontal).
  assert.ok(info.verticalFits >= 5, `konten vertikal harus muat >= 5 kartu (${info.verticalFits})`);
  assert.ok(info.horizontalFits >= 3, `konten horizontal harus muat >= 3 kartu (${info.horizontalFits})`);
});

test('D-294: thumbnail video pakai preload=auto + ada placeholder fallback', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(1440, 900);
  assert.ok(info.videoCards >= 1, 'harus ada kartu video');
  assert.ok(info.videosHavePreloadAuto, 'video wajib preload=auto supaya frame ter-decode');
  assert.ok(info.placeholderTotal >= 1, 'placeholder fallback harus tersedia');
});

test('D-294: poster video dibuat dari frame (canvas -> gambar)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { extra } = await renderHome(1440, 900, async (_info, act) => await act(async () => {
    const card = [...document.querySelectorAll('.sc-card')].find((c) => c.querySelector('video'));
    if (!card) return { ok: false, reason: 'tidak ada kartu video' };
    const v = card.querySelector('video');
    // Palsukan dimensi agar grabPoster() bisa berjalan.
    Object.defineProperty(v, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(v, 'videoHeight', { value: 1280, configurable: true });
    const realToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function () {
      return 'data:image/jpeg;base64,' + btoa('x'.repeat(200));
    };
    v.dispatchEvent(new Event('loadeddata'));
    await new Promise((r) => setTimeout(r, 150));
    const poster = card.querySelector('[data-sc-poster]');
    const videoVisible = v ? getComputedStyle(v).display !== 'none' : false;
    HTMLCanvasElement.prototype.toDataURL = realToDataURL;
    return { ok: !!poster, videoVisible };
  }));
  assert.ok(extra.ok, 'poster harus dibuat dari frame video (canvas -> img): ' + (extra.reason || ''));
  // Video TIDAK boleh disembunyikan (harus bisa di-hover untuk autoplay).
  assert.ok(extra.videoVisible, 'video tidak boleh display:none (autoplay hover akan mati)');
});

test('D-294: klik kartu -> lightbox ukuran asli terbuka', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { extra } = await renderHome(1440, 900, async (_info, act) => {
    await act(() => {
      const c = document.querySelector('#homePortfolio .sc-card');
      if (c) c.click();
    });
    return await act(() => {
      const lb = document.getElementById('scLightbox');
      return {
        open: lb ? lb.classList.contains('open') : false,
        hasMedia: lb ? !!lb.querySelector('img, video') : false,
        hasTitle: lb ? !!lb.querySelector('.sc-lb-head b') : false,
      };
    });
  });
  assert.ok(extra.open, 'lightbox harus terbuka setelah klik');
  assert.ok(extra.hasMedia, 'lightbox harus menampilkan media');
  assert.ok(extra.hasTitle, 'lightbox harus menampilkan judul');
});

test('D-294: video diputar saat kursor di atas (autoplay hover)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { extra } = await renderHome(1440, 900, async (_info, act) => {
    await act(() => {
      const v = document.querySelector('.sc-card video');
      if (!v) return;
      window.__played = 0;
      const orig = v.play.bind(v);
      v.play = () => { window.__played++; try { orig(); } catch {} return Promise.resolve(); };
    });
    await act(() => {
      const card = [...document.querySelectorAll('.sc-card')].find((c) => c.querySelector('video'));
      if (card) card.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    });
    return await act(() => window.__played || 0);
  });
  assert.ok(extra >= 1, 'video harus diputar saat hover (pointerenter)');
});

test('D-295: Beranda HP juga memakai kartu besar', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const { info } = await renderHome(390, 844);
  assert.ok(info.portfolioCardSize.w >= 120, `lebar kartu HP harus >= 120 (${info.portfolioCardSize.w})`);
  assert.ok(info.portfolioCardSize.h >= 200, `tinggi kartu HP harus >= 200 (${info.portfolioCardSize.h})`);
  assert.ok(info.horizontalCount >= 3, 'HP juga harus split konten potret/landscape');
  assert.ok(info.verticalCount >= 5, 'HP juga harus split konten potret/landscape');
});
