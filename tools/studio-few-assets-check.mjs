// D-261 — Cek galeri Studio saat jumlah aset SEDIK (kondisi asli user).
//
// Masalah (D-260): dengan aset sedikit, `maxCols = floor(items/2)` +
// `colW` dibatasi `minCol * 1.35` bikin galeri jadi 2 kolom di layar
// lebar, dan sisa ruang kosong besar di kanan.
//
// Sasaran D-261:
//  1. Jumlah aset sedikit (1, 2, 3, 4, 6) TETAP tampil >= 2 kolom
//     (side-by-side, bukan menumpuk ke bawah).
//  2. Baris terisi penuh (>= 97% lebar baris) -> tidak ada ruang kosong
//     di kanan.
//  3. PC: jumlah kolom ikut lebar halaman (vertikal ~7, horizontal ~5).
//  4. HP: vertikal 3, horizontal 2 (D-256).
//
// Keluar: exit code 0 = semua lolos, 1 = ada yang gagal.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.argv[2] || '/home/user/sherly');
const PORT = 8271;
const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + (env.LD_LIBRARY_PATH || '');

const mk = (id, w, h, name) => ({
  id, file_name: name || `aset-${id}.png`, media_type: 'image', kind: 'upload',
  url: '/assets/brand/sherly-logo-poster.png', width: w, height: h,
});
const vert = (id) => mk(id, 1080, 1920);
const horz = (id) => mk(id, 1920, 1080);

// Skenario: jumlah aset per baris (vertikal & horizontal) varies.
const SCENARIOS = [
  { name: '1-vert 1-horz', v: [vert('v1')], h: [horz('h1')] },
  { name: '2-vert 1-horz', v: [vert('v1'), vert('v2')], h: [horz('h1')] },
  { name: '2-vert 2-horz', v: [vert('v1'), vert('v2')], h: [horz('h1'), horz('h2')] },
  { name: '3-vert 2-horz', v: [vert('v1'), vert('v2'), vert('v3')], h: [horz('h1'), horz('h2')] },
  { name: '4-vert 3-horz', v: [vert('v1'), vert('v2'), vert('v3'), vert('v4')], h: [horz('h1'), horz('h2'), horz('h3')] },
  { name: '6-vert 4-horz', v: Array.from({ length: 6 }, (_, i) => vert('v' + i)), h: Array.from({ length: 4 }, (_, i) => horz('h' + i)) },
];

const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'public'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  env,
});

const VIEWPORTS = [
  { name: 'PC', width: 1280, height: 900, mobile: false },
  { name: 'HP', width: 390, height: 844, mobile: true },
];

const failures = [];
function check(vp, label, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(`${vp}: ${label}${detail ? ' — ' + detail : ''}`);
}

for (const vp of VIEWPORTS) {
  for (const sc of SCENARIOS) {
    console.log(`\n=== ${vp.name} — ${sc.name} ===`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.mobile, hasTouch: vp.mobile });
    await page.evaluateOnNewDocument((assets) => { window.__FAKE_ASSETS__ = assets; }, [...sc.v, ...sc.h]);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const origFetch = window.fetch;
      window.fetch = async (u, i) => {
        const s = String(u);
        if (s.includes('/api/studio/assets') && !(i && i.method === 'POST')) {
          return { ok: true, json: async () => ({ ok: true, assets: window.__FAKE_ASSETS__ }) };
        }
        return origFetch(u, i);
      };
      await window.renderStudio();
      document.getElementById('splash')?.classList.add('done');
      document.getElementById('studioView')?.classList.add('active');
      document.querySelectorAll('.page-view').forEach((v) => { if (v.id !== 'studioView') v.classList.remove('active'); });
      document.querySelector('.layout')?.style.setProperty('display', 'none', 'important');
    });
    await new Promise((r) => setTimeout(r, 900));

    const info = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('.st-gal-row').forEach((r) => {
        const key = r.classList.contains('st-gal-row--vertical') ? 'v' : 'h';
        const cols = [...r.getElementsByClassName('st-gal-col')];
        const items = [...r.querySelectorAll('.st-gal-item')];
        // Jumlah kolom yang terisi (punya >= 1 item).
        const filled = cols.filter((c) => c.children.length).length;
        // Item paling atas per kolom -> cek ada yang menumpuk ke bawah.
        const firstTops = cols.map((c) => (c.children[0] ? Math.round(c.children[0].getBoundingClientRect().top) : null));
        const rowW = r.clientWidth;
        const last = cols[cols.length - 1]?.getBoundingClientRect();
        const first = cols[0]?.getBoundingClientRect();
        const used = last && first ? last.right - first.left : 0;
        out[key] = {
          cols: cols.length, filled, items: items.length,
          rowW: Math.round(rowW),
          pct: rowW > 0 ? Math.round((used / rowW) * 100) : 0,
          firstTops,
          // Lebar kolom (harus <= maxcol, jangan giant).
          colW: cols.length ? Math.round(cols[0].getBoundingClientRect().width) : 0,
          // Berapa banyak baris (y berbeda) -> 1 = semua sejajar.
          rows: new Set(firstTops.filter((t) => t !== null)).size,
        };
      });
      return out;
    });
    console.log('  ' + JSON.stringify(info));

    const v = info.v, h = info.h;
    const tag = `${vp.name}/${sc.name}`;
    if (v) {
      check(tag, 'vertikal minimal 2 kolom (side-by-side, bukan menumpuk)', v.cols >= 2, `cols=${v.cols}`);
      // Semua kolom KECUALI boleh kosong hanya kalau memang lebih banyak
      // kolom dari jumlah aset (mis. 1 aset -> 2 kolom, kolom ke-2 kosong
      // supaya aset tetap tampil "berjadian" / setengah lebar ala D-260).
      const vEmpty = v.cols - v.filled;
      check(tag, 'vertikal kolom kosong <= 1 (aset tunggal tetap berjadian)', vEmpty <= 1, `kosong=${vEmpty}`);
      check(tag, 'vertikal semua item sejajar satu baris (bukan menumpuk)', v.rows === 1, `baris=${v.rows}`);
    }
    if (h) {
      check(tag, 'horizontal minimal 2 kolom', h.cols >= 2, `cols=${h.cols}`);
      const hEmpty = h.cols - h.filled;
      check(tag, 'horizontal kolom kosong <= 1', hEmpty <= 1, `kosong=${hEmpty}`);
      check(tag, 'horizontal semua item sejajar satu baris', h.rows === 1, `baris=${h.rows}`);
    }
    // D-261: thumbnail HARUS tetap sebesar kartu — bukan melebar jadi giant
    // saat jumlah kolom sedikit. Lebar kolom dibatasi --st-gal-maxcol.
    const cw = info.colW || {};
    if (cw.v) check(tag, 'lebar kolom vertikal <= maxcol (tidak giant)', cw.v <= 181, `colW=${cw.v}px`);
    if (cw.h) check(tag, 'lebar kolom horizontal <= maxcol (tidak giant)', cw.h <= 261, `colW=${cw.h}px`);
    await page.close();
  }
}

await browser.close();
server.kill();

console.log('');
if (failures.length) {
  console.log('GAGAL:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('SEMUA LOLOS — D-261 OK');
