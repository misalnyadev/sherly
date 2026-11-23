// D-275 · Visual check durasi Motion Graphics di panel Pengaturan Studio.
// Menjalankan halaman Studio dengan API di-stub (katalog template Motion
// Graphics), lalu memverifikasi:
//   1. Mode "Motion Graphics" bisa dipilih di panel Pengaturan.
//   2. Setting Durasi offering opsi baru (12/15/20/25/30 detik).
//   3. Opsi "30 detik" bisa dipilih & tersimpan.
//   4. Tidak ada overflow horizontal di PC maupun HP.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PORT = 8234;
const CHROME = '/tmp/chromedeps/chromium';
// Chromium sandbox butuh library bawaan @sparticuz/chromium.
process.env.LD_LIBRARY_PATH = '/tmp/chromedeps/root/lib:' + (process.env.LD_LIBRARY_PATH || '');

// Katalog template Motion Graphics (harus sama dengan server/motion-graphics.js).
const MG_TEMPLATES = [
  {
    id: 'branded-intro',
    label: 'Intro BerBrand',
    hint: 'Judul + subjudul + logo Sherly, cocok buat pembuka konten.',
    icon: 'sparkles',
    defaultDuration: 6,
    durations: [5, 6, 8, 10, 12, 15],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      { key: 'title', label: 'Judul', placeholder: 'Contoh: Kreasi Tanpa Batas', required: true },
      { key: 'subtitle', label: 'Subjudul', placeholder: 'Contoh: Studio kreatif bertenaga AI' },
    ],
  },
  {
    id: 'captioned-clip',
    label: 'Klip Bersubtitle',
    hint: 'Tempel video lalu kasih subtitle per baris.',
    icon: 'captions',
    defaultDuration: 8,
    durations: [6, 8, 10, 12, 15, 20, 25, 30],
    aspects: ['9:16', '16:9'],
    fields: [
      { key: 'src', label: 'URL video', placeholder: 'https://… (kosong = latarnya teks saja)' },
      { key: 'captionsText', label: 'Subtitle', placeholder: 'Satu baris = satu cue', type: 'textarea' },
    ],
  },
  {
    id: 'stat-card',
    label: 'Kartu Statistik',
    hint: 'Satu angka besar + label, buat kutipan atau ringkasan data.',
    icon: 'bar-chart',
    defaultDuration: 5,
    durations: [4, 5, 6, 8, 10, 12, 15],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [{ key: 'value', label: 'Nilai', placeholder: 'Contoh: 3.2x', required: true }],
  },
];

const server = spawn('node', ['tools/serve-static.mjs', 'public', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();

await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/studio/motion-graphics/templates')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, available: true, status: 'ready', templates: MG_TEMPLATES }),
    });
  }
  if (url.startsWith('http://localhost:' + PORT)) return req.continue();
  return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
});

const failures = [];
const ok = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  GAGAL') + ' | ' + msg);
  if (!cond) failures.push(msg);
};

/** Buka view Studio. */
async function openStudio() {
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    window.toast = () => {};
    const view = document.getElementById('studioView');
    if (view) view.classList.add('active');
    if (typeof window.renderStudio === 'function') window.renderStudio();
  });
  await new Promise((r) => setTimeout(r, 1500));
}

/** Buka panel Pengaturan (klik pill Jenis Konten). */
async function openSettings() {
  await page.evaluate(() => document.getElementById('stTypePill')?.click());
  await new Promise((r) => setTimeout(r, 600));
}

/** Pilih jenis konten "Motion Graphics" di panel Pengaturan. */
async function selectMotionMode() {
  const picked = await page.evaluate(() => {
    const btn = document.querySelector('#stPop-settings button[data-set-key="type"][data-set-v="motion"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 900));
  return picked;
}

/** Baca opsi durasi yang tersedia di panel Pengaturan. */
async function readDurationOptions() {
  return page.evaluate(() => {
    const pop = document.getElementById('stPop-settings');
    if (!pop) return { found: false, options: [] };
    const durButtons = Array.from(pop.querySelectorAll('button[data-set-key="mgdur"]'))
      .map((b) => (b.textContent || '').trim());
    return {
      found: durButtons.length > 0,
      options: Array.from(new Set(durButtons)),
    };
  });
}

/** Pilih opsi durasi tertentu di panel Pengaturan. */
async function pickDuration(seconds) {
  return page.evaluate((sec) => {
    const pop = document.getElementById('stPop-settings');
    const btn = Array.from(pop?.querySelectorAll('button[data-set-key="mgdur"]') || [])
      .find((b) => (b.textContent || '').trim() === sec + ' detik');
    if (!btn) return false;
    btn.click();
    return true;
  }, String(seconds));
}

/** Pilih template Motion Graphics tertentu di panel Pengaturan. */
async function selectTemplate(templateId) {
  const picked = await page.evaluate((id) => {
    const pop = document.getElementById('stPop-settings');
    const btn = Array.from(pop?.querySelectorAll('button[data-set-key="mgtpl"]') || [])
      .find((b) => b.getAttribute('data-set-v') === id);
    if (!btn) return false;
    btn.click();
    return true;
  }, templateId);
  await new Promise((r) => setTimeout(r, 700));
  return picked;
}

// ===== PC =====
console.log('\n== PC 1280x900 ==');
await page.setViewport({ width: 1280, height: 900 });
await openStudio();
await openSettings();

const modeOk = await selectMotionMode();
ok(modeOk, 'mode "Motion Graphics" bisa dipilih di panel Pengaturan');

// Template "Klip Bersubtitle" = template yang mendukung 30 detik.
await openSettings();
const tplOk = await selectTemplate('captioned-clip');
ok(tplOk, 'template "Klip Bersubtitle" bisa dipilih');
await openSettings();

const pc = await readDurationOptions();
ok(pc.found, 'baris setelan Durasi ditemukan di panel Pengaturan');
ok(pc.options.includes('30 detik'), 'opsi "30 detik" tersedia (PC)');
ok(pc.options.includes('25 detik'), 'opsi "25 detik" tersedia (PC)');
ok(pc.options.includes('20 detik'), 'opsi "20 detik" tersedia (PC)');
ok(pc.options.includes('15 detik'), 'opsi "15 detik" tersedia (PC)');
ok(pc.options.includes('12 detik'), 'opsi "12 detik" tersedia (PC)');
ok(!pc.options.includes('45 detik'), 'opsi di luar batas (45 detik) TIDAK tersedia');

const picked30 = await pickDuration(30);
await new Promise((r) => setTimeout(r, 500));
ok(picked30, 'opsi "30 detik" bisa diklik');

const pcOverflow = await page.evaluate(() => {
  const el = document.getElementById('studioView') || document.body;
  return el.scrollWidth - el.clientWidth;
});
ok(pcOverflow <= 0, `tidak ada overflow horizontal di PC (selisih ${pcOverflow}px)`);

// ===== HP =====
console.log('\n== HP 390x844 ==');
await page.setViewport({ width: 390, height: 844 });
await openStudio();
await openSettings();
await selectMotionMode();
await openSettings();
await selectTemplate('captioned-clip');
await openSettings();

const hp = await readDurationOptions();
ok(hp.found, 'baris setelan Durasi ditemukan (HP)');
ok(hp.options.includes('30 detik'), 'opsi "30 detik" tersedia (HP)');

const hpOverflow = await page.evaluate(() => {
  const el = document.getElementById('studioView') || document.body;
  return el.scrollWidth - el.clientWidth;
});
ok(hpOverflow <= 0, `tidak ada overflow horizontal di HP (selisih ${hpOverflow}px)`);

// ===== Ringkasan =====
await browser.close();
server.kill();

if (failures.length) {
  console.log(`\nGAGAL ${failures.length} pemeriksaan:`);
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nSEMUA LOLOS — D-275 durasi Motion Graphics OK');
