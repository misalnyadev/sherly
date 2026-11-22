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

  // 3) Video 9:16 tidak terpotong.
  check(vp.name, 'video 9:16 object-fit contain', before.videoObjectFit === 'contain', `object-fit=${before.videoObjectFit}`);
  // Rasio diukur tinggi/lebar — untuk 9:16 (tinggi/lebar) = 1.778.
  check(vp.name, 'item video ikut rasio portrait (9:16)', Math.abs(Number(before.videoItemRatio) - 16 / 9) < 0.05, `h/w=${before.videoItemRatio}`);
  check(vp.name, 'gambar tetap kotak 1:1', Math.abs(Number(before.imgItemRatio) - 1) < 0.05, `ratio=${before.imgItemRatio}`);

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
  const lb = await page.evaluate(async () => {
    document.querySelector('.st-gal-item')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    const box = document.getElementById('stLightbox');
    const panel = box?.querySelector('.st-lb-panel');
    const r = panel?.getBoundingClientRect();
    return { hasPanel: !!panel, rect: r ? { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) } : null,
      inView: r ? (r.top >= -5 && r.bottom <= window.innerHeight + 5) : false };
  });
  console.log('  LIGHTBOX:', JSON.stringify(lb));
  check(vp.name, 'lightbox preview aset tampil di layar', lb.hasPanel && lb.inView, JSON.stringify(lb));
  await page.evaluate(() => { document.getElementById('stLightbox')?.querySelector('[data-lb-close]')?.click(); });

  await page.screenshot({ path: `/tmp/studio-${vp.name.toLowerCase()}-bottom.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `/tmp/studio-${vp.name.toLowerCase()}-top.png` });
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
