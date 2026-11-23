// D-285 · Form "Karakter Bicara" yang JELAS.
//
// User: *"gak ngerti aku, buat yg jelas formnya. di kotak arahan itu gak bisa @
// gak muncul aset yg mau di pilih, @ cuma bisa di tempat naskah coba benerin
// formnya"*
//
// Dua masalah yang diperbaiki:
//
// 1. **@mention HANYA bisa di composer utama.** Di mode "Karakter Bicara" ada
//    DUA tempat relevan: naskah (composer) dan arahan adegan. User butuh
//    memilih gambar dari kotak arahan. Perbaikan: kolom "Gambar karakter di
//    lokasi ini" (`#stLipImage`) dengan dropdown mention SENDIRI
//    (`#stMentionListLip`).
//
// 2. **Form tidak jelas.** Perbaikan: label eksplisit "Naskah yang dibacakan
//    karakter" di composer, preview gambar terpilih, dan panduan 3 langkah
//    yang menyebut kolom gambarnya.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');

// ===== 1) Kolom gambar terpisah dengan @mention sendiri =====

test('D-285: ada kolom "Gambar karakter di lokasi ini" dengan @mention sendiri', () => {
  assert.ok(studio.includes('id="stLipImage"'), 'kolom gambar harus ada');
  assert.ok(studio.includes('id="stMentionListLip"'), 'dropdown mention terpisah harus ada');
  assert.ok(studio.includes('for="stLipImage"'), 'ada label untuk kolom gambar');
  assert.ok(studio.includes('Gambar karakter di lokasi ini'), 'label kolom gambar harus jelas');
  // Placeholder mengarahkan user ke @.
  assert.ok(studio.includes('ketik @ lalu pilih gambar'), 'placeholder harus menyebut @');
});

test('D-285: dropdown mention milik kolom gambar membuka ke BAWAH', () => {
  // Kolom gambar ada di bawah composer -> dropdown ke-atas akan tertutup.
  assert.ok(html.includes('.st-mention-box-alt .st-mention-list{'), 'harus ada style khusus');
  assert.ok(html.includes('bottom:auto;top:100%'), 'dropdown harus ke bawah');
});

test('D-285: mention bisa dipicu dari kedua textarea', () => {
  // Target mention disimpan, bukan hardcode ke stPrompt.
  assert.ok(studio.includes("let mentionTarget = 'stPrompt'"), 'ada state mentionTarget');
  assert.ok(studio.includes('function mentionTargetEl()'), 'ada helper target');
  // syncMentionFromText menerima targetId.
  assert.ok(studio.includes('function syncMentionFromText(targetId)'), 'fungsi menerima target');
  // pickMention menulis ke target yang benar.
  assert.ok(studio.includes('const ta = mentionTargetEl();'), 'pickMention pakai target');
  // Listener untuk kolom gambar.
  assert.ok(studio.includes("syncMentionFromText('stLipImage')"), 'kolom gambar memicu mention');
  // Keyboard (Enter/panah) untuk kedua textarea.
  assert.ok(studio.includes('const mentionKeydown = (e) =>'), 'handler keyboard diekstrak');
  assert.ok(studio.includes('lipTa?.addEventListener(\'keydown\', mentionKeydown)'),
    'kolom gambar punya handler keyboard');
});

test('D-285: renderMention menulis ke dropdown yang sesuai target', () => {
  assert.ok(studio.includes('function mentionBoxId()'), 'ada pemetaan target -> box');
  assert.ok(studio.includes("mentionTarget === 'stLipImage' ? 'stMentionListLip' : 'stMentionList'"),
    'dropdown composer dan kolom gambar harus terpisah');
  // closeMention membersihkan keduanya.
  assert.ok(studio.includes("for (const id of ['stMentionList', 'stMentionListLip'])"),
    'closeMention bersihkan kedua dropdown');
});

// ===== 2) Mention aset dibaca dari semua field =====

test('D-285: mention aset/karakter dibaca dari SEMUA field', () => {
  assert.ok(studio.includes('function mentionSourceTexts()'), 'ada helper sumber teks');
  // Composer + arahan adegan + kolom gambar.
  assert.ok(studio.includes("const main = $('stPrompt')?.value || ''"), 'composer ikut');
  assert.ok(studio.includes("const hint = $('stSceneHint')?.value || ''"), 'arahan ikut');
  assert.ok(studio.includes("const img = $('stLipImage')?.value || ''"), 'kolom gambar ikut');
  // mentionedCharacters & mentionedAssetIds memakainya.
  assert.ok(studio.includes('const text = mentionSourceTexts().join(\'\\n\');'),
    'mention dibaca dari gabungan field');
});

test('D-285: gambar yang dipilih di kolom gambar dipakai sebagai image_url', () => {
  // mentionedAssetIds() -> syncMentionedAssetRefs() -> sceneRefs -> refImg.
  const start = studio.indexOf('function mentionedAssetIds()');
  const body = studio.slice(start, start + 700);
  assert.ok(body.includes('mentionSourceTexts()'), 'mentionedAssetIds wajib dari gabungan field');
  // syncMentionedAssetRefs memakai mentionedAssetIds.
  const s2 = studio.indexOf('async function syncMentionedAssetRefs()');
  const b2 = studio.slice(s2, s2 + 400);
  assert.ok(b2.includes('const wanted = mentionedAssetIds();'), 'sinkron dari mentionedAssetIds');
  // generateLipsync memakai sceneRefs untuk image_url.
  const s3 = studio.indexOf('async function generateLipsync()');
  const e3 = studio.indexOf('async function generateMotionGraphics()', s3);
  const b3 = studio.slice(s3, e3 > s3 ? e3 : s3 + 6000);
  assert.ok(b3.includes('sceneRefs.find('), 'image_url diambil dari sceneRefs');
});

// ===== 3) Form yang jelas =====

test('D-285: label composer jadi "Naskah yang dibacakan karakter" di mode Bicara', () => {
  assert.ok(studio.includes('id="stPromptLabel"'), 'ada elemen label');
  assert.ok(studio.includes("pl.textContent = isLip ? 'Naskah yang dibacán karakter'".replace('dibacán', 'dibacakan')),
    'label berubah di mode Bicara');
  // Placeholder composer di mode Bicara = naskah murni (bukan prompt).
  assert.ok(studio.includes("isLip ? 'Naskah yang dibacakan karakter…'"), 'placeholder naskah');
});

test('D-285: preview gambar terpilih tampil di kolom gambar', () => {
  assert.ok(studio.includes('id="stLipPreview"'), 'ada elemen preview');
  assert.ok(studio.includes('function renderLipPreview()'), 'ada fungsi render');
  assert.ok(html.includes('.st-lip-preview{'), 'ada CSS preview');
  // Dipanggil saat referensi berubah.
  const s = studio.indexOf('async function syncMentionedAssetRefs()');
  const e = studio.indexOf('function removeSceneRef(', s);
  assert.ok(studio.slice(s, e > s ? e : s + 2000).includes('renderLipPreview()'),
    'dipanggil saat sinkron');
});

test('D-285: panduan 3 langkah menyebut kolom gambar', () => {
  assert.ok(studio.includes('2. Pilih gambar (kolom Gambar karakter)'),
    'langkah 2 harus menyebut kolom gambar');
  assert.ok(studio.includes('1. Pilih karakter'), 'langkah 1');
  assert.ok(studio.includes('3. Tulis naskah'), 'langkah 3');
});

test('D-285: pesan error mengarah ke kolom yang tepat', () => {
  const s = studio.indexOf('async function generateLipsync()');
  const body = studio.slice(s, s + 3500);
  // Error gambar -> fokus kolom gambar (bukan composer).
  assert.ok(body.includes("Pilih gambar karakter dulu"), 'pesan error gambar jelas');
  assert.ok(body.includes("$('stLipImage')?.focus()"), 'fokus ke kolom gambar');
  // Error naskah -> fokus composer.
  assert.ok(body.includes('Tulis naskah yang mau dibacakan karakter.'), 'pesan naskah');
});

test('D-285: naskah composer dibersihkan, kolom gambar tidak ikut jadi naskah', () => {
  const s = studio.indexOf('async function generateLipsync()');
  const e = studio.indexOf('async function generateMotionGraphics()', s);
  const body = studio.slice(s, e > s ? e : s + 6000);
  // Naskah tetap dari stPrompt saja, dibersihkan.
  assert.ok(body.includes('const rawScript = (ta?.value || \'\').trim();'), 'naskah dari composer');
  assert.ok(body.includes('const script = cleanScriptForTts(rawScript);'), 'naskah dibersihkan');
  // Arahan adegan terpisah (prompt ke Kie).
  assert.ok(body.includes("const sceneHint = ($('stSceneHint')?.value || '').trim();"),
    'arahan adegan terpisah dari naskah');
});

test('D-285: token @ tak dikenal dicek di semua field', () => {
  const s = studio.indexOf('async function generateLipsync()');
  const body = studio.slice(s, s + 3500);
  // Tanpa argumen -> otomatis semua field.
  assert.ok(body.includes('const unknown = unknownMentionTokens();'), 'cek semua field');
});
