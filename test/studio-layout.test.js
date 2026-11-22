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


/**
 * D-247: klik pill jenis konten kini membuka PANEL PENGATURAN (HP & PC sama).
 * Helper ini membuka panel lalu memilih jenis konten dari grup "Jenis Konten".
 */
async function pickContentType(win, doc, kind) {
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const panel = doc.getElementById('stPop-settings');
  const btn = [...panel.querySelectorAll('[data-set-key="type"]')].find((b) => b.dataset.setV === kind);
  assert.ok(btn, 'pilihan jenis konten "' + kind + '" harus ada di panel pengaturan');
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  // D-231: panel pengaturan menerapkan semua setelan sekaligus saat Simpan.
  doc.getElementById('stSetSave').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
}


/**
 * D-247: pilih jenis konten dari PANEL pengaturan lalu tekan Simpan.
 * Mengembalikan fungsi click untuk dipakai lanjutan test.
 */
async function pickTypeWithPanel(win, doc, kind) {
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  click(doc.getElementById('stTypePill'));
  await new Promise((r) => setTimeout(r, 60));
  const panel = doc.getElementById('stPop-settings');
  const btn = [...panel.querySelectorAll('[data-set-key="type"]')].find((b) => b.dataset.setV === kind);
  assert.ok(btn, 'pilihan "' + kind + '" harus ada di panel pengaturan');
  click(btn);
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  return click;
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
  // D-265: tombol Unggah bukan lagi absolute di pojok — sekarang jadi elemen
  // FLOW di baris atas area Studio (`.st-stage-top`), tetap di sisi KANAN
  // (margin-left:auto), sebaris dengan baris filter logo.
  assert.ok(/\.st-stage-top\{[^}]*display:flex[^}]*align-items:center/.test(html),
    '.st-stage-top harus flex row');
  assert.ok(/\.st-stage-top \.st-upload-btn\{[^}]*margin-left:auto/.test(html),
    'tombol Unggah harus terdorong ke kanan (margin-left:auto)');
  assert.ok(studio.includes('class="st-upload-btn" id="stUploadBtn"'),
    'tombol Unggah harus ada di dalam baris atas');
  assert.ok(studio.indexOf('id="stUploadBtn"') > studio.indexOf('<div class="st-stage-top">'),
    'tombol Unggah harus di dalam .st-stage-top');
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
  // 4 aksi ada sebagai item menu, urut Reset - Prompt - Optimasi - Copy.
  const items = [...doc.querySelectorAll('#stPop-actions .st-menu-item')];
  assert.equal(items.length, 4, 'harus ada 4 item menu');
  assert.deepEqual(items.map((i) => i.id),
    ['stResetPromptBtn', 'stPromptPill', 'stOptimizeBtn', 'stCopyPromptBtn'],
    'urutan item menu harus Reset - Prompt - Optimasi - Copy');
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
  // D-265: tombol Unggah berada di baris atas (`.st-stage-top`), di luar stage galeri.
  assert.ok(upload.closest('.st-stage-top'), 'tombol Unggah harus di dalam .st-stage-top');
  assert.ok(!upload.closest('.st-stage'), 'tombol Unggah masih di dalam stage');
  // D-265: baris atas juga jadi tempat filter logo (Semua/Foto/Video).
  const filters = doc.getElementById('stGalFilters');
  assert.ok(filters, 'baris filter tidak dirender');
  assert.ok(filters.closest('.st-stage-top'), 'filter harus sebaris dengan tombol Unggah');
  assert.ok(!doc.querySelector('#stGallery .st-gal-filters'), 'filter tidak boleh di dalam galeri');
  // Pill jenis konten ada di dalam baris kontrol composer.
  const typePill = doc.getElementById('stTypePill');
  assert.ok(typePill, 'pill jenis konten tidak dirender');
  assert.ok(typePill.closest('.st-controls'), 'pill jenis konten tidak di baris kontrol');
  // Tidak ada tab Foto/Video terpisah lagi.
  assert.equal(doc.querySelectorAll('.st-tab').length, 0, 'masih ada tab Foto/Video');
  // D-247: klik pill jenis konten membuka PANEL pengaturan (HP & PC sama).
  typePill.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));
  const panel = doc.getElementById('stPop-settings');
  assert.ok(panel.classList.contains('open'), 'panel pengaturan tidak terbuka');
  const opts = [...panel.querySelectorAll('[data-set-key="type"]')].map((b) => b.dataset.setV);
  // D-249: mode "Motion Graphics" ikut jadi pilihan jenis konten.
  assert.deepEqual(opts, ['photo', 'video', 'lipsync', 'motion'], 'pilihan jenis konten: ' + opts.join(','));
});

test('D-203: pilih jenis konten Video lewat satu kotak -> mode video aktif', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  await pickContentType(win, doc, 'video');
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
  await pickContentType(win, doc, 'video');
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
  // D-221: pill pengaturan kini berada di dalam container .st-settings-pills
  // (display:contents di desktop -> urutan visual tetap sama).
  // D-221: pill pengaturan kini di dalam container .st-settings-pills
  // (display:contents di desktop -> urutan visual tetap sama). Bandingkan
  // urutan dengan compareDocumentPosition (document order), bukan index children.
  const nodeOf = (id) => doc.getElementById(id);
  const idxOf = (id) => {
    const n = nodeOf(id);
    if (!n || !ctrl.contains(n)) return -1;
    return [...ctrl.querySelectorAll('*')].indexOf(n);
  };
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
  await pickContentType(win, doc, 'video');
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
  // D-254: composer dibungkus dock (position:fixed) supaya nempel di bawah
  // viewport sepanjang halaman. Dock = anak langsung studioRoot.
  const dock = doc.querySelector('.st-composer-dock');
  assert.ok(dock, 'dock composer harus ada');
  assert.equal(dock.parentElement, root, 'dock harus anak langsung studioRoot');
  assert.equal(composer.parentElement, dock, 'composer harus anak dock');
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
  // Ambil rule .st-menu-btn YANG ADA border-radius:10px (bukan rule ringkas
  // di @media(max-height:520px) yang muncul lebih dulu di file).
  const btnRules = [...css.matchAll(/\.st-menu-btn\{([^}]*)\}/g)].map((m) => m[1]);
  const btnRule = btnRules.find((b) => b.includes('border-radius:10px')) || btnRules[0] || '';
  assert.ok(btnRule, 'aturan .st-menu-btn tidak ada');
  assert.ok(btnRule.includes('border-radius:10px'), 'tombol menu harus bentuk petak');
  assert.ok(btnRule.includes('color:#fff'), 'tulisan tombol menu harus putih');
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
  const expected = ['Reset', 'Prompt', 'Optimasi', 'Copy'];
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
  assert.ok(/\.st-mention-face-box\{[^}]*border-radius:7px/.test(css), 'thumbnail mention harus kotak');
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
  // D-227: badge = kertas hitam polos tanpa border (bukan kotak pink).
  const badge = css.match(/\.st-asset-badge\{[^}]*\}/s);
  assert.ok(badge, 'aturan .st-asset-badge tidak ada');
  assert.ok(/border:0(;|\s)/.test(badge[0]), 'badge tanpa border (D-227)');
  assert.ok(!badge[0].includes('background:#0f1828'), 'badge tidak boleh filled gelap');
  // Ikonnya tetap outline pink (garis, bukan filled).
  const svgRule = css.match(/\.st-asset-badge svg\{[^}]*\}/s);
  assert.ok(svgRule, 'aturan svg badge tidak ada');
  assert.ok(svgRule[0].includes('fill:none'), 'ikon badge harus outline (fill:none)');
  assert.ok(svgRule[0].includes('stroke:#ff9bdc'), 'ikon badge harus pink');
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
  assert.ok(studio.includes("ta?.addEventListener('focus', scheduleCaretScroll)"), 'focus harus memicu scroll');
  // Tidak boleh pakai variabel global yang tak terdefinisi.
  assert.ok(!body.includes('win.getComputedStyle'), 'harus pakai window.getComputedStyle');
});

// ===== D-218: badge outline di DALAM kotak karakter + kursor pas di teks =====

test('D-218: badge penanda = ikon outline (posisi diatur D-227)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const badge = css.match(/\.st-asset-badge\{[^}]*\}/s);
  assert.ok(badge, 'aturan .st-asset-badge tidak ada');
  const rule = badge[0];
  // D-227 supersede posisi: sekarang KERTAS HITAM tanpa border, nempel di
  // tepi kanan + bawah bagian dalam kotak avatar. Yang diuji di sini:
  // ikon svg tetap outline (fill:none) & ikon kecil.
  // D-227: bentuk = kertas hitam tanpa border (bukan filled bulat / kotak pink).
  assert.ok(/border:0(;|\s)/.test(rule), 'badge tanpa border (D-227)');
  assert.ok(/width:1[234]px/.test(rule), 'badge kecil (12-14px)');
  // Ikon SVG-nya outline (tanpa isian).
  const svg = css.match(/\.st-asset-badge svg\{[^}]*\}/s);
  assert.ok(svg, 'aturan svg badge tidak ada');
  assert.ok(svg[0].includes('fill:none'), 'ikon badge harus outline (fill:none)');
  assert.ok(svg[0].includes('stroke:#ff9bdc'), 'ikon badge harus pink');
});

test('D-218: kursor composer di HP pas di teks, tidak nongol ke atas', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('const scrollCaretIntoView'));
  const body = fn.slice(0, fn.indexOf('\n    };'));
  // Offset caret harus memperhitungkan border textarea juga.
  assert.ok(body.includes('borderTop'), 'harus menghitung border-top textarea');
  assert.ok(body.includes('m.borderTop + m.paddingTop'), 'offset caret = border + padding');
  // Saat caret di atas area view -> scroll ke baris itu (bukan ke paling atas).
  assert.ok(body.includes('caretTop < ta.scrollTop'), 'kondisi scroll ke atas harus ada');
  assert.ok(body.includes('ta.scrollTop = Math.max(0, caretTop - m.borderTop - m.paddingTop)'), 'scroll ke baris caret');
  // Saat caret melewati bawah -> geser tepat seperlunya.
  assert.ok(body.includes('caretTop + m.lineHeight > viewBottom'), 'kondisi scroll ke bawah harus ada');
  assert.ok(body.includes('ta.scrollTop = Math.max(0, caretTop + m.lineHeight - clientH)'), 'scroll ke bawah tepat seperlunu');
  // Tidak boleh scroll ke 0 saat caret ada di baris jauh.
  assert.ok(!body.includes('ta.scrollTop = 0;'), 'scroll tidak boleh di-reset ke 0');
});

test('D-218: kursor ikutadjust saat caret berpindah (selectionchange)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes("ta?.addEventListener('selectionchange', scheduleCaretScroll)"),
    'textarea harus listen selectionchange');
  assert.ok(studio.includes("document.addEventListener('selectionchange'"), 'document harus listen selectionchange');
  assert.ok(studio.includes('document.activeElement === ta'), 'hanya saat textarea aktif');
});

// ===== D-219: badge icon user, thumbnail mention, kursor stabil =====

test('D-219: badge penanda pakai icon user (bukan mic)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const hbody = hdr.slice(0, hdr.indexOf('\n  }'));
  assert.ok(hbody.includes("icon('user')"), 'badge profil suara harus pakai icon user');
  assert.ok(!hbody.includes("icon('mic')"), 'badge tidak boleh pakai icon mic');
  // Mention picker juga.
  const ren = studio.slice(studio.indexOf('function renderMention'));
  const rbody = ren.slice(0, ren.indexOf('\n  }'));
  assert.ok(rbody.includes("icon('user')"), 'penanda di mention picker harus icon user');
  // ICONS harus punya 'user' & 'user-round' (dipakai sidebar/settings).
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes("user:'<path"), "ICONS harus punya ikon 'user'");
  // Kunci dengan tanda hubung WAJIB quoted ('user-round':) — kalau tidak, inline
  // script index.html gagal parse & seluruh aplikasi ikut rusak.
  assert.ok(html.includes("'user-round':'<"), "ICONS harus punya ikon 'user-round' (dipakai nav & settings)");
  assert.ok(!html.includes(" user-round:'<"), "kunci 'user-round' harus quoted, bukan identifier mentah");
});

test('D-219: thumbnail di daftar mention benar-benar tampil', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Gambar di dalam face harus full-size.
  assert.ok(css.includes('.st-mention-face img{width:100%;height:100%;object-fit:cover;display:block'),
    'img di mention face harus full-size');
  // Kotak putih dihindari: ada handling gambar rusak.
  assert.ok(css.includes('.st-mention-face img.is-broken{display:none}'), 'gambar rusak harus disembunyikan');
  // Thumbnail aset pakai <img> (bukan <video>) supaya konsisten.
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('function mentionAssetThumb('), 'mentionAssetThumb harus ada');
  const fn = studio.slice(studio.indexOf('function mentionAssetThumb'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('<img src='), 'mention thumb harus pakai img');
  assert.ok(!body.includes('<video'), 'mention thumb tidak boleh pakai elemen video');
  // Dipakai di item picker.
  assert.ok(studio.includes('mentionAssetThumb(a)'), 'mentionAssetThumb harus dipakai di picker');
});

test('D-219: kursor composer stabil — autoFit preservasi scroll, metrik di-cache', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // autoFit harus menyimpan & mengembalikan scrollTop.
  const fit = studio.slice(studio.indexOf('const autoFit = () => {'));
  const fbody = fit.slice(0, fit.indexOf('\n    };'));
  assert.ok(fbody.includes('const keepScroll = ta.scrollTop'), 'autoFit harus menyimpan scrollTop');
  assert.ok(fbody.includes('ta.scrollTop = keepScroll'), 'autoFit harus mengembalikan scrollTop');
  // Metrik textarea di-cache (line-height tidak stale).
  assert.ok(studio.includes('let taMetrics = null'), 'metrik textarea harus di-cache');
  assert.ok(studio.includes('const readMetrics = () => {'), 'readMetrics harus ada');
  const rm = studio.slice(studio.indexOf('const readMetrics = () => {'));
  const rbody = rm.slice(0, rm.indexOf('\n    };'));
  assert.ok(rbody.includes('if (taMetrics) return taMetrics'), 'metrik harus dipakai dari cache');
  // Scroll dijadwalkan (deferred) supaya layout selesai dulu.
  assert.ok(studio.includes('const scheduleCaretScroll = () => {'), 'scheduleCaretScroll harus ada');
  assert.ok(studio.includes('setTimeout(scrollCaretIntoView, 0)'), 'scroll harus dijadwalkan via setTimeout');
  // Semua pemanggilan memakai scheduleCaretScroll, bukan langsung.
  assert.ok(!studio.includes('autoFit();\n      renderAssetHeader(); updatePillLabels(); syncMentionFromText();\n      // D-216: mention aset gambar -> masuk ke header sebagai referensi.\n      syncMentionedAssetRefs();\n      // D-217: kursor naik sesuai baris yang sedang diketik.\n      scrollCaretIntoView();'),
    'input handler harus memakai scheduleCaretScroll');
  // Metrik di-reset saat resize (keyboard mobile buka/tutup).
  assert.ok(studio.includes("ta?.addEventListener('resize'"), 'resize harus trigger refresh metrik');
});

// ===== D-219: regresi — inline script index.html tidak boleh gagal parse =====

test('D-219: inline script index.html jalan (window.toast = function, ICONS terpasang)', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  // Kalau ada SyntaxError di inline script, window.toost jadi elemen DOM (named
  // access property) bukan fungsi -> seluruh aplikasi error.
  assert.equal(typeof win.toast, 'function', 'window.toast harus fungsi (inline script tidak boleh gagal parse)');
  assert.equal(typeof win.ICONS, 'object', 'window.ICONS harus terpasang');
  // Kunci ICONS dengan tanda hubung harus quoted (user-round, refresh-cw, dll).
  const iconKeys = [...win.ICONS ? Object.keys(win.ICONS) : []];
  assert.ok(iconKeys.includes('user-round'), "ICONS harus punya 'user-round'");
  assert.ok(iconKeys.includes('user'), "ICONS harus punya 'user'");
  // Semua elemen data-icon harus punya SVG (kalau inline script gagal, semua hilang).
  const all = [...win.document.querySelectorAll('[data-icon]')];
  const broken = all.filter((el) => !el.querySelector('svg'));
  assert.equal(broken.length, 0, 'semua [data-icon] harus punya SVG; yang rusak: '
    + broken.slice(0, 5).map((e) => e.dataset.icon).join(', '));
});

// ===== D-234: tombol X di pojok kanan modal + deskripsi header 1 baris =====

test('D-234: tombol X & deskripsi header (X dihapus di D-236)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // D-236: tombol X header dihapus (sudah ada "Batal" di footer).
  assert.ok(!css.includes('.st-set-close{'), 'aturan .st-set-close harus dihapus');
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(!studio.includes('stSetClose'), 'tombol X (stSetClose) harus dihapus');
  // Panel tetap positioned (aman untuk absolute lain).
  // D-247: di PC = absolute (dropdown), di HP = fixed (modal tengah).
  const panel = css.match(/\.st-pop-settings\{[^}]*\}/);
  assert.ok(panel[0].includes('position:absolute') || panel[0].includes('position:fixed'),
    'panel harus positioned');
});

test('D-234: deskripsi header satu baris (nowrap + ellipsis)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const small = css.match(/\.st-set-head-txt small\{[^}]*\}/s);
  assert.ok(small[0].includes('white-space:nowrap'), 'deskripsi tidak boleh wrap ke baris bawah');
  assert.ok(small[0].includes('overflow:hidden'), 'deskripsi harus overflow hidden');
  assert.ok(small[0].includes('text-overflow:ellipsis'), 'deskripsi dipotong dengan ellipsis');
  // D-235: deskripsi DI BAWAH judul (blok teks kolom), bukan sebaris.
  const txt = css.match(/\.st-set-head-txt\{[^}]*\}/s);
  assert.ok(txt[0].includes('flex-direction:column'), 'judul + deskripsi harus bertumpuk vertikal');
  assert.ok(txt[0].includes('overflow:hidden'), 'blok teks header harus overflow hidden');
});

test('D-234 (runtime): X dihapus (D-236), judul & deskripsi tetap ada', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  const panel = h.panel();
  // D-236: tidak ada tombol X di header.
  assert.ok(!panel.querySelector('#stSetClose'), 'tombol X tidak boleh ada');
  assert.ok(!panel.querySelector('.st-set-close'), 'tombol X tidak boleh ada');
  // Header tetap punya judul + subjudul (lengkap, tidak terpotong).
  const head = panel.querySelector('.st-set-head');
  assert.ok(head, 'header harus ada');
  assert.ok(head.querySelector('b'), 'judul harus ada');
  assert.ok(head.querySelector('.st-set-head-txt small'), 'subjudul harus ada');
  // Batal di footer tetap berfungsi (menutup panel, membuang draft).
  assert.ok(panel.querySelector('#stSetCancel'), 'tombol Batal harus ada');
  h.clickChip('aspect', '16:9');
  h.click(panel.querySelector('#stSetCancel'));
  assert.ok(!panel.classList.contains('open'), 'Batal harus menutup panel');
  assert.equal(h.pill('stAspectPill'), '4:5', 'Batal = batal, draft dibuang');
});

test('D-236: judul & deskripsi header dapat ruang penuh (tanpa X)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Header tanpa ruang kosong sisa tombol X.
  const head = css.match(/\.st-set-head\{[^}]*\}/s)[0];
  assert.ok(!/padding:[^;]*\b40px/.test(head[0]), 'header tidak perlu ruang kosong untuk X');
  // Blok teks mengisi sisa lebar header.
  const txt = css.match(/\.st-set-head-txt\{[^}]*\}/s)[0];
  assert.ok(txt.includes('flex:1 1 auto'), 'blok teks harus mengisi ruang header');
  assert.ok(txt.includes('min-width:0'), 'blok teks butuh min-width:0');
  // Tidak ada styling .st-set-close tersisa (tombol dihapus total).
  assert.ok(!css.includes('.st-set-close'), 'CSS .st-set-close harus dihapus');
});

test('D-235: deskripsi DI BAWAH judul di header', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  const panel = h.panel();
  const txt = panel.querySelector('.st-set-head-txt');
  const kids = [...txt.children].map((e) => e.tagName);
  // Urutan: judul dulu (b), deskripsi kedua (small).
  assert.deepEqual(kids, ['B', 'SMALL'], 'judul harus sebelum deskripsi di blok teks');
  // CSS: blok teks kolom (vertikal), bukan sebaris.
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-set-head-txt\{[^}]*\}/s)[0];
  assert.ok(rule.includes('flex-direction:column'), 'blok teks harus column (deskripsi di bawah)');
  assert.ok(!rule.includes('flex-direction:row'), 'blok teks tidak boleh row (deskripsi sebaris)');
});

// ===== D-238: input search Bank Prompt harus TERLIHAT (tidak tertekan 0px) =====

test('D-238: selector search pakai .st-pop prefix (kena rule ".st-pop button")', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Ada rule global ".st-pop button{...width:100%...}" (specificity 0,1,1).
  const popBtn = css.match(/\.st-pop button\{[^}]*\}/);
  assert.ok(popBtn, 'rule .st-pop button harus ada (documentasi)');
  assert.ok(popBtn[0].includes('width:100%'), 'rule .st-pop button memangLebar 100%');
  // Karena itu semua selector search WAJIB pakai prefix ".st-pop" (0,2,0+).
  assert.ok(css.includes('.st-pop .st-pb-search input{'), 'input search harus pakai prefix .st-pop');
  assert.ok(css.includes('.st-pop .st-pb-search-ico{'), 'ikon search harus pakai prefix .st-pop');
  assert.ok(css.includes('.st-pop .st-pb-search-clear{'), 'tombol clear harus pakai prefix .st-pop');
  // Input & ikon harus punya lebar eksplisit (tidak boleh 0).
  const input = css.match(/\.st-pop \.st-pb-search input\{[^}]*\}/s);
  assert.ok(input[0].includes('flex:1 1 auto'), 'input harus grow di dalam flex');
  assert.ok(input[0].includes('width:auto'), 'input tidak boleh width:100%');
  const ico = css.match(/\.st-pop \.st-pb-search-ico\{[^}]*\}/s);
  assert.ok(/width:1[0-9]px/.test(ico[0]), 'ikon search harus punya lebar tetap');
  const clr = css.match(/\.st-pop \.st-pb-search-clear\{[^}]*\}/s);
  assert.ok(/width:20px/.test(clr[0]), 'tombol clear harus 20px');
  assert.ok(clr[0].includes('flex:none'), 'tombol clear tidak boleh melebar');
  // Teks input dipaksa terang (WebKit fieldtext default = gelap).
  assert.ok(input[0].includes('-webkit-text-fill-color:#f4f5fb'), 'teks input harus dipaksa terang');
  assert.ok(input[0].includes('caret-color:#ff9bdc'), 'caret harus pink');
});

test('D-238: input search pakai type=text (bukan search)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('<input type="text" id="stPbSearch"'), 'input harus type=text');
  assert.ok(!studio.includes('<input type="search" id="stPbSearch"'),
    'type=search brings native cancel button + fieldtext default color');
});

test('D-238 (runtime): input search punya lebar > 0 & teks terlihat', async () => {
  // Render sungguhan via Chromium (butuh @sparticuz/chromium + puppeteer-core).
  // Kalau browser tidak tersedia, test di-skip (bukan gagal).
  let chromium, puppeteer;
  try {
    chromium = (await import('@sparticuz/chromium')).default;
    puppeteer = (await import('puppeteer-core')).default;
  } catch (_) { return; } // skip bila dependensi browser tidak ada
  const htmlSrc = readFileSync('public/index.html', 'utf8');
  let css = ''; let idx = 0;
  while (true) {
    const a = htmlSrc.indexOf('<style>', idx);
    if (a === -1) break;
    const b = htmlSrc.indexOf('</style>', a);
    if (b === -1) break;
    css += htmlSrc.slice(a + 7, b) + '\n';
    idx = b + 8;
  }
  const iconsSrc = htmlSrc.slice(htmlSrc.indexOf('const ICONS'), htmlSrc.indexOf('const ICONS') + 40000);
  const start = iconsSrc.indexOf('{');
  let depth = 0, end = -1;
  for (let i = start; i < iconsSrc.length; i++) {
    if (iconsSrc[i] === '{') depth++;
    else if (iconsSrc[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  // eslint-disable-next-line no-eval
  const ICONS = eval('(' + iconsSrc.slice(start, end) + ')');
  let browser;
  try {
    const exe = process.env.CHROME_EXE || '/tmp/chromium';
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: exe,
      headless: true,
      env: { ...process.env, LD_LIBRARY_PATH: '/tmp/chr/lib:/tmp/chr' },
    });
  } catch (_) { return; } // skip bila browser tidak bisa jalan
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 760 });
    await page.setContent(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<style>' + css + '</style><script>window.ICONS=' + JSON.stringify(ICONS) + ';</script></head>'
      + '<body><div id="studioRoot"></div></body></html>',
      { waitUntil: 'domcontentloaded' }
    );
    await page.evaluate(`window.fetch = async () => ({ ok:true, json: async()=>({ entries:[
      { id:'t1', kind:'template', label:'Neon Cyberpunk', content:'neon cyberpunk city', group:'style', slots:[] },
      { id:'t2', kind:'template', label:'Product Studio', content:'clean product photo', group:'umum', slots:[] }
    ], characters:[] })});`);
    await page.addScriptTag({ content: readFileSync('public/studio.js', 'utf8') });
    await page.evaluate(`window.__sherlyStudioMode='photo'; window.renderStudio();`);
    await page.evaluate(`document.getElementById('stPromptPill').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(`(()=>{const i=document.getElementById('stPbSearch'); i.focus(); i.value='neon';
      i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise((r) => setTimeout(r, 200));
    const m = await page.evaluate(`(()=>{const i=document.getElementById('stPbSearch'); const cs=getComputedStyle(i);
      const r=i.getBoundingClientRect(); const par=i.parentElement;
      return { w:r.width, color:cs.color, value:i.value,
        icoW: par.querySelector('.st-pb-search-ico').getBoundingClientRect().width,
        clrW: document.getElementById('stPbSearchClear').getBoundingClientRect().width,
        visible: [...document.querySelectorAll('#stPop-prompt .st-pb-item')]
          .filter(x=>!x.classList.contains('st-hidden')).map(x=>x.textContent.trim().slice(0,12)) };})()`);
    // Input HARUS punya lebar nyata (bug D-238: 0px -> teks tak terlihat).
    assert.ok(m.w > 100, 'lebar input harus > 100px, dapat ' + m.w);
    assert.ok(m.icoW >= 10, 'lebar ikon harus >= 10px, dapat ' + m.icoW);
    assert.ok(m.clrW <= 30, 'lebar tombol clear harus <= 30px, dapat ' + m.clrW);
    assert.ok(m.color !== 'rgb(0, 0, 0)', 'warna teks input tidak boleh hitam, dapat ' + m.color);
    assert.equal(m.value, 'neon', 'nilai input harus ' + m.value);
    // Filter: hanya 1 item yang cocok.
    assert.equal(m.visible.length, 1, 'hanya 1 item cocok, dapat ' + m.visible.length);
  } finally {
    await browser.close();
  }
});

// ===== D-237: label "Optimasi" + kotak search Bank Prompt =====

test('D-237: aksi.optimasi ditulis "Optimasi" (bukan "Optimalkan")', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Label di menu item.
  assert.ok(studio.includes("id=\"stOptimizeBtn\" data-action=\"optimize\">' + icon('sparkles') + ' <span>Optimasi</span>"),
    'item menu harus berlabel "Optimasi"');
  // Label tombol saat proses.
  assert.ok(studio.includes("icon('sparkles') + ' Optimasi'"), 'label tombol harus "Optimasi"');
  // Tidak boleh ada label lama di UI.
  assert.ok(!studio.includes('>Optimalkan<'), 'label "Optimalkan" tidak boleh dipakai di UI');
  assert.ok(!studio.includes("' Optimalkan'"), 'label "Optimalkan" tidak boleh dipakai di UI');
  // Toast juga ringkas.
  assert.ok(studio.includes('Prompt sudah dioptimasi & diurutkan.'), 'toast harus pakai "dioptimasi"');
});

test('D-237: Bank Prompt punya kotak search DI BAWAH tag Template/Blok', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function buildPromptPop'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Search ada & dirender setelah tabs.
  assert.ok(body.includes('st-pb-search'), 'harus ada search box');
  assert.ok(body.includes('id="stPbSearch"'), 'harus ada input search');
  assert.ok(body.includes('Cari prompt'), 'input harus punya placeholder');
  // Urutan render: tabs -> search -> body.
  const render = body.slice(body.indexOf('el.innerHTML = tabs'));
  assert.ok(render.includes('tabs + search +'), 'search harus dirender setelah tabs');
  // Penyaringan lewat visibility (bukan re-render) -> fokus input aman.
  assert.ok(studio.includes('function applyPromptBankFilter'), 'harus ada fungsi filter');
  const f = studio.slice(studio.indexOf('function applyPromptBankFilter'));
  const fBody = f.slice(0, f.indexOf('\n  }'));
  assert.ok(fBody.includes("classList.toggle('st-hidden', !ok)"), 'filter harus toggle visibility item');
  assert.ok(fBody.includes('dataset.pbSearch'), 'filter harus baca dataset.pbSearch');
  // Item punya data-pb-search (isi penuh untuk pencarian).
  assert.ok(body.includes('data-pb-search="'), 'item harus punya data-pb-search');
  // Tombol hapus pencarian.
  assert.ok(body.includes('stPbSearchClear'), 'harus ada tombol hapus pencarian');
  // CSS search box.
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('.st-pb-search{'), 'harus ada CSS .st-pb-search');
  assert.ok(css.includes('.st-pb-search input{'), 'harus ada styling input search');
});

test('D-237 (runtime): search Bank Prompt menyaring item & tombol clear berfungsi', async () => {
  const BANK = {
    entries: [
      { id: 't1', kind: 'template', label: 'Neon Cyberpunk', content: 'neon cyberpunk city', group: 'style', slots: [] },
      { id: 't2', kind: 'template', label: 'Product Studio', content: 'clean product photo', group: 'umum', slots: [] },
      { id: 'b1', kind: 'block', label: 'Kamera 85mm', content: 'shot on 85mm lens', category: 'kamera' },
    ],
  };
  const fetchStub = async (url) => {
    if (String(url).includes('/api/prompt-bank')) return { ok: true, json: async () => BANK };
    return { ok: true, json: async () => ({ entries: [], characters: [] }) };
  };
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window;
  win.fetch = fetchStub;
  win.confirm = () => true; win.alert = () => {}; win.scrollTo = () => {};
  win.eval(readFileSync('public/studio.js', 'utf8'));
  const doc = win.document;
  win.__sherlyStudioMode = 'photo';
  await win.renderStudio();
  // Buka popover Bank Prompt lewat tombol Prompt.
  const pill = doc.getElementById('stPromptPill');
  (pill?.querySelector('.st-pill') || pill)?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  const pop = doc.getElementById('stPop-prompt');
  assert.ok(pop.classList.contains('open'), 'popover prompt harus terbuka');
  // Search ada DI BAWAH tabs.
  const kids = [...pop.children].map((e) => e.className);
  assert.ok(kids[0].includes('st-pb-tabs'), 'anak pertama harus tabs');
  assert.ok(kids[1].includes('st-pb-search'), 'anak kedua harus search');
  // Ketik -> menyaring.
  const inp = doc.getElementById('stPbSearch');
  assert.ok(inp, 'input search harus ada');
  inp.value = 'neon';
  inp.dispatchEvent(new win.Event('input', { bubbles: true }));
  const items = [...pop.querySelectorAll('.st-pb-item')];
  const visible = items.filter((i) => !i.classList.contains('st-hidden'));
  assert.equal(visible.length, 1, 'hanya 1 item yang harus cocok');
  assert.ok(visible[0].textContent.includes('Neon'), 'item yang cocok harus Neon');
  // Group yang kosong ikut disembunyikan.
  const groups = [...pop.querySelectorAll('.st-pb-group')];
  assert.ok(groups.some((g) => g.classList.contains('st-hidden')), 'group kosong harus disembunyikan');
  // Tombol clear muncul & mengembalikan semua item.
  const clear = doc.getElementById('stPbSearchClear');
  assert.ok(clear && !clear.classList.contains('st-hidden'), 'tombol clear harus tampil saat ada query');
  clear.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const after = [...pop.querySelectorAll('.st-pb-item')];
  assert.equal(after.filter((i) => !i.classList.contains('st-hidden')).length, items.length,
    'clear harus menampilkan semua item lagi');
});

// ===== D-233: Panel Pengaturan Konten = GRID tombol, bukan daftar ke bawah =====

test('D-233: pilihan pengaturan jadi GRID (bukan wrap ke bawah)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const chips = css.match(/\.st-set-chips\{[^}]*\}/s);
  assert.ok(chips, 'aturan .st-set-chips tidak ada');
  // Container pilihan harus GRID, bukan flex-wrap.
  assert.ok(chips[0].includes('display:grid'), 'container pilihan harus display:grid');
  assert.ok(chips[0].includes('grid-template-columns'), 'harus ada grid-template-columns');
  assert.ok(chips[0].includes('repeat(auto-fit'), 'kolom otomatis sesuai jumlah pilihan');
  assert.ok(!chips[0].includes('flex-wrap:wrap'), 'tidak boleh wrap ke bawah (daftar)');
  // Chip mengisi satu kolom grid.
  const chip = css.match(/\.st-set-chip\{[^}]*\}/s);
  assert.ok(chip[0].includes('width:100%'), 'chip harus mengisi kolom grid');
  assert.ok(chip[0].includes('display:flex'), 'chip internal flex');
  assert.ok(chip[0].includes('justify-content:flex-start'), 'ikon + teks rata kiri dalam chip');
});

test('D-233: header panel tidak menyempit & ada ikon badge', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const head = css.match(/\.st-set-head\{[^}]*\}/s);
  assert.ok(head[0].includes('display:flex'), 'header harus flex');
  assert.ok(head[0].includes('align-items:center'), 'header items center');
  // Teks judul+subjudul boleh wrap tapi tetap pakai ruang lebar.
  const txt = css.match(/\.st-set-head-txt\{[^}]*\}/s);
  assert.ok(txt[0].includes('flex:1 1 auto'), 'blok teks harus mengisi sisa ruang');
  assert.ok(txt[0].includes('min-width:0'), 'blok teks butuh min-width:0');
  // Ikon judul dalam badge terpisah.
  assert.ok(css.includes('.st-set-head-ico{'), 'harus ada badge ikon header');
  // Judul tidak boleh flex:1 (bikin sempit).
  const b = css.match(/\.st-set-head b\{[^}]*\}/s);
  assert.ok(!b[0].includes('flex:1'), 'judul tidak boleh flex:1 (menyempit)');
  assert.ok(b[0].includes('white-space:nowrap'), 'judul tidak boleh terpotong');
});

test('D-233 (runtime): tiap baris punya beberapa chip (bukan 1 per baris)', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  const panel = h.panel();
  const rows = [...panel.querySelectorAll('.st-set-row')];
  assert.ok(rows.length >= 3, 'panel harus punya beberapa baris pengaturan');
  // Setiap baris punya >= 2 pilihan (bukan daftar 1 kolom).
  for (const r of rows) {
    const n = r.querySelectorAll('.st-set-chip').length;
    assert.ok(n >= 2, 'tiap baris minimal 2 pilihan, dapat ' + n);
  }
  // Chip: ikon + teks dalam dua tingkat span (teks + keterangan baris kedua).
  const chip = panel.querySelector('.st-set-chip');
  assert.ok(chip.querySelector('svg'), 'chip harus punya ikon');
  const spans = chip.querySelectorAll('span');
  assert.ok(spans.length >= 2, 'chip harus punya span luar + span teks');
  // Header: badge ikon + judul + subjudul.
  assert.ok(panel.querySelector('.st-set-head-ico'), 'header harus punya badge ikon');
  assert.ok(panel.querySelector('.st-set-head-txt b'), 'header harus punya judul');
  assert.ok(panel.querySelector('.st-set-head-txt small'), 'header harus punya subjudul');
});

// ===== D-232: Panel Pengaturan Konten tampil "pro" (kartu + chip ikon + footer sticky) =====

test('D-232: tiap pengaturan jadi kartu, bukan daftar teks polos', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const row = css.match(/\.st-set-row\{[^}]*\}/s);
  assert.ok(row, 'aturan .st-set-row tidak ada');
  // Baris pengaturan punya surface + border + radius -> terlihat sebagai kartu.
  assert.ok(row[0].includes('background:#101b2c'), 'kartu setting harus punya surface');
  assert.ok(row[0].includes('border:1px solid #1c2b40'), 'kartu setting harus punya border');
  assert.ok(row[0].includes('border-radius:13px'), 'kartu setting harus rounded');
  // Label uppercase + bold -> terlihat seperti header kartu.
  const label = css.match(/\.st-set-label\{[^}]*\}/s);
  assert.ok(label[0].includes('text-transform:uppercase'), 'label harus uppercase');
  assert.ok(label[0].includes('letter-spacing:.12em'), 'label harus ada letter-spacing');
});

test('D-232: chip punya ikon + tidak terpotong (footer sticky, body scroll)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Chip punya ikon (svg) styling.
  const chipSvg = css.match(/\.st-set-chip svg\{[^}]*\}/s);
  assert.ok(chipSvg, 'aturan svg chip tidak ada');
  assert.ok(chipSvg[0].includes('stroke:#91a2b9'), 'ikon chip default abu-abu');
  // Chip aktif -> ikon pink.
  assert.ok(css.includes('.st-set-chip.on svg{stroke:#ff9bdc}'), 'ikon chip aktif harus pink');
  // Body = area scroll; footer = sticky (tidak pernah terpotong).
  // Ambil rule .st-set-body YANG ADA overflow-y:auto (bukan rule ringkas
  // di @media(max-height:520px) yang muncul lebih dulu di file).
  const bodies = [...css.matchAll(/\.st-set-body\{([^}]*)\}/g)].map((m) => m[1]);
  const body = bodies.find((b) => b.includes('overflow-y:auto')) || bodies[0] || '';
  assert.ok(body, 'aturan .st-set-body harus ada');
  assert.ok(body.includes('overflow-y:auto'), 'body panel harus bisa scroll');
  assert.ok(body.includes('flex:1 1 auto'), 'body panel harus flexible');
  assert.ok(body.includes('min-height:0'), 'body panel butuh min-height:0 agar scroll benar');
  const foot = css.match(/\.st-set-foot\{[^}]*\}/s);
  assert.ok(foot[0].includes('flex:none'), 'footer harus flex:none (tidak ikut scroll)');
  assert.ok(foot[0].includes('border-top:1px solid #24344e'), 'footer harus ada garis pemisah');
  // Tombol footer lebih besar (tidak terpotong).
  const footBtn = css.match(/\.st-set-foot button\{[^}]*\}/s);
  assert.ok(/padding:1[12]px 1[34]px/.test(footBtn[0]), 'tombol footer harus bertinggi lega');
  // Panel lebih lega (mobile). D-247: aturan HP dipindah ke `.st-pop.st-pop-settings`.
  const mobRules = [...css.matchAll(/\.st-pop\.st-pop-settings\{([^}]*)\}/g)].map((m) => m[1]);
  const mobile = mobRules.find((r) => r.includes('position:fixed'));
  assert.ok(mobile, 'aturan mobile panel tidak ada');
  assert.ok(mobile.includes('max-height:min(80vh,560px)'), 'panel harus lebih tinggi');
  assert.ok(mobile.includes('padding:14px'), 'panel harus ada padding lega');
});

test('D-232: panel punya subjudul + ikon per chip', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function buildSettingsPanel'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Header: judul + subjudul.
  assert.ok(body.includes('st-set-head-txt'), 'header harus punya wrapper teks');
  assert.ok(body.includes('Atur semua dulu'), 'header harus punya subjudul');
  // Chip dirender lewat setChipIcon (ikon per pilihan).
  assert.ok(body.includes('setChipIcon(g.key, o.v)'), 'chip harus pakai setChipIcon');
  assert.ok(body.includes('<span>'), 'label chip dibungkus span');
  // Helper ikon + fallback per kategori.
  assert.ok(studio.includes('function setChipIcon('), 'harus ada helper setChipIcon');
  assert.ok(studio.includes('SET_CHIP_FALLBACK_ICON'), 'harus ada ikon cadangan per kategori');
});

test('D-232 (runtime): semua chip punya ikon & panel tidak terpotong', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  const panel = h.panel();
  assert.ok(panel?.classList.contains('open'), 'panel harus terbuka');
  // Tiap chip punya ikon SVG.
  const chips = [...panel.querySelectorAll('.st-set-chip')];
  assert.ok(chips.length > 0, 'harus ada chip');
  const withoutIcon = chips.filter((c) => !c.querySelector('svg'));
  assert.equal(withoutIcon.length, 0, 'semua chip harus punya ikon; yang belum: '
    + withoutIcon.map((c) => c.textContent.trim()).slice(0, 5).join(', '));
  // Tiap baris pengaturan adalah kartu (ada label + chips).
  const rows = [...panel.querySelectorAll('.st-set-row')];
  assert.ok(rows.length >= 3, 'panel harus punya beberapa baris pengaturan');
  for (const r of rows) {
    assert.ok(r.querySelector('.st-set-label'), 'tiap baris harus punya label');
    assert.ok(r.querySelector('.st-set-chips'), 'tiap baris harus punya deretan chip');
  }
  // Footer Simpan ada dan tidak berada di dalam area scroll (adalah sibling body).
  const foot = panel.querySelector('.st-set-foot');
  assert.ok(foot, 'panel harus punya footer');
  assert.ok(foot.parentElement === panel, 'footer harus anak langsung panel (sticky)');
  assert.ok(!panel.querySelector('.st-set-body .st-set-foot'), 'footer tidak boleh di dalam area scroll');
});

// ===== D-231: Pengaturan Konten = draft -> Simpan (panel tidak nutup sendiri) =====

/**
 * Harness runtime D-231: buka panel Pengaturan Konten di layout HP,
 * pilih beberapa setting, cek panel tetap terbuka & state belum berubah,
 * lalu terapkan lewat Simpan / Batal.
 */
function d231Harness() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window;
  win.fetch = async () => ({ ok: true, json: async () => ({ entries: [], characters: [] }) });
  win.confirm = () => true;
  win.alert = () => {};
  win.scrollTo = () => {};
  // Paksa layout HP -> tombol jenis konten membuka PANEL pengaturan.
  Object.defineProperty(win, 'innerWidth', { value: 420, writable: true });
  win.eval(readFileSync('public/studio.js', 'utf8'));
  const doc = win.document;
  win.__sherlyStudioMode = 'photo';
  const panel = () => doc.getElementById('stPop-settings');
  const pill = (id) => doc.getElementById(id)?.querySelector('b')?.textContent;
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const openPanel = () => {
    const t = doc.getElementById('stTypePill');
    click(t.querySelector('.st-pill') || t);
  };
  const clickChip = (key, val) => {
    const b = panel()?.querySelector(`[data-set-key="${key}"][data-set-v="${val}"]`);
    if (!b) return false;
    click(b);
    return true;
  };
  const rowLabels = () => [...(panel()?.querySelectorAll('.st-set-row') || [])]
    .map((r) => r.querySelector('.st-set-label b')?.textContent);
  return { win, doc, panel, pill, click, openPanel, clickChip, rowLabels };
}

test('D-231 (runtime): memilih setting tidak menutup panel & state belum berubah', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  assert.ok(h.panel()?.classList.contains('open'), 'panel harus terbuka');
  assert.ok(h.doc.getElementById('stSetSave'), 'panel harus punya tombol Simpan');
  assert.ok(h.doc.getElementById('stSetCancel'), 'panel harus punya tombol Batal');

  // Pilih rasio -> panel TETAP terbuka.
  assert.ok(h.clickChip('aspect', '16:9'), 'chip rasio harus ada');
  assert.ok(h.panel()?.classList.contains('open'), 'panel harus tetap terbuka setelah memilih');
  assert.ok(h.panel()?.querySelector('[data-set-key="aspect"][data-set-v="16:9"].on'),
    'chip terpilih harus ditandai aktif');

  // State aktif BELUM berubah (pill masih nilai awal).
  assert.equal(h.pill('stAspectPill'), '4:5', 'pill rasio tidak boleh berubah sebelum Save');

  // Pilih provider lain -> panel tetap terbuka, baris Model ikut berubah.
  assert.ok(h.clickChip('engine', 'gemini'), 'chip provider harus ada');
  assert.ok(h.panel()?.classList.contains('open'), 'panel tetap terbuka setelah pilih provider');
  assert.ok(!h.rowLabels().includes('Model'), 'provider non-Kie -> baris Model tidak tampil');
  assert.ok(h.clickChip('engine', 'kie'), 'chip Kie harus ada');
  assert.ok(h.panel()?.classList.contains('open'), 'panel tetap terbuka setelah pilih Kie');
  assert.ok(h.rowLabels().includes('Model'), 'provider Kie -> baris Model harus tampil');
});

test('D-231 (runtime): Simpan menerapkan draft lalu menutup panel', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  h.clickChip('aspect', '9:16');
  h.clickChip('engine', 'kie');
  assert.equal(h.pill('stAspectPill'), '4:5', 'sebelum Save pill tidak berubah');
  h.click(h.doc.getElementById('stSetSave'));
  assert.ok(!h.panel()?.classList.contains('open'), 'panel harus tertutup setelah Save');
  assert.equal(h.pill('stAspectPill'), '9:16', 'Save harus menerapkan rasio');
  assert.equal(h.pill('stEnginePill'), 'Kie AI', 'Save harus menerapkan provider');
});

test('D-231 (runtime): Batal & klik di luar membuang draft (tidak menerapkan)', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  // Batal.
  h.openPanel();
  h.clickChip('aspect', '16:9');
  assert.ok(h.panel()?.classList.contains('open'), 'panel tetap terbuka saat memilih');
  h.click(h.doc.getElementById('stSetCancel'));
  assert.ok(!h.panel()?.classList.contains('open'), 'panel tertutup setelah Batal');
  assert.equal(h.pill('stAspectPill'), '4:5', 'Batal tidak boleh menerapkan pilihan');
  // Klik di luar panel -> batal juga.
  h.openPanel();
  h.clickChip('aspect', '9:16');
  h.click(h.doc.body);
  assert.ok(!h.panel()?.classList.contains('open'), 'panel tertutup setelah klik di luar');
  assert.equal(h.pill('stAspectPill'), '4:5', 'klik di luar tidak boleh menerapkan pilihan');
});

test('D-231 (runtime): ganti jenis konten di draft lalu Save menerapkan', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  assert.ok(h.clickChip('type', 'video'), 'chip Video harus ada');
  assert.ok(h.panel()?.classList.contains('open'), 'panel tetap terbuka setelah ganti jenis konten');
  const rows = h.rowLabels();
  assert.ok(rows.includes('Durasi'), 'mode video -> baris Durasi harus tampil');
  assert.ok(rows.includes('Resolusi'), 'mode video -> baris Resolusi harus tampil');
  h.click(h.doc.getElementById('stSetSave'));
  assert.ok(!h.panel()?.classList.contains('open'), 'panel tertutup setelah Save');
  assert.equal(h.doc.getElementById('stTypePill')?.querySelector('b')?.textContent, 'Video',
    'Save harus menerapkan jenis konten');
});


test('D-231: panel Pengaturan Konten punya draft + tombol Simpan', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Draft state terpisah dari state aktif.
  assert.ok(studio.includes('let settingsDraft = null'), 'harus ada draft pengaturan');
  assert.ok(studio.includes('function beginSettingsDraft()'), 'harus ada mulai draft');
  assert.ok(studio.includes('function cancelSettingsDraft()'), 'harus ada batal draft');
  assert.ok(studio.includes('function commitSettingsDraft()'), 'harus ada terapkan draft');
  // Panel harus punya tombol Simpan + Batal.
  const fn = studio.slice(studio.indexOf('function buildSettingsPanel'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('stSetSave'), 'panel harus punya tombol Simpan');
  assert.ok(body.includes('stSetCancel'), 'panel harus punya tombol Batal');
  assert.ok(body.includes('st-set-foot'), 'panel harus punya footer');
  // Simpan -> commit (terapkan draft) lalu tutup.
  assert.ok(body.includes("commitSettingsDraft();"), 'Simpan harus menerapkan draft');
  assert.ok(body.includes("el.classList.remove('open')"), 'Simpan harus menutup panel');
});

test('D-231: memilih setting TIDAK menutup panel dan TIDAK mengubah state', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function buildSettingsPanel'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  const chipHandler = body.slice(body.indexOf('data-set-key]').addEventListener ? 0 : 0);
  // Di handler chip: applySetting lalu buildSettingsPanel (re-render, tetap buka).
  assert.ok(body.includes('applySetting(key, b.dataset.setV);'), 'chip harus memakai applySetting');
  assert.ok(body.includes('buildSettingsPanel();'), 'chip harus re-render panel');
  // applySetting menulis ke draft kalau panel terbuka.
  const ap = studio.slice(studio.indexOf('function applySetting'));
  const apBody = ap.slice(0, ap.indexOf('\n  }'));
  assert.ok(apBody.includes('const target = settingsDraft || state;'), 'applySetting harus menulis ke draft bila ada');
  assert.ok(apBody.includes('if (!draftMode) updatePillLabels();'),
    'pill label tidak boleh berubah sebelum Save');
  // Handler global klik-diluAR tidak boleh menutup panel saat klik di dalam.
  const doc = studio.slice(studio.indexOf("document.addEventListener('click'"));
  const docBody = doc.slice(0, doc.indexOf('\n  });'));
  assert.ok(docBody.includes("popOpen === 'settings'"), 'handler harus aware panel settings');
  assert.ok(docBody.includes("e.target.closest('#stPop-settings')"),
    'klik di dalam panel settings tidak boleh menutup panel');
  // Elemen yang sudah di-re-render (detached) juga tidak boleh menutup panel.
  assert.ok(docBody.includes('isConnected === false'),
    'klik pada elemen yang sudah di-re-render tidak boleh menutup panel');
});

test('D-231: Save menerapkan draft ke state, Batal membuang draft', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const commit = studio.slice(studio.indexOf('function commitSettingsDraft'));
  const cBody = commit.slice(0, commit.indexOf('\n  }'));
  // Semua field draft masuk ke state.
  for (const f of ['engine', 'aspect', 'imageModel', 'videoModel', 'duration', 'tier', 'resolution']) {
    assert.ok(cBody.includes('state.' + f + ' = d.' + f), 'Save harus menerapkan ' + f);
  }
  // Draft dibuang saat commit (tidak menggantung).
  assert.ok(cBody.includes('settingsDraft = null;'), 'draft harus dibuang setelah commit');
  // Batal -> cancel (buang draft), state tidak berubah.
  const fn = studio.slice(studio.indexOf('function buildSettingsPanel'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('cancelSettingsDraft();'), 'Batal harus membuang draft');
  // X (tutup) juga batal — tidak menerapkan.
  assert.ok(body.includes('cancelSettingsDraft();'), 'tombol X harus membuang draft');
});

test('D-231: pilihan pengaturan membaca DRAFT, bukan state', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function settingCtx'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('return settingsDraft || state;'), 'settingCtx harus pakai draft bila ada');
  // settingValue / settingChoices / activeSettings harus lewat ctx.
  for (const fnName of ['function settingChoices(', 'function settingValue(', 'function activeSettings(']) {
    const seg = studio.slice(studio.indexOf(fnName));
    const segBody = seg.slice(0, seg.indexOf('\n  }'));
    assert.ok(segBody.includes('settingCtx()'), fnName + ' harus membaca settingCtx()');
  }
});

test('D-231: CSS footer Simpan/Batal ada', () => {
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('.st-set-foot'), 'harus ada CSS .st-set-foot');
  assert.ok(css.includes('.st-set-save'), 'harus ada CSS .st-set-save');
  assert.ok(css.includes('.st-set-cancel'), 'harus ada CSS .st-set-cancel');
});

// ===== D-220: kursor tidak meloncat saat ada referensi aktif =====

test('D-220: header referensi hanya re-render kalau isinya berubah', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function renderAssetHeader'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Guard: bandingkan HTML hasil render dengan yang terpasang.
  assert.ok(body.includes('box.dataset.renderedHtml'), 'harus menyimpan HTML terakhir');
  assert.ok(body.includes('if (box.dataset.renderedHtml === html'), 're-render hanya kalau HTML berubah');
  assert.ok(body.includes("box.dataset.renderedHtml = html"), 'harus menyimpan HTML baru');
});

test('D-220: syncMentionedAssetRefs tidak menyentuh apa pun bila tidak berubah', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('async function syncMentionedAssetRefs()'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('const same = wanted.length === current.length'), 'harus mendeteksi kondisi tidak berubah');
  assert.ok(body.includes('if (same) return;'), 'harus keluar cepat bila tidak berubah');
});

test('D-220: mention aset tetap dikenali saat user lanjut mengetik di belakang token', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function mentionedAssetIds()'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Prefix fallback: "@aset-kopiabcde" -> "@aset-kopi".
  assert.ok(body.includes('raw.startsWith(slug)'), 'harus cocokkan prefix');
  assert.ok(body.includes('bestSlug'), 'harus memilih prefix terpanjang');
  assert.ok(body.includes('id = bestId'), 'harus memakai ID hasil prefix match');
  // Penting: jangan sampai mengembalikan slug, bukan ID.
  assert.ok(!body.includes('best = slug, aid'), 'nilai fallback harus ID, bukan slug');
});

test('D-220: caret dipulihkan setelah DOM header berubah', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('window.__sherlyRestoreCaret = () => {'), 'restoreCaret harus ada');
  assert.ok(studio.includes('ta.setSelectionRange(pos, end)'), 'harus memulihkan posisi caret');
  const fn = studio.slice(studio.indexOf('function renderAssetHeader'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("window.__sherlyRestoreCaret"), 'renderAssetHeader harus memanggil restoreCaret');
  // loadAssets harus sinkronkan mention yang sudah ada (aset baru termuat).
  const la = studio.slice(studio.indexOf('async function loadAssets()'));
  const lbody = la.slice(0, la.indexOf('\n  }'));
  assert.ok(lbody.includes('await syncMentionedAssetRefs()'), 'loadAssets harus sinkronkan mention aset');
});

// ===== D-221: pengaturan konten jadi dropdown/modal di HP =====

test('D-221: markup — pill pengaturan dikelompokkan + panel pengaturan ada', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Container pill pengaturan.
  assert.ok(studio.includes('id="stSettingsPills"'), 'container stSettingsPills harus ada');
  // Panel pengaturan.
  assert.ok(studio.includes('id="stPop-settings"'), 'panel stPop-settings harus ada');
  // Tombol jenis konten jadi pemicu (dengan chevron).
  assert.ok(studio.includes('class="st-pill st-type-btn" id="stTypePill"'), 'tombol jenis konten harus punya kelas st-type-btn');
  // Panel harus DI DALAM .st-controls (bukan popover global).
  const ctl = studio.slice(studio.indexOf('class="st-controls"'));
  const block = ctl.slice(0, ctl.indexOf("'<div class=\"st-video-progress"));
  assert.ok(block.includes('stPop-settings'), 'panel harus di dalam st-controls');
});

test('D-221: panel pengaturan berisi jenis konten + semua setelan relevan', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Fungsi inti.
  assert.ok(studio.includes('function buildSettingsPanel()'), 'buildSettingsPanel harus ada');
  assert.ok(studio.includes('function openSettingsPanel()'), 'openSettingsPanel harus ada');
  assert.ok(studio.includes('function activeSettings()'), 'activeSettings harus ada');
  assert.ok(studio.includes('function settingChoices('), 'settingChoices harus ada');
  assert.ok(studio.includes('function applySetting('), 'applySetting harus ada');
  // Panel memuat section Jenis Konten.
  const fn = studio.slice(studio.indexOf('function buildSettingsPanel()'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('data-set-key="type"'), 'panel harus punya pilihan jenis konten');
  assert.ok(body.includes('Jenis Konten'), 'panel harus punya label Jenis Konten');
  // Baris pengaturan lain.
  assert.ok(body.includes('data-set-key="'), 'chip pengaturan harus pakai data-set-key');
  // Mode video punya setting tambahan.
  const act = studio.slice(studio.indexOf('function activeSettings()'));
  const abody = act.slice(0, act.indexOf('\n  }'));
  assert.ok(abody.includes("'dur'"), 'mode video punya durasi');
  assert.ok(abody.includes("'tier'"), 'mode video punya tier');
  assert.ok(abody.includes("'res'"), 'mode video punya resolusi');
  assert.ok(abody.includes("'imgmodel'"), 'mode foto punya model gambar');
  assert.ok(abody.includes("'aspect'"), 'selalu ada rasio');
  assert.ok(abody.includes("'engine'"), 'selalu ada provider');
});

test('D-247: HP & PC sama-sama buka PANEL pengaturan (bukan dropdown jenis konten)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const handler = studio.slice(studio.indexOf("$('stTypePill')?.addEventListener"));
  const hbody = handler.slice(0, handler.indexOf('\n    });'));
  assert.ok(hbody.includes('openSettingsPanel()'), 'tombol jenis konten harus membuka panel pengaturan');
  assert.ok(!hbody.includes("buildPop('type')"), 'tidak lagi dropdown jenis konten terpisah');
  // togglePop harus bisa menutup panel settings.
  assert.ok(studio.includes("'actions', 'settings'"), 'togglePop harus menutup panel settings');
  // D-247: panel di HP = modal tengah, di PC = dropdown (lewat class toggle).
  assert.ok(studio.includes("el.classList.toggle('st-pop-center', isMobileLayout())"),
    'panel harus jadi modal tengah hanya di HP');
});

test('D-247: CSS — pill pengaturan disembunyikan di SEMUA device, panel styling ada', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // D-247: container pill disembunyikan di semua device (PC pun).
  assert.ok(/\.st-settings-pills\{display:none!important\}/.test(css),
    '.st-settings-pills harus display:none di semua device');
  assert.ok(!css.includes('.st-settings-pills{display:contents}'),
    'display:contents (pill sebaris di PC) harus dihapus');
  // Panel pengaturan styling.
  assert.ok(css.includes('.st-pop-settings{'), 'aturan .st-pop-settings harus ada');
  assert.ok(css.includes('.st-set-chip.on{'), 'chip aktif harus punya styling');
  assert.ok(css.includes('.st-set-row{'), 'baris pengaturan harus punya styling');
  // Panel di HP diposisikan di tengah layar (modal).
  assert.ok(/\.st-pop\.st-pop-settings\{position:fixed!important;left:50%!important;top:50%!important/.test(css),
    'panel di HP harus di tengah layar');
});

test('D-247: composer ringkas, transparan, di tengah horizontal & tetap di bawah', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-composer\{([^}]*)\}/);
  assert.ok(rule, 'aturan .st-composer harus ada');
  const body = rule[1];
  // D-254: composer tidak lagi `align-self:center` (ia kini anak dock fixed,
  // bukan flex item) — pemusatan lewat `margin:0 auto`.
  assert.ok(body.includes('margin:0 auto'), 'composer harus di tengah horizontal');
  assert.ok(body.includes('max-width:760px'), 'composer dibatasi lebar (bukan melintang)');
  // D-254: "menempel di bawah" sekarang dipegang dock (position:fixed).
  const dock = css.match(/\.st-composer-dock\{([^}]*)\}/);
  assert.ok(dock, 'aturan .st-composer-dock harus ada');
  assert.ok(dock[1].includes('position:fixed'), 'dock composer harus fixed (nempel di bawah)');
  assert.ok(dock[1].includes('bottom:0'), 'dock harus menempel di bawah');
  // Transparan: tidak ada warna solid opaque di background.
  assert.ok(!/background:\s*#[0-9a-f]{3,6}\s*;/.test(body.replace(/background-image[^;]*;/g, '')),
    'composer tidak boleh memakai background solid');
  // Tidak boleh ada filter/transform di composer (bikin containing block untuk fixed).
  assert.ok(!body.includes('backdrop-filter'), 'composer tidak boleh pakai backdrop-filter');
  assert.ok(!body.includes('transform'), 'composer tidak boleh pakai transform');
});

// ===== D-222: placeholder singkat + area tulis menyatu dengan form =====

test('D-222: placeholder prompt singkat, tanpa contoh panjang', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Placeholder statis di markup.
  assert.ok(studio.includes('placeholder="Prompt… mention @ karakter/aset dll."'),
    'placeholder statis harus singkat');
  // Tidak ada placeholder lama yang panjang.
  assert.ok(!studio.includes('cth: @sherly dan @novi'), 'placeholder lama (contoh panjang) harus hilang');
  assert.ok(!studio.includes('cth: opening reels'), 'placeholder video lama harus hilang');
  // Placeholder dinamis (mode video) juga singkat.
  const sm = studio.slice(studio.indexOf('function setMode('));
  const sbody = sm.slice(0, sm.indexOf('\n  }'));
  assert.ok(sbody.includes("'Prompt video… mention @ karakter/aset dll.'"), 'placeholder video harus ringkas');
  assert.ok(sbody.includes("'Prompt… mention @ karakter/aset dll.'"), 'placeholder foto harus ringkas');
  // Panjang maksimal ~40 karakter supaya tidak memenuhi area tulis.
  const ph = /placeholder="([^"]+)"/.exec(studio);
  assert.ok(ph, 'placeholder harus ada');
  assert.ok(ph[1].length <= 45, 'placeholder terlalu panjang: ' + ph[1].length);
});

test('D-222: area tulis menyatu dengan form (tanpa border/background pembeda)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Ambil rule .st-composer textarea YANG ADA background:transparent (bukan
  // rule ringkas di @media(max-height:520px) yang muncul lebih dulu).
  const taRules = [...css.matchAll(/\.st-composer textarea\{([^}]*)\}/g)].map((m) => m[1]);
  const rule = taRules.find((r) => r.includes('background:transparent')) || taRules[0] || '';
  assert.ok(rule, 'aturan .st-composer textarea harus ada');
  assert.ok(rule.includes('background:transparent'), 'background textarea harus transparan');
  assert.ok(/border:0[;}]/.test(rule), 'border textarea harus 0');
  assert.ok(rule.includes('border-radius:0'), 'border-radius textarea harus 0');
  // Padding horizontal dihapus -> area tulis lebih luas.
  assert.ok(rule.includes('padding:2px 0 6px'), 'padding horizontal textarea harus 0');
  // Wrapper mention-box tetap polos.
  assert.ok(css.includes('.st-mention-box{position:relative}'), 'wrapper mention-box tidak boleh punya border/background');
  // Fokus tidak boleh memunculkan border pink (tetap menyatu).
  const focus = css.match(/\.st-composer textarea:focus\{[^}]*\}/s);
  assert.ok(focus, 'aturan focus harus ada');
  assert.ok(/border:0[;}]/.test(focus[0]), 'focus tidak boleh memunculkan border');
  assert.ok(focus[0].includes('box-shadow:none'), 'focus tidak boleh memunculkan shadow');
});

// ===== D-223: badge karakter = satu ikon user (tanpa ikon buku/layers) =====

test('D-223: badge karakter hanya satu ikon user, tanpa ikon layers (buku)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const hbody = hdr.slice(0, hdr.indexOf('\n  }'));
  // Badge memakai icon user.
  assert.ok(hbody.includes("icon('user')"), 'badge harus pakai icon user');
  // Tidak boleh ada icon layers (bentuknya seperti buku).
  assert.ok(!hbody.includes("icon('layers')"), 'badge tidak boleh pakai icon layers');
  // D-224: badge user selalu tampil di kotak avatar (ikon terakhir dari 3 ikon).
  assert.ok(hbody.includes("badges.push('<span class=\"st-asset-badge\">' + icon('user') + '</span>')"),
    'kotak avatar harus punya satu badge icon user');
  // Font: penanda tetap di tooltip.
  assert.ok(hbody.includes("notes.push('Punya master sheet')"), 'detail sheet tetap di tooltip');
  assert.ok(hbody.includes("notes.push('Suara: '"), 'detail suara tetap di tooltip');
});

test('D-223: mention picker tanpa ikon layers (buku/lapis)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const ren = studio.slice(studio.indexOf('function renderMention'));
  const rbody = ren.slice(0, ren.indexOf('\n  }'));
  // D-224 Supersede: picker kini 2 ikon status (mic + book-open), bukan user.
  assert.ok(!rbody.includes("icon('layers')"), 'picker tidak boleh pakai icon layers');
  // (icon('user') di picker hanya untuk LABEL GRUP "Karakter", bukan penanda item.)
  const markLine = rbody.split('\n').filter((l) => l.includes('marks.push'));
  assert.ok(markLine.every((l) => !l.includes("icon('user')")), 'penanda item picker tidak boleh icon user (D-224)');
});

// ===== D-224: 3 ikon aset karakter (suara + bible + user) =====

test('D-224: ICONS punya book-open (ikon bible/naskah)', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.ok(html.includes("'book-open':'<"), "ICONS harus punya ikon 'book-open'");
  assert.ok(html.includes("mic:'<"), "ICONS harus punya ikon 'mic'");
  assert.ok(html.includes("user:'<"), "ICONS harus punya ikon 'user'");
  // Kunci dengan tanda hubung wajib quoted.
  assert.ok(!html.includes(" book-open:'<"), "kunci 'book-open' harus quoted");
});

test('D-224: kotak avatar hanya ikon user; daftar mention 2 ikon (suara + bible)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Header: satu badge user.
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const hbody = hdr.slice(0, hdr.indexOf('\n  }'));
  assert.ok(hbody.includes("badges.push('<span class=\"st-asset-badge\">' + icon('user') + '</span>')"),
    'kotak avatar harus pakai icon user');
  assert.ok(!hbody.includes("icon('mic')"), 'kotak avatar tidak boleh pakai icon mic');
  assert.ok(!hbody.includes("icon('book-open')"), 'kotak avatar tidak boleh pakai icon book-open');
  // Picker: mic + book-open.
  const ren = studio.slice(studio.indexOf('function renderMention'));
  const rbody = ren.slice(0, ren.indexOf('\n  }'));
  assert.ok(rbody.includes("marks.push(icon('mic'))"), 'daftar harus punya icon mic (suara)');
  assert.ok(rbody.includes("marks.push(icon('book-open'))"), 'daftar harus punya icon book-open (bible)');
  assert.ok(!rbody.includes("marks.push(icon('user'))"), 'daftar tidak perlu icon user');
  // Detail status tetap di tooltip.
  assert.ok(hbody.includes("notes.push('Suara: '"), 'detail suara di tooltip');
  assert.ok(hbody.includes("notes.push('Punya master sheet')"), 'detail sheet di tooltip');
});

// ===== D-226: badge user = petak DI DALAM kotak avatar, sudut kanan bawah =====
// D-225 (badge keluar setengah nempel border) dikoreksi: user minta badge
// tetap DI DALAM kotak avatar, di sudut kanan bawah, tanpa ada yang keluar.

test('D-227: badge user = kertas hitam tanpa border, nempel tepi kanan+bawah', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const badge = css.match(/\.st-asset-badge\{[^}]*\}/s);
  assert.ok(badge, 'aturan .st-asset-badge tidak ada');
  const rule = badge[0];
  // Menempel di tepi SAMPING + BAWAH bagian dalam kotak (0, bukan offset jauh,
  // dan bukan negatif/keluar).
  assert.ok(rule.includes('right:0'), 'badge nempel tepi kanan (right:0)');
  assert.ok(rule.includes('bottom:0'), 'badge nempel tepi bawah (bottom:0)');
  assert.ok(!/right:-\d/.test(rule), 'badge tidak boleh keluar dari kanan');
  assert.ok(!/bottom:-\d/.test(rule), 'badge tidak boleh keluar dari bawah');
  // TANPA border -> kertas hitam polos, bukan kotak ber-border pink.
  assert.ok(/border:0(;|\s)/.test(rule), 'badge harus tanpa border');
  assert.ok(!rule.includes('#ff9bdc'), 'badge tidak boleh pakai warna border pink');
  // Kertas hitam semi transparan + menyatu (tanpa box-shadow pemisah yang
  // bikin melayang). D-230: alpha 99 -> foto avatar di belakang tetap terlihat.
  assert.ok(/background:#0c1422[0-9a-f]{2}/.test(rule), 'badge kertas hitam semi transparan');
  assert.ok(!rule.includes('background:#0c1422;'), 'badge harus punya alpha (transparan)');
  assert.ok(!rule.includes('box-shadow'), 'badge tidak boleh ada shadow (biar nyatu, bukan melayang)');
  // Ukuran + tidak menghalang klik.
  assert.ok(rule.includes('width:14px;height:14px'), 'badge 14x14');
  assert.ok(rule.includes('pointer-events:none'), 'badge tidak boleh menghalang klik');
});

test('D-230: background badge semi transparan, foto avatar tetap terlihat', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-asset-badge\{[^}]*\}/s)[0];
  const bg = rule.match(/background:([^;]+)/)[1].trim();
  // Format #RRGGBB + 2 digit alpha.
  assert.ok(/^#0c1422[0-9a-fA-F]{2}$/.test(bg), 'background harus #0c1422 + alpha hex: ' + bg);
  const alpha = parseInt(bg.slice(7), 16);
  assert.ok(alpha > 0 && alpha < 255, 'alpha harus di antara 0 dan 255 (semi transparan), bukan penuh');
  // Alpha cukup tinggi supaya ikon pink tetap kontras di atas foto terang.
  assert.ok(alpha >= 0x80, 'alpha >= 0x80 agar ikon tetap terbaca');
  // Tetap tanpa border & tanpa shadow (biar nyatu, bukan melayang).
  assert.ok(/border:0(;|\s)/.test(rule), 'badge tanpa border');
  assert.ok(!rule.includes('box-shadow'), 'badge tanpa shadow');
  // Ikon tetap pink outline.
  const svg = css.match(/\.st-asset-badge svg\{[^}]*\}/s)[0];
  assert.ok(svg.includes('stroke:#ff9bdc'), 'ikon badge harus pink');
  assert.ok(svg.includes('fill:none'), 'ikon badge harus outline');
});

test('D-229: hanya kiri ATAS badge yang melengkung, bawah tetap siku', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-asset-badge\{[^}]*\}/s)[0];
  // Radius hanya di kiri-atas: 8px 0 0 0 (sisa sudut siku).
  assert.ok(rule.includes('border-radius:8px 0 0 0'), 'hanya kiri-atas yang bulat (8px 0 0 0)');
  // Tidak boleh radius penuh (bulat).
  assert.ok(!rule.includes('border-radius:50%'), 'badge tidak boleh bulat');
  // Kiri BAWAH harus siku -> badge tidak terlihat bulat.
  const radius = rule.match(/border-radius:([^;]+)/)[1].trim().split(/\s+/);
  assert.equal(radius.length, 4, 'radius harus 4 sudut');
  assert.equal(radius[0], '8px', 'kiri-atas bulat (ujung daun)');
  assert.equal(radius[1], '0', 'kanan-atas siku');
  assert.equal(radius[2], '0', 'kanan-bawah siku');
  assert.equal(radius[3], '0', 'kiri-bawah HARUS siku (jangan lengkung -> jangan bulat)');
  // Tetap nempel tepi kanan + bawah (flush, bukan mengambang).
  assert.ok(rule.includes('right:0'), 'badge flush tepi kanan');
  assert.ok(rule.includes('bottom:0'), 'badge flush tepi bawah');
  // Avatar tetap radius 8px.
  const face = css.match(/\.st-asset-face\{[^}]*\}/s)[0];
  assert.ok(face.includes('border-radius:8px'), 'avatar radius 8px');
});

test('D-227: badge ada DI DALAM .st-asset-face (tidak ada yang keluar kotak)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const hbody = hdr.slice(0, hdr.indexOf('\n  }'));
  // Badge harus DI DALAM face: '...face">' + characterThumb + badges.join
  const faceIdx = hbody.indexOf('<span class="st-asset-face">');
  const badgeIdx = hbody.indexOf("badges.join('')");
  const faceClose = hbody.indexOf('</span>', badgeIdx);
  assert.ok(faceIdx > -1, 'avatar harus ada');
  assert.ok(badgeIdx > -1, 'badge harus ada');
  assert.ok(faceIdx < badgeIdx, 'badge harus setelah avatar dibuka');
  assert.ok(badgeIdx < faceClose, 'badge harus DI DALAM .st-asset-face (sebelum </span>)');
  // Avatar punya overflow:hidden -> badge otomatis terpotong di dalam kotak.
  const css = readFileSync('public/index.html', 'utf8');
  const face = css.match(/\.st-asset-face\{[^}]*\}/s);
  assert.ok(face[0].includes('overflow:hidden'), 'avatar overflow:hidden (badge terpotong di dalam)');
});

test('D-227: badge user tetap pakai ikon user', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const hdr = studio.slice(studio.indexOf('function renderAssetHeader'));
  const hbody = hdr.slice(0, hdr.indexOf('\n  }'));
  const line = hbody.split('\n').find((l) => l.includes('badges.push'));
  assert.ok(line, 'badge push tidak ditemukan');
  assert.ok(line.includes('st-asset-badge'), 'badge harus kelas st-asset-badge');
  assert.ok(line.includes("icon('user')"), 'badge harus ikon user');
});

// ===== D-240: Durasi (dan setting lain) hasil pilihan panel harus TERSIMPAN =====

test('D-240 (runtime): durasi 10 detik chosen di panel TERSIMPAN setelah Simpan', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  // Pindah ke mode Video supaya baris Durasi muncul (Veo 3.1: 4/6/8 dtk).
  h.openPanel();
  h.clickChip('type', 'video');
  h.openPanel();
  h.clickChip('model', 'veo-3-1');
  // Pilih durasi 8 detik (Veo 3.1 tidak punya 10 dtk).
  assert.ok(h.clickChip('dur', '8'), 'chip durasi 8 detik harus ada');
  // Simpan.
  h.click(h.doc.getElementById('stSetSave'));
  // Pill durasi harus menunjukkan "8 detik".
  assert.equal(h.pill('stDurPill'), '8 detik',
    'durasi 8 detik harus tersimpan, dapat "' + h.pill('stDurPill') + '"');
  // Buka panel lagi -> chip 8 detik harus masih terpilih.
  h.openPanel();
  assert.ok(h.panel()?.querySelector('[data-set-key="dur"][data-set-v="8"].on'),
    'durasi 8 detik harus tetap terpilih saat panel dibuka lagi');
});

test('D-240 (runtime): buka panel lagi -> setting tersimpan tetap terpilih', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  h.clickChip('type', 'video');
  h.openPanel();
  // Kling 3.0 punya durasi 3-15 dtk -> pakai 12 detik.
  h.clickChip('model', 'kling-3.0/video');
  h.clickChip('dur', '12');
  h.click(h.doc.getElementById('stSetSave'));
  // Buka panel lagi: chip 12 detik harus aktif.
  h.openPanel();
  assert.ok(h.panel()?.querySelector('[data-set-key="dur"][data-set-v="12"].on'),
    'durasi 12 detik harus tetap aktif setelah panel dibuka lagi');
});

test('D-240 (runtime): memilih model lain TIDAK boleh menimpa durasi yang sudah dipilih', async () => {
  const h = d231Harness();
  await h.win.renderStudio();
  h.openPanel();
  h.clickChip('type', 'video');
  h.openPanel();
  h.clickChip('model', 'kling-3.0/video');
  h.clickChip('dur', '12');
  // Simpan -> durasi 12 detik harus jadi default Kling.
  h.click(h.doc.getElementById('stSetSave'));
  assert.equal(h.pill('stDurPill'), '12 detik',
    'durasi 12 detik harus tersimpan, dapat "' + h.pill('stDurPill') + '"');
  // Buka panel lagi, pilih model LAIN, lalu Simpan lagi.
  h.openPanel();
  h.clickChip('model', 'bytedance/seedance-2');
  h.click(h.doc.getElementById('stSetSave'));
  // Seedance mendukung 12 detik -> durasi 12 harus tetap, bukan balik ke default 8.
  assert.equal(h.pill('stDurPill'), '12 detik',
    'ganti model tidak boleh menimpa durasi tersimpan, dapat "' + h.pill('stDurPill') + '"');
});

// ===== D-242: mode "Karakter Bicara" (lipsync) =====

test('D-242: mode Karakter Bicara punya tombol, bar karakter & tombol buat video bicara', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  // Pilih mode lipsync lewat panel pengaturan.
  await pickContentType(win, doc, 'lipsync');
  // Label pill = "Karakter Bicara".
  assert.equal(doc.querySelector('#stTypePill b').textContent.trim(), 'Karakter Bicara');
  // Tombol "Buat Video Bicara" tampil, tombol gambar & video biasa hidden.
  const lipBtn = doc.getElementById('stLipsyncBtn');
  assert.ok(lipBtn, 'tombol Buat Video Bicara harus ada');
  assert.ok(!lipBtn.classList.contains('st-hidden'), 'tombol lipsync harus tampil di mode lipsync');
  assert.ok(doc.getElementById('stGenBtn').classList.contains('st-hidden'), 'tombol Buat Gambar harus hidden');
  assert.ok(doc.getElementById('stVideoBtn').classList.contains('st-hidden'), 'tombol Buat Video harus hidden');
  // Bar karakter tampil.
  const bar = doc.getElementById('stLipsyncBar');
  assert.ok(bar, 'bar karakter harus ada');
  assert.ok(!bar.classList.contains('st-hidden'), 'bar karakter harus tampil di mode lipsync');
  // Placeholder composer = naskah.
  const ta = doc.getElementById('stPrompt');
  assert.match(ta.placeholder, /Naskah/i);
});

test('D-242: bar karakter hanya tampil di mode lipsync', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const bar = doc.getElementById('stLipsyncBar');
  assert.ok(bar.classList.contains('st-hidden'), 'mode foto -> bar karakter hidden');
  assert.ok(doc.getElementById('stLipsyncBtn').classList.contains('st-hidden'));
  // Pindah ke video -> tetap hidden.
  await pickContentType(win, doc, 'video');
  assert.ok(bar.classList.contains('st-hidden'), 'mode video -> bar karakter hidden');
});

test('D-242: fallback katalog lipsync frontend sinkron dengan server', async () => {
  const studioSrc = readFileSync('public/studio.js', 'utf8');
  assert.ok(studioSrc.includes("id: 'infinitalk/from-audio'"), 'fallback harus punya InfiniteTalk');
  assert.ok(studioSrc.includes("label: 'InfiniteTalk'"));
  assert.ok(studioSrc.includes('FALLBACK_LIPSYNC_MODELS'));
  assert.ok(studioSrc.includes('/api/ai/lipsync/models'), 'frontend harus ambil katalog dari server');
});

test('D-242: generate lipsync mengirim characterId, script, model, resolusi & aspect', async () => {
  let captured = null;
  const lipFetch = async (url, opts) => {
    const u = String(url || '');
    if (u.includes('/api/ai/lipsync') && (opts && opts.method === 'POST')) {
      captured = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true, id: 'task-1', task_id: 'kie-1', model: 'infinitalk/from-audio' }) };
    }
    if (u.includes('/api/ai/lipsync/models')) {
      return { ok: true, json: async () => ({ ok: true, defaultModel: 'infinitalk/from-audio', maxSeconds: 15, models: [
        { id: 'infinitalk/from-audio', provider: 'kie', label: 'InfiniteTalk', maker: 'MeiGen-AI',
          resolutions: ['480p', '720p'], aspects: ['16:9', '9:16', '1:1'], maxSeconds: 15,
          defaultResolution: '720p', defaultAspect: '9:16' }] }) };
    }
    if (u.includes('/api/characters')) {
      return { ok: true, json: async () => ({ characters: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Sherly', reference_image_path: 'a.png', voice: { name: 'Zephyr' } }] }) };
    }
    return { ok: true, json: async () => (u.includes('/api/ai/image/models') ? IMAGE_CATALOG : u.includes('/api/prompt-bank') ? PROMPT_BANK : CATALOG) };
  };
  const { win, doc } = buildStudio(lipFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  // Matikan timer polling supaya test tidak menggantung.
  const realSetTimeout = win.setTimeout;
  win.setTimeout = (fn, ms) => (ms >= 1000 ? 0 : realSetTimeout(fn, ms));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  // Masuk mode lipsync lewat panel pengaturan (D-247).
  await pickTypeWithPanel(win, doc, 'lipsync');
  // Pilih karakter di bar lipsync.
  click(doc.getElementById('stLipsyncCharBtn'));
  await new Promise((r) => setTimeout(r, 40));
  const cp = doc.getElementById('stPop-lipsyncchar');
  const ch = [...cp.querySelectorAll('[data-lip-char]')][0];
  assert.ok(ch, 'pilihan karakter tidak dirender');
  click(ch);
  // Tulis naskah lalu klik Buat Video Bicara.
  const ta = doc.getElementById('stPrompt');
  ta.value = 'Halo, aku Sherly.';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  click(doc.getElementById('stLipsyncBtn'));
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(captured, 'request /api/ai/lipsync tidak terkirim');
  assert.equal(captured.characterId, '11111111-1111-4111-8111-111111111111');
  assert.equal(captured.script, 'Halo, aku Sherly.');
  assert.equal(captured.model, 'infinitalk/from-audio');
  assert.equal(captured.resolution, '720p');
  assert.ok(['16:9', '9:16', '1:1'].includes(captured.aspect), 'aspect tidak valid: ' + captured.aspect);
});

test('D-242: generate lipsync menolak tanpa karakter (tidak kirim request)', async () => {
  let posted = false;
  const spyFetch = async (url, opts) => {
    if (String(url || '').includes('/api/ai/lipsync') && opts && opts.method === 'POST') { posted = true; }
    return { ok: true, json: async () => (String(url || '').includes('/api/ai/image/models') ? IMAGE_CATALOG : String(url || '').includes('/api/prompt-bank') ? PROMPT_BANK : CATALOG) };
  };
  const { win, doc } = buildStudio(spyFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await pickTypeWithPanel(win, doc, 'lipsync');
  const ta = doc.getElementById('stPrompt');
  ta.value = 'Halo.';
  click(doc.getElementById('stLipsyncBtn'));
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(posted, false, 'tidak boleh kirim request tanpa karakter');
});

// ===== D-243: tombol generate seragam "Buat" + durasi lipsync otomatis =====

test('D-243: semua tombol generate berlabel "Buat" (seragam, tidak melebar di HP)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const labelOf = (id) => {
    const b = doc.getElementById(id);
    return (b?.textContent || '').replace(/\s+/g, ' ').trim();
  };
  // Mode foto (default).
  assert.equal(labelOf('stGenBtn'), 'Buat', 'tombol foto harus berlabel "Buat"');
  // Mode video.
  await pickTypeWithPanel(win, doc, 'video');
  assert.equal(labelOf('stVideoBtn'), 'Buat', 'tombol video harus berlabel "Buat"');
  // Mode lipsync.
  await pickTypeWithPanel(win, doc, 'lipsync');
  assert.equal(labelOf('stLipsyncBtn'), 'Buat', 'tombol lipsync harus berlabel "Buat"');
  // Semua tombol punya title yang menjelaskan isi (tooltip).
  assert.match(doc.getElementById('stGenBtn').getAttribute('title') || '', /Gambar/i);
  assert.match(doc.getElementById('stVideoBtn').getAttribute('title') || '', /Video/i);
  assert.match(doc.getElementById('stLipsyncBtn').getAttribute('title') || '', /Bicara/i);
});

test('D-243: durasi lipsync otomatis dari panjang naskah (bukan diset di awal)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await pickTypeWithPanel(win, doc, 'lipsync');
  const meta = doc.getElementById('stLipsyncMeta');
  // Tanpa naskah -> hanya info batas.
  assert.match(meta.textContent, /maks 15/i, 'meta harus menyebut batas 15 detik');
  // Naskah pendek -> estimasi detik muncul.
  const ta = doc.getElementById('stPrompt');
  ta.value = 'Halo, aku Sherly.';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  assert.match(meta.textContent, /±\d+ dtk/i, 'estimasi durasi harus tampil: ' + meta.textContent);
  // Naskah panjang -> estimator naik & ditandai peringatan.
  ta.value = 'a'.repeat(600);
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  const warn = /±(\d+) dtk/.exec(meta.textContent);
  assert.ok(warn, 'estimasi durasi harus tampil');
  assert.ok(Number(warn[1]) > 15, 'naskah panjang harus estimasi > 15 detik');
  assert.ok(meta.classList.contains('st-lipsync-meta-warn'), 'naskah melebihi batas harus diberi peringatan');
});

test('D-243: mode lipsync tidak punya pill durasi (durasi mengikuti naskah)', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await pickTypeWithPanel(win, doc, 'lipsync');
  assert.ok(doc.getElementById('stDurPill').classList.contains('st-hidden'), 'pill durasi harus hidden di mode lipsync');
  // Tidak ada popover durasi untuk lipsync.
  assert.equal(doc.getElementById('stPop-dur').children.length, 0, 'popover durasi tidak boleh terisi di mode lipsync');
});

// ===== D-244: arahan adegan + gambar @mention (karakter di lokasi tertentu) =====

test('D-244: mode Karakter Bicara punya input "Arahan adegan" terpisah dari naskah', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  // Box arahan adegan tersembunyi di mode foto.
  assert.ok(doc.getElementById('stSceneHintBox').classList.contains('st-hidden'), 'box arahan harus hidden di mode foto');
  // Masuk mode lipsync.
  await pickTypeWithPanel(win, doc, 'lipsync');
  assert.ok(!doc.getElementById('stSceneHintBox').classList.contains('st-hidden'), 'box arahan harus tampil di mode lipsync');
  assert.ok(doc.getElementById('stSceneHint'), 'textarea arahan adegan harus ada');
  assert.ok(doc.getElementById('stSceneHint').getAttribute('maxlength'), 'textarea arahan adegan punya batas panjang');
  // Placeholder composer naskah menyuruh mention gambar.
  assert.match(doc.getElementById('stPrompt').placeholder, /mention @ gambar/i);
});

test('D-244: request lipsync mengirim arahan adegan sebagai prompt', async () => {
  let captured = null;
  const lipFetch = async (url, opts) => {
    const u = String(url || '');
    if (u.includes('/api/ai/lipsync') && opts && opts.method === 'POST') {
      captured = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true, id: 'task-1', task_id: 'kie-1' }) };
    }
    if (u.includes('/api/ai/lipsync/models')) {
      return { ok: true, json: async () => ({ ok: true, defaultModel: 'infinitalk/from-audio', maxSeconds: 15, models: [
        { id: 'infinitalk/from-audio', provider: 'kie', label: 'InfiniteTalk', maker: 'MeiGen-AI',
          resolutions: ['480p', '720p'], aspects: ['16:9', '9:16', '1:1'], maxSeconds: 15,
          defaultResolution: '720p', defaultAspect: '9:16' }] }) };
    }
    if (u.includes('/api/characters')) {
      return { ok: true, json: async () => ({ characters: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Sherly', reference_image_path: 'a.png', voice: { name: 'Zephyr' } }] }) };
    }
    return { ok: true, json: async () => (u.includes('/api/ai/image/models') ? IMAGE_CATALOG : u.includes('/api/prompt-bank') ? PROMPT_BANK : CATALOG) };
  };
  const { win, doc } = buildStudio(lipFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  const realSetTimeout = win.setTimeout;
  win.setTimeout = (fn, ms) => (ms >= 1000 ? 0 : realSetTimeout(fn, ms));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await pickTypeWithPanel(win, doc, 'lipsync');
  // Pilih karakter.
  click(doc.getElementById('stLipsyncCharBtn'));
  await new Promise((r) => setTimeout(r, 40));
  click(doc.getElementById('stPop-lipsyncchar').querySelector('[data-lip-char]'));
  // Isi arahan adegan + naskah.
  const sh = doc.getElementById('stSceneHint');
  sh.value = 'di studio podcast, kamera close-up';
  sh.dispatchEvent(new win.Event('input', { bubbles: true }));
  const ta = doc.getElementById('stPrompt');
  ta.value = 'Halo, aku Sherly.';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  click(doc.getElementById('stLipsyncBtn'));
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(captured, 'request lipsync tidak terkirim');
  assert.equal(captured.prompt, 'di studio podcast, kamera close-up', 'arahan adegan harus dikirim sebagai prompt');
  assert.equal(captured.script, 'Halo, aku Sherly.', 'naskah harus dikirim terpisah');
  // Tanpa mention gambar -> tidak ada referenceImage (backend pakai potret karakter).
  assert.equal(captured.referenceImage, undefined, 'tanpa mention tidak boleh kirim referenceImage');
});

test('D-244: karakter tanpa potret tidak bisa dipilih (picker hanya karakter berpotret)', async () => {
  const spyFetch = async (url) => {
    const u = String(url || '');
    if (u.includes('/api/characters')) {
      return { ok: true, json: async () => ({ characters: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'TanpaPotret', voice: { name: 'Zephyr' } },
        { id: '22222222-2222-4222-8222-222222222222', name: 'AdaPotret', reference_image_path: 'a.png' }] }) };
    }
    return { ok: true, json: async () => (u.includes('/api/ai/image/models') ? IMAGE_CATALOG : u.includes('/api/prompt-bank') ? PROMPT_BANK : CATALOG) };
  };
  const { win, doc } = buildStudio(spyFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await pickTypeWithPanel(win, doc, 'lipsync');
  click(doc.getElementById('stLipsyncCharBtn'));
  await new Promise((r) => setTimeout(r, 40));
  const ids = [...doc.getElementById('stPop-lipsyncchar').querySelectorAll('[data-lip-char]')].map((b) => b.dataset.lipChar);
  assert.deepEqual(ids, ['22222222-2222-4222-8222-222222222222'], 'hanya karakter berpotret yang bisa dipilih');
});

// ===== D-245: provider & model lipsync bisa dipilih =====

const LIP_CATALOG = {
  ok: true, defaultModel: 'infinitalk/from-audio', maxSeconds: 15,
  providers: [{ id: 'kie', label: 'Kie AI', note: 'Semua model lipsync via satu kunci Kie' }],
  models: [
    { id: 'infinitalk/from-audio', provider: 'kie', label: 'InfiniteTalk', maker: 'MeiGen-AI',
      resolutions: ['480p', '720p'], aspects: ['16:9', '9:16', '1:1'], maxSeconds: 15,
      note: 'n', defaultResolution: '720p', defaultAspect: '9:16' },
    { id: 'ltx/2-5-fast-audio-to-video', provider: 'kie', label: 'LTX 2.5 Fast A2V', maker: 'Lightricks',
      resolutions: ['720p', '1080p', '1440p'], aspects: ['16:9', '9:16', '1:1', '3:2', '2:3'], maxSeconds: 20,
      note: 'n', defaultResolution: '1080p', defaultAspect: '9:16' },
    { id: 'omnihuman-1-5', provider: 'kie', label: 'OmniHuman 1.5', maker: 'ByteDance',
      resolutions: ['720P', '1080P'], aspects: ['16:9', '9:16', '1:1', '4:5', '3:4'], maxSeconds: 60,
      note: 'n', defaultResolution: '1080P', defaultAspect: '9:16', promptMax: 300, fullBody: true, minSeconds: 1 },
    { id: 'omnihuman-2-0', provider: 'kie', label: 'OmniHuman 2.0', maker: 'ByteDance',
      resolutions: ['720p'], aspects: ['16:9', '9:16', '1:1', '4:5', '3:4'], maxSeconds: 300,
      note: 'n', defaultResolution: '720p', defaultAspect: '9:16', promptMax: 300, fullBody: true, minSeconds: 4 },
  ],
};

function lipFetchCapture(capture) {
  return async (url, opts) => {
    const u = String(url || '');
    if (u.includes('/api/ai/lipsync') && opts && opts.method === 'POST') {
      capture.body = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true, id: 'task-1', task_id: 'kie-1' }) };
    }
    if (u.includes('/api/ai/lipsync/models')) return { ok: true, json: async () => JSON.parse(JSON.stringify(LIP_CATALOG)) };
    if (u.includes('/api/characters')) {
      return { ok: true, json: async () => ({ characters: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Sherly', reference_image_path: 'a.png', voice: { name: 'Zephyr' } }] }) };
    }
    return { ok: true, json: async () => (u.includes('/api/ai/image/models') ? IMAGE_CATALOG : u.includes('/api/prompt-bank') ? PROMPT_BANK : CATALOG) };
  };
}

async function switchToLipsync(win, doc) {
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  // D-247: jenis konten dipilih dari PANEL pengaturan (HP & PC sama).
  click(doc.getElementById('stTypePill'));
  await new Promise((r) => setTimeout(r, 60));
  const panel = doc.getElementById('stPop-settings');
  click([...panel.querySelectorAll('[data-set-key="type"]')].find((b) => b.dataset.setV === 'lipsync'));
  await new Promise((r) => setTimeout(r, 60));
  // D-231: terapkan lewat Simpan.
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  return click;
}

/** Buka panel "Pengaturan Konten" (layout mobile => innerWidth <= 560). */
async function openSettings(win, doc) {
  Object.defineProperty(win, 'innerWidth', { value: 390, configurable: true });
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  click(doc.getElementById('stTypePill'));
  await new Promise((r) => setTimeout(r, 80));
  return click;
}

test('D-245: pill Provider & Resolusi tampil di mode Karakter Bicara', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  // Di mode foto -> pill provider tampil, pill resolusi lipsync hidden.
  assert.ok(!doc.getElementById('stEnginePillWrap').classList.contains('st-hidden'), 'pill provider tampil di mode foto');
  assert.ok(doc.getElementById('stLipResPillWrap').classList.contains('st-hidden'), 'pill resolusi lipsync hidden di mode foto');
  const click = await switchToLipsync(win, doc);
  assert.ok(!doc.getElementById('stEnginePillWrap').classList.contains('st-hidden'), 'pill provider harus tampil di mode lipsync');
  assert.ok(!doc.getElementById('stLipResPillWrap').classList.contains('st-hidden'), 'pill resolusi lipsync harus tampil di mode lipsync');
  assert.equal(doc.querySelector('#stEnginePill b').textContent.trim(), 'Kie AI');
});

test('D-245: panel Pengaturan Konten punya grup Provider, Model, Resolusi untuk lipsync', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  const labels = [...panel.querySelectorAll('.st-set-label b')].map((b) => b.textContent);
  assert.ok(labels.includes('Provider'), 'grup Provider harus ada: ' + labels.join(','));
  assert.ok(labels.includes('Model'), 'grup Model harus ada: ' + labels.join(','));
  assert.ok(labels.includes('Resolusi'), 'grup Resolusi harus ada: ' + labels.join(','));
  // Pilihan provider lipsync hanya Kie AI.
  const provs = [...panel.querySelectorAll('[data-set-key="engine"]')].map((b) => b.dataset.setV);
  assert.deepEqual(provs, ['kie'], 'provider lipsync hanya Kie AI');
  // Ada 4 model lipsync (D-246: + OmniHuman 1.5 & 2.0).
  const models = [...panel.querySelectorAll('[data-set-key="lipmodel"]')].map((b) => b.dataset.setV);
  assert.deepEqual(models, [
    'infinitalk/from-audio', 'ltx/2-5-fast-audio-to-video', 'omnihuman-1-5', 'omnihuman-2-0']);
});

test('D-245: ganti model lipsync -> resolusi ikut ke default model baru & tersimpan', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  click(panel.querySelector('[data-set-key="lipmodel"][data-set-v="ltx/2-5-fast-audio-to-video"]'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  // Resolusi LTX default 1080p.
  assert.equal(doc.querySelector('#stLipResPill b').textContent.trim(), '1080p');
  // Bar karakter menampilkan model LTX + provider Kie AI + maks 20 dtk.
  const meta = doc.getElementById('stLipsyncMeta').textContent;
  assert.match(meta, /Kie AI/, 'meta harus menyebut provider: ' + meta);
  assert.match(meta, /LTX 2\.5/, 'meta harus menyebut model: ' + meta);
  assert.match(meta, /maks 20/, 'meta harus menyebut batas 20 detik: ' + meta);
  // Buka panel lagi -> pilihan tersimpan.
  const click2 = await openSettings(win, doc);
  const p2 = doc.getElementById('stPop-settings');
  const on = [...p2.querySelectorAll('[data-set-key="lipmodel"]')].find((b) => b.classList.contains('on'));
  assert.equal(on?.dataset.setV, 'ltx/2-5-fast-audio-to-video', 'model lipsync harus tersimpan');
  const onRes = [...p2.querySelectorAll('[data-set-key="lipres"]')].find((b) => b.classList.contains('on'));
  assert.equal(onRes?.dataset.setV, '1080p', 'resolusi lipsync harus tersimpan');
});

test('D-245: request lipsync mengirim provider & resolusi terpilih', async () => {
  const capture = {};
  const { win, doc } = buildStudio(lipFetchCapture(capture));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  const realSetTimeout = win.setTimeout;
  win.setTimeout = (fn, ms) => (ms >= 1000 ? 0 : realSetTimeout(fn, ms));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  // Pilih model LTX + resolusi 1440p.
  const panel = doc.getElementById('stPop-settings');
  click(panel.querySelector('[data-set-key="lipmodel"][data-set-v="ltx/2-5-fast-audio-to-video"]'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stLipResPill'));
  await new Promise((r) => setTimeout(r, 40));
  click([...doc.getElementById('stPop-lipres').querySelectorAll('button')].find((b) => b.dataset.v === '1440p'));
  // Pilih karakter + naskah.
  click(doc.getElementById('stLipsyncCharBtn'));
  await new Promise((r) => setTimeout(r, 40));
  click(doc.getElementById('stPop-lipsyncchar').querySelector('[data-lip-char]'));
  const ta = doc.getElementById('stPrompt');
  ta.value = 'Halo, aku Sherly.';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  click(doc.getElementById('stLipsyncBtn'));
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(capture.body, 'request lipsync tidak terkirim');
  assert.equal(capture.body.model, 'ltx/2-5-fast-audio-to-video');
  assert.equal(capture.body.provider, 'kie');
  assert.equal(capture.body.resolution, '1440p');
});

// ===== D-246: OmniHuman 1.5 & 2.0 sebagai model Karakter Bicara =====

test('D-246: panel model lipsync menampilkan 4 model (2 OmniHuman baru)', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  const models = [...panel.querySelectorAll('[data-set-key="lipmodel"]')].map((b) => b.dataset.setV);
  assert.equal(models.length, 4, 'harus ada 4 model lipsync');
  assert.ok(models.includes('omnihuman-1-5'), 'OmniHuman 1.5 harus bisa dipilih');
  assert.ok(models.includes('omnihuman-2-0'), 'OmniHuman 2.0 harus bisa dipilih');
});

test('D-246: pilih OmniHuman 1.5 -> resolusi 1080P & batas 60 detik di meta', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  click(panel.querySelector('[data-set-key="lipmodel"][data-set-v="omnihuman-1-5"]'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(doc.querySelector('#stLipResPill b').textContent.trim(), '1080P');
  const meta = doc.getElementById('stLipsyncMeta').textContent;
  assert.match(meta, /OmniHuman 1\.5/, 'meta harus menyebut model: ' + meta);
  assert.match(meta, /maks 60/, 'meta harus menyebut batas 60 detik: ' + meta);
});

test('D-246: pilih OmniHuman 2.0 -> hanya resolusi 720p & batas 300 detik', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  click(panel.querySelector('[data-set-key="lipmodel"][data-set-v="omnihuman-2-0"]'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(doc.querySelector('#stLipResPill b').textContent.trim(), '720p');
  const meta = doc.getElementById('stLipsyncMeta').textContent;
  assert.match(meta, /OmniHuman 2\.0/, 'meta harus menyebut model: ' + meta);
  assert.match(meta, /maks 300/, 'meta harus menyebut batas 300 detik: ' + meta);
});

test('D-246: request lipsync OmniHuman 2.0 mengirim model & resolusi 720p', async () => {
  const capture = {};
  const { win, doc } = buildStudio(lipFetchCapture(capture));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  const realSetTimeout = win.setTimeout;
  win.setTimeout = (fn, ms) => (ms >= 1000 ? 0 : realSetTimeout(fn, ms));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  click(panel.querySelector('[data-set-key="lipmodel"][data-set-v="omnihuman-2-0"]'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stLipsyncCharBtn'));
  await new Promise((r) => setTimeout(r, 40));
  click(doc.getElementById('stPop-lipsyncchar').querySelector('[data-lip-char]'));
  const ta = doc.getElementById('stPrompt');
  ta.value = 'Halo, aku Sherly. Ini perkenalan singkat hari ini.';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  click(doc.getElementById('stLipsyncBtn'));
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(capture.body, 'request lipsync tidak terkirim');
  assert.equal(capture.body.model, 'omnihuman-2-0');
  assert.equal(capture.body.resolution, '720p');
});

test('D-246: arahan adegan dibatasi 300 karakter untuk OmniHuman (5.000 untuk model lain)', async () => {
  const { win, doc } = buildStudio(lipFetchCapture({}));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  await switchToLipsync(win, doc);
  const click = await openSettings(win, doc);
  const panel = doc.getElementById('stPop-settings');
  const hint = doc.getElementById('stSceneHint');
  click(panel.querySelector('[data-set-key="lipmodel"][data-set-v="omnihuman-1-5"]'));
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(hint.getAttribute('maxlength'), '300', 'prompt OmniHuman dibatasi 300 karakter');
});

// ===== D-247: composer flow (transparan, compact, center horizontal) & panel HP=PC =====

test('D-247: PC & HP sama-sama buka panel Pengaturan dari pill jenis konten', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  // Layout desktop (default jsdom innerWidth = 1024).
  click(doc.getElementById('stTypePill'));
  await new Promise((r) => setTimeout(r, 60));
  const panel = doc.getElementById('stPop-settings');
  assert.ok(panel.classList.contains('open'), 'panel pengaturan harus terbuka di desktop');
  assert.ok(!panel.classList.contains('st-pop-center'), 'di desktop panel bukan modal tengah');
  // Panel punya grup Jenis Konten dengan 3 pilihan.
  const types = [...panel.querySelectorAll('[data-set-key="type"]')].map((b) => b.dataset.setV);
  // D-249: mode "Motion Graphics" ikut jadi pilihan jenis konten.
  assert.deepEqual(types, ['photo', 'video', 'lipsync', 'motion'], 'pilihan jenis konten di panel');
  // Panel adalah anak composer (posisi dropdown stabil).
  assert.ok(panel.closest('.st-composer'), 'panel pengaturan harus anak composer');
});

test('D-247: HP membuka panel sebagai modal tengah', async () => {
  const { win, doc } = buildStudio(okFetch);
  Object.defineProperty(win, 'innerWidth', { value: 390, configurable: true });
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  click(doc.getElementById('stTypePill'));
  await new Promise((r) => setTimeout(r, 60));
  const panel = doc.getElementById('stPop-settings');
  assert.ok(panel.classList.contains('open'), 'panel pengaturan harus terbuka di HP');
  assert.ok(panel.classList.contains('st-pop-center'), 'di HP panel harus modal tengah');
});

test('D-247: pill baris (Rasio/Mesin/Model/Duration) tidak lagi tampil sebagai baris', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 60));
  const pills = doc.getElementById('stSettingsPills');
  assert.ok(pills, 'container stSettingsPills harus tetap ada di markup');
  // CSS menyembunyikannya di semua device (HP & PC) -> isi panel satu-satunya sumber.
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(/\.st-settings-pills\{display:none!important\}/.test(css),
    '.st-settings-pills harus tersembunyi di semua device');
  // Button model gambar TIDAK lagi jadi pill terpisah (masih ada di markup tapi disembunyikan).
  const imgWrap = doc.getElementById('stImgModelPillWrap');
  assert.ok(imgWrap.closest('#stSettingsPills'), 'pill model gambar harus di dalam container yang disembunyikan');
});

test('D-247: markup composer — textarea 1 baris (auto-grow) & panel di dalam composer', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('id="stPrompt" rows="1"'), 'textarea prompt mulai 1 baris (auto-grow)');
  // Panel pengaturan berada di dalam composer (bukan di dalam .st-controls).
  const compStart = studio.indexOf("'<div class=\"st-composer\">'");
  const compEnd = studio.indexOf("'<input type=\"file\" id=\"stUploadInput\"");
  const comp = studio.slice(compStart, compEnd);
  assert.ok(comp.includes('id="stPop-settings"'), 'panel pengaturan harus di dalam composer');
  assert.ok(comp.includes('id="stControlsHint"') || comp.includes('class="st-controls"'),
    'sanity: composer punya blok controls');
});

test('D-247: panel pengaturan di dalam composer, tapi DI LUAR baris kontrol', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const ctrlStart = studio.indexOf("'<div class=\"st-controls\">'");
  const ctrlEnd = studio.indexOf("'<span class=\"st-count\"");
  const ctrl = studio.slice(ctrlStart, ctrlEnd);
  assert.ok(!ctrl.includes('id="stPop-settings"'), 'panel tak boleh di dalam .st-controls');
});

// ===== D-254: Studio full-page — galeri mengalir, composer sticky, video 9:16 utuh =====

test('D-254: view Studio jadi full-page (min-height, bukan fixed height)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/#studioView\.active\{([^}]*)\}/);
  assert.ok(rule, 'aturan #studioView.active tidak ada');
  assert.ok(rule[1].includes('min-height:'), 'view Studio harus pakai min-height (bukan height tetap)');
  // Tidak boleh ada `height:` TETAP — hanya min-height & height:auto.
  const heights = [...rule[1].matchAll(/(^|;)\s*height:([^;]+)/g)].map((m) => m[2].trim());
  assert.ok(heights.every((h) => h === 'auto'),
    'view Studio tidak boleh punya height tetap (halaman harus scroll natural): ' + heights.join(','));
});

test('D-254: galeri bukan scroll container internal (halaman luar yang bergulir)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-stage\{([^}]*)\}/);
  assert.ok(rule, 'aturan .st-stage tidak ada');
  assert.ok(!/overflow-y:auto/.test(rule[1]), 'galeri tidak boleh jadi scroll container internal');
  assert.ok(!/overflow:auto/.test(rule[1]), 'galeri tidak boleh jadi scroll container internal');
  // Galeri menyisakan ruang bawah untuk composer (fixed).
  assert.ok(rule[1].includes('--st-composer-h'), 'galeri harus menyisakan ruang untuk composer');
});

test('D-254: dock composer fixed (nempel di bawah viewport) & pointer-events none', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-composer-dock\{([^}]*)\}/);
  assert.ok(rule, 'aturan .st-composer-dock tidak ada');
  assert.ok(rule[1].includes('position:fixed'), 'dock harus fixed');
  assert.ok(rule[1].includes('bottom:0'), 'dock harus di bawah');
  assert.ok(rule[1].includes('pointer-events:none'), 'dock tidak boleh menghalang klik ke galeri');
  assert.ok(rule[1].includes('align-items:flex-end'), 'composer harus di dasar dock');
  // Composer (anak dock) tetap bisa diklik.
  const comp = css.match(/\.st-composer\{([^}]*)\}/);
  assert.ok(comp[1].includes('pointer-events:auto'), 'composer harus bisa diklik');
});

test('D-254: di HP composer nempel DI ATAS tabbar bawah (kapsul menu)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const mob = css.match(/@media\(max-width:850px\)\{[^}]*\.st-composer-dock\{([^}]*)\}/s);
  assert.ok(mob, 'aturan dock composer untuk HP tidak ada');
  assert.ok(mob[1].includes('bottom:'), 'dock HP harus punya offset bottom');
  assert.ok(/68px/.test(mob[1]), 'dock HP harus menyisakan ruang untuk tabbar (68px)');
});

test('D-254: tinggi composer disinkronkan ke CSS var (ruang bawah galeri)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('--st-composer-h'), 'tinggi composer harus disinkronkan ke CSS var');
  assert.ok(studio.includes('ResizeObserver'), 'perubahan tinggi composer harus dipantau');
  assert.ok(studio.includes("root.style.setProperty('--st-composer-h'"), 'CSS var harus di-set');
});

test('D-254: aset portrait (video 9:16) tidak terpotong — rasio item ikut metadata', async () => {
  const { win, doc } = buildStudio(async (url) => {
    const u = String(url || '');
    if (u.includes('/api/studio/assets')) {
      return { ok: true, json: async () => ({ ok: true, assets: [
        { id: 'v1', file_name: 'vid.mp4', media_type: 'video', kind: 'generate', url: '/x.mp4', width: 1080, height: 1920 },
        { id: 'p1', file_name: 'foto.png', media_type: 'image', kind: 'upload', url: '/x.png', width: 1024, height: 1024 },
      ] }) };
    }
    return { ok: true, json: async () => (u.includes('/api/ai/image/models') ? IMAGE_CATALOG : u.includes('/api/prompt-bank') ? PROMPT_BANK : CATALOG) };
  });
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  const items = [...doc.querySelectorAll('.st-gal-item')];
  assert.equal(items.length, 2, 'harus ada 2 aset di galeri');
  const vid = items.find((i) => i.querySelector('video'));
  const img = items.find((i) => i.querySelector('img'));
  assert.ok(vid, 'item video harus ada');
  assert.ok(img, 'item gambar harus ada');
  // Item video portrait -> kelas khusus + aspect-ratio inline (9:16).
  assert.ok(vid.classList.contains('st-gal-item--portrait'), 'item video portrait harus punya kelas portrait');
  const vStyle = vid.getAttribute('style') || '';
  const vRatio = /aspect-ratio:([\d.]+)/.exec(vStyle);
  assert.ok(vRatio, 'item video harus punya aspect-ratio inline, dapat ' + vStyle);
  assert.ok(Math.abs(Number(vRatio[1]) - 9 / 16) < 0.01,
    'item video harus ikut rasio 9:16, dapat ' + vRatio[1]);
  // D-255: gambar juga ikut rasio aslinya (compact packing) — gambar 1:1
  // tetap rasio 1 (kotak) tapi BUKAN punya kelas portrait.
  assert.ok(!img.classList.contains('st-gal-item--portrait'), 'gambar 1:1 bukan portrait');
  assert.ok(/aspect-ratio:1/.test(img.getAttribute('style') || ''),
    'gambar 1:1 harus tetap rasio 1, dapat ' + img.getAttribute('style'));
  // D-256: kartu galeri ala Beranda -> thumbnail dipotong rapi (`cover`),
  // aset UTUH tetap bisa dilihat lewat preview (`contain`).
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(/\.st-gal-thumb img,\s*\.st-gal-thumb video\{[^}]*object-fit:cover/.test(css),
    'media thumbnail harus object-fit:cover');
  assert.ok(css.includes('.st-lb-body .st-lb-media{object-fit:contain'),
    'media preview harus object-fit:contain (aset utuh)');
});

test('D-254: fallback rasio video 9:16 saat metadata width/height kosong', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function assetRatio('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("a?.media_type === 'video'"), 'video tanpa metadata harus fallback');
  // D-257: video tanpa dimensi TIDAK boleh diasumsikan vertikal (9:16) —
  // default 16:9 (horizontal) sampai dimensi_asli terdeteksi.
  assert.ok(body.includes('16 / 9'), 'fallback video harus 16:9 (bukan 9:16)');
  assert.ok(body.includes('return 1;'), 'gambar tanpa metadata harus fallback 1:1');
});

test('D-254: galeri & composer — dock terpisah dari stage di markup studio.js', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('class="st-composer-dock"'), 'dock composer harus ada di markup');
  assert.ok(studio.includes('class="st-stage"'), 'stage galeri harus ada di markup');
  // Composer DI DALAM dock; stage (galeri) DI LUAR dock -> dock jadi overlay
  // fixed di atas galeri, galeri tetap mengalir di flow dokumen.
  const dockIdx = studio.indexOf('class="st-composer-dock"');
  const stageIdx = studio.indexOf('class="st-stage"');
  assert.ok(dockIdx > -1 && stageIdx > -1, 'dock & stage harus ada');
  // Stage harus berada SETELAH markup dock (dock ditutup 2x: composer + dock).
  const lightboxIdx = studio.indexOf('class="st-lightbox"');
  const afterLightbox = studio.slice(lightboxIdx, lightboxIdx + 400);
  assert.ok(/'\s*\+\s*'<\/div>'\s*\+\s*'<\/div>'/.test(afterLightbox) ||
    /\+\s*'<\/div>'[\s\S]{0,40}\+\s*'<\/div>'/.test(afterLightbox),
    'dock harus ditutup (composer + dock) sebelum markup stage: ' + afterLightbox.slice(0, 160));
});

// ===== D-255: galeri compact (masonry) + preview ukuran asli + autoplay video =====

test('D-255: galeri pakai masonry multi-column (vertikal & horizontal saling isi)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Mode packed: container jadi multi-column, item = blok utuh.
  assert.ok(css.includes('.st-gal-row--packed{display:block'), 'mode packed baris harus ada');
  assert.ok(css.includes('break-inside:avoid'), 'item galeri tidak boleh terpotong antar kolom');
  // Jarak diatur lewat CSS var (bisa user atur sendiri).
  assert.ok(css.includes('--st-gal-gap'), 'jarak galeri harus pakai CSS var');
  assert.ok(css.includes('--st-gal-mincol'), 'lebar kolom minimal harus pakai CSS var');
  // Thumbnail lebih kecil dari sebelumnya (D-247: 180px PC / 112px HP).
  // D-261: aturan vertikal sekarang juga punya --st-gal-maxcol.
  assert.ok(/min-width:900px\)\{\.st-gal-row--vertical\{--st-gal-mincol:132px/.test(css),
    'kolom vertikal PC harus 132px');
  assert.ok(mediaBlock(css, 'max-width:560px', '.st-gal-row--vertical{--st-gal-mincol:96px')
    .includes('.st-gal-row--vertical{--st-gal-mincol:96px'),
    'kolom vertikal HP harus 96px');
});

test('D-255: packing gallery dihitung dari rasio aset & tinggi dibatasi (compact)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('function packGallery('), 'packGallery harus ada');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Tinggi item = lebar kolom / rasio.
  // D-258: tinggi item dihitung dari rasio target per baris (median rasio
  // aset), bukan lagi per-item mentah.
  assert.ok(body.includes('targetRatio'), 'tinggi item harus dari rasio target baris');
  assert.ok(body.includes('colW / targetRatio'), 'tinggi item dihitung dari lebar kolom & rasio');
  assert.ok(!body.includes('maxH'), 'tinggi item tidak lagi dibatasi');
  // D-258: mode masonry kolom (bukan multi-column).
  assert.ok(body.includes('st-gal-col'), 'harus memakai wrapper kolom');
  assert.ok(body.includes("st-gal-row--masonry"), 'harus menandai mode masonry');
  // Dijalankan setelah layout terhitung (requestAnimationFrame).
  assert.ok(studio.includes('requestAnimationFrame'), 'packing harus dijadwalkan setelah layout');
  // Resize -> packing diulang.
  assert.ok(studio.includes("window.addEventListener('resize'"), 'packing harus diulang saat resize');
});

test('D-255: tinggi item portrait dibatasi tapi video tetap utuh (contain)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Aset portrait tetap pakai contain -> tidak ada crop.
  // D-256: kartu galeri sekarang ala Beranda — thumbnail dipotong rapi
  // (`cover`), dan aset UTUH dilihat lewat preview (`contain`).
  assert.ok(/\.st-gal-thumb img,\s*\.st-gal-thumb video\{[^}]*object-fit:cover/.test(css),
    'media thumbnail harus object-fit:cover');
  assert.ok(css.includes('.st-lb-body .st-lb-media{object-fit:contain'),
    'media preview harus contain (aset utuh)');
});

test('D-255: video thumbnail punya loop + muted (autoplay tanpa suara)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function assetThumb('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('muted'), 'video thumbnail harus muted');
  assert.ok(body.includes('loop'), 'video thumbnail harus loop (berulang)');
  assert.ok(body.includes('playsinline'), 'video thumbnail harus playsinline');
});

test('D-255: autoplay video — PC hover, HP klik', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  // Helper putar.
  assert.ok(studio.includes('function playThumbVideo('), 'playThumbVideo harus ada');
  assert.ok(studio.includes('function pauseThumbVideo('), 'pauseThumbVideo harus ada');
  assert.ok(studio.includes('function pauseAllThumbVideos('), 'pauseAllThumbVideos harus ada');
  // PC: pointerenter / pointerleave.
  assert.ok(studio.includes("addEventListener('pointerenter'"), 'harus listen pointerenter (hover PC)');
  assert.ok(studio.includes("addEventListener('pointerleave'"), 'harus listen pointerleave (hover PC)');
  // HP: klik = putar di tempat, klik kedua = buka preview.
  const rf = studio.slice(studio.indexOf('function renderGallery('));
  const rbody = rf.slice(0, rf.indexOf('\n  }'));
  assert.ok(rbody.includes("a.media_type === 'video' && isMobileLayout()"),
    'di HP klik video harus autoplay di tempat');
  assert.ok(rbody.includes('playThumbVideo(b)'), 'klik HP harus memanggil playThumbVideo');
  assert.ok(rbody.includes('openPreview(a)'), 'klik kedua harus membuka preview');
  // Item yang diputar diberi penanda.
  assert.ok(studio.includes("classList.add('is-playing')"), 'itemplaying harus diberi kelas');
  assert.ok(studio.includes("classList.remove('is-playing')"), 'kelas is-playing harus dilepas saat berhenti');
});

test('D-255: preview aset menampilkan ukuran asli', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function openPreview('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Baris info ukuran asli.
  assert.ok(body.includes('st-lb-meta'), 'harus ada baris info ukuran asli');
  assert.ok(body.includes('Ukuran asli'), 'teks ukuran asli harus ada');
  assert.ok(body.includes('px'), 'ukuran asli harus ditampilkan dalam px');
  // Video di preview autoplay + loop.
  assert.ok(body.includes('autoplay loop playsinline'), 'video preview harus autoplay + loop');
  // CSS baris info.
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('.st-lb-meta{'), 'CSS .st-lb-meta harus ada');
  assert.ok(css.includes('.st-lb-meta-ico'), 'CSS ikon ukuran harus ada');
  // Media di preview tidak boleh di-crop.
  assert.ok(css.includes('.st-lb-body .st-lb-media{object-fit:contain'),
    'media preview harus contain (tampilkan ukuran asli)');
  // Ikon maximize dipakai & tersedia di ICONS.
  assert.ok(studio.includes("icon('maximize')"), 'harus pakai ikon maximize');
  assert.ok(css.includes("'maximize':'<"), "ICONS harus punya ikon 'maximize'");
});

test('D-255: tooltip thumbnail menampilkan ukuran aset', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function assetCardHtml('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('a.width'), 'tooltip harus memakai lebar aset');
  assert.ok(body.includes('a.height'), 'tooltip harus memakai tinggi aset');
  assert.ok(body.includes('x'), 'tooltip harus menyatukan ukuran');
});

// ===== D-256: pola galeri ala Beranda — baris VERTIKAL & HORIZONTAL terpisah =====

test('D-256: galeri dipisah jadi baris Vertikal & Horizontal (ala Beranda)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const rf = studio.slice(studio.indexOf('function renderGallery('));
  const body = rf.slice(0, rf.indexOf('\n  }'));
  assert.ok(body.includes("st-gal-row--vertical"), 'baris vertikal harus ada');
  assert.ok(body.includes("st-gal-row--horizontal"), 'baris horizontal harus ada');
  assert.ok(body.includes("rowHtml('Vertikal'"), 'harus ada judul baris Vertikal');
  assert.ok(body.includes("rowHtml('Horizontal'"), 'harus ada judul baris Horizontal');
  // Pengelompokan berdasarkan rasio.
  assert.ok(body.includes('isPortraitRatio(assetRatio(a))'), 'aset dipisah berdasarkan rasio');
});

test('D-256: HP 3 grid vertikal & 3 grid horizontal', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Vertikal: kolom minimum kecil (3 kolom muat di HP).
  // D-261: aturan sekarang juga punya --st-gal-maxcol.
  assert.ok(css.includes('.st-gal-row--vertical{--st-gal-mincol:104px;'),
    'aturan baris vertikal harus ada');
  assert.ok(mediaBlock(css, 'max-width:560px', '.st-gal-row--vertical{--st-gal-mincol:96px')
    .includes('.st-gal-row--vertical{--st-gal-mincol:96px'),
    'vertikal HP mincol 96px (3 grid)');
  // Horizontal: D-263 menaikkan dari 2 -> 3 grid di HP (mincol 115px).
  assert.ok(css.includes('.st-gal-row--horizontal{--st-gal-mincol:150px;'),
    'aturan baris horizontal harus ada');
  assert.ok(mediaBlock(css, 'max-width:560px', '.st-gal-row--horizontal{--st-gal-mincol:115px')
    .includes('.st-gal-row--horizontal{--st-gal-mincol:115px'),
    'horizontal HP mincol 115px (3 grid, D-263)');
  // Media query HP override.
  assert.ok(mediaBlock(css, 'max-width:560px', '.st-gal-row--vertical{--st-gal-mincol:96px')
    .includes('.st-gal-row--vertical{--st-gal-mincol:96px'),
    'media query HP untuk baris vertikal harus ada');
  assert.ok(mediaBlock(css, 'max-width:560px', '.st-gal-row--horizontal{--st-gal-mincol:115px')
    .includes('.st-gal-row--horizontal{--st-gal-mincol:115px'),
    'media query HP untuk baris horizontal harus ada');
});

test('D-256: kartu galeri ala Beranda (cover, border, hover)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Thumbnail pakai cover (potong rapi) seperti kartu "Produksi Terbaru".
  assert.ok(/\.st-gal-thumb img,\s*\.st-gal-thumb video\{[^}]*object-fit:cover/.test(css),
    'thumbnail harus object-fit:cover');
  // Judul baris dengan garis pemisah seperti section-head Beranda.
  assert.ok(css.includes('.st-gal-row-head h3{'), 'judul baris harus ada');
  assert.ok(css.includes('.st-gal-row-head::after{'), 'garis pemisah judul baris harus ada');
  // Ikon orientasi baru.
  assert.ok(css.includes("'smartphone':'"), "ICONS harus punya ikon 'smartphone'");
  assert.ok(css.includes("'monitor':'"), "ICONS harus punya ikon 'monitor'");
});

test('D-256: packing per baris pakai column-count & tinggi ikut rasio', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("querySelectorAll('.st-gal-row')"), 'packing harus per baris');
  // D-258: masonry sejati -> wrapper kolom, bukan CSS multi-column.
  assert.ok(body.includes('st-gal-col'), 'baris harus jadi masonry kolom');
  assert.ok(body.includes('st-gal-row--masonry'), 'harus menandai baris masonry');
  assert.ok(body.includes('colW / targetRatio'), 'tinggi item harus dari rasio target baris');
  // Jumlah kolom dihitung dari lebar baris & mincol (bukan gridTemplateColumns).
  assert.ok(body.includes('--st-gal-mincol'), 'jumlah kolom harus dari --st-gal-mincol');
  assert.ok(body.includes('row.clientWidth'), 'lebar baris dipakai untuk hitung kolom');
  // Baris yang belum punya lebar dilewati (view tersembunyi).
  assert.ok(body.includes('if (!row.clientWidth) return;'), 'baris tanpa lebar harus dilewati');
});

test('D-256: packing diulang saat view jadi terlihat (ResizeObserver)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes('ResizeObserver'), 'harus pakai ResizeObserver');
  assert.ok(studio.includes('ro.observe(box)'), 'galeri harus diobservasi');
  assert.ok(studio.includes("window.addEventListener('resize'"), 'packing diulang saat resize');
});

test('D-256: aset utuh tetap bisa dilihat lewat preview (contain)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Lightbox tetap contain -> ukuran asli utuh, tidak dipotong.
  assert.ok(css.includes('.st-lb-body .st-lb-media{object-fit:contain'),
    'media preview harus contain (ukuran asli utuh)');
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function openPreview('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('st-lb-meta'), 'preview harus menampilkan ukuran asli');
  assert.ok(body.includes('autoplay loop playsinline'), 'video preview autoplay + loop');
});

// ===== D-257: orientasi aset terdeteksi (video horizontal tidak tampil vertikal) =====

test('D-257: upload aset mengirim dimensi file (client)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function readFileSize('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Gambar: naturalWidth/naturalHeight; Video: videoWidth/videoHeight.
  assert.ok(body.includes('naturalWidth'), 'gambar harus dibaca via naturalWidth');
  assert.ok(body.includes('naturalHeight'), 'gambar harus dibaca via naturalHeight');
  assert.ok(body.includes('videoWidth'), 'video harus dibaca via videoWidth');
  assert.ok(body.includes('videoHeight'), 'video harus dibaca via videoHeight');
  // Upload KirstHarus mengirim width/height.
  const up = studio.slice(studio.indexOf('async function uploadAsset('));
  const upbody = up.slice(0, up.indexOf('\n  }'));
  assert.ok(upbody.includes('readFileSize'), 'upload harus memanggil readFileSize');
  assert.ok(upbody.includes("fd.append('width'"), 'upload harus mengirim width');
  assert.ok(upbody.includes("fd.append('height'"), 'upload harus mengirim height');
});

test('D-257: server menyimpan dimensi saat upload & menebak dari header file', () => {
  const app = readFileSync('server/app.js', 'utf8');
  assert.ok(app.includes("import { detectDimensions } from './media-dimensions.js'"),
    'server harus mengimpor detectDimensions');
  const route = app.slice(app.indexOf("app.post('/api/studio/assets'"));
  const rbody = route.slice(0, route.indexOf('\napp.'));
  assert.ok(rbody.includes('detectDimensions'), 'route upload harus menebak dimensi dari file');
  assert.ok(rbody.includes('width: width || undefined'), 'route upload harus menyimpan width');
  assert.ok(rbody.includes('height: height || undefined'), 'route upload harus menyimpan height');
});

test('D-257: ada route PATCH untuk memperbarui dimensi aset', () => {
  const app = readFileSync('server/app.js', 'utf8');
  assert.ok(app.includes("app.patch('/api/studio/assets/:id'"), 'route PATCH harus ada');
  const route = app.slice(app.indexOf("app.patch('/api/studio/assets/:id'"));
  const rbody = route.slice(0, route.indexOf('\napp.'));
  assert.ok(rbody.includes('req.body?.width'), 'PATCH harus membaca width');
  assert.ok(rbody.includes('req.body?.height'), 'PATCH harus membaca height');
  assert.ok(rbody.includes('getAsset'), 'PATCH harus cek kepemilikan aset');
});

test('D-257: galeri mendeteksi orientasi aset lama dari metadata video', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const rf = studio.slice(studio.indexOf('function renderGallery('));
  const body = rf.slice(0, rf.indexOf('\n  }'));
  // Aset tanpa dimensi -> dibaca dari elemen video (loadedmetadata).
  assert.ok(body.includes("vid.addEventListener('loadedmetadata'"), 'harus监听 loadedmetadata');
  assert.ok(body.includes('vid.videoWidth'), 'harus membaca videoWidth');
  assert.ok(body.includes('vid.videoHeight'), 'harus membaca videoHeight');
  // Dimensi disimpan ke server supaya konsisten.
  assert.ok(body.includes("method: 'PATCH'"), 'dimensi harus dikirim ke server');
  assert.ok(body.includes('renderGallery()'), 'galeri harus dirender ulang setelah orientasi diketahui');
});


// D-259: helper — ambil isi blok @media tertentu yang mengandung selector.
function mediaBlock(css, query, mustContain) {
  const re = new RegExp('@media\\(' + query + '\\)\\{', 'g');
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = m.index + m[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    const body = css.slice(m.index + m[0].length, i - 1);
    if (!mustContain || body.includes(mustContain)) return body;
  }
  return '';
}

// ===== D-258: galeri tanpa kotak kosong (masonry kolom seimbang) =====

test('D-258: layout galeri pakai masonry kolom (bukan CSS multi-column)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Wrapper kolom dipakai (masonry sejati).
  assert.ok(body.includes("st-gal-col"), 'harus membuat wrapper kolom');
  assert.ok(body.includes('st-gal-row--masonry'), 'harus menandai mode masonry');
  // Tidak lagi pakai CSS multi-column (penyebab kolom tak seimbang).
  assert.ok(!body.includes('columnCount'), 'tidak boleh memakai columnCount lagi');
  // Posisi kolom dihitung manual.
  assert.ok(body.includes('c.style.left'), 'kolom harus diposisikan manual');
  assert.ok(body.includes('c.style.width'), 'lebar kolom harus diatur manual');
  // CSS mode masonry.
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('.st-gal-row--masonry .st-gal-col{position:absolute'),
    'wrapper kolom harus absolutely positioned');
});

test('D-258: rasio thumbnail diseragamkan per baris (anti rongga)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('median'), 'rasio target dihitung dari median rasio aset');
  assert.ok(body.includes('targetRatio'), 'rasio target harus dipakai');
  // Baris vertikal tetap portrait, horizontal tetap melebar.
  assert.ok(body.includes('Math.min(0.85'), 'baris vertikal dibatasi portrait (maks 0.85)');
  assert.ok(body.includes('Math.max(1.3'), 'baris horizontal dibatasi melebar (min 1.3)');
});

test('D-258: distribute item menyeimbangkan kolom & sisa di kolom tengah', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('const base = Math.floor(total / cols)'), 'jumlah item per kolom dihitung');
  assert.ok(body.includes('const rest = total % cols'), 'sisa item dihitung');
  // D-261: sisa TIDAK lagi ditumpuk di satu kolom tengah (bikin satu kolom
  // jauh lebih tinggi & rongga besar di tengah) -> dibagi satu-satu ke
  // kolom dari kanan ke kiri.
  assert.ok(body.includes('extraCols'), 'sisa item dibagi ke beberapa kolom');
  assert.ok(!body.includes('midIdx'), 'sisa item tidak boleh ditumpuk di kolom tengah');
  assert.ok(body.includes('row.style.height'), 'tinggi baris harus disetel');
});

test('D-258: posisi item stabil saat galeri render ulang (klik/autoplay)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Signature untuk mendeteksi perubahan isi/lebar.
  assert.ok(body.includes('mgSig'), 'harus menyimpan signature packing');
  assert.ok(body.includes('sameShape'), 'packing hanya diulang bila bentuk berubah');
  // Signature memuat daftar id aset -> urutan item menentukan posisinya.
  assert.ok(body.includes("it.dataset.assetOpen || ''"), 'signature harus memuat id aset');
});

// ===== D-259: grid tidak "1 baris"/rata tengah, HP landscape tetap rapi =====

test('D-259: jumlah kolom dibatasi agar tiap kolom terisi (bukan 1 baris)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // D-261: batas kolom berubah dari `floor(items/2)` menjadi `items.length`
  // (tiap kolom minimal 1 item) + minimal 2 kolom, supaya galeri TIDAK
  // lagi jadi "2 kolom" di layar lebar walau ruang di kanan masih kosong.
  assert.ok(body.includes('const maxCols = Math.max(2, items.length)'),
    'jumlah kolom dibatasi jumlah item (tiap kolom >= 1 item)');
  assert.ok(body.includes('Math.min(idealCols, maxCols)'), 'cols harus dibatasi oleh maxCols');
  // Lebar kolom tidak boleh ikut melebar saat jumlah kolom dikurangi.
  assert.ok(body.includes("--st-gal-maxcol"), 'lebar kolom harus dibatasi oleh --st-gal-maxcol');
  assert.ok(!body.includes('minCol * 1.35'),
    'batas lebar kolom tidak lagi hardcoded 1,35x minCol');
});

test('D-259: baris masonry tidak rata tengah (align-content start)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-gal-row--masonry\{([^}]*)\}/);
  assert.ok(rule, 'aturan masonry harus ada');
  assert.ok(rule[1].includes('align-content:start'), 'baris tidak boleh rata tengah');
  assert.ok(rule[1].includes('justify-content:start'), 'konten tidak boleh rata tengah');
});

test('D-259: panel Pengaturan jadi modal tengah juga saat HP dimiringkan', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // Rule modal HP harus ada di @media(max-width:850px) (bukan cuma 560px),
  // supaya tetap berlaku saat HP landscape.
  const m = mediaBlock(css, 'max-width:850px', '.st-pop.st-pop-settings{position:fixed');
  assert.ok(m, 'blok @media(max-width:850px) untuk panel harus ada');
  assert.ok(m.includes('.st-pop.st-pop-settings{position:fixed'),
    'panel Pengaturan harus jadi modal fixed di <= 850px');
  assert.ok(m.includes('translate(-50%,-50%)'), 'modal harus dipusatkan');
});

test('D-259: layar pendek (landscape) — composer ringkas, galeri tak tertutup', () => {
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('@media(max-height:520px)'), 'blok layar pendek harus ada');
  const m = mediaBlock(css, 'max-height:520px', '.st-composer{');
  assert.ok(m, 'isi blok layar pendek harus ada');
  assert.ok(m.includes('.st-composer{'), 'composer harus diringkas');
  assert.ok(m.includes('max-height:min(52vh,220px)'), 'isi panel pengaturan harus dibatasi');
});

test('D-259: jarak antar item galeri tidak terlalu sempit di HP', () => {
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(/@media\(max-width:560px\)\{\.st-gallery\{--st-gal-gap:9px\}/.test(css),
    'HP harus punya jarak galeri sendiri (9px)');
});

// ===== D-260: jarak kolom tidak nempel, upload error non-JSON informatif =====

test('D-260: jarak antar kolom diambil dari --st-gal-gap (bukan computed gap)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Mode masonry mengubah `gap` computed -> 0, jadi jarak HARUS dibaca dari var.
  assert.ok(body.includes("getPropertyValue('--st-gal-gap')"), 'jarak kolom harus dari --st-gal-gap');
  assert.ok(body.includes('if (!gap) gap = parseFloat(cs.gap'), 'ada fallback ke computed gap');
  // CSS masonry tidak bolehivi gap:0 (bikin kolom nempel).
  const css = readFileSync('public/index.html', 'utf8');
  const rule = css.match(/\.st-gal-row--masonry\{([^}]*)\}/);
  assert.ok(rule, 'aturan masonry harus ada');
  assert.ok(!/gap:0/.test(rule[1]), 'masonry tidak boleh pakai gap:0 (kolom nempel)');
});

test('D-260: minimal 2 kolom & jumlah kolom dibatasi', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Minimal 2 kolom -> 1-2 aset tetap tampil berjadian, bukan menumpuk ke bawah.
  assert.ok(body.includes('const maxCols = Math.max(2,'), 'maxCols minimal 2');
  assert.ok(body.includes('Math.max(2, Math.min(idealCols, maxCols))'), 'cols minimal 2');
});

test('D-260: error upload non-JSON ditampilkan dengan pesan yang bisa dibaca', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('async function uploadAsset('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Baca teks dulu, baru coba parse (r.json() langsung = "JSON.Parse ...").
  assert.ok(body.includes('await r.text()'), 'response harus dibaca sebagai teks dulu');
  assert.ok(body.includes('JSON.parse(raw)'), 'teks baru diparse sebagai JSON');
  assert.ok(body.includes('try { d = raw ? JSON.parse(raw) : null; } catch { d = null; }'),
    'parse JSON harus di-catch (balasan HTML tidak boleh melempar)');
  // Pesan informatif per status.
  assert.ok(body.includes('r.status === 413'), 'harus ada pesan untuk 413');
  assert.ok(body.includes('4,5 MB'), 'pesan 413 harus menyebut batas 4,5 MB');
  assert.ok(body.includes('r.status === 401 || r.status === 403'), 'harus ada pesan untuk sesi habis');
});

// ===== D-261: kolom ikut lebar halaman (PC penuh), thumbnail tetap kartu =====

test('D-261: jumlah kolom ikut lebar halaman (bukan dibatasi items/2)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Batas lama `floor(items/2)` bikin galeri cuma 2 kolom di layar lebar.
  assert.ok(!body.includes('Math.floor(items.length / 2)'),
    'batas kolom tidak boleh items/2 (bikin 2 kolom di layar lebar)');
  assert.ok(body.includes('const maxCols = Math.max(2, items.length)'),
    'batas kolom = jumlah item, minimal 2');
  // Jumlah kolom dihitung dari lebar baris (auto-fit).
  assert.ok(body.includes('const idealCols = Math.max(1, Math.floor((row.clientWidth + gap)'),
    'jumlah kolom harus dihitung dari lebar baris');
});

test('D-261: lebar kolom tetap sebesar kartu (tidak giant) & baris penuh', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Batas atas lebar kolom dari CSS var.
  assert.ok(body.includes("getPropertyValue('--st-gal-maxcol')"),
    'batas lebar kolom dari --st-gal-maxcol');
  // Sisa ruang diserap kolom tapi TIDAK melebihi maxcol.
  assert.ok(body.includes('const leftover ='), 'sisa ruang dihitung');
  assert.ok(body.includes('Math.min(colW + extra, maxCol || Infinity)'),
    'lebar kolom tidak boleh melebihi maxcol');
  // CSS harus punya --st-gal-maxcol per orientasi.
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('--st-gal-maxcol'), 'CSS harus punya --st-gal-maxcol');
  assert.ok(/\.st-gal-row--vertical\{[^}]*--st-gal-maxcol:180px/.test(css),
    'vertikal punya batas lebar kolom 180px');
  assert.ok(/\.st-gal-row--horizontal\{[^}]*--st-gal-maxcol:260px/.test(css),
    'horizontal punya batas lebar kolom 260px');
});

test('D-261: sisa item dibagi ke banyak kolom (tidak menumpuk di tengah)', () => {
  const studio = readFileSync('public/studio.js', 'utf8');
  const fn = studio.slice(studio.indexOf('function packGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // 9 aset & 7 kolom -> kolom tengah tidak boleh dapat 3 item (baris
  // bergerigi & rongga besar di tengah konten).
  assert.ok(body.includes('extraCols'), 'sisa item memakai daftar kolom ekstra');
  assert.ok(!body.includes('midIdx'), 'tidak ada lagi kolom tengah khusus sisa');
  assert.ok(body.includes('for (let c = cols - 1; c >= 0 && extraCols.length < rest; c--)'),
    'sisa item dibagi dari kolom kanan ke kiri (ragged di ujung kiri)');
});

test('D-261: harness aset sedikit — minimal 2 kolom & thumbnail tidak giant', () => {
  const h = readFileSync('tools/studio-few-assets-check.mjs', 'utf8');
  assert.ok(h.includes('SCENARIOS'), 'harness aset sedikit harus punya skenario');
  assert.ok(h.includes('cols >= 2'), 'harus mengecek minimal 2 kolom');
  assert.ok(h.includes('lebar kolom vertikal <= maxcol'), 'harus mengecek kolom tidak giant');
  assert.ok(h.includes('SEMUA LOLOS — D-261 OK'), 'harness aset sedikit harus punya penanda lulus');
});

// ===== D-262: PC horizontal 4 kolom (ukuran lebih seimbang) =====

test('D-262: PC horizontal 4 grid (bukan 5) — ukuran lebih seimbang', () => {
  const css = readFileSync('public/index.html', 'utf8');
  // mincol PC horizontal = 220px -> floor((1052+12)/(220+12)) = 4 kolom.
  assert.ok(/min-width:900px\)\{\.st-gal-row--horizontal\{--st-gal-mincol:220px/.test(css),
    'PC horizontal harus mincol 220px (4 grid)');
  assert.ok(!/min-width:900px\)\{\.st-gal-row--horizontal\{--st-gal-mincol:190px/.test(css),
    'mincol lama 190px (5 grid) harus diganti');
  // Batas lebar kolom tetap 260px (4 kolom x 254px muat di 1052px).
  assert.ok(/\.st-gal-row--horizontal\{--st-gal-mincol:150px;--st-gal-maxcol:260px\}/.test(css),
    'horizontal maxcol tetap 260px');
  // D-263: HP horizontal dinaikkan jadi 3 grid (mincol 115px) — PC tetap 4.
  assert.ok(mediaBlock(css, 'max-width:560px', '.st-gal-row--horizontal{--st-gal-mincol:115px')
    .includes('.st-gal-row--horizontal{--st-gal-mincol:115px'),
    'HP horizontal mincol 115px (3 grid, D-263)');
});

test('D-262: harness-layout mengecek PC horizontal 4 grid', () => {
  const h = readFileSync('tools/studio-layout-check.mjs', 'utf8');
  assert.ok(h.includes('PC horizontal = 4 grid'), 'harness harus mengecek PC horizontal 4 grid');
  assert.ok(h.includes('before.horizontalCols === 4'), 'assertion jumlah kolom horizontal PC = 4');
  // Baris horizontal PC harus tetap PENUH (4 x 254 + 3 x 12 = 1052).
  assert.ok(h.includes('baris terisi penuh'), 'harness harus tetap mengecek baris terisi penuh');
});

// ===== D-264: Filter jenis konten (Semua | Foto | Video) =====

test('D-264: baris filter jenis konten ada di atas galeri', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  // Keadaan filter.
  assert.ok(js.includes("let galleryFilter = 'all'"), 'harus ada state galleryFilter');
  // Tombol filter + jumlah aset.
  assert.ok(js.includes('st-gal-filter'), 'harus ada kelas .st-gal-filter');
  assert.ok(js.includes('data-gal-filter'), 'tombol filter harus punya data-gal-filter');
  assert.ok(js.includes("filterBtn('all', 'layout-grid', 'Semua', counts.all)"), 'tombol Semua wajib');
  assert.ok(js.includes("filterBtn('photo', 'image', 'Foto', counts.photo)"), 'tombol Foto wajib');
  assert.ok(js.includes("filterBtn('video', 'video', 'Video', counts.video)"), 'tombol Video wajib');
  // Hitungan per jenis media.
  assert.ok(js.includes("if (a.media_type === 'video') counts.video++; else counts.photo++"),
    'jumlah dihitung dari jenis media (video vs lainnya)');
  // D-265: baris filter TIDAK lagi jadi baris di dalam galeri — dia hidup di
  // baris atas area Studio (sebaris dengan tombol Unggah).
  const rIdx = js.indexOf('const filterBar =');
  const vIdx = js.indexOf("rowHtml('Vertikal'");
  assert.ok(rIdx > 0 && vIdx > 0 && rIdx < vIdx, 'baris filter harus ditulis sebelum isi galeri');
  assert.ok(!/[^a-zA-Z]box\.innerHTML = filterBar/.test(js), 'filter bar tidak boleh masuk ke dalam galeri');
  assert.ok(js.includes("const fbox = $('stGalFilters');"), 'filter bar harus di-render ke #stGalFilters');
});

test('D-264: filter menyaring isi galeri & jumlah label tetap total', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  const fn = js.slice(js.indexOf('function renderGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // Penyaringan berdasarkan jenis media.
  assert.ok(body.includes("galleryFilter === 'photo'"), 'harus ada cabang filter photo');
  assert.ok(body.includes("assets.filter((a) => a.media_type !== 'video')"), 'filter foto = bukan video');
  assert.ok(body.includes("assets.filter((a) => a.media_type === 'video')"), 'filter video = video');
  // Jumlah label dihitung dari TOTAL aset, bukan hasil filter.
  assert.ok(body.includes('const counts = { all: assets.length, photo: 0, video: 0 };'),
    'hitungan harus dari total aset');
  // Filter tak valid -> balik ke all.
  assert.ok(body.includes("if (!['all', 'photo', 'video'].includes(galleryFilter)) galleryFilter = 'all'"),
    'filter tak valid harus aman');
});

test('D-264: klik filter menyaring galeri & toggle kelas aktif', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  const fn = js.slice(js.indexOf('function renderGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("[data-gal-filter]"), 'harus memasang handler klik filter');
  assert.ok(body.includes('galleryFilter = key;'), 'klik harus mengubah filter aktif');
  assert.ok(body.includes('renderGallery();'), 'klik harus render ulang galeri');
  // Kelas aktif + aria-pressed untuk aksesibilitas.
  assert.ok(body.includes("galleryFilter === key ? ' is-active' : ''"), 'tombol aktif harus punya kelas is-active');
  assert.ok(body.includes('aria-pressed'), 'tombol filter harus punya aria-pressed');
});

test('D-264: empty state tampil saat filter tidak punya aset', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  const fn = js.slice(js.indexOf('function renderGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('st-gal-empty-filter'), 'harus ada empty state untuk filter kosong');
  assert.ok(body.includes('shown.length'), 'isi galeri harus dicek dari jumlah hasil filter');
});

test('D-264: CSS baris filter ada (pill + aktif + empty state)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('.st-gal-filters{'), 'harus ada aturan .st-gal-filters');
  assert.ok(css.includes('.st-gal-filter{'), 'harus ada aturan .st-gal-filter');
  assert.ok(css.includes('.st-gal-filter.is-active{'), 'harus ada aturan tombol aktif');
  assert.ok(css.includes('.st-gal-empty-filter{'), 'harus ada aturan empty state');
});

// ===== D-265: Filter jadi LOGO SAJA, sebaris dengan tombol Unggah =====

test('D-265: tombol filter = logo saja (tanpa teks label)', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  const fn = js.slice(js.indexOf('const filterBtn ='));
  const body = fn.slice(0, fn.indexOf('\n    const filterBar'));
  // Tombol berisi ikon + badge jumlah, TANPA teks "Semua/Foto/Video" di dalam.
  assert.ok(body.includes('icon(ico)'), 'tombol filter harus render ikon');
  assert.ok(body.includes("'<b>(' + n + ')</b></button>'"), 'tombol filter harus punya jumlah dalam kurung');
  assert.ok(!body.includes('>' + "label"), 'label tidak boleh dicetak sebagai teks di dalam tombol');
  // Label tetap tersedia untuk aksesibilitas (title/aria-label).
  assert.ok(body.includes("title=\"' + esc(label) + ' (' + n + ')'"), 'harus punya title aksesibel');
  assert.ok(body.includes('aria-label') && body.includes(`esc(label) + ' (' + n + ')'`),
    'harus punya aria-label aksesibel');
  // Ikon: grid (Semua), image (Foto), video (Video).
  assert.ok(js.includes("filterBtn('all', 'layout-grid'"), 'tombol Semua pakai ikon layout-grid');
  assert.ok(js.includes("filterBtn('photo', 'image'"), 'tombol Foto pakai ikon image');
  assert.ok(js.includes("filterBtn('video', 'video'"), 'tombol Video pakai ikon video');
});

test('D-265: baris filter DI LUAR galeri, sebaris dengan tombol Unggah', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  // Baris atas Studio memuat filter + tombol Unggah dalam satu baris.
  assert.ok(js.includes('<div class="st-stage-top">'), 'harus ada .st-stage-top');
  const topIdx = js.indexOf('<div class="st-stage-top">');
  const filtIdx = js.indexOf('class="st-gal-filters st-hidden" id="stGalFilters"', topIdx);
  const upIdx = js.indexOf('id="stUploadBtn"', topIdx);
  assert.ok(filtIdx > topIdx && upIdx > topIdx, 'filter & Unggah harus di dalam .st-stage-top');
  // Filter TIDAK boleh digabung ke dalam isi galeri.
  const galIdx = js.indexOf("box.innerHTML = (shown.length");
  assert.ok(galIdx > 0, 'isi galeri harus dirender terpisah dari filter bar');
  assert.ok(!/[^a-zA-Z]box\.innerHTML = filterBar/.test(js), 'filter bar tak boleh masuk ke dalam galeri');
  // Filter bar & tombol Unggah dirender terpisah (masing-masing ke container).
  assert.ok(js.includes("const fbox = $('stGalFilters');"), 'filter bar di-render ke #stGalFilters');
  assert.ok(js.includes('fbox.innerHTML = filterBar.replace'), 'filter bar replaces isi #stGalFilters');
});

test('D-265: filter disembunyikan saat belum ada aset', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  const fn = js.slice(js.indexOf('function renderGallery('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("fboxTop?.classList.add('st-hidden')"), 'filter harus disembunyikan saat galeri kosong');
  assert.ok(body.includes("fbox.classList.remove('st-hidden')"), 'filter harus tampil saat ada aset');
});

test('D-265: CSS baris atas = 1 baris flex (filter kiri, Unggah kanan)', () => {
  const css = readFileSync('public/index.html', 'utf8');
  assert.ok(css.includes('.st-stage-top{'), 'harus ada aturan .st-stage-top');
  const rule = css.match(/\.st-stage-top\{([^}]*)\}/);
  assert.ok(rule && rule[1].includes('display:flex'), '.st-stage-top harus flex row');
  assert.ok(rule && rule[1].includes('align-items:center'), '.st-stage-top harus align center');
  // Filter di kiri, tombol Unggah didorong ke kanan.
  assert.ok(/\.st-stage-top \.st-upload-btn\{[^}]*margin-left:auto/.test(css),
    'filter kiri & Unggah kanan');
  // D-266: jumlah ditampilkan DI SAMPING ikon (bukan badge di pojok).
  const badge = css.match(/\.st-gal-filter b\{([^}]*)\}/);
  assert.ok(badge, 'aturan .st-gal-filter b harus ada');
  assert.ok(!badge[1].includes('position:absolute'), 'jumlah tidak lagi badge pojok');
  assert.ok(!badge[1].includes('right:'), 'jumlah tidak lagi di pojok kanan');
  assert.ok(!badge[1].includes('bottom:'), 'jumlah tidak lagi di pojok bawah');
  assert.ok(/font-size:\d/.test(badge[1]), 'jumlah harus punya ukuran font');
  // Tombol filter: ikon + jumlah dalam 1 baris horizontal.
  const btn = css.match(/\.st-gal-filter\{([^}]*)\}/);
  assert.ok(btn && btn[1].includes('display:inline-flex'), 'tombol filter harus inline-flex');
  assert.ok(btn && btn[1].includes('align-items:center'), 'ikon & jumlah sejajar');
  assert.ok(btn && btn[1].includes('gap:'), 'ada jarak antara ikon & jumlah');
  assert.ok(!/width:\d+px/.test(btn[1]), 'tombol tidak boleh lebar tetap (ikut jumlah)');
  assert.ok(/height:\d+px/.test(btn[1]), 'tinggi tombol tetap (1 baris)');
});

// ===== D-266: Jumlah aset di samping ikon filter =====

test('D-266: jumlah filter ditulis dalam kurung di samping ikon', () => {
  const js = readFileSync('public/studio.js', 'utf8');
  const fn = js.slice(js.indexOf('const filterBtn ='));
  const body = fn.slice(0, fn.indexOf('\n    const filterBar'));
  // Tombol = ikon + <b>(n)</b> — jumlah dalam kurung, di samping ikon.
  assert.ok(body.includes('icon(ico)'), 'tombol harus render ikon');
  assert.ok(body.includes(`'<b>(' + n + ')</b></button>'`), 'jumlah harus ditulis dalam kurung');
  // Urutan: ikon dulu, baru jumlah.
  assert.ok(body.indexOf('icon(ico)') < body.indexOf(`'<b>(' + n + ')</b></button>'`),
    'ikon harus di sebelah kiri jumlah');
  // Tidak ada badge pojok lagi.
  assert.ok(!body.includes('badge'), 'tidak ada badge pojok');
});

test('D-266: harness filter mengecek jumlah di samping ikon', () => {
  const h = readFileSync('tools/studio-filter-check.mjs', 'utf8');
  assert.ok(h.includes('jumlah di samping ikon'), 'harness harus cek jumlah di samping ikon');
  assert.ok(h.includes('1 baris'), 'harness harus tetap cek 1 baris');
});

// ===== D-267: Tombol Unggah diseragamkan dengan tombol filter =====

test('D-267: tombol Unggah kompak & sepadan dengan tombol filter', () => {
  const css = readFileSync('public/index.html', 'utf8');
  const up = css.match(/(^|\n)\.st-upload-btn\{([^}]*)\}/);
  const fil = css.match(/\.st-gal-filter\{([^}]*)\}/);
  assert.ok(up, 'aturan .st-upload-btn harus ada');
  assert.ok(fil, 'aturan .st-gal-filter harus ada');
  // Bentuk sama: inline-flex, align center, radius sama, border solid.
  assert.ok(up[2].includes('display:inline-flex'), 'Unggah harus inline-flex');
  assert.ok(up[2].includes('align-items:center'), 'Unggah harus align center');
  const upR = (up[2].match(/border-radius:(\d+)px/) || [])[1];
  const filR = (fil[1].match(/border-radius:(\d+)px/) || [])[1];
  assert.ok(upR && filR && upR === filR, `radius harus sama (Unggah ${upR} vs filter ${filR})`);
  assert.ok(!up[1].includes('dashed'), 'border Unggah tidak boleh dashed (harus solid)');
  // Tinggi sama -> 1 baris yang rata.
  const upH = (up[2].match(/height:(\d+)px/) || [])[1];
  const filH = (fil[1].match(/height:(\d+)px/) || [])[1];
  assert.ok(upH && filH && upH === filH, `tinggi harus sama (Unggah ${upH} vs filter ${filH})`);
  // Warna dasar sama (pill gelap), hover sama.
  assert.ok(up[2].includes('background:#101b2c'), 'latar Unggah harus sama dengan filter');
  const upHover = css.match(/\.st-upload-btn:hover\{([^}]*)\}/);
  const filHover = css.match(/\.st-gal-filter:hover\{([^}]*)\}/);
  assert.ok(upHover && filHover && upHover[1] === filHover[1],
    'hover Unggah harus sama dengan hover filter');
  // HP: versi compact juga sama.
  const hpUp = css.match(/\.st-upload-btn\{([^}]*height:\d+px[^}]*)\}/);
  const hpFil = css.match(/\.st-gal-filter\{([^}]*height:\d+px[^}]*)\}/);
  assert.ok(hpUp && hpFil, 'aturan HP untuk Unggah & filter harus ada');
  const hpUpH = (hpUp[1].match(/height:(\d+)px/) || [])[1];
  const hpFilH = (hpFil[1].match(/height:(\d+)px/) || [])[1];
  assert.ok(hpUpH && hpFilH && hpUpH === hpFilH,
    `tinggi HP harus sama (Unggah ${hpUpH} vs filter ${hpFilH})`);
});

test('D-267: harness mengecek tinggi tombol Unggah = tinggi tombol filter', () => {
  const h = readFileSync('tools/studio-filter-check.mjs', 'utf8');
  assert.ok(h.includes('tinggi tombol Unggah sama dengan filter'),
    'harness harus cek tinggi tombol Unggah seragam');
});

test('D-264: harness filter galeri harus ada', () => {
  const h = readFileSync('tools/studio-filter-check.mjs', 'utf8');
  assert.ok(h.includes('data-gal-filter'), 'harness harus mengklik filter');
  assert.ok(h.includes('SEMUA LOLOS'), 'harness harus punya penanda lulus');
  assert.ok(h.includes('jumlah label TIDAK berubah'), 'harness harus mengecek jumlah label stabil');
});

// ===== D-265: harness + regresi =====

test('D-265: harness filter mengecek posisi logo-only & 1 baris', () => {
  const h = readFileSync('tools/studio-filter-check.mjs', 'utf8');
  assert.ok(h.includes('filter bar DI LUAR galeri'), 'harness harus cek filter di luar galeri');
  assert.ok(h.includes('sebaris dengan tombol Unggah'), 'harness harus cek sebaris dengan Unggah');
  assert.ok(h.includes('tombol filter pakai logo'), 'harness harus cek tombol filter pakai logo');
  assert.ok(h.includes('semua tombol filter 1 baris'), 'harness harus cek 1 baris');
  assert.ok(h.includes('jumlah Foto = 10'), 'harness harus tetap cek jumlah total stabil');
});
