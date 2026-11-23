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

test('D-285: kolom "Gambar karakter" membuka dropdown mention sendiri', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  const lipImage = doc.getElementById('stLipImage');
  assert.ok(lipImage, 'kolom gambar harus ada di mode Karakter Bicara');

  const listLip = doc.getElementById('stMentionListLip');
  const listMain = doc.getElementById('stMentionList');
  assert.ok(listLip, 'dropdown kolom gambar harus ada');
  assert.ok(listMain, 'dropdown composer harus ada');
  assert.ok(!listLip.classList.contains('open'), 'dropdown kolom gambar belum terbuka');

  // User ketik "@" di kolom gambar.
  lipImage.value = '@';
  lipImage.setSelectionRange(1, 1);
  lipImage.dispatchEvent(new win.Event('keyup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(listLip.classList.contains('open'),
    'dropdown kolom gambar HARUS terbuka (dulu tidak bisa @ di sini)');
  assert.ok(!listMain.classList.contains('open'),
    'dropdown composer TIDAK boleh ikut terbuka (tidak bercampur)');
  // Daftar harus menampilkan aset dari galeri.
  const txt = listLip.textContent || '';
  assert.match(txt, /gambar referensi/i, 'aset harus muncul di dropdown');
  assert.match(txt, /studio podcast/i, 'semua aset harus muncul');
});

test('D-285: aset yang dipilih dari kolom gambar MASUK jadi referensi (image_url)', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  const lipImage = doc.getElementById('stLipImage');
  lipImage.value = '@';
  lipImage.setSelectionRange(1, 1);
  lipImage.dispatchEvent(new win.Event('keyup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  const listLip = doc.getElementById('stMentionListLip');
  const item = [...listLip.querySelectorAll('[data-mention-pick]')]
    .find((b) => /gambar referensi/i.test(b.textContent || ''));
  assert.ok(item, 'item aset harus ada di dropdown');

  // Klik aset -> token ditulis ke kolom gambar (BUKAN ke composer).
  item.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));

  assert.match(lipImage.value, /^@aset-/,
    'token harus ditulis ke kolom gambar, diawali "aset-"');
  assert.equal(doc.getElementById('stPrompt').value, '',
    'composer (naskah) harus tetap kosong');

  // Preview gambar terpilih harus tampil.
  const prev = doc.getElementById('stLipPreview');
  assert.ok(prev && !prev.classList.contains('st-hidden'),
    'preview gambar terpilih harus tampil');
  assert.ok(prev.querySelector('img'), 'preview harus berisi gambar');
});

test('D-285: composer dan kolom gambar punya dropdown terpisah', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  // Ketik "@" di composer -> dropdown composer yang terbuka.
  const ta = doc.getElementById('stPrompt');
  ta.value = '@';
  ta.setSelectionRange(1, 1);
  ta.dispatchEvent(new win.Event('keyup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(doc.getElementById('stMentionList').classList.contains('open'),
    'dropdown composer harus terbuka');
  assert.ok(!doc.getElementById('stMentionListLip').classList.contains('open'),
    'dropdown kolom gambar TIDAK boleh ikut terbuka');

  // Sekarang ketik "@" di kolom gambar -> yang terbuka HANYA kolom gambar.
  const lipImage = doc.getElementById('stLipImage');
  lipImage.value = '@';
  lipImage.setSelectionRange(1, 1);
  lipImage.dispatchEvent(new win.Event('keyup', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(doc.getElementById('stMentionListLip').classList.contains('open'),
    'dropdown kolom gambar harus terbuka');
  assert.ok(!doc.getElementById('stMentionList').classList.contains('open'),
    'dropdown composer harus tertutup (tidak bercampur)');
});

test('D-285: naskah di composer dan arahan di kotak arahan tetap terpisah', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await enterLipsync(win, doc);

  const ta = doc.getElementById('stPrompt');
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

  // Bar info harus menyebut sumber gambar + durasi.
  const meta = doc.getElementById('stLipsyncMeta');
  assert.match(meta.textContent, /dtk/i, 'durasi harus tampil');
});

test('D-285: label composer berubah jadi "Naskah yang dibacakan karakter"', async () => {
  const { win, doc } = buildStudio(makeFetch());
  await win.renderStudio();
  await new Promise((r) => setTimeout(r, 80));

  // Di mode foto: label generic.
  const label = doc.getElementById('stPromptLabel');
  assert.ok(label, 'label composer harus ada');
  assert.equal(label.textContent, 'Prompt', 'mode foto = Prompt');

  await enterLipsync(win, doc);
  assert.equal(doc.getElementById('stPromptLabel').textContent,
    'Naskah yang dibacakan karakter', 'mode Karakter Bicara = Naskah yang dibacakan');
});
