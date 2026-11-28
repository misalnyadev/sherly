// D-297 — Uji VISUAL (Chromium): "Karakter Tersedia" di Beranda jadi DAFTAR KONTAK.
//
// Yang diperiksa:
//   - baris karakter setinggi avatar (avatar muat nama + profesi),
//   - "Master Identity" jadi ICON BADGE di samping nama (bukan teks baris terpisah),
//   - teks kepanjangan dipotong "..." (text-overflow: ellipsis),
//   - SEMUA karakter ditampilkan (tidak dipotong slice) & bisa scroll vertikal,
//   - ada tombol "Tambah Karakter".
import { test, before, after } from 'node:test';
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

const SKIP = { skip: 'Chromium tidak tersedia di lingkungan ini' };

// 4 karakter: 1 master, nama panjang (harus ellipsis), 2 biasa.
const CHARS = [
  { id: 'c1', name: 'Sherly', role: 'Virtual Lifestyle Influencer', origin: 'Indonesia', is_master: true, reference_image_url: '' },
  { id: 'c2', name: 'Novi', role: 'Fashion Influencer', origin: 'Indonesia', is_master: false, reference_image_url: '' },
  { id: 'c3', name: 'Very Long Character Name For Ellipsis Test', role: 'Fashion Influencer', origin: 'Indonesia', is_master: false, reference_image_url: '' },
  { id: 'c4', name: 'Raka', role: 'Travel Influencer', origin: 'Indonesia', is_master: false, reference_image_url: '' },
];

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

/** Render Beranda + isi daftar karakter dari stub. */
async function renderHome(w, h) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: w, height: h });
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    const bodyMatch = html.match(/<div class="layout">([\s\S]*?)<footer class="page-sign">/);
    const body = bodyMatch ? bodyMatch[1] : '';
    const sidebar = html.match(/<aside class="sidebar"[\s\S]*?<\/aside>/)?.[0] || '';
    const rightcol = '<div class="rightcol"><div class="panel" style="height:200px">Quick Menu</div></div>';
    // Ambil ICONS + sherlyCharRow dari file asli supaya yang diuji = yang dipakai.
    const iconJs = html.match(/const ICONS\s*=\s*\{[\s\S]*?\};/)?.[0] || 'const ICONS={};';
    const charRowJs = html.match(/function sherlyCharRow\(c\)\{[\s\S]*?\n/)?.[0] || '';
    const file = path.join(ROOT, 'public', '__d297_chars.html');
    writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${styles}</style></head><body>
<div class="app">${sidebar}<main><div class="layout">${body}${rightcol}</div></main></div>
<script>
  ${iconJs}
  window.esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  ${charRowJs}
  document.getElementById('homeChars').innerHTML = ${JSON.stringify(CHARS)}.map(sherlyCharRow).join('');
</script>
</body></html>`);
    await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 300));
    return await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const all = (s) => [...document.querySelectorAll(s)];
      const wrap = q('#homeChars');
      const rows = all('#homeChars .character-row');
      const r0 = rows[0] ? rows[0].getBoundingClientRect() : null;
      const ava = rows[0] ? (rows[0].querySelector('img') || rows[0].querySelector('.ava')) : null;
      const avaBox = ava ? ava.getBoundingClientRect() : null;
      const nameEl = rows[2] ? rows[2].querySelector('b') : null;
      const roleEl = rows[2] ? rows[2].querySelector('small') : null;
      const cs = wrap ? getComputedStyle(wrap) : null;
      return {
        rowCount: rows.length,
        rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
        avatarSize: avaBox ? { w: Math.round(avaBox.width), h: Math.round(avaBox.height) } : null,
        masterBadges: all('#homeChars .ch-master').length,
        masterBadgeHasSvg: !!q('#homeChars .ch-master svg'),
        masterBadgeTitle: q('#homeChars .ch-master')?.getAttribute('title') || '',
        hasOldMasterText: (wrap?.textContent || '').includes('Master identity'),
        nameEllipsis: nameEl ? getComputedStyle(nameEl).textOverflow : '',
        roleEllipsis: roleEl ? getComputedStyle(roleEl).textOverflow : '',
        overflowY: cs ? cs.overflowY : '',
        canScroll: wrap ? wrap.scrollHeight > wrap.clientHeight : false,
        hasAddButton: !!q('#homeCharsAdd'),
        addButtonLabel: (q('#homeCharsAdd')?.textContent || '').trim(),
      };
    });
  } finally {
    try { await page.close(); } catch { /* abaikan */ }
    try { unlinkSync(path.join(ROOT, 'public', '__d297_chars.html')); } catch { /* abaikan */ }
  }
}

// ===========================================================================

test('D-297: baris karakter setinggi avatar & muat nama + profesi', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const info = await renderHome(1352, 768);
  assert.equal(info.rowCount, 4, 'semua karakter harus tampil (tidak dipotong slice)');
  assert.ok(info.rowHeights.every((h) => h >= 48 && h <= 60), `tinggi baris harus ~52px (${info.rowHeights})`);
  assert.ok(info.avatarSize.w === 40 && info.avatarSize.h === 40, `avatar harus 40x40 (${JSON.stringify(info.avatarSize)})`);
  // Baris harus cukup tinggi untuk 2 baris teks (nama + profesi).
  assert.ok(info.rowHeights[0] >= 48, 'baris harus muat nama + profesi');
});

test('D-297: "Master Identity" jadi icon badge di samping nama', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const info = await renderHome(1352, 768);
  assert.equal(info.masterBadges, 1, 'hanya karakter master yang dapat badge');
  assert.ok(info.masterBadgeHasSvg, 'badge master harus berupa ikon (svg)');
  assert.equal(info.masterBadgeTitle, 'Master identity', 'badge master harus punya title/label yang jelas');
  assert.ok(!info.hasOldMasterText, 'teks "Master identity" sebagai baris terpisah harus hilang');
});

test('D-297: teks kepanjangan dipotong "..." (ellipsis)', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const info = await renderHome(1352, 768);
  assert.equal(info.nameEllipsis, 'ellipsis', 'nama panjang harus dipotong ...');
  assert.equal(info.roleEllipsis, 'ellipsis', 'profesi panjang harus dipotong ...');
});

test('D-297: daftar karakter bisa scroll & ada tombol Tambah Karakter', async (t) => {
  if (!puppeteer || !chromium) return t.skip(SKIP);
  const info = await renderHome(1352, 768);
  assert.equal(info.overflowY, 'auto', 'daftar karakter harus bisa scroll vertikal');
  assert.ok(info.hasAddButton, 'harus ada tombol Tambah Karakter');
  assert.ok(/Tambah Karakter/i.test(info.addButtonLabel), 'label tombol harus "Tambah Karakter"');
});
