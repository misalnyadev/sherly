// D-291 — Uji VISUAL (Chromium) panel Pengaturan Konten Studio.
//
// Hanya memeriksa GEOMETRI, jadi tidak butuh login/API: halaman harness memakai
// CSS asli dari public/index.html + struktur markup yang sama dengan yang
// dibangun studio.js (buildSettingsPanel).
//
// Kalau Chromium tidak tersedia di lingkungan CI, test ini di-skip (bukan fail)
// supaya suite tetap hijau di mesin tanpa browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

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

const ICON = (d) => `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="${d}"/></svg>`;
const chip = (label) =>
  `<button type="button" class="st-set-chip">${ICON('M4 6h16')}<span><span>${label}</span></span></button>`;

function harnessHtml() {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styles}</style>
<style>body{margin:0;background:#070c15;color:#e8ecf5;font-family:Inter,sans-serif}.fake-stage{height:100vh;position:relative}</style>
</head><body>
<div class="fake-stage">
  <div class="st-composer-dock">
    <div class="st-composer">
      <div class="st-composer-top"><div class="st-asset-header"></div><div class="st-tools-menu-row"></div></div>
      <div class="st-prompt-box"><textarea rows="1">deskripsi adegan sinematik</textarea></div>
      <div class="st-composer-actions"><button class="st-send">Buat</button></div>
    </div>
  </div>
  <div class="st-pop st-pop-settings open" id="stPop-settings">
    <div class="st-set-head"><span class="st-set-head-ico">${ICON('M4 6h16')}</span>
      <div class="st-set-head-txt"><b>Pengaturan Konten</b><small>Atur semua dulu, lalu tekan Simpan</small></div></div>
    <div class="st-set-body">
      <div class="st-set-row"><div class="st-set-label">${ICON('M12 5v14')}<b>Jenis Konten</b></div>
        <div class="st-set-chips">${chip('Foto')}${chip('Video')}${chip('Motion Graphics')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M4 6h16')}<b>Aspek Rasio</b></div>
        <div class="st-set-chips">${chip('1:1')}${chip('4:5')}${chip('16:9')}${chip('9:16')}${chip('3:4')}${chip('4:3')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M5 12h14')}<b>Provider Video</b></div>
        <div class="st-set-chips">${chip('Veo 3.1')}${chip('Kling 2.5')}${chip('Seedance')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M7 4h10v16H7z')}<b>Model</b></div>
        <div class="st-set-chips">${chip('Model A')}${chip('Model B')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M4 4h16v16H4z')}<b>Resolusi</b></div>
        <div class="st-set-chips">${chip('720p')}${chip('1080p')}${chip('4K')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M12 8v4l3 2')}<b>Durasi</b></div>
        <div class="st-set-chips">${chip('4 detik')}${chip('6 detik')}${chip('8 detik')}${chip('10 detik')}</div></div>
    </div>
    <div class="st-set-foot"><button class="st-cancel">Batal</button><button class="st-save">Simpan</button></div>
  </div>
</div>
<script>
  function syncComposerHeightVar(){
    const c=document.querySelector('.st-composer');
    const dock=document.querySelector('.st-composer-dock')||document.documentElement;
    if(!c)return; dock.style.setProperty('--st-composer-h', Math.round(c.getBoundingClientRect().height)+'px');
  }
  syncComposerHeightVar(); window.addEventListener('resize',syncComposerHeightVar); window.__sync=syncComposerHeightVar;
</script></body></html>`;
}

const SKIP = { skip: 'Chromium tidak tersedia di lingkungan ini' };

/**
 * Mengukur geometri panel di ukuran viewport tertentu.
 */
async function measure(browser, w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const file = path.join(ROOT, 'public', '__d291_harness.html');
  writeFileSync(file, harnessHtml());
  try {
    await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.__sync && window.__sync());
    await new Promise((r) => setTimeout(r, 350));
    return await page.evaluate(() => {
      const panel = document.querySelector('#stPop-settings');
      const body = document.querySelector('.st-set-body');
      const pr = panel.getBoundingClientRect();
      const cs = getComputedStyle(panel);
      const mg = [...document.querySelectorAll('.st-set-chip')]
        .find((c) => c.textContent.includes('Motion Graphics'));
      const mr = mg ? mg.getBoundingClientRect() : null;
      const jenis = document.querySelector('.st-set-row .st-set-label b');
      const jr = jenis.getBoundingClientRect();
      return {
        vw: innerWidth, vh: innerHeight,
        panel: {
          top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right,
          w: pr.width, h: pr.height,
          position: cs.position, animation: cs.animationName,
          maxHeight: cs.maxHeight,
        },
        bodyScrollable: body.scrollHeight > body.clientHeight,
        motionGraphics: mr ? { top: mr.top, bottom: mr.bottom, h: mr.height } : null,
        jenisKonten: { top: jr.top, bottom: jr.bottom },
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

// ===========================================================================

for (const [w, h] of [[1440, 900], [1280, 720], [1920, 1080], [1024, 640]]) {
  test(`D-291: panel Pengaturan desktop ${w}x${h} tidak terpotong ke atas`, async (t) => {
    if (!puppeteer || !chromium) return t.skip(SKIP);
    const m = await withBrowser((b) => measure(b, w, h));

    assert.ok(m.panel.top >= 0, `panel tidak boleh keluar layar atas (top=${m.panel.top})`);
    assert.ok(
      m.panel.bottom <= m.vh + 1,
      `panel tidak boleh keluar layar bawah (bottom=${m.panel.bottom}, vh=${m.vh})`,
    );
    assert.equal(m.panel.position, 'fixed', 'panel desktop harus fixed');

    // Grup "Jenis Konten" harus terlihat.
    assert.ok(
      m.jenisKonten.top >= 0 && m.jenisKonten.bottom <= m.vh,
      'label "Jenis Konten" harus terlihat',
    );

    // "Motion Graphics" harus terlihat DAN berada di dalam panel.
    assert.ok(m.motionGraphics, 'pilihan "Motion Graphics" harus ada');
    assert.ok(
      m.motionGraphics.top >= 0 && m.motionGraphics.bottom <= m.vh,
      '"Motion Graphics" harus terlihat di layar',
    );
    assert.ok(
      m.motionGraphics.top >= m.panel.top - 1 && m.motionGraphics.bottom <= m.panel.bottom + 1,
      '"Motion Graphics" harus berada di dalam panel (tidak terpotong)',
    );
  });
}

test('D-291: panel desktop punya animasi "tampil dari bawah"', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 1440, 900));
  assert.equal(m.panel.animation, 'stSettingsRise', 'panel desktop harus animasi rise dari bawah');
});

test('D-291: panel HP tetap modal tengah (tidak ikut animasi rise)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 390, 844));
  assert.equal(m.panel.position, 'fixed');
  assert.equal(m.panel.animation, 'none', 'panel HP tidak boleh pakai animasi rise');
  assert.ok(
    Math.abs((m.panel.top + m.panel.bottom) / 2 - m.vh / 2) < 2,
    'panel HP harus tetap di tengah layar',
  );
  assert.ok(m.panel.top >= 0 && m.panel.bottom <= m.vh + 1, 'panel HP tidak boleh keluar layar');
  assert.ok(
    m.motionGraphics.top >= m.panel.top - 1 && m.motionGraphics.bottom <= m.panel.bottom + 1,
    '"Motion Graphics" harus di dalam panel HP',
  );
});

test('D-291: panel HP landscape (layar pendek) tetap aman', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 844, 390));
  assert.ok(m.panel.top >= -1, 'panel tidak keluar layar atas');
  assert.ok(m.panel.bottom <= m.vh + 1, 'panel tidak keluar layar bawah');
  assert.ok(
    m.motionGraphics.top >= m.panel.top - 1 && m.motionGraphics.bottom <= m.panel.bottom + 1,
    '"Motion Graphics" harus di dalam panel landscape',
  );
});
