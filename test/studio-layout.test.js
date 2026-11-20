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
  doc.body.innerHTML = '<div id="studioRoot"></div>';
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
const okFetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(CATALOG)) });

// --- D-202: judul & deskripsi halaman Studio dihapus ---

test('D-202: section studioView tidak punya page-heading (judul & deskripsi dihapus)', () => {
  const m = html.match(/<section id="studioView"[\s\S]*?<\/section>/);
  assert.ok(m, 'section studioView tidak ditemukan');
  assert.ok(!m[0].includes('page-heading'), 'masih ada page-heading di Studio');
  assert.ok(!m[0].includes('<h1>Studio</h1>'), 'judul Studio masih ada');
  assert.ok(!m[0].includes('Generator konten'), 'deskripsi Studio masih ada');
});

test('D-202: halaman Studio punya tinggi penuh & composer turun lebih rendah', () => {
  assert.ok(/#studioView\.active\{[^}]*height:calc\(100vh - 107px\)/.test(html),
    'tinggi view Studio tidak调整为 calc(100vh - 107px)');
  assert.ok(/#studioView\.active\{[^}]*margin-bottom:-16px/.test(html),
    'view Studio tidak turun (margin-bottom)');
});

test('D-202: tombol Unggah diposisikan di sudut kanan area Studio', () => {
  assert.ok(/\.st-upload-corner\{[^}]*position:absolute[^}]*top:0[^}]*right:0/.test(html),
    'kelas .st-upload-corner tidak posisi absolut kanan-atas');
  assert.ok(/#studioRoot\{[^}]*position:relative/.test(html), '#studioRoot tidak position:relative');
  assert.ok(studio.includes('st-upload-btn st-upload-corner'), 'tombol Unggah tidak memakai kelas corner');
  assert.ok(!studio.includes('st-topbar'), 'wrapper .st-topbar masih dipakai');
});

test('D-202: tab Foto/Video berada di bawah komposer pada baris kontrol', () => {
  const controlsIdx = studio.indexOf('class="st-controls"');
  const tabsIdx = studio.indexOf('st-tabs-inline');
  assert.ok(controlsIdx > -1, 'baris kontrol tidak ditemukan');
  assert.ok(tabsIdx > controlsIdx, 'tab Foto/Video bukan di baris kontrol komposer');
  assert.ok(studio.includes('class="st-tabs st-tabs-inline"'), 'kelas st-tabs-inline hilang');
});

test('D-202: urutan baris kontrol — jenis konten, vertikal/horizontal, lalu mesin/gaya', () => {
  const controls = studio.slice(studio.indexOf('class="st-controls"'), studio.indexOf('class="st-controls"') + 1800);
  const iTabs = controls.indexOf('st-tabs-inline');
  const iAspect = controls.indexOf('stAspectPill');
  const iEngine = controls.indexOf('stEnginePill');
  assert.ok(iTabs > -1 && iAspect > -1 && iEngine > -1, 'elemen kontrol tidak lengkap');
  assert.ok(iTabs < iAspect, 'tab harus sebelum pilihan rasio');
  assert.ok(iAspect < iEngine, 'rasio harus sebelum mesin');
});

test('D-202: pilihan vertikal/horizontal tersedia di popover rasio', () => {
  assert.ok(studio.includes("'9:16', 'Vertikal (9:16)'"), 'opsi vertikal hilang');
  assert.ok(studio.includes("'16:9', 'Landscape (16:9)'"), 'opsi landscape hilang');
});

// --- D-202 + D-201: DOM nyata ---

test('D-202: hasil render — Unggah di sudut, tab di bawah komposer', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  const upload = doc.getElementById('stUploadBtn');
  assert.ok(upload, 'tombol Unggah tidak dirender');
  assert.ok(upload.classList.contains('st-upload-corner'), 'kelas corner tidak ada di tombol Unggah');
  // Tombol Unggah berada di luar stage galeri (di pojok halaman).
  assert.ok(!upload.closest('.st-stage'), 'tombol Unggah masih di dalam stage');
  // Tab Foto/Video ada di dalam baris kontrol composer.
  const tabs = doc.querySelector('.st-tabs-inline');
  assert.ok(tabs, 'tab inline tidak dirender');
  assert.ok(tabs.closest('.st-controls'), 'tab tidak di baris kontrol');
  assert.ok(tabs.querySelector('.st-tab[data-mode="photo"]'), 'tab Foto hilang');
  assert.ok(tabs.querySelector('.st-tab[data-mode="video"]'), 'tab Video hilang');
});

test('D-202: mode video tetap menampilkan tab Video aktif & pill model', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  const videoTab = doc.querySelector('.st-tab[data-mode="video"]');
  videoTab.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.ok(videoTab.classList.contains('active'), 'tab Video tidak jadi aktif');
  const wrap = doc.getElementById('stModelPillWrap');
  assert.ok(!wrap.classList.contains('st-hidden'), 'pill model harus tampil di mode video');
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

test('D-200 (regresi): pilihan durasi tetap dinamis mengikuti model', async () => {
  const { win, doc } = buildStudio(okFetch);
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 50));
  doc.querySelector('.st-tab[data-mode="video"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
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
