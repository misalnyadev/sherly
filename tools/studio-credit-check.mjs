// D-274 · Visual check badge kredit di komposer Studio.
// Menjalankan halaman Studio dengan API di-stub (katalog + saldo Kie),
// lalu memverifikasi badge tampil sebagai ANGKA di samping jenis konten
// dan berubah saat model / resolusi / durasi diganti.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PORT = 8231;
const CHROME = '/tmp/chromedeps/chromium';
// Chromium sandbox butuh library bawaan @sparticuz/chromium.
process.env.LD_LIBRARY_PATH = '/tmp/chromedeps/root/lib:' + (process.env.LD_LIBRARY_PATH || '');

const IMAGE_MODELS = [
  { id: 'nano-banana-2', provider: 'kie', label: 'Nano Banana 2', maker: 'Google', resolutions: ['1K', '2K', '4K'], aspects: ['1:1', '4:5'], maxReferences: 10, note: '', defaultResolution: '2K', defaultAspect: '4:5', credits: { '1K': 8, '2K': 12, '4K': 18 } },
  { id: 'gpt-image-2-text-to-image', provider: 'kie', label: 'GPT Image 2', maker: 'OpenAI', resolutions: ['1K', '2K', '4K'], aspects: ['1:1', '4:5'], maxReferences: 16, note: '', defaultResolution: '2K', defaultAspect: '4:5', credits: { '1K': 6, '2K': 10, '4K': 16 } },
  { id: 'gpt-image-2-6/flare-text-to-image', provider: 'kie', label: 'GPT Image 2.6', maker: 'OpenAI', resolutions: ['1K', '2K', '4K'], aspects: ['1:1', '4:5'], maxReferences: 16, note: '', defaultResolution: '2K', defaultAspect: '4:5', credits: { '1K': 7.82, '2K': 15.9, '4K': 26.43 } },
];
const VIDEO_MODELS = [
  { id: 'google/gemini-omni-flash-1-2', provider: 'kie', label: 'Omni 1.2 Flash', maker: 'Google', durations: [3, 8, 15], resolutions: ['360p', '720p', '1080p', '4k'], aspects: ['16:9', '9:16'], audio: true, maxReferences: 3, note: '', tiers: [{ id: 'standard', label: 'Standard' }], defaultTier: 'standard', defaultDuration: 8, defaultResolution: '720p', defaultAspect: '4:5', credits: { perSecond: { standard: { '360p': 4, '720p': 9, '1080p': 10, '4k': 22 } } } },
  { id: 'bytedance/seedance-2', provider: 'kie', label: 'Seedance 2.0', maker: 'ByteDance', durations: [4, 8, 15], resolutions: ['480p', '720p', '1080p'], aspects: ['16:9', '9:16'], audio: true, maxReferences: 3, note: '', tiers: [{ id: 'standard', label: 'Standard' }, { id: 'fast', label: 'Fast' }], defaultTier: 'standard', defaultDuration: 8, defaultResolution: '720p', defaultAspect: '4:5', credits: { perSecond: { fast: { '480p': 6.8, '720p': 15 }, standard: { '480p': 11.7, '720p': 24.8 } } } },
];

const server = spawn('node', ['tools/serve-static.mjs', 'public', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

// Stub API sebelum halaman dimuat.
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/ai/image/models')) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, defaultModel: 'nano-banana-2', models: IMAGE_MODELS }) });
  }
  if (url.includes('/api/ai/video/models')) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, defaultModel: 'google/gemini-omni-flash-1-2', models: VIDEO_MODELS }) });
  }
  if (url.includes('/api/ai/lipsync/models')) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, defaultModel: 'infinitalk/from-audio', models: [] }) });
  }
  if (url.includes('/api/ai/credits')) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, credits: 40 }) });
  }
  if (url.startsWith('http://localhost:' + PORT)) return req.continue();
  return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
});

// Paksa masuk ke view Studio.
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  window.toast = () => {};
  const view = document.getElementById('studioView');
  if (view) view.classList.add('active');
  // Render komposer Studio.
  if (typeof window.renderStudio === 'function') window.renderStudio();
});

await new Promise((r) => setTimeout(r, 1500));

const read = () => page.evaluate(() => {
  const badge = document.getElementById('stCreditBadge');
  const type = document.getElementById('stTypePill');
  if (!badge || !type) return null;
  const cs = getComputedStyle(badge);
  const typeRect = type.getBoundingClientRect();
  const badgeRect = badge.getBoundingClientRect();
  return {
    badgeText: badge.textContent.trim(),
    badgeVisible: !badge.classList.contains('st-hidden') && cs.display !== 'none',
    typeText: type.querySelector('b')?.textContent?.trim(),
    // posisi relatif: badge harus di sebelah kanan tombol jenis konten
    sameRow: Math.abs(badgeRect.top + badgeRect.height / 2 - (typeRect.top + typeRect.height / 2)) < 14,
    toRight: badgeRect.left >= typeRect.right - 4,
    gap: Math.round(badgeRect.left - typeRect.right),
    title: badge.getAttribute('title') || '',
  };
});

const photo = await read();
console.log('FOTO  ->', JSON.stringify(photo));

// Ganti ke model lain (GPT Image 2.6) lewat panel pengaturan.
await page.evaluate(() => {
  const pill = document.getElementById('stTypePill');
  pill?.click();
});
await new Promise((r) => setTimeout(r, 500));

// Pilih model gambar GPT Image 2.6 lewat panel Pengaturan (Kie engine).
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#stPop-settings button')].find((b) => b.textContent.includes('GPT Image 2.6'));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 400));
const photo26 = await read();
console.log('FOTO 2.6 ->', JSON.stringify(photo26));

// Beralih ke mode Video: pilih di panel Pengaturan lalu Simpan.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#stPop-settings button')].find((b) => b.textContent.trim() === 'Video');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const save = [...document.querySelectorAll('#stPop-settings button')].find((b) => b.textContent.includes('Simpan'));
  if (save) save.click();
});
await new Promise((r) => setTimeout(r, 600));
const video = await read();
console.log('VIDEO ->', JSON.stringify(video));

// Screenshot.
await page.screenshot({ path: 'artifacts/d274-credits-video.png', fullPage: false });

// Cek layout HP: badge tetap di samping jenis konten & tidak bikin overflow.
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 600));
const mobile = await read();
const overflow = await page.evaluate(() => {
  const c = document.querySelector('.st-controls');
  return c ? { scrollW: c.scrollWidth, clientW: c.clientWidth, overflow: c.scrollWidth > c.clientWidth + 2 } : null;
});
console.log('HP    ->', JSON.stringify(mobile), 'overflow:', JSON.stringify(overflow));
await page.screenshot({ path: 'artifacts/d274-credits-mobile.png', fullPage: false });

await browser.close();
server.kill();

const ok = photo && photo.badgeVisible && photo.badgeText === '12' && photo.sameRow && photo.toRight
  && video && video.badgeText === '72' && video.typeText === 'Video'
  && mobile && mobile.badgeVisible && !overflow?.overflow;
console.log(ok ? 'OK: badge [12] di samping jenis konten (PC + HP)' : 'GAGAL: ' + JSON.stringify({ photo, video, mobile, overflow }));
process.exit(ok ? 0 : 1);
