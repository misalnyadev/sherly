// D-276 · Visual check Motion Graphics "Rangkaian Beat" + kolom suara TTS.
//
// Menjalankan halaman Studio dengan API di-stub (katalog template + daftar
// voice TTS), lalu memverifikasi:
//   1. Template "Rangkaian Beat" bisa dipilih di panel Pengaturan.
//   2. Field "Isi Beat" (textarea) + "Teks Tombol CTA" + "Naskah Voice-over"
//      + dropdown "Suara" tampil di bar isian Motion Graphics.
//   3. Dropdown suara berisi voice Gemini + Soniox + Voicemaker + TTSMaker.
//   4. Status engine cadangan TTS (Soniox utama) ditampilkan.
//   5. Tidak ada overflow horizontal di PC maupun HP.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PORT = 8241;
const CHROME = '/tmp/chromedeps/chromium';
process.env.LD_LIBRARY_PATH = '/tmp/chromedeps/root/lib:' + (process.env.LD_LIBRARY_PATH || '');

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
      { key: 'src', label: 'URL video', placeholder: 'https://…' },
      { key: 'captionsText', label: 'Subtitle', placeholder: 'Satu baris = satu cue', type: 'textarea' },
    ],
  },
  {
    id: 'stat-card',
    label: 'Kartu Statistik',
    hint: 'Satu angka besar + label.',
    icon: 'bar-chart',
    defaultDuration: 5,
    durations: [4, 5, 6, 8, 10, 12, 15],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [{ key: 'value', label: 'Nilai', placeholder: 'Contoh: 3.2x', required: true }],
  },
  {
    id: 'beat-sequence',
    label: 'Rangkaian Beat',
    hint: 'Video multi-bloc: hook, isi, lalu CTA.',
    icon: 'layers',
    defaultDuration: 15,
    durations: [10, 12, 15, 20, 25, 30],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {
        key: 'beatsText',
        label: 'Isi Beat',
        type: 'textarea',
        rows: 7,
        required: true,
        placeholder: '=== Hook ===\n3,2x lebih cepat produksi',
      },
      { key: 'ctaLabel', label: 'Teks Tombol CTA', placeholder: 'Contoh: Simpan Videonya' },
      {
        key: 'voiceoverText',
        label: 'Naskah Voice-over (opsional)',
        type: 'textarea',
        rows: 3,
        placeholder: 'Kosongkan kalau tidak mau suara.',
      },
      { key: 'voice', label: 'Suara (opsional)', type: 'select', placeholder: 'Pakai bawaan sistem' },
    ],
  },
];

const TTS_VOICES = {
  ok: true,
  voices: [
    { provider: 'gemini', id: 'Kore', label: 'Kore (wanita)', language: 'Bahasa Indonesia' },
    { provider: 'gemini', id: 'Puck', label: 'Puck (pria)', language: 'Bahasa Indonesia' },
    { provider: 'soniox', id: 'Sari', label: 'Sari', language: 'Bahasa Indonesia' },
    { provider: 'voicemaker', id: 'ai2-Ardi', label: 'Ardi', language: 'Bahasa Indonesia' },
    { provider: 'ttsmaker', id: 729, label: 'Citra', language: 'Bahasa Indonesia', limit: 1000 },
    { provider: 'ttsmaker', id: 270, label: 'Dewi', language: 'Bahasa Indonesia', limit: 1000 },
    { provider: 'ttsmaker', id: 700001, label: 'Sarah', language: 'Bahasa Sunda', limit: 500 },
  ],
  providers: ['gemini', 'soniox', 'voicemaker', 'ttsmaker'],
  emotions: [],
  // D-277: Soniox = fallback utama (tanpa langganan), TTSMaker = opsional (wajib subscribe).
  soniox: { configured: true },
  voicemaker: { configured: false },
  ttsmaker: { configured: true, quota: { quota: 100000, used: 1200, left: 98800 }, error: null },
};

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
  if (url.includes('/api/ai/tts/voices')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TTS_VOICES),
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

async function openSettings() {
  await page.evaluate(() => document.getElementById('stTypePill')?.click());
  await new Promise((r) => setTimeout(r, 600));
}

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

async function selectTemplate(templateId) {
  const picked = await page.evaluate((id) => {
    const pop = document.getElementById('stPop-settings');
    const btn = Array.from(pop?.querySelectorAll('button[data-set-key="mgtpl"]') || [])
      .find((b) => b.getAttribute('data-set-v') === id);
    if (!btn) return false;
    btn.click();
    return true;
  }, templateId);
  await new Promise((r) => setTimeout(r, 500));
  return picked;
}

/**
 * D-231: panel Pengaturan memakai draft — pilihan baru正式 berlaku setelah
 * tombol "Simpan" diklik. Tanpa ini mode/template belum tersimpan.
 */
async function saveSettings() {
  const clicked = await page.evaluate(() => {
    const b = document.getElementById('stSetSave');
    if (!b) return false;
    b.click();
    return true;
  });
  await new Promise((r) => setTimeout(r, 900));
  return clicked;
}

/** Baca isi bar Motion Graphics (stMotionBar). */
async function readMotionBar() {
  return page.evaluate(() => {
    const bar = document.getElementById('stMotionBar');
    if (!bar) return { found: false };
    const textarea = bar.querySelector('textarea[data-motion-field="beatsText"]');
    const voArea = bar.querySelector('textarea[data-motion-field="voiceoverText"]');
    const cta = bar.querySelector('input[data-motion-field="ctaLabel"]');
    const select = bar.querySelector('select[data-motion-field="voice"]');
    const note = bar.querySelector('.st-motion-tts-note');
    return {
      found: true,
      beatRows: textarea ? Number(textarea.getAttribute('rows')) : 0,
      hasBeat: Boolean(textarea),
      hasVoiceover: Boolean(voArea),
      hasCta: Boolean(cta),
      hasSelect: Boolean(select),
      options: select ? Array.from(select.options).map((o) => o.textContent.trim()) : [],
      note: note ? note.textContent.replace(/\s+/g, ' ').trim() : '',
    };
  });
}

async function readOverflow() {
  return page.evaluate(() => {
    const el = document.getElementById('studioView') || document.body;
    return el.scrollWidth - el.clientWidth;
  });
}

// ===== PC =====
console.log('\n== PC 1280x900 ==');
await page.setViewport({ width: 1280, height: 900 });
await openStudio();
await openSettings();
ok(await selectMotionMode(), 'mode "Motion Graphics" bisa dipilih');
await openSettings();
ok(await selectTemplate('beat-sequence'), 'template "Rangkaian Beat" bisa dipilih');
ok(await saveSettings(), 'tombol "Simpan" menerapkan pilihan');

const pc = await readMotionBar();
ok(pc.found, 'bar isian Motion Graphics tampil');
ok(pc.hasBeat, 'kolom "Isi Beat" (textarea) tampil');
ok(pc.beatRows >= 6, `kolom beat punya ruang cukup (${pc.beatRows} baris)`);
ok(pc.hasCta, 'kolom "Teks Tombol CTA" tampil');
ok(pc.hasVoiceover, 'kolom "Naskah Voice-over" tampil');
ok(pc.hasSelect, 'dropdown "Suara" tampil');
ok(
  pc.options.some((o) => o.includes('Sari')),
  'dropdown suara berisi voice Soniox (Sari)',
);
ok(
  pc.options.some((o) => o.includes('Ardi')),
  'dropdown suara berisi voice Voicemaker (Ardi)',
);
ok(
  pc.options.some((o) => o.includes('Citra')),
  'dropdown suara berisi voice TTSMaker (Citra)',
);
ok(
  pc.options.some((o) => o.includes('Sunda')),
  'dropdown suara menandai voice Bahasa Sunda',
);
ok(
  pc.options.some((o) => o.includes('Kore')),
  'dropdown suara berisi voice Gemini',
);
ok(
  /Soniox/.test(pc.note),
  'status engine cadangan Soniox tampil (catatan: "' + pc.note + '")',
);
ok(
  /98[.\s]?800/.test(pc.note),
  'status engine cadangan menampilkan sisa kuota (catatan: "' + pc.note + '")',
);

const pcOverflow = await readOverflow();
ok(pcOverflow <= 0, `tidak ada overflow horizontal di PC (selisih ${pcOverflow}px)`);

// ===== HP =====
console.log('\n== HP 390x844 ==');
await page.setViewport({ width: 390, height: 844 });
await openStudio();
await openSettings();
await selectMotionMode();
await openSettings();
await selectTemplate('beat-sequence');
await saveSettings();

const hp = await readMotionBar();
ok(hp.hasBeat, 'kolom "Isi Beat" tampil di HP');
ok(hp.hasSelect, 'dropdown "Suara" tampil di HP');
const hpOverflow = await readOverflow();
ok(hpOverflow <= 0, `tidak ada overflow horizontal di HP (selisih ${hpOverflow}px)`);

await browser.close();
server.kill();

console.log('');
if (failures.length) {
  console.log('GAGAL (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('SEMUA LOLOS — D-276 Rangkaian Beat + suara TTS OK');
