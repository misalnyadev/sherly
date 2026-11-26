// D-292 — Uji VISUAL (Chromium): panel "Pengaturan Konten" desktop MENUTUPI
// composer, termasuk saat composer TINGGI (mode Motion Graphics + template
// "Rangkaian Beat" yang punya textarea 7 baris + textarea 3 baris).
//
// Halaman harness memakai CSS asli dari public/index.html + struktur markup
// yang sama dengan studio.js (buildSettingsPanel).
// Kalau Chromium tidak tersedia, test di-skip (bukan fail).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
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

function harnessHtml(kind) {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  // kind 'beat' = composer tinggi (mode Motion Graphics + template Rangkaian Beat)
  const composerBody = kind === 'beat'
    ? `<div class="st-mg-fields">
        <label>Isi Beat</label>
        <textarea rows="7" style="width:100%;min-height:150px">=== Hook ===
3,2x lebih cepat produksi

=== Poin 1 ===
Template siap pakai

=== CTA ===
Coba sekarang</textarea>
        <label>Naskah Voice-over (opsional)</label>
        <textarea rows="3" style="width:100%;min-height:70px">Halo, ini narasi untuk video.</textarea>
      </div>`
    : `<div class="st-prompt-box"><textarea rows="1">deskripsi adegan sinematik untuk klip video pendek</textarea></div>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styles}</style>
<style>body{margin:0;background:#070c15;color:#e8ecf5;font-family:Inter,sans-serif}.fake-stage{height:100vh;position:relative}</style>
</head><body>
<div class="fake-stage">
  <div class="st-composer-dock">
    <div class="st-composer">
      <div class="st-composer-top"><div class="st-asset-header"></div><div class="st-tools-menu-row"></div></div>
      ${composerBody}
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
        <div class="st-set-chips">${chip('1:1')}${chip('4:5')}${chip('16:9')}${chip('9:16')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M5 12h14')}<b>Provider Video</b></div>
        <div class="st-set-chips">${chip('Veo 3.1')}${chip('Kling 2.5')}</div></div>
      <div class="st-set-row"><div class="st-set-label">${ICON('M7 4h10v16H7z')}<b>Model</b></div>
        <div class="st-set-chips">${chip('Model A')}${chip('Model B')}</div></div>
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

async function measure(browser, w, h, kind) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const file = path.join(ROOT, 'public', '__d292_harness.html');
  writeFileSync(file, harnessHtml(kind));
  try {
    await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.__sync && window.__sync());
    await new Promise((r) => setTimeout(r, 350));
    return await page.evaluate(() => {
      const panel = document.querySelector('#stPop-settings');
      const composer = document.querySelector('.st-composer');
      const pr = panel.getBoundingClientRect();
      const cr = composer.getBoundingClientRect();
      const cs = getComputedStyle(panel);
      const mg = [...document.querySelectorAll('.st-set-chip')]
        .find((c) => c.textContent.includes('Motion Graphics'));
      const mr = mg ? mg.getBoundingClientRect() : null;
      const jenis = document.querySelector('.st-set-row .st-set-label b').getBoundingClientRect();
      return {
        vw: innerWidth, vh: innerHeight,
        composer: { top: cr.top, bottom: cr.bottom, h: cr.height },
        panel: {
          top: pr.top, bottom: pr.bottom, h: pr.height, left: pr.left, w: pr.width,
          position: cs.position, animation: cs.animationName,
          borderBottomLeftRadius: cs.borderBottomLeftRadius,
        },
        panelCoversComposer: pr.top <= cr.top + 1 && pr.bottom >= cr.bottom - 1,
        motionGraphics: mr ? { top: mr.top, bottom: mr.bottom } : null,
        jenisKonten: { top: jenis.top, bottom: jenis.bottom },
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
  test(`D-292: desktop ${w}x${h} — panel menutupi composer even saat composer TINGGI (Rangkaian Beat)`, async (t) => {
    if (!puppeteer || !chromium) return t.skip(SKIP);
    const m = await withBrowser((b) => measure(b, w, h, 'beat'));

    assert.ok(m.composer.h > 250, `composer harus benar-benar tinggi di harness (h=${m.composer.h})`);

    // Panel menutupi composer (tidak menumpuk di atasnya).
    assert.ok(
      m.panelCoversComposer,
      `panel harus menutupi composer (panel ${m.panel.top}-${m.panel.bottom}, composer ${m.composer.top}-${m.composer.bottom})`,
    );
    // Panel tidak keluar viewport.
    assert.ok(m.panel.top >= -1, `panel tidak boleh keluar layar atas (top=${m.panel.top})`);
    assert.ok(m.panel.bottom <= m.vh + 1, `panel tidak boleh keluar layar bawah (bottom=${m.panel.bottom})`);
    // "Jenis Konten" & "Motion Graphics" terlihat.
    assert.ok(m.jenisKonten.top >= 0 && m.jenisKonten.bottom <= m.vh, '"Jenis Konten" harus terlihat');
    assert.ok(m.motionGraphics, '"Motion Graphics" harus ada');
    assert.ok(
      m.motionGraphics.top >= 0 && m.motionGraphics.bottom <= m.vh,
      '"Motion Graphics" harus terlihat',
    );
    assert.ok(
      m.motionGraphics.top >= m.panel.top - 1 && m.motionGraphics.bottom <= m.panel.bottom + 1,
      '"Motion Graphics" harus di dalam panel',
    );
  });
}

test('D-292: desktop — panel menutupi composer juga saat composer normal', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 1440, 900, 'normal'));
  assert.ok(m.panelCoversComposer, 'panel harus menutupi composer');
  assert.ok(m.panel.bottom <= m.vh + 1, 'panel tidak keluar layar bawah');
  assert.ok(m.motionGraphics.top >= 0 && m.motionGraphics.bottom <= m.vh);
});

test('D-292: panel desktop menempel di bawah layar (sudut bawah rata)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 1440, 900, 'beat'));
  assert.ok(Math.abs(m.panel.bottom - m.vh) <= 1, `panel harus menempel di bawah layar (bottom=${m.panel.bottom}, vh=${m.vh})`);
  assert.equal(m.panel.borderBottomLeftRadius, '0px', 'sudut bawah panel harus rata');
});

test('D-292: panel desktop tetap "tampil dari bawah" (animasi rise)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 1440, 900, 'beat'));
  assert.equal(m.panel.animation, 'stSettingsRise');
});

test('D-292: HP tetap modal tengah saat composer tinggi', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 390, 844, 'beat'));
  assert.equal(m.panel.animation, 'none', 'panel HP tidak ikut animasi rise');
  assert.ok(m.panel.top >= -1 && m.panel.bottom <= m.vh + 1, 'panel HP tidak keluar layar');
  assert.ok(
    Math.abs((m.panel.top + m.panel.bottom) / 2 - m.vh / 2) < 2,
    'panel HP harus tetap di tengah layar',
  );
  assert.ok(
    m.motionGraphics.top >= m.panel.top - 1 && m.motionGraphics.bottom <= m.panel.bottom + 1,
    '"Motion Graphics" harus di dalam panel HP',
  );
});

test('D-292: HP landscape (layar pendek) tetap aman saat composer tinggi', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const m = await withBrowser((b) => measure(b, 844, 390, 'beat'));
  assert.ok(m.panel.top >= -1, 'panel tidak keluar layar atas');
  assert.ok(m.panel.bottom <= m.vh + 1, 'panel tidak keluar layar bawah');
  assert.ok(
    m.motionGraphics.top >= m.panel.top - 1 && m.motionGraphics.bottom <= m.panel.bottom + 1,
    '"Motion Graphics" harus di dalam panel landscape',
  );
});
