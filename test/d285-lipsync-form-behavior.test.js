// D-285 · Test PERILAKU form "Karakter Bicara" (bukan hanya cek string).
//
// User: *"di kotak arahan itu gak bisa @ gak muncul aset yg mau di pilih,
// @ cuma bisa di tempat naskah"*
//
// Test ini memverifikasi di DOM sungguhan (jsdom) bahwa:
//   1) Kolom "Gambar karakter di lokasi ini" MEMBUKA dropdown mention sendiri
//      saat user mengetik "@" di dalamnya.
//   2) Aset yang dipilih dari dropdown kolom gambar MASUK jadi sceneRefs
//      (dipakai sebagai image_url).
//   3) Dropdown composer dan dropdown kolom gambar TIDAK bercampur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('public/index.html', 'utf8');
const studio = readFileSync('public/studio.js', 'utf8');

const IMAGE_CATALOG = { ok: true, models: [] };
const CATALOG = { ok: true };
const PROMPT_BANK = { ok: true, prompts: [] };

const CHARACTERS = {
  ok: true,
  characters: [{
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Sherly',
    reference_image_path: 'a.png',
    voice: { name: 'Zephyr' },
  }],
};

const ASSETS = {
  ok: true,
  assets: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      file_name: 'gambar referensi.png',
      url: 'data:image/png;base64,iVBORw0KGgo=',
      media_type: 'image',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      file_name: 'studio podcast.png',
      url: 'data:image/png;base64,iVBORw0KGgo=',
      media_type: 'image',
    },
  ],
};

const LIPSYNC_MODELS = {
  ok: true,
  defaultModel: 'infinitalk/from-audio',
  maxSeconds: 15,
  models: [{
    id: 'infinitalk/from-audio',
    provider: 'kie',
    label: 'InfiniteTalk',
    maker: 'MeiGen-AI',
    resolutions: ['480p', '720p'],
    aspects: ['16:9', '9:16', '1:1'],
    maxSeconds: 15,
    defaultResolution: '720p',
    defaultAspect: '9:16',
  }],
};

/**
 * Fetch stub: endpoint API -> JSON biasa; data: URL -> Blob sungguhan
 * (jsdom butuh res.blob() yang valid supaya syncMentionedAssetRefs()
 * bisa memuat gambar referensi).
 */
function makeFetch() {
  return async (url, opts) => {
    const u = String(url || '');
    if (u.startsWith('data:')) {
      const [meta, b64] = u.split(',');
      const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/png';
      const bin = atob(b64 || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return {
        ok: true,
        blob: async () => new win_Blob([bytes], { type: mime }),
      };
    }
    if (u.includes('/api/ai/lipsync/models')) return { ok: true, json: async () => LIPSYNC_MODELS };
    if (u.includes('/api/characters')) return { ok: true, json: async () => CHARACTERS };
    if (u.includes('/api/studio/assets')) return { ok: true, json: async () => ASSETS };
    if (u.includes('/api/ai/image/models')) return { ok: true, json: async () => IMAGE_CATALOG };
    if (u.includes('/api/prompt-bank')) return { ok: true, json: async () => PROMPT_BANK };
    return { ok: true, json: async () => CATALOG };
  };
}

function buildStudio(fetchImpl) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  win.localStorage.clear();
  win.fetch = fetchImpl;
  win.sherlyGetAccessToken = async () => 'test-token';
  win.sherlyStoredToken = () => null;
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  win_Blob = win.Blob;
  const doc = win.document;
  doc.body.innerHTML = '<div id="studioRoot"></div><div id="toast"></div>';
  const script = doc.createElement('script');
  script.textContent = studio;
  doc.body.appendChild(script);
  return { win, doc };
}

let win_Blob = null;

/**
 * Masuk ke mode "Karakter Bicara".
 * Panel pengaturan konten: pilih chip "Karakter Bicara" -> klik Save.
 */
async function enterLipsync(win, doc) {
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));
  click(doc.getElementById('stTypePill'));
  await new Promise((r) => setTimeout(r, 60));
  const panel = doc.getElementById('stPop-settings');
  const btn = [...panel.querySelectorAll('[data-set-key="type"]')]
    .find((b) => b.dataset.setV === 'lipsync');
  assert.ok(btn, 'pilihan Karakter Bicara harus ada di panel pengaturan');
  click(btn);
  await new Promise((r) => setTimeout(r, 60));
  click(doc.getElementById('stSetSave'));
  await new Promise((r) => setTimeout(r, 80));
}

test('D-287: langkah 4 "Gambar referensi" adalah DROPDOWN dari aset', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  const btn = doc.getElementById('stLipImageBtn');
  assert.ok(btn, 'tombol pilih gambar harus ada di mode Karakter Bicara');
  const pop = doc.getElementById('stPop-lipsyncimg');
  assert.ok(pop, 'dropdown gambar harus ada');
  assert.match(doc.getElementById('stLipImageName').textContent, /pilih gambar/i,
    'label harus menyebut "pilih gambar"');

  // Klik tombol -> dropdown berisi aset dari galeri.
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const txt = pop.textContent || '';
  assert.match(txt, /gambar referensi/i, 'aset harus muncul di dropdown');
  assert.match(txt, /studio podcast/i, 'semua aset harus muncul');
});

test('D-287: aset yang dipilih dari dropdown gambar MASUK jadi referensi (image_url)', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  doc.getElementById('stLipImageBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const pop = doc.getElementById('stPop-lipsyncimg');
  const item = [...pop.querySelectorAll('[data-lip-img]')]
    .find((b) => /gambar referensi/i.test(b.textContent || ''));
  assert.ok(item, 'item aset harus ada di dropdown');

  item.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));

  // Nama aset terpilih tampil di tombol.
  assert.match(doc.getElementById('stLipImageName').textContent, /gambar referensi/i,
    'nama aset terpilih harus tampil di tombol');
  // Thumbnail terisi.
  const thumb = doc.getElementById('stLipImageThumb');
  assert.ok(thumb && !thumb.classList.contains('is-empty'),
    'thumbnail gambar terpilih harus terisi');
  assert.ok(thumb.querySelector('img'), 'thumbnail harus berisi gambar');
});

test('D-287: naskah (langkah 1) punya dropdown mention sendiri', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  const script = doc.getElementById('stLipScript');
  assert.ok(script, 'textarea naskah harus ada di langkah 1');
  script.value = '@';
  script.setSelectionRange(1, 1);
  script.dispatchEvent(new win.Event('keyup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(doc.getElementById('stMentionListScript').classList.contains('open'),
    'dropdown naskah harus terbuka');
  assert.ok(!doc.getElementById('stMentionList').classList.contains('open'),
    'dropdown composer TIDAK boleh ikut terbuka');
});

test('D-285: naskah di composer dan arahan di kotak arahan tetap terpisah', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  const ta = doc.getElementById('stLipScript');
  const hint = doc.getElementById('stSceneHint');
  ta.value = 'selamat datang di sherly studio';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  hint.value = 'di studio sedang podcast, tersenyum menghadap kamera';
  hint.dispatchEvent(new win.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  // Dua field terisi terpisah, tidak saling menimpa.
  assert.equal(ta.value, 'selamat datang di sherly studio', 'naskah terpisah');
  assert.equal(hint.value, 'di studio sedang podcast, tersenyum menghadap kamera',
    'arahan terpisah');
  // Composer prompt biasa harus TERSEMBUNYI di mode Bicara (tidak ada 2 textarea aktif).
  assert.ok(doc.getElementById('stComposerBox').classList.contains('st-hidden'),
    'composer prompt harus hidden di mode Karakter Bicara');

  // Bar info harus menyebut sumber gambar + durasi.
  const meta = doc.getElementById('stLipsyncMeta');
  assert.match(meta.textContent, /dtk/i, 'durasi harus tampil');
});

test('D-287: alur 4 langkah tampil dari atas di mode Karakter Bicara', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));

  // Di mode foto: alur 4 langkah disembunyikan, composer prompt tampil.
  assert.ok(doc.getElementById('stLipFlow').classList.contains('st-hidden'),
    'alur 4 langkah harus hidden di mode foto');
  assert.ok(!doc.getElementById('stComposerBox').classList.contains('st-hidden'),
    'composer prompt harus tampil di mode foto');
  assert.equal(doc.getElementById('stComposerLabel').textContent, 'Prompt',
    'mode foto = Prompt');

  await enterLipsync(win, doc);
  assert.ok(!doc.getElementById('stLipFlow').classList.contains('st-hidden'),
    'alur 4 langkah harus tampil di mode Karakter Bicara');
  assert.ok(doc.getElementById('stComposerBox').classList.contains('st-hidden'),
    'composer prompt harus hidden di mode Karakter Bicara');

  // Urutan field di markup: naskah (1) -> arahan (2) -> karakter (3) -> gambar (4).
  const html = doc.getElementById('stLipFlow').innerHTML;
  const iScript = html.indexOf('stLipFieldScript');
  const iHint = html.indexOf('stLipFieldHint');
  const iChar = html.indexOf('stLipFieldChar');
  const iImg = html.indexOf('stLipFieldImg');
  assert.ok(iScript >= 0 && iHint > iScript && iChar > iHint && iImg > iChar,
    'urutan harus: naskah -> arahan -> karakter -> gambar');
  // Nomor langkah 1..4.
  assert.equal(doc.getElementById('stLipFieldScript').querySelector('.st-lip-no').textContent, '1');
  assert.equal(doc.getElementById('stLipFieldHint').querySelector('.st-lip-no').textContent, '2');
  assert.equal(doc.getElementById('stLipFieldChar').querySelector('.st-lip-no').textContent, '3');
  assert.equal(doc.getElementById('stLipFieldImg').querySelector('.st-lip-no').textContent, '4');
});
