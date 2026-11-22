import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('public/index.html', 'utf8');
const studio = readFileSync('public/studio.js', 'utf8');

/**
 * D-249: Mode "Motion Graphics" di Studio — uji integrasi DOM (jsdom).
 * Meniru pola test/studio-layout.test.js.
 */

const MG_TEMPLATES = [
  { id: 'branded-intro', label: 'Intro BerBrand', hint: 'Judul + subjudul + logo.',
    icon: 'sparkles', defaultDuration: 6, durations: [5, 6, 8], aspects: ['9:16', '16:9', '1:1'],
    fields: [{ key: 'title', label: 'Judul', placeholder: 'Judul', required: true },
      { key: 'subtitle', label: 'Subjudul', placeholder: 'Subjudul' }] },
  { id: 'stat-card', label: 'Kartu Statistik', hint: 'Angka besar + label.',
    icon: 'bar-chart', defaultDuration: 5, durations: [4, 5, 6], aspects: ['9:16', '16:9', '1:1'],
    fields: [{ key: 'value', label: 'Nilai', placeholder: 'Nilai', required: true },
      { key: 'label', label: 'Label', placeholder: 'Label', required: true }] },
];

function buildStudio(fetchImpl) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  win.localStorage.clear();
  win.fetch = fetchImpl;
  win.sherlyGetAccessToken = async () => 'test-token';
  win.sherlyStoredToken = () => null;
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const doc = win.document;
  doc.body.innerHTML = '<div id="studioRoot"></div><div id="toast"></div>';
  const script = doc.createElement('script');
  script.textContent = studio;
  doc.body.appendChild(script);
  openWindows.push(win);
  return { win, doc };
}

/** Fetch mock: katalog video/gambar standar + template Motion Graphics. */
function makeFetch(opts = {}) {
  const mgAvailable = opts.mgAvailable !== false;
  const mgStatus = opts.mgStatus || (mgAvailable ? 'ready' : 'installing');
  const mgReason = opts.mgReason || '';
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
    const u = String(url);
    if (u.includes('/api/studio/motion-graphics/templates')) {
      return { ok: true, json: async () => ({
        ok: true, available: mgAvailable, status: mgStatus, reason: mgReason,
        // D-251: katalog template selalu dikirim — render client-side butuh
        // template & field walau renderer server tidak tersedia.
        templates: MG_TEMPLATES,
      }) };
    }
    if (u.includes('/api/studio/motion-graphics') && (init.method || 'GET') === 'POST') {
      return { ok: true, json: async () => ({ ok: true, task: { id: 'task-1', status: 'queued', progress: 0 } }) };
    }
    if (u.includes('/api/studio/motion-graphics/task-1')) {
      return { ok: true, json: async () => ({ ok: true, task: { id: 'task-1', status: 'done', progress: 100 } }) };
    }
    if (u.includes('/api/studio/assets')) return { ok: true, json: async () => ({ ok: true, assets: [] }) };
    if (u.includes('/api/ai/image/models')) return { ok: true, json: async () => ({ ok: true, models: [] }) };
    if (u.includes('/api/ai/video/models')) return { ok: true, json: async () => ({ ok: true, models: [] }) };
    if (u.includes('/api/ai/lipsync/models')) return { ok: true, json: async () => ({ ok: true, models: [] }) };
    if (u.includes('/api/characters')) return { ok: true, json: async () => ({ characters: [] }) };
    if (u.includes('/api/custom-providers')) return { ok: true, json: async () => ({ providers: [] }) };
    if (u.includes('/api/prompt-bank')) return { ok: true, json: async () => ({ ok: true, entries: [], blocks: [] }) };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  impl.calls = calls;
  return impl;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// JSDOM window yang dibuat per test harus ditutup, kalau tidak timer polling
// Motion Graphics (interval 3 detik saat status 'installing') bikin proses
// test tidak pernah exit.
const openWindows = [];
afterEach(() => {
  while (openWindows.length) {
    const win = openWindows.pop();
    try { win.close(); } catch { /* sudah tertutup */ }
  }
});

async function pickTypeWithPanel(win, doc, kind) {
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  click(doc.getElementById('stTypePill'));
  await wait(60);
  const panel = doc.getElementById('stPop-settings');
  const btn = [...panel.querySelectorAll('[data-set-key="type"]')].find((b) => b.dataset.setV === kind);
  assert.ok(btn, 'pilihan "' + kind + '" harus ada di panel pengaturan');
  click(btn);
  await wait(60);
  click(doc.getElementById('stSetSave'));
  await wait(60);
  return click;
}

test('D-249: mode Motion Graphics muncul di panel Jenis Konten saat renderer siap', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: true }));
  await win.renderStudio();
  await wait(150);
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(60);
  const panel = doc.getElementById('stPop-settings');
  const kinds = [...panel.querySelectorAll('[data-set-key="type"]')].map((b) => b.dataset.setV);
  assert.ok(kinds.includes('motion'), 'pilihan "motion" harus ada');
  assert.ok(kinds.includes('photo'));
  assert.ok(kinds.includes('video'));
});

test('D-249: mode Motion Graphics TETAP tampil saat renderer belum siap', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: false, mgStatus: 'installing' }));
  await win.renderStudio();
  await wait(150);
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(60);
  const panel = doc.getElementById('stPop-settings');
  const kinds = [...panel.querySelectorAll('[data-set-key="type"]')].map((b) => b.dataset.setV);
  assert.ok(kinds.includes('motion'), 'mode motion harus tetap terlihat walau renderer belum siap');
});

test('D-251: renderer server belum siap -> bar isian tetap bisa dipakai (render di browser)', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: false, mgStatus: 'installing' }));
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  const bar = doc.getElementById('stMotionBar');
  assert.ok(!bar.classList.contains('st-hidden'), 'bar harus tetap tampil');
  // D-251: TIDAK lagi status "Menyiapkan…" yang membeku — kolom isian langsung
  // tampil karena render dilakukan di browser.
  assert.doesNotMatch(bar.innerHTML, /Menyiapkan renderer video/, 'tidak boleh lagi menunggu renderer server');
  assert.ok(doc.getElementById('stMotionField-title'), 'kolom isian harus tampil -- BAR: ' + bar.innerHTML.slice(0, 200) + ' | hidden=' + bar.classList.contains('st-hidden'));
  assert.match(bar.innerHTML, /st-motion-note/, 'harus ada catatan renderer');
});

test('D-251: renderer server gagal -> mode tetap bisa dipakai (render di browser)', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: false, mgStatus: 'failed', mgReason: 'npm install gagal' }));
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  const bar = doc.getElementById('stMotionBar');
  assert.ok(doc.getElementById('stMotionField-title'), 'kolom isian harus tetap tampil');
  assert.doesNotMatch(bar.innerHTML, /st-motion-status-err/, 'tidak lagi menampilkan error renderer server');
});

test('D-251: catatan renderer menjelaskan render di browser', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: true }));
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  const bar = doc.getElementById('stMotionBar');
  assert.match(bar.innerHTML, /st-motion-note/, 'harus ada catatan renderer');
  // Catatan harus menyebut browser (atau, di jsdom, kegagalan muat modul).
  assert.match(bar.innerHTML, /browser|modul render/i, 'catatan harus menjelaskan batasan renderer');
});

test('D-249: pilih Motion Graphics -> bar template tampil + tombol Render muncul', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: true }));
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  const bar = doc.getElementById('stMotionBar');
  assert.ok(bar, 'bar Motion Graphics harus ada');
  assert.ok(!bar.classList.contains('st-hidden'), 'bar harus tampil di mode motion');
  assert.match(bar.innerHTML, /Intro BerBrand/, 'bar harus menampilkan template terpilih');
  assert.ok(doc.getElementById('stMotionBtn'), 'tombol Render harus ada');
  assert.ok(!doc.getElementById('stMotionBtn').classList.contains('st-hidden'), 'tombol Render harus tampil');
  // Tombol generate lain harus disembunyikan.
  assert.ok(doc.getElementById('stGenBtn').classList.contains('st-hidden'));
  assert.ok(doc.getElementById('stVideoBtn').classList.contains('st-hidden'));
  assert.ok(doc.getElementById('stLipsyncBtn').classList.contains('st-hidden'));
});

test('D-249: panel Pengaturan mode Motion Graphics = Template + Durasi saja', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: true }));
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(60);
  const panel = doc.getElementById('stPop-settings');
  const keys = [...panel.querySelectorAll('[data-set-key]')].map((b) => b.dataset.setKey);
  const uniq = [...new Set(keys)];
  assert.ok(uniq.includes('mgtpl'), 'harus ada pilihan Template');
  assert.ok(uniq.includes('mgdur'), 'harus ada pilihan Durasi');
  // Tidak ada Provider/Model/Tier/Resolusi di mode Motion Graphics.
  for (const k of ['engine', 'model', 'tier', 'res', 'imgmodel', 'lipmodel', 'lipres']) {
    assert.ok(!uniq.includes(k), 'mode motion tidak punya pengaturan "' + k + '"');
  }
});

test('D-249: render mengirim template + aspect + durasi + isi ke server', async () => {
  const fetchImpl = makeFetch({ mgAvailable: true });
  const { win, doc } = buildStudio(fetchImpl);
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  // Isi kolom judul.
  const input = doc.getElementById('stMotionField-title');
  assert.ok(input, 'kolom Judul harus ada di bar Motion Graphics');
  input.value = 'Judul Uji';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  await wait(30);
  // Tekan tombol Render.
  doc.getElementById('stMotionBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(150);
  const post = fetchImpl.calls.find((c) => c.method === 'POST' && c.url.includes('/api/studio/motion-graphics'));
  assert.ok(post, 'harus ada POST /api/studio/motion-graphics');
  const body = JSON.parse(post.body);
  assert.equal(body.template, 'branded-intro');
  assert.equal(body.props.title, 'Judul Uji');
  assert.ok(['9:16', '16:9', '1:1'].includes(body.aspect), 'aspect harus salah satu rasio Motion Graphics');
  assert.ok(Number(body.duration) >= 4, 'durasi harus dikirim');
});

test('D-249: kolom wajib kosong -> tidak ada request render (toast pesan)', async () => {
  const fetchImpl = makeFetch({ mgAvailable: true });
  const { win, doc } = buildStudio(fetchImpl);
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  doc.getElementById('stMotionBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(120);
  const post = fetchImpl.calls.find((c) => c.method === 'POST' && c.url.includes('/api/studio/motion-graphics'));
  assert.ok(!post, 'tidak boleh request render kalau kolom wajib kosong');
  assert.match(doc.getElementById('toast').textContent, /Judul/i, 'harus ada pesan error');
});

test('D-249: ganti template -> bar isian berubah & isi lama dibersihkan', async () => {
  const { win, doc } = buildStudio(makeFetch({ mgAvailable: true }));
  await win.renderStudio();
  await wait(150);
  await pickTypeWithPanel(win, doc, 'motion');
  const input = doc.getElementById('stMotionField-title');
  input.value = 'Lama';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  await wait(30);
  // Buka panel & pilih template "Kartu Statistik".
  doc.getElementById('stTypePill').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(60);
  const panel = doc.getElementById('stPop-settings');
  const tplBtn = [...panel.querySelectorAll('[data-set-key="mgtpl"]')].find((b) => b.dataset.setV === 'stat-card');
  assert.ok(tplBtn, 'pilihan template stat-card harus ada');
  tplBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(60);
  doc.getElementById('stSetSave').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(80);
  const bar = doc.getElementById('stMotionBar');
  assert.ok(!doc.getElementById('stMotionField-title'), 'kolom Judul harus hilang (template beda)');
  assert.ok(doc.getElementById('stMotionField-value'), 'kolom Nilai harus muncul');
  assert.ok(doc.getElementById('stMotionField-label'), 'kolom Label harus muncul');
});
