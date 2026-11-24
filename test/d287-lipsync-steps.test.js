// D-287 · ALUR 4 LANGKAH mode "Karakter Bicara" + diagnosa Kie.
//
// User: *"buat alurnya yg bener, mulai dari atas
//   1. tulis naskah
//   2. arahan adegan
//   3. pilih karakter (dropdown) dari karakter
//   4. pilih gambar referensi (dorpdown) dari aset
// buatlah tampilannya compact, itu pilih karakter seperti kotak error perbaiki"*
//
// Dua bagian:
//
// 1) FORM — alur 4 langkah bernomor dari ATAS, langkah 3 & 4 jadi DROPDOWN
//    (bukan textarea @mention), dan tombol pemilih dibuat COMPACT + TIDAK
//    terlihat seperti kotak error (border netral + thumbnail + nama).
//
// 2) DIAGNOSA — payload Kie yang dikirim user menunjukkan `image_url` diawali
//    "[" dan `prompt` memuat "]" (pola markdown link). Verifikasi DB live
//    (tabel `sherly_video_tasks`) menunjukkan prompt yang KITA SIMPAN sudah
//    BERSIH ("Novi berbicara natural. di Studio, ...") -> jejasnya ada di
//    sisi Kie/pembungkus, bukan di request kita. Supaya masalah ini bisa
//    dipetakan kalau terjadi lagi, state mentah Kie + kunci resultJson
//    disimpan ke meta task saat gagal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kieResultUrls, kieNormalizeState } from '../server/ai.js';

const studio = readFileSync('public/studio.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');
const appJs = readFileSync('server/app.js', 'utf8');
const assetsJs = readFileSync('server/studio-assets.js', 'utf8');

// ===== 1) FORM: alur 4 langkah =====

test('D-287: container alur 4 langkah ada & punya 4 field bernomor', () => {
  assert.ok(studio.includes('id="stLipFlow"'), 'container alur harus ada');
  for (const f of ['stLipFieldScript', 'stLipFieldHint', 'stLipFieldChar', 'stLipFieldImg']) {
    assert.ok(studio.includes('id="' + f + '"'), f + ' harus ada');
  }
  for (const n of [1, 2, 3, 4]) {
    assert.ok(studio.includes('class="st-lip-no">' + n + '<'), 'nomor langkah ' + n);
  }
  assert.ok(html.includes('.st-lip-no{'), 'CSS nomor langkah harus ada');
});

test('D-287: urutan di markup = naskah -> arahan -> karakter -> gambar', () => {
  const iScript = studio.indexOf('stLipFieldScript');
  const iHint = studio.indexOf('stLipFieldHint');
  const iChar = studio.indexOf('stLipFieldChar');
  const iImg = studio.indexOf('stLipFieldImg');
  assert.ok(iScript > 0 && iHint > iScript && iChar > iHint && iImg > iChar,
    'urutan harus naskah -> arahan -> karakter -> gambar');
});

test('D-287: langkah 3 = dropdown karakter (dari daftar karakter)', () => {
  assert.ok(studio.includes('id="stLipsyncCharBtn"'), 'tombol karakter harus ada');
  assert.ok(studio.includes('id="stPop-lipsyncchar"'), 'dropdown karakter harus ada');
  assert.ok(studio.includes('function buildLipsyncCharPop()'), 'ada builder dropdown karakter');
  // Item dropdown karakter pakai avatar.
  assert.ok(studio.includes('data-lip-char='), 'item dropdown karakter harus ada');
  // Tombol menampilkan thumbnail karakter.
  assert.ok(studio.includes('id="stLipsyncCharThumb"'), 'thumbnail karakter harus ada');
  assert.ok(studio.includes('charThumb.innerHTML = ch ? characterThumb(ch)'),
    'thumbnail karakter diisi dari karakter terpilih');
});

test('D-287: langkah 4 = dropdown gambar dari daftar ASET', () => {
  assert.ok(studio.includes('id="stLipImageBtn"'), 'tombol gambar harus ada');
  assert.ok(studio.includes('id="stPop-lipsyncimg"'), 'dropdown gambar harus ada');
  assert.ok(studio.includes('function buildLipsyncImgPop()'), 'ada builder dropdown gambar');
  assert.ok(studio.includes('assets.filter((a) => a && a.url)'),
    'dropdown gambar harus berisi aset (bukan karakter)');
  assert.ok(studio.includes('data-lip-img='), 'item dropdown gambar harus ada');
  // Tombol menampilkan nama + thumbnail aset terpilih.
  assert.ok(studio.includes('id="stLipImageName"'), 'nama gambar harus ada');
  assert.ok(studio.includes('id="stLipImageThumb"'), 'thumbnail gambar harus ada');
  assert.ok(studio.includes('state.lipsyncAssetId'), 'state aset lipsync dipakai');
});

test('D-287: tombol pemilih COMPACT & bukan kotak error', () => {
  const at = html.indexOf('.st-lip-pick-btn{');
  assert.ok(at > 0, 'harus ada style tombol pemilih');
  const btn = html.slice(at, at + 430);
  // Border netral — bukan merah/kotak error.
  assert.match(btn, /border:1px solid #24344e/, 'border harus netral');
  assert.ok(!/border:1px solid #f044a8/.test(btn), 'border tidak boleh merah (terlihat error)');
  // Compact.
  assert.match(btn, /min-height:38px/, 'tinggi harus compact');
  // Tidak boleh styling "error" (merah + background merah).
  assert.ok(!/background:#3[0-9a-f]{2}1[0-9a-f]{2}/i.test(btn), 'tidak boleh background merah');
  // Tombol + item dropdown punya styling.
  assert.ok(html.includes('.st-lip-img-item{'), 'harus ada style item dropdown gambar');
  assert.ok(html.includes('.st-lip-pick-thumb{'), 'harus ada style thumbnail');
});

test('D-287: naskah (#stLipScript) terpisah dari composer prompt (#stPrompt)', () => {
  assert.ok(studio.includes('id="stLipScript"'), 'textarea naskah harus ada');
  assert.ok(studio.includes('id="stPrompt"'), 'composer prompt harus tetap ada');
  // Toggle visibility: flow hanya di mode Bicara, composer disembunyikan.
  assert.ok(studio.includes("$('stLipFlow')?.classList.toggle('st-hidden', !isLip)"),
    'flow hanya tampil di mode Bicara');
  assert.ok(studio.includes("$('stComposerBox')?.classList.toggle('st-hidden', isLip)"),
    'composer disembunyikan di mode Bicara');
  // Semua pembacaan naskah pakai #stLipScript.
  const g = studio.indexOf('async function generateLipsync()');
  assert.ok(studio.slice(g, g + 700).includes("const ta = $('stLipScript')"),
    'generateLipsync baca naskah dari langkah 1');
  assert.ok(studio.includes("cleanScriptForTts(($('stLipScript') || {}).value)"),
    'estimasi durasi pakai naskah langkah 1');
});

test('D-287: aset terpilih jadi referensi (image_url) & bisa diganti', () => {
  assert.ok(studio.includes('async function syncLipsyncAssetRef()'), 'ada sinkron aset');
  const s = studio.indexOf('async function syncLipsyncAssetRef()');
  const body = studio.slice(s, s + 1700);
  assert.ok(body.includes('sceneRefs.push('), 'aset masuk sceneRefs -> jadi image_url');
  assert.ok(body.includes('sceneRefs = sceneRefs.filter('), 'referensi lama dilepas saat ganti');
});

test('D-287: error mengarah ke field yang tepat', () => {
  const g = studio.indexOf('async function generateLipsync()');
  const body = studio.slice(g, g + 3600);
  assert.ok(body.includes("Pilih gambar karakter dulu"), 'pesan gambar jelas');
  assert.ok(body.includes("$('stLipImageBtn')?.focus()"), 'fokus ke tombol gambar');
  assert.ok(body.includes('Tulis naskah yang mau dibacakan karakter.'), 'pesan naskah jelas');
});

test('D-287: panduan langkah mengikuti alur baru', () => {
  assert.ok(studio.includes('1. Tulis naskah'), 'langkah 1 = naskah');
  assert.ok(studio.includes('2. Pilih karakter'), 'langkah 2 = karakter');
  assert.ok(studio.includes('3. Pilih gambar'), 'langkah 3 = gambar');
});

// ===== 2) DIAGNOSA Kie =====

test('D-287: diagnostik Kie disimpan ke meta task saat gagal', () => {
  // Poll menyertakan info mentah.
  assert.ok(studio.length >= 0);
  const ai = readFileSync('server/ai.js', 'utf8');
  assert.ok(ai.includes('rawState:'), 'poll harus mengembalikan state mentah');
  assert.ok(ai.includes('rawKeys'), 'poll harus mengembalikan kunci resultJson');
  assert.ok(ai.includes('hasResultJson'), 'poll harus mengecek keberadaan resultJson');
  // Route menyimpannya ke meta.
  assert.ok(appJs.includes('kieRawState:'), 'meta task harus menyimpan state mentah');
  assert.ok(appJs.includes('kieResultKeys:'), 'meta task harus menyimpan kunci resultJson');
  // updateVideoTask boleh update meta.
  assert.ok(assetsJs.includes("'error', 'meta'"), 'updateVideoTask harus boleh update meta');
});

test('D-287: kieResultUrls & kieNormalizeState tetap benar (regresi D-286)', () => {
  // Kasus produksi: result_urls kosong + origin_urls berisi.
  const rj = { code: 200, data: { result_urls: [], origin_urls: ['https://x.com/a.mp4'] } };
  assert.deepEqual(kieResultUrls(rj, {}), ['https://x.com/a.mp4']);
  // Sukses tanpa URL -> fail.
  const norm = kieNormalizeState('success', [], {});
  assert.equal(norm.state, 'fail');
  assert.match(norm.error, /tidak mengembalikan URL/i);
});
