// D-264 — Filter jenis konten di atas galeri Studio (Semua | Foto | Video).
//
// Sasaran:
//  1. Baris filter tampil di ATAS galeri dengan jumlah aset per jenis.
//  2. Jumlah = TOTAL aset (tidak berubah saat filter aktif) -> label stabil.
//  3. Filter "Foto" hanya menampilkan aset gambar; "Video" hanya video.
//  4. Baris orientasi (Vertikal/Horizontal) ikut hilang kalau kosong.
//  5. Layout tiap filter tetap benar (PC 7/4 grid, HP 3/3 grid).
//
// Keluar: exit code 0 = semua lolos, 1 = ada yang gagal.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.argv[2] || '/home/user/sherly');
const PORT = 8279;
const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + (env.LD_LIBRARY_PATH || '');

// 8 foto vertikal + 6 video horizontal + 2 foto horizontal (campuran).
const ASSETS = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: 'v' + i, file_name: 'foto-' + i + '.png', media_type: 'image', kind: 'upload',
    url: '/assets/brand/sherly-logo-poster.png', width: 1080, height: 1920,
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: 'fh' + i, file_name: 'foto-h-' + i + '.png', media_type: 'image', kind: 'upload',
    url: '/assets/brand/sherly-logo-poster.png', width: 1920, height: 1080,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: 'h' + i, file_name: 'video-' + i + '.mp4', media_type: 'video', kind: 'upload',
    url: '/assets/brand/fixture-horizontal.webm', width: 1280, height: 720,
  })),
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
  { name: 'PC', width: 1280, height: 900, mobile: false, vCols: 7, hCols: 4 },
  { name: 'HP', width: 390, height: 844, mobile: true, vCols: 3, hCols: 3 },
];

const failures = [];
function check(vp, label, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(`${vp}: ${label}${detail ? ' — ' + detail : ''}`);
}

for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.mobile, hasTouch: vp.mobile });
  await page.evaluateOnNewDocument((assets) => { window.__FAKE_ASSETS__ = assets; }, ASSETS);
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
  await new Promise((r) => setTimeout(r, 1200));

  const read = () => page.evaluate(() => {
    const bar = [...document.querySelectorAll('.st-gal-filter')].map((b) => {
      const r = b.getBoundingClientRect();
      const bb = b.querySelector('b');
      const svg = b.querySelector('svg');
      const br = bb?.getBoundingClientRect();
      const sr = svg?.getBoundingClientRect();
      return {
        key: b.dataset.galFilter,
        label: b.textContent.replace(/\s+/g, ' ').trim(),
        on: b.classList.contains('is-active'),
        // D-266: jumlah ditulis dalam kurung -> ambil angkanya saja.
        n: Number((bb?.textContent || '').replace(/[^\d]/g, '')),
        top: Math.round(r.top),
        h: Math.round(r.height),
        w: Math.round(r.width),
        hasSvg: !!svg,
        title: b.getAttribute('title') || '',
        // D-266: jumlah di SAMPING ikon (kanan ikon, sebaris vertikal).
        bLeft: br ? Math.round(br.left) : null,
        bRight: br ? Math.round(br.right) : null,
        bTop: br ? Math.round(br.top) : null,
        bH: br ? Math.round(br.height) : null,
        svgRight: sr ? Math.round(sr.right) : null,
        svgTop: sr ? Math.round(sr.top) : null,
        svgH: sr ? Math.round(sr.height) : null,
        // Teks jumlah harus dalam kurung.
        paren: /\(\d+\)/.test(b.textContent.replace(/\s+/g, '')),
      };
    });
    const rows = [...document.querySelectorAll('.st-gal-row')].map((r) => ({
      m: (r.className.match(/st-gal-row--(\w+)/) || [])[1],
      cols: r.getElementsByClassName('st-gal-col').length,
      n: r.querySelectorAll('.st-gal-item').length,
    }));
    const up = document.querySelector('#stUploadBtn');
    const upRect = up?.getBoundingClientRect();
    return {
      bar,
      rows,
      items: document.querySelectorAll('.st-gal-item').length,
      empty: !!document.querySelector('.st-gal-empty-filter'),
      // D-265: filter bar HARUS di luar galeri, di baris yang sama dengan
      // tombol Unggah (1 baris, tidak menambah baris baru).
      filterOutside: !!document.querySelector('#stGalFilters')
        && !document.querySelector('#stGallery > .st-gal-filters'),
      inTopRow: !!document.querySelector('.st-stage-top #stGalFilters'),
      uploadTop: upRect ? Math.round(upRect.top) : null,
      uploadH: upRect ? Math.round(upRect.height) : null,
    };
  });

  const all = await read();
  console.log('  ALL: ' + JSON.stringify(all));
  // 1) Baris filter ada, di luar galeri, sebaris dengan tombol Unggah.
  check(vp.name, 'baris filter ada (3 tombol)', all.bar.length === 3, `n=${all.bar.length}`);
  check(vp.name, 'filter bar DI LUAR galeri (bukan baris baru)', all.filterOutside, `outside=${all.filterOutside}`);
  check(vp.name, 'filter bar sebaris dengan tombol Unggah', all.inTopRow, `inTopRow=${all.inTopRow}`);
  // Semua tombol filter + Unggah harus di baris yang SAMA (top sama).
  const tops = all.bar.map((b) => b.top);
  check(vp.name, 'semua tombol filter 1 baris (top sama)',
    new Set(tops).size === 1, `tops=${[...new Set(tops)].join(',')}`);
  check(vp.name, 'tombol Unggah sebaris dengan filter',
    all.uploadTop !== null && Math.abs(all.uploadTop - tops[0]) <= 12,
    `upload=${all.uploadTop} filter=${tops[0]}`);
  // D-265: tombol filter = LOGO SAJA (punya svg) + jumlah.
  check(vp.name, 'tombol filter pakai logo (svg)', all.bar.every((b) => b.hasSvg), JSON.stringify(all.bar.map((b) => b.hasSvg)));
  check(vp.name, 'tombol filter punya title/label aksesibel',
    all.bar.every((b) => /Semua|Foto|Video/.test(b.title)), JSON.stringify(all.bar.map((b) => b.title)));
  // D-266: jumlah ditulis DALAM KURUNG & berada DI SAMPING ikon (bukan pojok).
  check(vp.name, 'jumlah ditulis dalam kurung',
    all.bar.every((b) => b.paren), JSON.stringify(all.bar.map((b) => b.label)));
  check(vp.name, 'jumlah di samping ikon (kanan ikon, sebaris)',
    all.bar.every((b) => b.bLeft !== null && b.svgRight !== null && b.bLeft >= b.svgRight
      && Math.abs(b.bTop - b.svgTop) <= Math.max(b.bH, b.svgH)),
    JSON.stringify(all.bar.map((b) => ({ bLeft: b.bLeft, svgRight: b.svgRight, bTop: b.bTop, svgTop: b.svgTop }))));
  // 2) Jumlah: total 16, foto 10, video 6.
  const byKey = Object.fromEntries(all.bar.map((b) => [b.key, b]));
  check(vp.name, 'jumlah Semua = 16', byKey.all?.n === 16, `n=${byKey.all?.n}`);
  check(vp.name, 'jumlah Foto = 10', byKey.photo?.n === 10, `n=${byKey.photo?.n}`);
  check(vp.name, 'jumlah Video = 6', byKey.video?.n === 6, `n=${byKey.video?.n}`);
  // Layout saat semua tampil.
  const vRow = all.rows.find((r) => r.m === 'vertical');
  const hRow = all.rows.find((r) => r.m === 'horizontal');
  check(vp.name, `baris vertikal ${vp.vCols} grid`, vRow?.cols === vp.vCols, `cols=${vRow?.cols}`);
  check(vp.name, `baris horizontal ${vp.hCols} grid`, hRow?.cols === vp.hCols, `cols=${hRow?.cols}`);

  // 3) Filter FOTO -> hanya gambar (10), baris horizontal (foto) ikut tampil.
  await page.click('[data-gal-filter="photo"]');
  await new Promise((r) => setTimeout(r, 900));
  const photo = await read();
  console.log('  FOTO: ' + JSON.stringify(photo));
  check(vp.name, 'filter Foto: 10 item tampil', photo.items === 10, `items=${photo.items}`);
  check(vp.name, 'filter Foto: tombol Foto aktif', photo.bar.find((b) => b.key === 'photo')?.on === true);
  const pCounts = Object.fromEntries(photo.bar.map((b) => [b.key, b.n]));
  check(vp.name, 'filter Foto: jumlah label TIDAK berubah (tetap total)', pCounts.all === 16 && pCounts.photo === 10 && pCounts.video === 6,
    JSON.stringify(pCounts));
  const pv = photo.rows.find((r) => r.m === 'vertical');
  const ph = photo.rows.find((r) => r.m === 'horizontal');
  check(vp.name, `filter Foto: vertikal ${vp.vCols} grid`, pv?.cols === vp.vCols, `cols=${pv?.cols}`);
  // Baris horizontal setelah filter Foto cuma berisi 2 foto -> kolom = min(ideal,
  // jumlah item) = 2 (D-259/D-260: jangan buat kolom melebihi jumlah aset).
  check(vp.name, 'filter Foto: horizontal kolom <= jumlah aset (2)',
    ph && ph.cols <= Math.max(2, ph.n) && ph.cols === Math.min(vp.hCols, Math.max(2, ph.n)),
    `cols=${ph?.cols} n=${ph?.n}`);

  // 4) Filter VIDEO -> hanya video (6), baris vertikal (foto) hilang.
  await page.click('[data-gal-filter="video"]');
  await new Promise((r) => setTimeout(r, 900));
  const video = await read();
  console.log('  VIDEO: ' + JSON.stringify(video));
  check(vp.name, 'filter Video: 6 item tampil', video.items === 6, `items=${video.items}`);
  check(vp.name, 'filter Video: tombol Video aktif', video.bar.find((b) => b.key === 'video')?.on === true);
  check(vp.name, 'filter Video: baris vertikal hilang (nggak ada foto)', !video.rows.some((r) => r.m === 'vertical'),
    JSON.stringify(video.rows.map((r) => r.m)));
  const hv = video.rows.find((r) => r.m === 'horizontal');
  check(vp.name, `filter Video: horizontal ${vp.hCols} grid`, hv?.cols === vp.hCols, `cols=${hv?.cols}`);

  // 5) Balik ke Semua -> semua kembali.
  await page.click('[data-gal-filter="all"]');
  await new Promise((r) => setTimeout(r, 900));
  const back = await read();
  check(vp.name, 'balik ke Semua: 16 item', back.items === 16, `items=${back.items}`);
  check(vp.name, 'balik ke Semua: 2 baris (vertikal + horizontal)', back.rows.length === 2,
    JSON.stringify(back.rows.map((r) => r.m)));

  await page.close();
}

await browser.close();
server.kill();

console.log('');
if (failures.length) {
  console.log('GAGAL:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('SEMUA LOLOS — D-266 OK');
