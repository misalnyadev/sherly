import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('public/index.html', 'utf8');
const studio = readFileSync('public/studio.js', 'utf8');

function buildStudio(fetchImpl) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  win.localStorage.clear();
  win.fetch = fetchImpl;
  win.sherlyGetAccessToken = async () => 'test-token';
  win.sherlyStoredToken = () => null;
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const doc = win.document;
  // #toast dipakai modul Studio untuk pesan; tanpa itu generate() melempar.
  doc.body.innerHTML = '<div id="studioRoot"></div><div id="toast"></div>';
  const script = doc.createElement('script');
  script.textContent = studio;
  doc.body.appendChild(script);
  return { win, doc };
}

const CATALOG = {
  ok: true, defaultModel: 'veo-3-1',
  models: [
    { id: 'veo-3-1', provider: 'kie', label: 'Veo 3.1', maker: 'Google', durations: [4, 6, 8],
      resolutions: ['720p', '1080p', '4k'], aspects: ['16:9', '9:16'], audio: true, firstLastFrame: true,
      note: 'n', tiers: [{ id: 'veo3_fast', label: 'Fast (hemat)' }],
      defaultTier: 'veo3_fast', defaultDuration: 8, defaultResolution: '720p', defaultAspect: '9:16' },
    { id: 'kling-3.0/video', provider: 'kie', label: 'Kling 3.0', maker: 'Kuaishou',
      durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      resolutions: ['720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], audio: true, firstLastFrame: true,
      note: 'n', tiers: [{ id: 'std', label: 'Standar' }],
      defaultTier: 'std', defaultDuration: 5, defaultResolution: '720p', defaultAspect: '9:16' },
  ],
};
const IMAGE_CATALOG = {
  ok: true, defaultModel: 'nano-banana-2',
  models: [
    { id: 'nano-banana-2', provider: 'kie', label: 'Nano Banana 2', maker: 'Google', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 10, note: 'n',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'nano-banana-pro', provider: 'kie', label: 'Nano Banana Pro', maker: 'Google', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 8, note: 'n',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'gpt-image-2-text-to-image', provider: 'kie', label: 'GPT Image 2', maker: 'OpenAI', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 16, note: 'n',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'bytedance/seedream-5.0-lite', provider: 'kie', label: 'Seedream 5.0 Lite', maker: 'ByteDance', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 10, note: 'n',
      defaultResolution: '1K', defaultAspect: '4:5' },
  ],
};
// Routing fetch berdasarkan URL: katalog video vs katalog gambar.
const PROMPT_BANK = {
  ok: true,
  entries: [
    { id: 't1', kind: 'template', label: 'Try Outfit', category: 'umum', content: 'full-body shot { outfit }', slots: ['outfit'], is_active: true },
    { id: 't2', kind: 'template', label: 'Drone View', category: 'kamera', content: 'aerial drone shot', slots: [], is_active: true },
    { id: 'b1', kind: 'block', label: 'Low Angle', category: 'kamera', content: 'low-angle shot', slots: [], is_active: true },
    { id: 'b2', kind: 'block', label: 'Golden Hour', category: 'cahaya', content: 'warm golden hour sunlight', slots: [], is_active: true },
    { id: 'b3', kind: 'block', label: 'No Cartoon', category: 'negative', content: 'no cartoon', slots: [], is_active: true },
    { id: 'b4', kind: 'block', label: 'Nonaktif', category: 'gaya', content: 'x', slots: [], is_active: false },
  ],
};

const okFetch = async (url) => {
  const u = String(url || '');
  const body = u.includes('/api/ai/image/models') ? IMAGE_CATALOG
    : u.includes('/api/prompt-bank') ? PROMPT_BANK
    : CATALOG;
  return { ok: true, json: async () => JSON.parse(JSON.stringify(body)) };
};

// --- D-202: judul & deskripsi halaman Studio dihapus ---

test('D-202: section studioView tidak punya page-heading (judul & deskripsi dihapus)', () => {
  const m = html.match(/<section id="studioView"[\s\S]*?<\/section>/);
  assert.ok(m, 'section studioView tidak ditemukan');
  assert.ok(!m[0].includes('page-heading'), 'masih ada page-heading di Studio');
  assert.ok(!m[0].includes('<h1>Studio</h1>'), 'judul Studio masih ada');
  assert.ok(!m[0].includes('Generator konten'), 'deskripsi Studio masih ada');
});

test('D-205/D-206: composer di bawah tapi ada ruang napas dari tepi layar', () => {
  // Jarak atas content = padding atas main 18 + topbar ~44 + margin 17 = 79px.
  // D-206: tinggi 100vh - 91px -> dasar view di y = 100vh - 12px (ruang napas 12px).
  assert.ok(/#studioView\.active\{[^}]*height:calc\(100vh - 91px\)/.test(html),
    'tinggi view Studio bukan calc(100vh - 91px)');
  // margin-bottom negatif menompah padding bawah main (28px) supaya tak ada celah dobel.
  assert.ok(/#studioView\.active\{[^}]*margin-bottom:-28px/.test(html),
    'margin-bottom penyaring celah bawah hilang');
  // studioRoot tanpa padding bawah -> komposer duduk persis di dasar view.
  assert.ok(/#studioRoot\{[^}]*padding-bottom:0/.test(html),
    'studioRoot masih punya padding-bottom (composer tidak menempel)');
  // Height lama (96px) bikin composer terangkat ~45px dari bawah.
  assert.ok(!/height:calc\(100vh - 96px\)/.test(html), 'tinggi view lama masih dipakai');
  // D-206: composer jangan nempel di batas layar bawah.
  assert.ok(!/height:calc\(100vh - 79px\)/.test(html),
    'tinggi 100vh - 79px membuat composer nempel di tepi layar');
});

test('D-202: tombol Unggah diposisikan di sudut kanan area Studio', () => {
  assert.ok(/\.st-upload-corner\{[^}]*position:absolute[^}]*top:0[^}]*right:0/.test(html),
    'kelas .st-upload-corner tidak posisi absolut kanan-atas');
  assert.ok(/#studioRoot\{[^}]*position:relative/.test(html), '#studioRoot tidak position:relative');
  assert.ok(studio.includes('st-upload-btn st-upload-corner'), 'tombol Unggah tidak memakai kelas corner');
  assert.ok(!studio.includes('st-topbar'), 'wrapper .st-topbar masih dipakai');
});

test('D-203: jenis konten jadi SATU kotak pilihan (pill), bukan dua tab', () => {
  const controlsIdx = studio.indexOf('class="st-controls"');
  const controls = studio.slice(controlsIdx, controlsIdx + 2200);
  assert.ok(controlsIdx > -1, 'baris kontrol tidak ditemukan');
  assert.ok(controls.includes('id="stTypePill"'), 'pill jenis konten bukan di baris kontrol komposer');
  assert.ok(studio.includes('id="stPop-type"'), 'popover jenis konten hilang');
  // Tidak ada lagi dua tab Foto/Video terpisah.
  assert.ok(!studio.includes('st-tabs-inline'), 'masih ada tab Foto/Video terpisah');
  assert.ok(!studio.includes('data-mode="photo"'), 'masih ada tab data-mode');
});

// --- D-207: Bank Prompt di Studio ---

test('D-207: pill Bank Prompt ada di baris kontrol, setelah Style', () => {
  const controls = studio.slice(studio.indexOf('class="st-controls"'), studio.indexOf('class="st-controls"') + 2600);
  const iStyle = controls.indexOf('stStylePill');
  const iPrompt = controls.indexOf('stPromptPill');
  assert.ok(iPrompt > -1, 'pill Bank Prompt tidak ada');
  assert.ok(iStyle > -1 && iStyle < iPrompt, 'pill Bank Prompt harus setelah Style');
});

test('D-207: popover Bank Prompt punya tab Template & Blok', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const pop = doc.getElementById('stPop-prompt');
  assert.ok(pop, 'popover prompt tidak ada');
  const tabs = [...pop.querySelectorAll('[data-pb-tab]')].map((t) => t.dataset.pbTab);
  assert.deepEqual(tabs, ['template', 'block'], 'tab Template/Blok tidak lengkap');
});

test('D-207: template yang dipilih mengisi komposer', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const pop = doc.getElementById('stPop-prompt');
  const btn = [...pop.querySelectorAll('[data-pb-template]')].find((b) => b.dataset.pbTemplate === 't2');
  assert.ok(btn, 'template Drone View tidak tampil');
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const val = doc.getElementById('stPrompt').value;
  assert.ok(val.includes('aerial drone shot'), 'isi template tidak masuk komposer: ' + val);
});

test('D-207: template ber-placeholder meminta isian user', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  let asked = null;
  win.prompt = (msg) => { asked = msg; return 'kemeja batik'; };
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const pop = doc.getElementById('stPop-prompt');
  const btn = [...pop.querySelectorAll('[data-pb-template]')].find((b) => b.dataset.pbTemplate === 't1');
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.ok(asked, 'placeholder template tidak meminta isian');
  assert.ok(/outfit/.test(asked), 'prompt isian tidak menyebut slot: ' + asked);
  const val = doc.getElementById('stPrompt').value;
  assert.ok(val.includes('kemeja batik'), 'isi slot tidak masuk komposer: ' + val);
});

test('D-207: blok nonaktif tidak muncul di popover', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const pop = doc.getElementById('stPop-prompt');
  // Beralih ke tab Blok.
  [...pop.querySelectorAll('[data-pb-tab]')].find((t) => t.dataset.pbTab === 'block')
    .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const labels = [...pop.querySelectorAll('[data-pb-block]')].map((b) => b.textContent);
  assert.ok(labels.some((l) => l.includes('Low Angle')), 'blok aktif tidak tampil');
  assert.ok(!labels.some((l) => l.includes('Nonaktif')), 'blok nonaktif ikut tampil');
});

test('D-207: blok terpilih menambah label pill', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  let pop = doc.getElementById('stPop-prompt');
  [...pop.querySelectorAll('[data-pb-tab]')].find((t) => t.dataset.pbTab === 'block')
    .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  pop = doc.getElementById('stPop-prompt');
  const btn = [...pop.querySelectorAll('[data-pb-block]')].find((b) => b.dataset.pbBlock === 'b1');
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const label = doc.querySelector('#stPromptPill b').textContent.trim();
  assert.equal(label, '1 blok', 'label pill blok tidak sesuai: ' + label);
});

test('D-207: prompt yang dikirim ke server memuat blok urut kategori', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  [...doc.getElementById('stPop-prompt').querySelectorAll('[data-pb-tab]')].find((t) => t.dataset.pbTab === 'block')
    .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  // Pilih blok: cahaya (b2), kamera (b1), negative (b3) — urutan pilihan sengaja dibalik.
  for (const id of ['b2', 'b1', 'b3']) {
    const btn = [...doc.getElementById('stPop-prompt').querySelectorAll('[data-pb-block]')].find((b) => b.dataset.pbBlock === id);
    assert.ok(btn, 'blok ' + id + ' tidak ada');
    btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  }
  const ta = doc.getElementById('stPrompt');
  ta.value = 'woman wearing casual outfit';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));

  let sent = null;
  const origFetch = win.fetch;
  win.fetch = async (url, opts) => {
    if (String(url).includes('/api/ai/image') && opts && opts.body) sent = JSON.parse(opts.body);
    return origFetch(url, opts);
  };
  doc.getElementById('stGenBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));

  assert.ok(sent, 'request generate tidak terkirim');
  const p = sent.prompt;
  const iSubject = p.indexOf('woman wearing casual outfit');
  const iCamera = p.indexOf('low-angle shot');
  const iLight = p.indexOf('warm golden hour sunlight');
  const iNegative = p.indexOf('no cartoon');
  assert.ok(iSubject > -1 && iCamera > -1 && iLight > -1 && iNegative > -1, 'bagian prompt hilang: ' + p);
  assert.ok(iSubject < iCamera, 'subject harus sebelum kamera');
  assert.ok(iCamera < iLight, 'kamera harus sebelum cahaya');
  assert.ok(iLight < iNegative, 'cahaya harus sebelum negative');
});

test('D-207: prompt akhir merakit blok urut kategori (kamera -> cahaya -> negative)', () => {
  // composedPrompt harus: prompt utama dulu, lalu blok per kategori, negative paling akhir.
  const fn = studio.slice(studio.indexOf('function composedPrompt'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('PROMPT_CATEGORY_ORDER'), 'composedPrompt tidak memakai urutan kategori');
  const orderIdx = body.indexOf('for (const cat of PROMPT_CATEGORY_ORDER)');
  assert.ok(orderIdx > -1, 'blok tidak dirakit per kategori');
  // Gaya visual & rasio tetap ditambahkan di akhir (perilaku lama).
  assert.ok(body.includes('Gaya visual'), 'suffix gaya hilang');
  assert.ok(body.includes('rasio aspek'), 'keterangan rasio hilang');
});

test('D-204: urutan baris kontrol FOTO — jenis konten, rasio, provider, model, style', () => {
  const controls = studio.slice(studio.indexOf('class="st-controls"'), studio.indexOf('class="st-controls"') + 2400);
  const iType = controls.indexOf('stTypePill');
  const iAspect = controls.indexOf('stAspectPill');
  const iEngine = controls.indexOf('stEnginePill');
  const iImgModel = controls.indexOf('stImgModelPill');
  const iStyle = controls.indexOf('stStylePill');
  assert.ok(
    iType > -1 && iAspect > -1 && iEngine > -1 && iImgModel > -1 && iStyle > -1,
    'elemen kontrol tidak lengkap');
  assert.ok(iType < iAspect, '1. jenis konten harus sebelum rasio');
  assert.ok(iAspect < iEngine, '2. rasio harus sebelum provider');
  assert.ok(iEngine < iImgModel, '3. provider harus sebelum model');
  assert.ok(iImgModel < iStyle, '4. model harus sebelum style');
});

test('D-204: label provider "Otomatis" ringkas (tanpa keterangan dalam kurung)', () => {
  assert.ok(!studio.includes('Otomatis (Kie'), 'label Otomatis masih panjang');
  assert.ok(studio.includes("['auto', 'Otomatis']"), 'label Otomatis tidak ringkas');
  // Penjelasan lengkap tetap tersedia di popover sebagai sub-label.
  assert.ok(studio.includes('Kie → Kustom → Gemini'), 'penjelasan auto hilang dari popover');
});

test('D-202: pilihan vertikal/horizontal tersedia di popover rasio', () => {
  assert.ok(studio.includes("'9:16', 'Vertikal (9:16)'"), 'opsi vertikal hilang');
  assert.ok(studio.includes("'16:9', 'Landscape (16:9)'"), 'opsi landscape hilang');
});

// --- D-202 + D-201: DOM nyata ---

test('D-203: hasil render — Unggah di sudut, pill jenis konten di bawah komposer', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  const upload = doc.getElementById('stUploadBtn');
  assert.ok(upload, 'tombol Unggah tidak dirender');
  assert.ok(upload.classList.contains('st-upload-corner'), 'kelas corner tidak ada di tombol Unggah');
  // Tombol Unggah berada di luar stage galeri (di pojok halaman).
  assert.ok(!upload.closest('.st-stage'), 'tombol Unggah masih di dalam stage');
  // Pill jenis konten ada di dalam baris kontrol composer.
  const typePill = doc.getElementById('stTypePill');
  assert.ok(typePill, 'pill jenis konten tidak dirender');
  assert.ok(typePill.closest('.st-controls'), 'pill jenis konten tidak di baris kontrol');
  // Tidak ada tab Foto/Video terpisah lagi.
  assert.equal(doc.querySelectorAll('.st-tab').length, 0, 'masih ada tab Foto/Video');
  // Popover jenis konten memuat dua pilihan: Foto & Video.
  typePill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const pop = doc.getElementById('stPop-type');
  assert.ok(pop.classList.contains('open'), 'popover jenis konten tidak terbuka');
  const opts = [...pop.querySelectorAll('button')].map((b) => b.dataset.v);
  assert.deepEqual(opts, ['photo', 'video'], 'pilihan jenis konten: ' + opts.join(','));
});

test('D-203: pilih jenis konten Video lewat satu kotak -> mode video aktif', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const pop = doc.getElementById('stPop-type');
  const video = [...pop.querySelectorAll('button')].find((b) => b.dataset.v === 'video');
  assert.ok(video, 'pilihan Video tidak ada');
  video.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  // Label pill jenis konten = Video.
  assert.equal(doc.querySelector('#stTypePill b').textContent.trim(), 'Video', 'label jenis konten');
  const wrap = doc.getElementById('stModelPillWrap');
  assert.ok(!wrap.classList.contains('st-hidden'), 'pill model video harus tampil');
  // Pill model gambar disembunyikan di mode video.
  const imgWrap = doc.getElementById('stImgModelPillWrap');
  assert.ok(imgWrap.classList.contains('st-hidden'), 'pill model gambar harus hidden di mode video');
});

test('D-201 (regresi): popover pilihan tetap membuka ke atas', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const origRect = win.Element.prototype.getBoundingClientRect;
  win.Element.prototype.getBoundingClientRect = function () {
    const r = origRect.call(this);
    if (this.classList && this.classList.contains('st-pill-wrap')) {
      return { ...r, top: 700, bottom: 740, height: 40, width: 120, left: 20, right: 140 };
    }
    return r;
  };
  const pill = doc.getElementById('stAspectPill');
  pill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const pop = doc.getElementById('stPop-aspect');
  assert.ok(pop.classList.contains('open'), 'popover rasio tidak terbuka');
  assert.ok(pop.classList.contains('pop-up'), 'popover bukan membuka ke atas');
  assert.ok(!pop.classList.contains('pop-down'), 'popover jatuh ke bawah');
});

test('D-205: ikon jenis konten ikut pilihan (Foto = gambar, Video = video)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const iconOf = (id) => {
    const el = doc.getElementById(id);
    const span = el && el.querySelector('[data-icon]');
    return span ? span.getAttribute('data-icon') : null;
  };
  // Default: Foto -> ikon gambar.
  assert.equal(iconOf('stTypePill'), 'image-plus', 'ikon jenis konten awal');
  // Pilih Video -> ikon harus berubah ke video (bukan tetap gambar).
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const pop = doc.getElementById('stPop-type');
  [...pop.querySelectorAll('button')].find((b) => b.dataset.v === 'video')
    .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(doc.querySelector('#stTypePill b').textContent.trim(), 'Video', 'label jenis konten');
  assert.equal(iconOf('stTypePill'), 'video', 'ikon jenis konten harus video saat mode Video');
});

test('D-205: ikon rasio ikut orientasi (vertikal = smartphone, horizontal = monitor)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const iconOf = () => {
    const span = doc.getElementById('stAspectPill').querySelector('[data-icon]');
    return span ? span.getAttribute('data-icon') : null;
  };
  const pickAspect = (v) => {
    doc.getElementById('stAspectPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    const pop = doc.getElementById('stPop-aspect');
    [...pop.querySelectorAll('button')].find((b) => b.dataset.v === v)
      .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  };
  pickAspect('9:16');
  assert.equal(doc.querySelector('#stAspectPill b').textContent.trim(), '9:16', 'label rasio');
  assert.equal(iconOf(), 'smartphone', 'rasio vertikal harus ikon smartphone');
  pickAspect('16:9');
  assert.equal(doc.querySelector('#stAspectPill b').textContent.trim(), '16:9', 'label rasio');
  assert.equal(iconOf(), 'monitor', 'rasio horizontal harus ikon monitor');
  pickAspect('4:5');
  assert.equal(iconOf(), 'smartphone', 'rasio potret harus ikon smartphone');
  pickAspect('1:1');
  assert.equal(iconOf(), 'monitor', 'rasio persegi harus ikon monitor (bukan vertikal)');
});

test('D-204: urutan Controls di DOM — jenis konten, rasio, provider, model, style', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const ctrl = doc.querySelector('.st-controls');
  // Cari indeks tiap kontrol di dalam baris kontrol (id bisa di button atau wrapper).
  const idxOf = (id) => [...ctrl.children].findIndex((c) => c.id === id || c.querySelector('#' + id));
  const order = ['stTypePill', 'stAspectPill', 'stEnginePill', 'stImgModelPill', 'stStylePill'];
  let prev = -1;
  for (const id of order) {
    const idx = idxOf(id);
    assert.ok(idx > -1, 'kontrol ' + id + ' tidak ada di baris kontrol');
    assert.ok(idx > prev, 'urutan salah: ' + id + ' tidak setelah elemen sebelumnya');
    prev = idx;
  }
  // Provider menampilkan label ringkas "Otomatis".
  assert.equal(doc.querySelector('#stEnginePill b').textContent.trim(), 'Otomatis', 'label provider');
});

test('D-203: pill model gambar menampilkan model Kie & bisa diganti', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const wrap = doc.getElementById('stImgModelPillWrap');
  assert.ok(wrap, 'pill model gambar tidak dirender');
  // Mode foto + mesin auto -> pill model gambar tampil.
  assert.ok(!wrap.classList.contains('st-hidden'), 'pill model gambar harus tampil di mode foto');
  const label = () => doc.querySelector('#stImgModelPill b').textContent.trim();
  assert.equal(label(), 'Nano Banana 2', 'label model gambar awal');
  // Buka popover -> berisi model Kie.
  doc.getElementById('stImgModelPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const pop = doc.getElementById('stPop-imgmodel');
  assert.ok(pop.classList.contains('open'), 'popover model gambar tidak terbuka');
  const models = [...pop.querySelectorAll('button')].map((b) => b.dataset.v);
  assert.ok(models.length >= 4, 'jumlah model gambar: ' + models.length);
  assert.ok(models.some((m) => m.includes('nano-banana')), 'model Banana tidak ada');
  assert.ok(models.some((m) => m.includes('gpt-image')), 'model GPT Image tidak ada');
  // Ganti ke GPT Image 2 -> label ikut berubah.
  const gpt = [...pop.querySelectorAll('button')].find((b) => b.dataset.v.includes('gpt-image'));
  gpt.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(label(), 'GPT Image 2', 'label setelah ganti model');
});

test('D-203: request gambar mengirim model & resolusi', () => {
  assert.ok(/model: state\.imageModel/.test(studio), 'model gambar tidak dikirim');
  assert.ok(/resolution: state\.imageResolution/.test(studio), 'resolusi gambar tidak dikirim');
  assert.ok(studio.includes('/api/ai/image/models'), 'endpoint katalog model gambar tidak dipakai');
});

test('D-200 (regresi): pilihan durasi tetap dinamis mengikuti model', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const typePop = doc.getElementById('stPop-type');
  [...typePop.querySelectorAll('button')].find((b) => b.dataset.v === 'video')
    .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const durText = () => doc.querySelector('#stDurPill .st-pill b').textContent.trim();
  assert.equal(durText(), '8 detik', 'durasi awal Veo');
  doc.getElementById('stModelPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const pop = doc.getElementById('stPop-model');
  const kling = [...pop.querySelectorAll('button')].find((b) => b.dataset.v === 'kling-3.0/video');
  assert.ok(kling, 'model Kling tidak ada di popover');
  kling.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(durText(), '5 detik', 'durasi setelah pilih Kling');
  assert.equal(doc.querySelector('#stModelPill b').textContent.trim(), 'Kling 3.0', 'label model');
});
