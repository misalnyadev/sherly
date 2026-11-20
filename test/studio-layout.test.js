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

test('D-207/D-208: pill Bank Prompt ada di baris judul prompt (bukan baris kontrol)', () => {
  const controls = studio.slice(studio.indexOf('class="st-controls"'), studio.indexOf('class="st-controls"') + 2600);
  // D-210: pill Prompt pindah ke baris judul prompt, di ATAS kotak komposer.
  assert.ok(studio.includes('stPromptPill'), 'pill Bank Prompt tidak ada');
  assert.ok(!controls.includes('stPromptPill'), 'pill Bank Prompt masih di baris kontrol');
  const controls2 = studio.slice(studio.indexOf('class="st-controls"'), studio.indexOf('class="st-controls"') + 2600);
  assert.ok(controls2.includes('stImgModelPill'), 'pill Model gambar hilang dari baris kontrol');
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
  // D-213/D-214: item menu "Prompt" menampilkan jumlah blok (span judul), tombol menu (b).
  const label = doc.querySelector('#stPromptPill span:not([data-icon])').textContent.trim();
  assert.equal(label, '1 blok', 'label item menu blok tidak sesuai: ' + label);
  const menuLabel = doc.querySelector('#stPromptMenuBtn b').textContent.trim();
  assert.equal(menuLabel, '1 blok', 'label tombol menu blok tidak sesuai: ' + menuLabel);
});

test('D-213: aksi prompt jadi menu dropdown di dalam kotak composer (1 baris)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const box = doc.getElementById('stPrompt').closest('.st-mention-box');
  assert.ok(box, 'kotak prompt tidak ditemukan');
  // D-213: baris judul LAMA (.st-prompt-head) dihapus supaya header composer pendek.
  assert.equal(doc.querySelector('.st-prompt-head'), null, 'baris judul lama harus dihapus (D-213)');
  // D-214: baris menu aksi ada di baris ATAS composer (st-composer-top), 1 baris.
  const row = doc.querySelector('.st-tools-menu-row');
  assert.ok(row, 'baris menu aksi tidak ada');
  const top = doc.querySelector('.st-composer-top');
  assert.ok(top, 'baris atas composer tidak ada');
  assert.ok(top.contains(row), 'baris menu harus di baris atas composer');
  // Referensi (karakter/gambar) SEBARIS dengan menu, bukan baris terpisah.
  assert.ok(top.contains(doc.getElementById('stAssetHeader')), 'header aset harus sebaris dengan menu');
  assert.equal(row.children.length, 1, 'baris menu harus 1 elemen (1 baris)');
  // Tombol menu utama (compact, bukan 4 tombol lebar).
  const btn = doc.getElementById('stPromptMenuBtn');
  assert.ok(btn, 'tombol menu utama tidak ada');
  assert.ok(btn.classList.contains('st-menu-btn'), 'tombol menu harus pakai .st-menu-btn');
  // 4 aksi ada sebagai item menu, urut Reset - Prompt - Optimalkan - Copy.
  const items = [...doc.querySelectorAll('#stPop-actions .st-menu-item')];
  assert.equal(items.length, 4, 'harus ada 4 item menu');
  assert.deepEqual(items.map((i) => i.id),
    ['stResetPromptBtn', 'stPromptPill', 'stOptimizeBtn', 'stCopyPromptBtn'],
    'urutan item menu harus Reset - Prompt - Optimalkan - Copy');
  // Tiap item punya ikon (data-icon, sesuai pola ICONS app) + tulisan.
  for (const it of items) {
    const ic = it.querySelector('[data-icon]');
    assert.ok(ic, 'item ' + it.id + ' harus punya ikon');
    assert.ok(ic.getAttribute('data-icon'), 'ikon item ' + it.id + ' harus punya nama');
    assert.ok(it.textContent.trim().length > 0, 'item ' + it.id + ' harus punya tulisan');
  }
  // Textarea tetap di bawah baris menu.
  const ta = doc.getElementById('stPrompt');
  // D-214: baris menu di baris ATAS composer, mendahului textarea (FOLLOWING = 4).
  const topEl = doc.querySelector('.st-composer-top');
  assert.ok(topEl.contains(row), 'baris menu harus di baris atas composer');
  assert.ok(
    row.compareDocumentPosition(ta) & 4,
    'baris menu harus mendahului textarea'
  );
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
  // D-208: suffix gaya dihapus (gaya jadi template transparan), rasio tetap.
  assert.ok(!body.includes('Gaya visual'), 'suffix gaya lama harus dihapus (D-208)');
  assert.ok(body.includes('rasio aspek'), 'keterangan rasio hilang');
});

test('D-204/D-208: urutan baris kontrol FOTO — jenis konten, rasio, provider, model', () => {
  const controls = studio.slice(studio.indexOf('class="st-controls"'), studio.indexOf('class="st-controls"') + 2400);
  const iType = controls.indexOf('stTypePill');
  const iAspect = controls.indexOf('stAspectPill');
  const iEngine = controls.indexOf('stEnginePill');
  const iImgModel = controls.indexOf('stImgModelPill');
  assert.ok(
    iType > -1 && iAspect > -1 && iEngine > -1 && iImgModel > -1,
    'elemen kontrol tidak lengkap');
  assert.ok(iType < iAspect, '1. jenis konten harus sebelum rasio');
  assert.ok(iAspect < iEngine, '2. rasio harus sebelum provider');
  assert.ok(iEngine < iImgModel, '3. provider harus sebelum model');
  // D-210: pill Prompt pindah ke baris judul prompt (di atas kotak composer).
  assert.ok(controls.indexOf('stPromptPill') === -1, 'pill Prompt harus keluar dari baris kontrol (D-210)');
  // D-208: pill Style dihapus (gaya jadi template transparan di Bank Prompt).
  assert.ok(controls.indexOf('stStylePill') === -1, 'pill Style harus dihapus (D-208)');
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

test('D-204: urutan Controls di DOM — jenis konten, rasio, provider, model', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const ctrl = doc.querySelector('.st-controls');
  // Cari indeks tiap kontrol di dalam baris kontrol (id bisa di button atau wrapper).
  const idxOf = (id) => [...ctrl.children].findIndex((c) => c.id === id || c.querySelector('#' + id));
  const order = ['stTypePill', 'stAspectPill', 'stEnginePill', 'stImgModelPill'];
  let prev = -1;
  for (const id of order) {
    const idx = idxOf(id);
    assert.ok(idx > -1, 'kontrol ' + id + ' tidak ada di baris kontrol');
    assert.ok(idx > prev, 'urutan salah: ' + id + ' tidak setelah elemen sebelumnya');
    prev = idx;
  }
  // D-213: aksi prompt jadi menu dropdown di dalam composer, bukan di baris kontrol.
  assert.equal(idxOf('stPromptPill'), -1, 'item Prompt harus di menu, bukan di baris kontrol');
  const menu = doc.getElementById('stPop-actions');
  assert.ok(menu, 'menu aksi prompt tidak ada');
  assert.ok(menu.querySelector('#stPromptPill'), 'item Prompt tidak di menu');
  assert.ok(menu.querySelector('#stOptimizeBtn'), 'item Optimalkan tidak di menu');
  assert.ok(menu.querySelector('#stCopyPromptBtn'), 'item Copy tidak di menu');
  assert.ok(menu.querySelector('#stResetPromptBtn'), 'item Reset tidak di menu');
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

// ===== D-210: jendela pilih prompt di tengah layar HP =====

test('D-210/D-213: di HP jendela pilih prompt jadi panel tengah layar', async () => {
  const { win, doc } = buildStudio(okFetch);
  // Simulasi lebar layar HP.
  Object.defineProperty(win, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: 844, configurable: true });
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  // Buka menu aksi dulu, lalu pilih item "Prompt".
  doc.getElementById('stPromptMenuBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const pop = doc.getElementById('stPop-prompt');
  assert.ok(pop.classList.contains('open'), 'jendela prompt tidak terbuka');
  assert.ok(pop.classList.contains('st-pop-center'), 'jendela prompt tidak diposisikan di tengah layar');
  // Menu aksi tertutup saat jendela prompt terbuka.
  assert.ok(!doc.getElementById('stPop-actions').classList.contains('open'), 'menu aksi harus tertutup');
});

test('D-210: di desktop jendela prompt tetap popover (bukan panel tengah)', async () => {
  const { win, doc } = buildStudio(okFetch);
  Object.defineProperty(win, 'innerWidth', { value: 1280, configurable: true });
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const pop = doc.getElementById('stPop-prompt');
  assert.ok(!pop.classList.contains('st-pop-center'), 'desktop tidak boleh panel tengah');
});

test('D-213: markup menu aksi di dalam composer & tanpa baris judul lama', () => {
  const iComposer = studio.indexOf('class="st-composer"');
  const iMenu = studio.indexOf('st-tools-menu-row');
  assert.ok(iComposer > -1, 'kotak composer tidak ada');
  assert.ok(iMenu > -1, 'baris menu aksi tidak ada');
  // Baris menu ada DI DALAM composer (setelah tag pembuka composer).
  assert.ok(iMenu > iComposer, 'baris menu harus di dalam kotak composer');
  // Baris judul lama dihapus.
  assert.ok(!studio.includes('class="st-prompt-head"'), 'baris judul lama harus dihapus (D-213)');
  // Menu utama + 4 item aksi ada.
  assert.ok(studio.includes('stPromptMenuBtn'), 'tombol menu utama tidak ada');
  for (const id of ['stResetPromptBtn', 'stPromptPill', 'stOptimizeBtn', 'stCopyPromptBtn']) {
    assert.ok(studio.includes(id), 'item menu ' + id + ' tidak ada');
  }
});

test('D-213: menu aksi & textarea berada di dalam composer', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  const root = doc.getElementById('studioRoot');
  const composer = doc.querySelector('.st-composer');
  assert.equal(composer.parentElement, root, 'composer harus anak langsung studioRoot');
  // Baris menu & textarea di DALAM composer.
  const row = doc.querySelector('.st-tools-menu-row');
  const ta = doc.getElementById('stPrompt');
  assert.ok(composer.contains(row), 'baris menu harus di dalam composer');
  assert.ok(composer.contains(ta), 'textarea harus di dalam composer');
  // Baris menu mendahului textarea di DOM (DOCUMENT_POSITION_FOLLOWING = 4).
  assert.ok(
    row.compareDocumentPosition(ta) & 4,
    'baris menu harus mendahului textarea'
  );
});

test('D-213: baris menu aksi 1 baris & rata kanan (desktop & HP)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const row = doc.querySelector('.st-tools-menu-row');
  // Satu elemen saja -> tidak mungkin jadi 2 baris.
  assert.equal(row.children.length, 1, 'baris menu harus 1 elemen (1 baris)');
  assert.ok(row.classList.contains('st-tools-menu-row'), 'harus kelas .st-tools-menu-row');
  // CSS: baris atas composer = referensi + menu sebaris (tidak vertikal).
  const css = readFileSync('public/index.html', 'utf8');
  const topRule = css.match(/\.st-composer-top\{[^}]*\}/);
  assert.ok(topRule, 'aturan .st-composer-top tidak ada');
  assert.ok(topRule[0].includes('display:flex'), 'baris atas composer harus flex');
  assert.ok(!topRule[0].includes('flex-direction:column'), 'baris atas composer jangan vertikal');
  assert.ok(topRule[0].includes('align-items:center'), 'isi baris atas composer harus rata tengah');
  const rowRule = css.match(/\.st-tools-menu-row\{[^}]*\}/);
  assert.ok(rowRule, 'aturan .st-tools-menu-row tidak ada');
  assert.ok(!rowRule[0].includes('flex-direction:column'), 'baris menu jangan jadi vertikal');
  // Menu utama tidak boleh jadi lebar penuh (bentuk compact).
  const btnRule = css.match(/\.st-menu-btn\{[^}]*\}/);
  assert.ok(btnRule, 'aturan .st-menu-btn tidak ada');
  assert.ok(btnRule[0].includes('border-radius:10px'), 'tombol menu harus bentuk petak');
  assert.ok(btnRule[0].includes('color:#fff'), 'tulisan tombol menu harus putih');
});

// ===== D-212: 4 tombol aksi prompt seragam petak, warna putih, + tombol Reset =====

test('D-213: 4 item menu aksi prompt seragam (ikon + tulisan putih)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const items = [...doc.querySelectorAll('#stPop-actions .st-menu-item')];
  assert.equal(items.length, 4, 'harus ada 4 item menu aksi prompt');
  for (const b of items) {
    assert.ok(b.classList.contains('st-menu-item'), 'item ' + b.id + ' harus pakai .st-menu-item');
    assert.ok(b.querySelector('[data-icon]'), 'item ' + b.id + ' harus punya ikon');
    assert.ok(b.textContent.trim().length > 0, 'item ' + b.id + ' harus punya tulisan');
  }
});

test('D-213: CSS menu — ikon & tulisan putih, bentuk petak', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Tulisan putih pada tombol menu & item menu.
  assert.ok(css.includes('.st-menu-btn b{color:#fff'), 'tulisan <b> di tombol menu harus putih');
  assert.ok(css.includes('.st-menu-item span{color:#fff'), 'tulisan item menu harus putih');
  // Ikon putih (stroke) di tombol menu & item menu.
  assert.ok(/\.st-menu-btn \[data-icon\][^{]*\{[^}]*stroke:#fff/.test(css), 'ikon tombol menu harus putih');
  assert.ok(/\.st-menu-item \[data-icon\][^{]*\{[^}]*stroke:#fff/.test(css), 'ikon item menu harus putih');
  // Bentuk petak.
  assert.ok(/\.st-menu-btn\{[^}]*border-radius:10px/.test(css), 'tombol menu harus petak');
  // Tombol menu utama compact (tidak melebar penuh).
  assert.ok(/\.st-menu-btn\{[^}]*padding:6px 11px/.test(css), 'tombol menu harus ringkas');
});

test('D-212: tombol Reset membersihkan komposer dari prompt', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const ta = doc.getElementById('stPrompt');
  ta.value = 'promo kopi susu untuk anak muda';
  const btn = doc.getElementById('stResetPromptBtn');
  assert.ok(btn, 'tombol Reset tidak ada');
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(ta.value, '', 'Reset harus mengosongkan isi prompt');
  // Label kembali ke "Prompt" (blok terpilih dilepas) — di item menu & tombol menu.
  assert.equal(doc.querySelector('#stPromptPill span:not([data-icon])').textContent.trim(), 'Prompt',
    'label item menu harus kembali ke Prompt setelah Reset');
  assert.equal(doc.querySelector('#stPromptMenuBtn b').textContent.trim(), 'Prompt',
    'label tombol menu harus kembali ke Prompt setelah Reset');
});

test('D-212: Reset menutup jendela pilih prompt yang sedang terbuka', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const pop = doc.getElementById('stPop-prompt');
  assert.ok(pop.classList.contains('open'), 'jendela prompt tidak terbuka');
  doc.getElementById('stResetPromptBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.ok(!pop.classList.contains('open'), 'Reset harus menutup jendela prompt');
});

test('D-213: tombol menu membuka daftar 4 aksi, item Prompt membuka popover Bank Prompt', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  const menu = doc.getElementById('stPop-actions');
  const pop = doc.getElementById('stPop-prompt');
  // Menu awalnya tertutup.
  assert.ok(!menu.classList.contains('open'), 'menu harus tertutup saat awal');
  // Klik tombol menu -> terbuka.
  doc.getElementById('stPromptMenuBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.ok(menu.classList.contains('open'), 'menu tidak terbuka setelah klik tombol');
  // Pilih item "Prompt" -> menu tertutup, popover Bank Prompt terbuka.
  doc.getElementById('stPromptPill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert.ok(!menu.classList.contains('open'), 'menu harus tertutup setelah pilih Prompt');
  assert.ok(pop.classList.contains('open'), 'popover Bank Prompt harus terbuka');
});

test('D-213: item Reset & Copy dari menu tetap menjalankan aksinya', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  // Reset lewat menu.
  const ta = doc.getElementById('stPrompt');
  ta.value = 'promo kopi susu';
  doc.getElementById('stPromptMenuBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  doc.getElementById('stResetPromptBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(ta.value, '', 'Reset dari menu harus mengosongkan prompt');
  assert.ok(!doc.getElementById('stPop-actions').classList.contains('open'), 'menu harus tertutup setelah Reset');
  // Copy lewat menu: teks tersalin (clipboard di-stub).
  let copied = null;
  Object.defineProperty(win.navigator, 'clipboard', {
    value: { writeText: async (t) => { copied = t; } }, configurable: true,
  });
  ta.value = 'promo kopi susu';
  doc.getElementById('stPromptMenuBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  doc.getElementById('stCopyPromptBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert.ok(copied && copied.includes('promo kopi susu'), 'Copy dari menu harus menyalin isi prompt');
});

// ===== D-214: ikon tampil, menu tanpa keterangan, referensi sebaris dengan menu =====

test('D-214: ICONS diexpose ke window supaya ikon studio.js tampil', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes('window.ICONS = ICONS'),
    'ICONS harus di-expose ke window (const di script lain tidak terjangkau)');
  // Helper icon() di studio.js memakai window.ICONS sebagai fallback.
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('window.ICONS'), 'icon() harus fallback ke window.ICONS');
});

test('D-214: item menu prompt tidak punya keterangan (hanya ikon + judul)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const items = [...doc.querySelectorAll('#stPop-actions .st-menu-item')];
  assert.equal(items.length, 4, 'harus ada 4 item menu');
  const expected = ['Reset', 'Prompt', 'Optimalkan', 'Copy'];
  items.forEach((it, i) => {
    assert.equal(it.querySelectorAll('small').length, 0, 'item ' + it.id + ' tidak boleh punya keterangan');
    assert.ok(it.querySelector('[data-icon]'), 'item ' + it.id + ' harus punya ikon');
    // Teks item = judulnya saja (tanpa keterangan).
    const title = it.querySelector('span:not([data-icon])');
    assert.ok(title, 'item ' + it.id + ' harus punya judul');
    assert.equal(title.textContent.trim(), expected[i], 'judul item ' + it.id + ' tidak sesuai');
  });
});

test('D-214: judul item menu tidak kembar (span ikon vs span judul terpisah)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const pp = doc.getElementById('stPromptPill');
  const title = pp.querySelector('span:not([data-icon])');
  assert.equal(title.textContent.trim(), 'Prompt', 'judul item Prompt tidak boleh kembar');
  // Setelah updatePillLabels pun tetap satu kata.
  const { win: w2, doc: d2 } = buildStudio(okFetch);
  await w2.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const pp2 = d2.getElementById('stPromptPill');
  assert.equal(pp2.querySelector('span:not([data-icon])').textContent.trim(), 'Prompt');
});

test('D-214: referensi karakter/gambar SEBARIS dengan menu dropdown prompt', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const top = doc.querySelector('.st-composer-top');
  assert.ok(top, 'baris atas composer tidak ada');
  // Header aset & baris menu adalah dua anak sebaris di baris yang sama.
  const kids = [...top.children];
  assert.equal(kids.length, 2, 'baris atas composer harus 2 anak (referensi + menu)');
  assert.ok(kids[0].classList.contains('st-asset-header'), 'anak pertama = header aset');
  assert.ok(kids[1].classList.contains('st-tools-menu-row'), 'anak kedua = baris menu');
  // Header aset TIDAK lagi anak langsung composer (bukan baris terpisah).
  const composer = doc.querySelector('.st-composer');
  assert.notEqual(doc.getElementById('stAssetHeader').parentElement, composer,
    'header aset tidak boleh baris terpisah di atas composer');
  // CSS: baris atas composer flex, rata tengah, tidak vertikal.
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-composer-top\{[^}]*\}/);
  assert.ok(rule, 'aturan .st-composer-top tidak ada');
  assert.ok(rule[0].includes('display:flex'), 'harus flex (sebaris)');
  assert.ok(rule[0].includes('align-items:center'), 'harus rata tengah');
  assert.ok(!rule[0].includes('flex-direction:column'), 'jangan vertikal (naik 2 baris)');
});

// ===== D-215: referensi = icon foto saja, info muncul saat hover =====

test('D-215: item referensi karakter hanya avatar + badge (tanpa nama, tanpa kapsul)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function renderAssetHeader'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Tidak ada nama karakter yang ditampilkan.
  assert.ok(!body.includes('st-asset-name'), 'nama karakter tidak boleh dirender (D-215)');
  // Ada avatar (foto) + badge penanda + tooltip.
  assert.ok(body.includes('st-asset-face'), 'avatar karakter harus ada');
  assert.ok(body.includes('st-asset-badge'), 'badge penanda harus ada');
  assert.ok(body.includes('st-asset-tip'), 'tooltip info harus ada');
  // Badge & tombol hapus tetap ada.
  assert.ok(body.includes('st-asset-x'), 'tombol hapus harus ada');
  assert.ok(body.includes('data-asset-tip'), 'atribut tooltip harus ada');
});

test('D-215: CSS — header referensi tanpa kapsul & tooltip hanya saat hover', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Header: tanpa background/border kapsul, 1 baris (nowrap).
  // Ambil aturan .st-asset-header yang UTAMA (bukan .st-composer-top .st-asset-header).
  const headRules = [...css.matchAll(/\.st-asset-header\{[^}]*\}/gs)].map((m) => m[0]);
  // Aturan utama = yang mengatur layout header (bukan hanya flex dalam .st-composer-top).
  const head = headRules.find((r) => r.includes('flex-wrap:nowrap')) || headRules[0];
  assert.ok(head, 'aturan .st-asset-header tidak ada');
  assert.ok(head.includes('background:transparent'), 'header tidak boleh punya background kapsul');
  assert.ok(head.includes('flex-wrap:nowrap'), 'header harus 1 baris (nowrap)');
  // Tooltip: hidden by default, tampil saat hover.
  const tip = css.match(/\.st-asset-tip\{[^}]*\}/s);
  assert.ok(tip, 'aturan .st-asset-tip tidak ada');
  assert.ok(tip[0].includes('opacity:0'), 'tooltip harus tersembunyi awal');
  assert.ok(tip[0].includes('pointer-events:none'), 'tooltip tidak bolehhalang klik');
  const hover = css.match(/\.st-asset:hover \.st-asset-tip[^\{]*\{[^}]*opacity:1/);
  assert.ok(hover, 'tooltip harus muncul saat hover');
  // Tombol hapus: muncul saat hover saja.
  const x = css.match(/\.st-asset-x\{[^}]*\}/s);
  assert.ok(x, 'aturan .st-asset-x tidak ada');
  assert.ok(x[0].includes('opacity:0'), 'tombol hapus harus tersembunyi awal');
  const xHover = css.match(/\.st-asset:hover \.st-asset-x[^\{]*\{[^}]*opacity:1/);
  assert.ok(xHover, 'tombol hapus harus muncul saat hover');
  // Aturan nama lama dibuang.
  assert.ok(!css.includes('.st-asset-name{'), 'aturan .st-asset-name harus dihapus');
});

test('D-215: badge penanda & tombol hapus tidak menambah lebar baris', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Badge & tombol hapus absolute -> tidak menambah lebar item.
  const badge = css.match(/\.st-asset-badge\{[^}]*\}/s);
  assert.ok(badge, 'aturan .st-asset-badge tidak ada');
  assert.ok(badge[0].includes('position:absolute'), 'badge harus absolute (hemat tempat)');
  const x = css.match(/\.st-asset-x\{[^}]*\}/s);
  assert.ok(x, 'aturan .st-asset-x tidak ada');
  assert.ok(x[0].includes('position:absolute'), 'tombol hapus harus absolute (hemat tempat)');
  // Aturan .st-asset UTAMA (bukan turunan .st-asset-char / .st-asset-scene).
  const itemRules = [...css.matchAll(/\.st-asset\{[^}]*\}/gs)].map((m) => m[0]);
  const item = itemRules.find((r) => r.includes('position:relative')) || itemRules[0];
  assert.ok(item, 'aturan .st-asset tidak ada');
  assert.ok(!item.includes('background:#24142a'), 'item tidak boleh pakai kapsul lama');
  assert.ok(!item.includes('border-radius:22px'), 'item tidak boleh bulat seperti kapsul');
});

// ===== D-216: mention = satu-satunya selector aset (gambar + karakter) =====

test('D-216: mention picker menampilkan karakter DAN aset gambar', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // mentionCandidates -> gabungan dua sumber.
  assert.ok(studio.includes('function mentionCandidates()'), 'mentionCandidates hilang');
  const fn = studio.slice(studio.indexOf('function mentionCandidates'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("kind: 'char'"), 'kandidat karakter harus ada');
  assert.ok(body.includes("kind: 'asset'"), 'kandidat aset gambar harus ada');
  // Loop dua sumber: characters + assets.
  assert.ok(body.includes('for (const c of characters)'), 'harus iterasi characters');
  assert.ok(body.includes('for (const a of assets)'), 'harus iterasi assets');
  // Grup label di picker.
  const render = studio.slice(studio.indexOf('function renderMention'));
  const rbody = render.slice(0, render.indexOf('\n  }'));
  assert.ok(rbody.includes('st-mention-group'), 'harus ada grup label');
  assert.ok(rbody.includes('Karakter'), 'grup Karakter harus ada');
  assert.ok(rbody.includes('Aset Gambar'), 'grup Aset Gambar harus ada');
});

test('D-216: aset yang di-mention masuk ke header composer sebagai referensi', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Token slug aset -> parser mention aset.
  assert.ok(studio.includes('function assetTokenSlug('), 'assetTokenSlug hilang');
  assert.ok(studio.includes('function mentionedAssetIds()'), 'mentionedAssetIds hilang');
  assert.ok(studio.includes('async function syncMentionedAssetRefs()'), 'syncMentionedAssetRefs hilang');
  // Header me-render semua sceneRefs (bukan hanya satu sceneRef).
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const hbody = hdr.slice(0, hdr.indexOf('\n  }'));
  assert.ok(hbody.includes('for (const r of sceneRefs)'), 'header harus iterasi semua sceneRefs');
  // addSceneRef/removeSceneRef managing daftar.
  assert.ok(studio.includes('function addSceneRef('), 'addSceneRef hilang');
  assert.ok(studio.includes('function removeSceneRef('), 'removeSceneRef hilang');
  // Hook ke input textarea.
  assert.ok(studio.includes('syncMentionedAssetRefs();'), 'sinkronisasi harus dipanggil dari input');
});

test('D-216: petak referensi (karakter & gambar) berbentuk KOTAK', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const faceRules = [...css.matchAll(/\.st-asset-face\{[^}]*\}/gs)].map((m) => m[0]);
  const face = faceRules.find((r) => r.includes('border-radius')) || faceRules[0];
  assert.ok(face, 'aturan .st-asset-face tidak ada');
  assert.ok(face.includes('border-radius:8px'), 'avatar karakter harus KOTAK (bukan bulat)');
  assert.ok(!face.includes('border-radius:50%'), 'avatar karakter tidak boleh bulat');
  // Gambar referensi juga kotak (ambil aturan UTAMA, bukan turunan hover).
  const sceneRules = [...css.matchAll(/\.st-asset-scene-img\{[^}]*\}/gs)].map((m) => m[0]);
  const scene = sceneRules.find((r) => r.includes('border-radius')) || sceneRules[0];
  assert.ok(scene, 'aturan .st-asset-scene-img tidak ada');
  assert.ok(scene.includes('border-radius:8px'), 'gambar referensi harus kotak');
  // Thumbnail di mention picker juga kotak.
  assert.ok(css.includes('.st-mention-face-box{border-radius:7px}'), 'thumbnail mention harus kotak');
});

// ===== D-217: outline karakter + kursor composer HP =====

test('D-217: avatar karakter pakai outline (garis luar) sebagai penanda status', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Outline lewat ::after di sekeliling avatar (bukan badge filled).
  assert.ok(css.includes('.st-asset-char .st-asset-face::after'), 'outline karakter harus ada');
  const outline = css.match(/\.st-asset-char \.st-asset-face::after\{[^}]*\}/s);
  assert.ok(outline, 'aturan outline tidak ada');
  assert.ok(outline[0].includes('inset:-3px'), 'outline harus di luar avatar');
  assert.ok(outline[0].includes('border:1.5px solid #ff9bdc'), 'outline harus garis pink');
  assert.ok(outline[0].includes('opacity:0'), 'outline default transparan');
  // Karakter dengan suara/sheet -> outline tampil.
  assert.ok(css.includes('.st-asset-char.has-voice .st-asset-face::after,.st-asset-char.has-sheet .st-asset-face::after{opacity:1}'),
    'outline harus tampil untuk has-voice / has-sheet');
  // Badge jadi ikon kecil outline (bukan filled circle gelap).
  const badge = css.match(/\.st-asset-badge\{[^}]*\}/s);
  assert.ok(badge, 'aturan .st-asset-badge tidak ada');
  assert.ok(badge[0].includes('border:1px solid #ff9bdc'), 'badge harus outline pink');
  assert.ok(!badge[0].includes('background:#0f1828'), 'badge tidak boleh filled gelap');
});

test('D-217: markup menandai kelas has-voice / has-sheet', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes("' has-voice'"), 'kelas has-voice harus ada di markup');
  assert.ok(studio.includes("' has-sheet'"), 'kelas has-sheet harus ada di markup');
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const body = hdr.slice(0, hdr.indexOf('\n  }'));
  assert.ok(body.includes('has-voice'), 'renderAssetHeader harus menambah kelas has-voice');
  assert.ok(body.includes('has-sheet'), 'renderAssetHeader harus menambah kelas has-sheet');
});

test('D-217: kursor composer ikut naik sesuai baris yang diketik', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('const scrollCaretIntoView = () => {'), 'scrollCaretIntoView harus ada');
  const fn = studio.slice(studio.indexOf('const scrollCaretIntoView'));
  const body = fn.slice(0, fn.indexOf('\n    };'));
  // Posisi caret -> baris -> offset.
  assert.ok(body.includes('ta.selectionStart'), 'harus membaca selectionStart');
  assert.ok(body.includes('lineHeight'), 'harum mengukur line-height');
  assert.ok(body.includes('ta.scrollTop'), 'harus mengatur scrollTop');
  // Dipanggil pada event yang relevan.
  assert.ok(studio.includes("ta?.addEventListener('keyup'"), 'keyup harus memicu scroll');
  assert.ok(studio.includes("ta?.addEventListener('click'"), 'click harus memicu scroll');
  assert.ok(studio.includes("ta?.addEventListener('focus', scrollCaretIntoView)"), 'focus harus memicu scroll');
  // Tidak boleh pakai variabel global yang tak terdefinisi.
  assert.ok(!body.includes('win.getComputedStyle'), 'harus pakai window.getComputedStyle');
});
