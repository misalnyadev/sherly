// D-284 · Cara pakai "Karakter Bicara" (lipsync) — perbaikan usability.
//
// User bertanya: "selamat datang di sherly studio @gambar referensi" +
// arahan adegan — itu cara yang benar?
//
// Jawaban: BELUM tepat, dan ada 2 bug yang diperbaiki di sini:
//
// 1. **Token @ ikut dibacakan TTS.** Script mentah ("selamat datang di sherly
//    studio @aset-gambarreferensi") dikirim apa adanya ke Gemini TTS ->
//    karakter membacakan "@aset-gambarreferensi" dengan suara robotik.
//    Perbaikan: `cleanScriptForTts()` membuang token @ sebelum TTS.
//
// 2. **Token yang diketik manual tidak dikenalan.** Token aset WAJIB berawalan
//    "aset-" (lihat assetTokenSlug). "@gambar referensi" bukan token valid ->
//    diam-diam diabaikan -> gambar TIDAK terkirim -> Kie pakai potret
//    karakter sebagai cadangan. Perbaikan: `unknownMentionTokens()` +
//    peringatan di UI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const appJs = readFileSync('server/app.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');

/** Bersihkan naskah dari token mention — cerminan client. */
function cleanScriptForTts(raw) {
  return String(raw || '')
    .replace(/@[a-z0-9][a-z0-9_-]{0,59}/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

test('D-284: token @ DIBUANG dari naskah sebelum dikirim ke TTS', () => {
  // Naskah user + token aset.
  const script = cleanScriptForTts('selamat datang di sherly studio @aset-gambarreferensi');
  assert.ok(!script.includes('@'), 'token @ harus hilang');
  assert.ok(!script.includes('aset-'), 'nama aset tidak boleh ikut dibacakan');
  assert.equal(script, 'selamat datang di sherly studio', 'naskah inti harus utuh');
  // Spasi dobel & tanda baca harus dirapikan.
  assert.equal(cleanScriptForTts('halo  @aset-abc ,  dunia'), 'halo, dunia');
  // Naskah tanpa token tetap sama.
  assert.equal(cleanScriptForTts('halo dunia'), 'halo dunia');
});

test('D-284: client & server sama-sama membersihkan naskah', () => {
  assert.ok(studio.includes('function cleanScriptForTts(raw)'), 'client punya helper');
  assert.ok(appJs.includes('function cleanScriptForTts(raw)'), 'server punya helper');
  // Client memakai helper untuk script yang dikirim.
  assert.ok(studio.includes('const script = cleanScriptForTts(rawScript);'),
    'generateLipsync harus pakai naskah bersih');
  // Server juga membersihkan (belt & braces untuk client lama / API langsung).
  assert.ok(appJs.includes('const script = cleanScriptForTts('),
    'route lipsync harus membersihkan naskah');
});

test('D-284: token aset WAJIB berawalan "aset-" (bukan "@gambar referensi")', () => {
  assert.ok(studio.includes("return ('aset-' + base).slice(0, 60);"),
    'slug aset harus berawalan aset-');
  // Regex mention hanya menerima slug a-z0-9 + _ - (spasi tidak boleh).
  assert.ok(/const re = \/@\(\[a-z0-9\]\[a-z0-9_-\]\{0,59\}\)\/gi/.test(studio),
    'token mention harus format slug (tanpa spasi)');
});

test('D-284: token @ tak dikenal terdeteksi & diberi peringatan', () => {
  assert.ok(studio.includes('function unknownMentionTokens(raw)'), 'helper deteksi token asing');
  // Dipakai di generateLipsync (toast) & di tip UI.
  // D-285: tanpa argumen -> otomatis semua field (composer + arahan + kolom gambar).
  assert.ok(studio.includes('const unknown = unknownMentionTokens();'),
    'generateLipsync harus memeriksa token asing');
  assert.ok(studio.includes('const unknown = unknownMentionTokens();'),
    'tip UI harus memeriksa token asing');
  assert.ok(studio.includes('Token tak dikenal'), 'harus ada pesan jelas');
  assert.ok(studio.includes('token aset diawali "aset-"'), 'pesan harus menjelaskan format token');
});

test('D-284: UI memberi panduan 3 langkah (karakter -> gambar -> naskah)', () => {
  assert.ok(studio.includes('id="stLipsyncTip"'), 'harus ada elemen tip');
  assert.ok(html.includes('.st-lipsync-tip{'), 'harus ada CSS tip');
  // Isi tip: 3 langkah.
  assert.ok(studio.includes('2. Pilih karakter'), 'langkah 2 = pilih karakter');
  // D-287: urutan panduan = naskah -> karakter -> gambar.
  assert.ok(studio.includes('1. Tulis naskah'), 'langkah 1 = naskah');
  assert.ok(studio.includes('2. Pilih karakter'), 'langkah 2 = karakter');
  assert.ok(studio.includes('3. Pilih gambar'), 'langkah 3 = gambar');
  assert.ok(studio.includes('3. Pilih gambar'), 'langkah 3 = pilih gambar');
  // Ada penanda selesai (ok) vs belum (todo).
  assert.ok(studio.includes("'<b class=\"ok\">"), 'langkah selesai ditandai ok');
  assert.ok(studio.includes("'<b class=\"todo\">"), 'langkah belum ditandai todo');
});

test('D-284: bar info lipsync tetap menampilkan sumber gambar & durasi', () => {
  // D-287: sumber gambar mengikuti aset yang dipilih di langkah 4.
  assert.ok(studio.includes('const src = selAsset ? \'gambar dipilih\''),
    'info harus menyebut sumber gambar (gambar dipilih vs potret karakter)');
  assert.ok(studio.includes('±\' + est + \' dtk (maks \' + max + \')'),
    'info harus menampilkan estimasi durasi');
  assert.ok(studio.includes('terlalu panjang, pendekkan naskah'),
    'info harus memperingatkan naskah kepanjangan');
});

test('D-284: naskah tetap wajib diisi (validasi awal)', () => {
  const start = studio.indexOf('async function generateLipsync()');
  const end = studio.indexOf('function renderVideoProgress()', start);
  const body = studio.slice(start, end);
  // Naskah kosong (hanya token @) -> ditolak.
  assert.ok(body.includes("if (!script)"), 'naskah kosong harus ditolak');
  assert.ok(body.includes('Tulis naskah yang mau dibacakan karakter.'), 'ada pesan jelas');
  // Batas durasi tetap dijaga (D-283).
  assert.ok(body.includes('estSec > maxSec + 3'), 'batas maksimum durasi tetap dijaga');
});
