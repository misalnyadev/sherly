// D-254 — Cek layout Studio di browser sungguhan (Chromium headless).
//
// Sasaran:
//  1. Galeri Studio = FULL PAGE  -> halaman luar scroll natural (bukan scroll
//     container internal), galeri mengalir sampai bawah halaman.
//  2. Composer TETAP NEMPEL di bawah viewport, posisinya tidak bergeser
//     sebelum & sesudah halaman di-scroll.
//  3. Thumbnail video 9:16 TIDAK terpotong -> item ikut rasio portrait
//     (9:16) dan media pakai `object-fit:contain`.
//
// Keluar: exit code 0 = semua lolos, 1 = ada yang gagal.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.argv[2] || '/home/user/sherly');
const PORT = 8270;
const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + (env.LD_LIBRARY_PATH || '');

// 4 video portrait 9:16 + 8 gambar + 40 aset lain (galeri harus panjang
//enough supaya halaman punya area scroll nyata).
const ASSETS = [
  { id: 'a1', file_name: 'vid-vertikal-9x16.mp4', media_type: 'video', kind: 'generate', url: '/assets/brand/sherly-logo.mp4', width: 1080, height: 1920, duration_ms: 6000, meta: { kind: 'motion-graphics' } },
  { id: 'a2', file_name: 'vid-vertikal-2.mp4', media_type: 'video', kind: 'generate', url: '/assets/brand/sherly-logo.mp4', width: 1080, height: 1920, duration_ms: 6000, meta: { kind: 'motion-graphics' } },
  { id: 'a3', file_name: 'vid-vertikal-3.mp4', media_type: 'video', kind: 'generate', url: '/assets/brand/sherly-logo.mp4', width: 1080, height: 1920, duration_ms: 6000, meta: { kind: 'motion-graphics' } },
  { id: 'a4', file_name: 'vid-vertikal-4.mp4', media_type: 'video', kind: 'generate', url: '/assets/brand/sherly-logo.mp4', width: 1080, height: 1920, duration_ms: 6000, meta: { kind: 'motion-graphics' } },
  // Landscape 16:9 — harus tetap 1 baris (compact).
  { id: 'a5', file_name: 'vid-horizontal-16x9.mp4', media_type: 'video', kind: 'generate', url: '/assets/brand/sherly-logo.mp4', width: 1920, height: 1080, duration_ms: 5000 },
  // D-257: video HORIZONTAL asli (1280x720) — harus masuk baris Horizontal.
  { id: 'aH', file_name: 'vid-horizontal-real.webm', media_type: 'video', kind: 'upload', url: '/assets/brand/fixture-horizontal.webm', width: 1280, height: 720, duration_ms: 1200 },
  // D-257: video VERTIKAL asli (720x1280) — harus masuk baris Vertikal.
  { id: 'aV', file_name: 'vid-vertical-real.webm', media_type: 'video', kind: 'upload', url: '/assets/brand/fixture-vertical.webm', width: 720, height: 1280, duration_ms: 1200 },
  // Gambar 4:5 & 3:4 — potret ringan.
  { id: 'a6', file_name: 'foto-4x5.png', media_type: 'image', kind: 'upload', url: '/assets/brand/sherly-logo-poster.png', width: 1080, height: 1350 },
  { id: 'a7', file_name: 'foto-3x4.png', media_type: 'image', kind: 'upload', url: '/assets/brand/sherly-logo-poster.png', width: 900, height: 1200 },
  ...Array.from({ length: 44 }, (_, i) => ({
    id: 'img' + i, file_name: 'foto-' + i + '.png', media_type: 'image', kind: 'upload',
    url: '/assets/brand/sherly-logo-poster.png', width: 1024, height: 1024,
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
  { name: 'PC', width: 1280, height: 900, mobile: false },
  { name: 'HP', width: 390, height: 844, mobile: true },
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
    // Matikan splash overlay (bikin screenshot HP tertutup).
    document.getElementById('splash')?.classList.add('done');
    document.getElementById('studioView')?.classList.add('active');
    document.querySelectorAll('.page-view').forEach((v) => { if (v.id !== 'studioView') v.classList.remove('active'); });
    // Di produksi `go('Studio')` menyembunyikan halaman Beranda (.layout).
    // Di test kita belum memanggil go(), jadi Beranda masih tampil.
    document.querySelector('.layout')?.style.setProperty('display', 'none', 'important');
  });
  await new Promise((r) => setTimeout(r, 1500));

  const before = await page.evaluate(() => {
    const c = document.querySelector('.st-composer');
    const g = document.getElementById('stGallery');
    const items = [...document.querySelectorAll('.st-gal-item')];
    const vid = document.querySelector('.st-gal-thumb video');
    const vidItem = vid?.closest('.st-gal-item');
    const vidRect = vid?.getBoundingClientRect();
    const img = document.querySelector('.st-gal-thumb img');
    const imgItem = img?.closest('.st-gal-item');
    return {
      docScrollH: document.documentElement.scrollHeight,
      viewH: window.innerHeight,
      composerTop: c?.getBoundingClientRect().top,
      composerBottom: c?.getBoundingClientRect().bottom,
      composerH: c?.getBoundingClientRect().height,
      galleryH: g?.getBoundingClientRect().height,
      stageOverflowY: getComputedStyle(document.querySelector('.st-stage')).overflowY,
      docOverflowY: getComputedStyle(document.documentElement).overflowY,
      itemCount: items.length,
      videoObjectFit: vid ? getComputedStyle(vid).objectFit : null,
      videoItemRatio: vidItem ? (vidItem.getBoundingClientRect().height / vidItem.getBoundingClientRect().width).toFixed(3) : null,
      videoRenderedRatio: vidRect ? (vidRect.height / vidRect.width).toFixed(3) : null,
      videoIntrinsicRatio: vid && vid.videoWidth ? (vid.videoWidth / vid.videoHeight).toFixed(3) : null,
      // D-258: masonry sejati -> jumlah kolom = jumlah wrapper `.st-gal-col`.
      verticalCols: (() => {
        const r = document.querySelector('.st-gal-row--vertical');
        if (!r) return 0;
        const n = r.getElementsByClassName('st-gal-col').length;
        if (n) return n;
        const cc = parseInt(getComputedStyle(r).columnCount, 10);
        return Number.isFinite(cc) && cc > 0 ? cc : 0;
      })(),
      horizontalCols: (() => {
        const r = document.querySelector('.st-gal-row--horizontal');
        if (!r) return 0;
        const n = r.getElementsByClassName('st-gal-col').length;
        if (n) return n;
        const cc = parseInt(getComputedStyle(r).columnCount, 10);
        return Number.isFinite(cc) && cc > 0 ? cc : 0;
      })(),
      // D-258: tinggi tiap kolom masonry harus sama -> tidak ada kotak kosong
      // di bawah kolom yang lebih pendek.
      colHeights: (() => {
        const out = {};
        document.querySelectorAll('.st-gal-row').forEach((r) => {
          const hs = [...r.getElementsByClassName('st-gal-col')].map((c) => Math.round(c.getBoundingClientRect().height));
          out[r.classList.contains('st-gal-row--vertical') ? 'v' : 'h'] = hs;
        });
        return out;
      })(),
      // Per baris: tinggi item + tinggi kolom. Toleransi rongga = tinggi 1
      // item DI BARIS ITU (sisa satu item boleh lebih pendek — standar grid).
      itemHByRow: (() => {
        const out = {};
        document.querySelectorAll('.st-gal-row').forEach((r) => {
          const key = r.classList.contains('st-gal-row--vertical') ? 'v' : 'h';
          const hs = [...r.getElementsByClassName('st-gal-col')].map((c) =>
            Math.round(c.getBoundingClientRect().height));
          const itemHs = [...r.querySelectorAll('.st-gal-item')].map((i) =>
            Math.round(i.getBoundingClientRect().height));
          // Toleransi rongga = tinggi 1 item TERBESAR di baris itu (sisa satu
          // item boleh lebih pendek -> standar grid).
          out[key] = { cols: hs, item: itemHs.length ? Math.max(...itemHs) : 0 };
        });
        return out;
      })(),
      rowHeights: (() => {
        const r = document.querySelector('.st-gal-row--vertical');
        return r ? Math.round(r.getBoundingClientRect().height) : 0;
      })(),
      rowWidths: {
        v: (() => { const r = document.querySelector('.st-gal-row--vertical'); return r ? Math.round(r.clientWidth) : 0; })(),
        h: (() => { const r = document.querySelector('.st-gal-row--horizontal'); return r ? Math.round(r.clientWidth) : 0; })(),
      },
      minCols: {
        v: getComputedStyle(document.querySelector('.st-gal-row--vertical')).getPropertyValue('--st-gal-mincol'),
        h: getComputedStyle(document.querySelector('.st-gal-row--horizontal')).getPropertyValue('--st-gal-mincol'),
      },
      imgItemRatio: imgItem ? (imgItem.getBoundingClientRect().height / imgItem.getBoundingClientRect().width).toFixed(3) : null,
    };
  });
  console.log('  BEFORE:', JSON.stringify(before));

  // 1) Halaman luar scroll natural (dokumen yang bergulir, bukan container internal).
  check(vp.name, 'halaman luar scrollable (docScrollH > viewport)', before.docScrollH > before.viewH + 50, `${before.docScrollH} > ${before.viewH}`);
  check(vp.name, 'galeri bukan scroll container internal', before.stageOverflowY === 'visible', `overflow-y=${before.stageOverflowY}`);
  check(vp.name, 'galeri mengalir di halaman (tinggi > viewport)', before.galleryH > before.viewH * 0.9, `galleryH=${Math.round(before.galleryH)}`);

  // 2) Composer nempel di bawah viewport SEBELUM scroll. Di HP ada tabbar
  //    bawah, jadi "dasar" yang benar = viewport - tinggi tabbar.
  const tabbarH = await page.evaluate(() => {
    const t = document.querySelector('.mobile-tabbar');
    if (!t || getComputedStyle(t).display === 'none') return 0;
    return t.getBoundingClientRect().height + (window.innerHeight - t.getBoundingClientRect().bottom);
  });
  const basePC = before.viewH;
  const baseHP = before.viewH - tabbarH;
  const base = vp.mobile ? baseHP : basePC;
  check(vp.name, 'composer nempel bawah (sebelum scroll)', Math.abs(before.composerBottom - base) < 30, `bottom=${before.composerBottom} vs ${base} (tabbar=${tabbarH})`);

  // 3) D-256: thumbnail potong rapi (cover) seperti kartu Beranda; aset utuh
  //    dilihat lewat preview (contain).
  check(vp.name, 'thumbnail object-fit cover (kartu ala Beranda)', before.videoObjectFit === 'cover', `object-fit=${before.videoObjectFit}`);
  // D-256: dua baris ala Beranda — HP: 3 grid vertikal, 2 grid horizontal.
  check(vp.name, 'baris VERTIKAL & HORIZONTAL terpisah ada',
    before.verticalCols > 0 && before.horizontalCols > 0,
    `vert=${before.verticalCols} horz=${before.horizontalCols}`);
  if (vp.name === 'HP') {
    check(vp.name, 'HP vertikal = 3 grid', before.verticalCols === 3, `vert=${before.verticalCols}`);
    check(vp.name, 'HP horizontal = 2 grid', before.horizontalCols === 2, `horz=${before.horizontalCols}`);
  }
  // D-258: semua kolom masonry sama tinggi -> tidak ada kotak kosong di
  // bawah kolom yang lebih pendek.
  const rows = before.itemHByRow || {};
  for (const [key, info] of Object.entries(rows)) {
    const hs = info.cols || [];
    if (!hs.length) continue;
    const min = Math.min(...hs), max = Math.max(...hs);
    // Rongga yang darf adalah lebih besar dari 1 item di baris itu
    // (1 item + jarak antar item masih wajar).
    const tol = (info.item || 0) + 12;
    check(vp.name, `tinggi kolom masonry ${key.toUpperCase()} sebanding (rongga <= 1 item)`,
      max - min <= tol, `tinggi=${JSON.stringify(hs)} toleransi=${Math.round(tol)}`);
    // D-258: kolom terpendek harus di UJUNG baris (kanan) -> rongga natural
    // seperti grid biasa, bukan di tengah konten.
    const minIdx = hs.indexOf(min);
    check(vp.name, `kolom terpendek di ujung baris ${key.toUpperCase()}`,
      minIdx === hs.length - 1 || minIdx === 0, `idx=${minIdx} dari ${hs.length}`);
  }
  // D-256: tinggi item portrait mengikuti rasio aset (9:16 -> h/w 1.778).
  const vr = Number(before.videoItemRatio);
  check(vp.name, 'item video portrait ikut rasio 9:16', Math.abs(vr - 16 / 9) < 0.08, `h/w=${vr}`);
  // D-258: rasio thumbnail DISERAGAMKAN per baris (median rasio aset) ->
  // semua item satu tinggi, kolom sama tinggi, tidak ada kotak kosong.
  // Item pertama yang diukur ada di baris Vertikal (9:16 -> h/w 1.78).
  check(vp.name, 'rasio thumbnail seragam per baris (tidak ada rongga besar)',
    Math.abs(Number(before.imgItemRatio) - 16 / 9) < 0.08, `h/w=${before.imgItemRatio}`);

  // Scroll ke bawah -> composer harus tetap nempel, tidak bergeser.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise((r) => setTimeout(r, 700));
  const after = await page.evaluate(() => {
    const c = document.querySelector('.st-composer');
    const r = c?.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      composerTop: r?.top,
      composerBottom: r?.bottom,
      viewportH: window.innerHeight,
      nempelBawah: r ? Math.abs(r.bottom - window.innerHeight) < 30 : null,
    };
  });
  console.log('  AFTER :', JSON.stringify(after));
  check(vp.name, 'halaman benar-benar bergulir', after.scrollY > 100, `scrollY=${after.scrollY}`);
  const afterBase = vp.mobile ? after.viewportH - tabbarH : after.viewportH;
  check(vp.name, 'composer nempel bawah (sesudah scroll)', Math.abs(after.composerBottom - afterBase) < 30, `bottom=${after.composerBottom} vs ${afterBase}`);
  check(vp.name, 'composer tidak bergeser', Math.abs(after.composerBottom - before.composerBottom) < 30, `${before.composerBottom} -> ${after.composerBottom}`);

  const tb = await page.evaluate(() => {
    const t = document.querySelector('.mobile-tabbar');
    const r = t?.getBoundingClientRect();
    return { h: r?.height, bottom: r?.bottom, top: r?.top, display: t ? getComputedStyle(t).display : null };
  });
  console.log('  TABBAR:', JSON.stringify(tb));
  const pack = await page.evaluate(() => {
    const box = document.getElementById('stGallery');
    const cs = box ? getComputedStyle(box) : null;
    const items = [...document.querySelectorAll('.st-gal-item')].slice(0, 12);
    return {
      cols: cs?.gridTemplateColumns,
      gridAutoRows: cs?.gridAutoRows,
      items: items.map((i) => ({ col: i.style.gridColumn, row: i.style.gridRow, h: i.style.height, r: i.style.aspectRatio,
        rectH: Math.round(i.getBoundingClientRect().height), rectW: Math.round(i.getBoundingClientRect().width) })),
    };
  });
  console.log('  PACK:', JSON.stringify(pack));
  const vis = await page.evaluate(() => {
    const sv = document.getElementById('studioView');
    const cs = sv ? getComputedStyle(sv) : null;
    const others = [...document.querySelectorAll('.page-view')].filter((v) => v.id !== 'studioView' && getComputedStyle(v).display !== 'none').map((v) => v.id + ':' + getComputedStyle(v).display);
    return { active: sv?.classList.contains('active'), display: cs?.display, visible: cs?.visibility, opacity: cs?.opacity, z: cs?.zIndex, others };
  });
  console.log('  STUDIO VIEW:', JSON.stringify(vis));
  // Interaksi: panel Pengaturan Konten harus terbuka & berada di layar.
  const inter = await page.evaluate(async () => {
    const pill = document.getElementById('stTypePill');
    pill?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    const panel = document.getElementById('stPop-settings');
    const r = panel?.getBoundingClientRect();
    const cs = panel ? getComputedStyle(panel) : null;
    const inView = r ? (r.top >= -5 && r.bottom <= window.innerHeight + 5 && r.width > 100) : false;
    return { open: !!panel?.classList.contains('open'), rect: r ? { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) } : null, pos: cs?.position, inView };
  });
  console.log('  PANEL:', JSON.stringify(inter));
  check(vp.name, 'panel Pengaturan terbuka & terlihat di layar', inter.open && inter.inView, JSON.stringify(inter));
  // Tutup panel lagi.
  await page.evaluate(() => {
    const p = document.getElementById('stPop-settings');
    p?.classList.remove('open');
  });

  // Lightbox preview aset harus menutupi layar (tidak terkurung dock).
  // D-255: di HP klik pertama = autoplay di tempat; klik kedua = lightbox.
  const lb = await page.evaluate(async () => {
    const item = document.querySelector('.st-gal-item');
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    let box = document.getElementById('stLightbox');
    if (!box?.querySelector('.st-lb-panel')) {
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
      box = document.getElementById('stLightbox');
    }
    const panel = box?.querySelector('.st-lb-panel');
    const r = panel?.getBoundingClientRect();
    const meta = box?.querySelector('.st-lb-meta');
    return { hasPanel: !!panel, rect: r ? { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) } : null,
      hasMeta: !!meta, metaText: (meta?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
      inView: r ? (r.top >= -5 && r.bottom <= window.innerHeight + 5) : false };
  });
  console.log('  LIGHTBOX:', JSON.stringify(lb));
  check(vp.name, 'lightbox preview aset tampil di layar', lb.hasPanel && lb.inView, JSON.stringify(lb));

  // D-257: video horizontal harus masuk baris HORIZONTAL, video vertikal ke
  // baris VERTIKAL (bukanvice versa).
  const orient = await page.evaluate(() => {
    const inRow = (sel, id) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const it = el.querySelector('[data-asset-open="' + id + '"]');
      return it ? it.closest('.st-gal-row')?.className || null : null;
    };
    const h = inRow('.st-gal-row--horizontal', 'aH');
    const v = inRow('.st-gal-row--vertical', 'aV');
    // Aset tanpa dimensi (video lama) juga boleh terdeteksi nanti.
    const noDim = document.querySelector('[data-asset-open="a4"]')?.closest('.st-gal-row')?.className || null;
    return { h, v, noDim };
  });
  console.log('  ORIENTASI:', JSON.stringify(orient));
  check(vp.name, 'video horizontal (1280x720) masuk baris HORIZONTAL',
    String(orient.h || '').includes('st-gal-row--horizontal'), JSON.stringify(orient.h));
  check(vp.name, 'video vertikal (720x1280) masuk baris VERTIKAL',
    String(orient.v || '').includes('st-gal-row--vertical'), JSON.stringify(orient.v));
  check(vp.name, 'lightbox menampilkan ukuran asli', lb.hasMeta && /px/.test(lb.metaText), lb.metaText);
  await page.evaluate(() => { document.getElementById('stLightbox')?.querySelector('[data-lb-close]')?.click(); });

  // D-255: autoplay video — PC: hover (pointerenter). HP: klik.
  const auto = await page.evaluate(async () => {
    const item = [...document.querySelectorAll('.st-gal-item')].find((i) => i.querySelector('video'));
    const v = item?.querySelector('video');
    if (!item || !v) return { skip: true };
    const before = { paused: v.paused, loop: v.loop, muted: v.muted };
    if (window.innerWidth <= 560) {
      item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      item.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 500));
    const playing = !v.paused && v.currentTime > 0;
    const cls = item.classList.contains('is-playing');
    return { before, playing, cls, currentTime: v.currentTime };
  });
  console.log('  AUTOPLAY:', JSON.stringify(auto));
  check(vp.name, 'video thumbnail punya loop + muted', auto.before?.loop === true && auto.before?.muted === true, JSON.stringify(auto.before));
  check(vp.name, (vp.mobile ? 'klik thumbnail' : 'hover thumbnail') + ' -> video autoplay', auto.playing === true, JSON.stringify(auto));
  check(vp.name, 'item video diberi penanda is-playing', auto.cls === true, JSON.stringify(auto));

  await page.screenshot({ path: `/tmp/studio-${vp.name.toLowerCase()}-bottom.png` });
  // Screenshot area baris HORIZONTAL (tempat kotak kosong pernah muncul).
  await page.evaluate(() => {
    document.querySelector('.st-gal-row--horizontal')?.scrollIntoView({ block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `/tmp/studio-${vp.name.toLowerCase()}-horizontal.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `/tmp/studio-${vp.name.toLowerCase()}-top.png` });
  // Screenshot Beranda untuk pembanding pola kartu.
  await page.evaluate(() => {
    document.querySelector('.layout')?.style.setProperty('display', 'grid', 'important');
    document.getElementById('studioView')?.classList.remove('active');
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `/tmp/beranda-${vp.name.toLowerCase()}.png` });
  await page.evaluate(() => {
    document.querySelector('.layout')?.style.setProperty('display', 'none', 'important');
    document.getElementById('studioView')?.classList.add('active');
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.close();
}

await browser.close();
server.kill('SIGTERM');

console.log('\n===============================');
if (failures.length) {
  console.log('GAGAL ' + failures.length + ' pemeriksaan:');
  failures.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
console.log('SEMUA LOLOS — D-254 OK');
