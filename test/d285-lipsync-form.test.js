// D-285 / D-287 · Form "Karakter Bicara" — struktur & wiring.
//
// D-285: form dibuat jelas (composer = naskah, kolom @mention terpisah).
// D-287: ALUR 4 LANGKAH sesuai permintaan user, dari ATAS:
//   1. Tulis naskah        (#stLipScript)
//   2. Arahan adegan       (#stSceneHint)
//   3. Pilih karakter      (dropdown #stLipsyncCharBtn)
//   4. Pilih gambar ref.   (dropdown #stLipImageBtn dari daftar aset)
//
// Plus: tombol pemilih harus COMPACT dan TIDAK terlihat seperti kotak error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');

// ===== 1) Struktur 4 langkah =====

test('D-287: ada container alur 4 langkah', () => {
  assert.ok(studio.includes('id="stLipFlow"'), 'container alur harus ada');
  assert.ok(studio.includes('id="stLipFieldScript"'), 'field naskah harus ada');
  assert.ok(studio.includes('id="stLipFieldHint"'), 'field arahan harus ada');
  assert.ok(studio.includes('id="stLipFieldChar"'), 'field karakter harus ada');
  assert.ok(studio.includes('id="stLipFieldImg"'), 'field gambar harus ada');
});

test('D-287: urutan field di markup: naskah -> arahan -> karakter -> gambar', () => {
  const iScript = studio.indexOf('stLipFieldScript');
  const iHint = studio.indexOf('stLipFieldHint');
  const iChar = studio.indexOf('stLipFieldChar');
  const iImg = studio.indexOf('stLipFieldImg');
  assert.ok(iScript > 0 && iHint > iScript && iChar > iHint && iImg > iChar,
    'urutan harus naskah -> arahan -> karakter -> gambar');
});

test('D-287: tiap langkah punya nomor 1..4', () => {
  assert.ok(studio.includes('class="st-lip-no">1<'), 'nomor 1');
  assert.ok(studio.includes('class="st-lip-no">2<'), 'nomor 2');
  assert.ok(studio.includes('class="st-lip-no">3<'), 'nomor 3');
  assert.ok(studio.includes('class="st-lip-no">4<'), 'nomor 4');
  assert.ok(html.includes('.st-lip-no{'), 'CSS nomor langkah harus ada');
});

test('D-287: langkah 4 "Gambar referensi" = DROPDOWN dari aset', () => {
  assert.ok(studio.includes('id="stLipImageBtn"'), 'tombol pilih gambar harus ada');
  assert.ok(studio.includes('id="stPop-lipsyncimg"'), 'dropdown gambar harus ada');
  assert.ok(studio.includes('for="stLipImageBtn"'), 'ada label untuk tombol gambar');
  assert.ok(studio.includes('Gambar referensi'), 'label langkah 4 harus jelas');
  assert.ok(studio.includes('function buildLipsyncImgPop()'), 'ada builder dropdown gambar');
  assert.ok(studio.includes('assets.filter((a) => a && a.url)'),
    'dropdown harus berisi aset gambar');
  assert.ok(studio.includes('data-lip-img='), 'item dropdown harus punya data-lip-img');
});

test('D-287: tombol pemilih compact & TIDAK seperti kotak error', () => {
  assert.ok(html.includes('.st-lip-pick-btn{'), 'harus ada style tombol pemilih');
  assert.ok(html.includes('.st-lip-img-item{'), 'harus ada style item dropdown gambar');
  const at = html.indexOf('.st-lip-pick-btn{');
  const btn = html.slice(at, at + 420);
  // Border netral — BUKAN merah/kotak error.
  assert.match(btn, /border:1px solid #24344e/, 'border harus netral (bukan merah/err)');
  // Compact.
  assert.match(btn, /min-height:38px/, 'tinggi tombol harus compact');
  // WAJIB ada thumbnail + nama.
  assert.ok(html.includes('.st-lip-pick-thumb{'), 'harus ada thumbnail di tombol');
  assert.ok(studio.includes('id="stLipsyncCharThumb"'), 'thumbnail karakter harus ada');
  assert.ok(studio.includes('id="stLipImageThumb"'), 'thumbnail gambar harus ada');
});

test('D-287: composer prompt & textarea naskah terpisah', () => {
  assert.ok(studio.includes('id="stLipScript"'), 'textarea naskah harus ada');
  assert.ok(studio.includes('id="stPrompt"'), 'composer prompt harus tetap ada');
  // Mode Bicara: composer disembunyikan, flow tampil.
  assert.ok(studio.includes("$('stLipFlow')?.classList.toggle('st-hidden', !isLip)"),
    'flow hanya tampil di mode Bicara');
  assert.ok(studio.includes("$('stComposerBox')?.classList.toggle('st-hidden', isLip)"),
    'composer disembunyikan di mode Bicara');
});

test('D-287: naskah dibaca dari #stLipScript di semua tempat', () => {
  // Estimasi durasi.
  assert.ok(studio.includes("cleanScriptForTts(($('stLipScript') || {}).value)"),
    'estimasi durasi pakai naskah');
  // Generate.
  const g = studio.indexOf('async function generateLipsync()');
  assert.ok(studio.slice(g, g + 600).includes("const ta = $('stLipScript')"),
    'generateLipsync baca dari #stLipScript');
  // Mention.
  assert.ok(studio.includes("const script = $('stLipScript')?.value || ''"),
    'mentionSourceTexts ikut naskah');
});

test('D-287: mention punya dropdown sendiri untuk naskah', () => {
  assert.ok(studio.includes("let mentionTarget = 'stPrompt'"), 'ada state mentionTarget');
  assert.ok(studio.includes('function mentionTargetEl()'), 'ada helper target');
  assert.ok(studio.includes('function syncMentionFromText(targetId)'), 'fungsi menerima target');
  assert.ok(studio.includes('const ta = mentionTargetEl();'), 'pickMention pakai target');
  assert.ok(studio.includes("mentionTarget === 'stLipScript' ? 'stMentionListScript' : 'stMentionList'"),
    'dropdown naskah terpisah dari composer');
  assert.ok(studio.includes("for (const id of ['stMentionList', 'stMentionListScript'])"),
    'closeMention bersihkan kedua dropdown');
  assert.ok(studio.includes("syncMentionFromText('stLipScript')"), 'naskah memicu mention');
  assert.ok(studio.includes("lipScript?.addEventListener('keydown', mentionKeydown)"),
    'naskah punya handler keyboard');
});

test('D-287: aset yang dipilih jadi referensi (image_url)', () => {
  assert.ok(studio.includes('state.lipsyncAssetId'), 'state aset lipsync dipakai');
  assert.ok(studio.includes('async function syncLipsyncAssetRef()'), 'ada sinkron aset');
  const s = studio.indexOf('async function syncLipsyncAssetRef()');
  const body = studio.slice(s, s + 1600);
  assert.ok(body.includes('sceneRefs.push('), 'aset masuk sceneRefs');
  // Step 4 dipakai sebagai image_url di generateLipsync.
  const g = studio.indexOf('async function generateLipsync()');
  const ge = studio.indexOf('async function generateMotionGraphics()', g);
  assert.ok(studio.slice(g, ge).includes('sceneRefs.find('), 'image_url dari sceneRefs');
});

test('D-287: dropdown gambar & karakter terpasang ke tombolnya', () => {
  assert.ok(studio.includes("$('stLipImageBtn')?.addEventListener('click'"),
    'tombol gambar punya listener');
  assert.ok(studio.includes("togglePop('lipsyncimg')"), 'dropdown gambar pakai togglePop');
  assert.ok(studio.includes("$('stLipsyncCharBtn')?.addEventListener('click'"),
    'tombol karakter punya listener');
});

test('D-287: panduan langkah mengikuti alur naskah -> karakter -> gambar', () => {
  assert.ok(studio.includes('1. Tulis naskah'), 'langkah 1 = naskah');
  assert.ok(studio.includes('2. Pilih karakter'), 'langkah 2 = karakter');
  assert.ok(studio.includes('3. Pilih gambar'), 'langkah 3 = gambar');
});

test('D-287: pesan error mengarah ke field yang tepat', () => {
  const g = studio.indexOf('async function generateLipsync()');
  const body = studio.slice(g, g + 3600);
  assert.ok(body.includes('Pilih gambar karakter dulu'), 'pesan error gambar jelas');
  assert.ok(body.includes("$('stLipImageBtn')?.focus()"), 'fokus ke tombol gambar');
  assert.ok(body.includes('Tulis naskah yang mau dibacakan karakter.'), 'pesan naskah');
});

test('D-287: bar info tetap menampilkan durasi & sumber gambar', () => {
  assert.ok(studio.includes("const src = selAsset ? 'gambar dipilih'"),
    'info harus menyebut sumber gambar');
  assert.ok(studio.includes('±\' + est + \' dtk (maks \' + max + \')'),
    'info harus menampilkan estimasi durasi');
  assert.ok(studio.includes('terlalu panjang, pendekkan naskah'),
    'info harus memperingatkan naskah kepanjangan');
});
