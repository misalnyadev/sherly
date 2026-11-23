// D-283 · Dua bug yang user laporkan:
//   (1) "foto horizontal hasilnya tidak masuk ke galeri"
//   (2) "fitur karakter berbicara juga belum berhasil"
//
// (1) FOTO HORIZONTAL TIDAK MASUK GALERI
//     Penyebab: generate gambar Kie ожидал результат внутри SATU request
//     (poll Kie sampai 55 detik). Vercel serverless maxDuration = 60 detik,
//     jadi fungsi dibunuh platform -> client tidak pernah dapat respons ->
//     foto hilang total, tidak pernah masuk galeri.
//     Paling kena LANDSCAPE 16:9: Kie menghitung ukuran dari sisi PENDEK,
//     jadi 16:9 2K = 3641x2048 (7,5 MP) — jauh lebih besar & lambat dari
//     9:16 2K (2,4 MP).
//     Perbaikan: pola ASYNC dua fase (create task -> poll dari browser),
//     sama seperti video.
//
// (2) KARAKTER BERBICARA GAGAL
//     Data live (tabel sherly_video_tasks): 4 task lipsync semuanya 'fail'
//     dengan error "ConnectException: Operation timed out (Connection timed out)"
//     -> task Kie dibuat sukses, tapi Kie gagal menarik file input.
//     Penyebab yang bisa kita perbaiki: durasi audio salah hitung ~3x
//     (estimasi lama `base64*0.75/16000` menganggap PCM 16 kHz, padahal
//     Gemini TTS menghasilkan WAV 24 kHz mono = 48.000 B/detik).
//     Akibatnya naskah 4 detik dianggap 12 detik, naskah 5 detik dianggap 15
//     detik -> kena gatekeeper "terlalu panjang" (maks 15 dtk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pcmToWav, wavDurationSeconds, audioDurationFromBase64 } from '../server/tts.js';
import { lipsyncErrorMessage } from '../server/lipsync-errors.js';

const appJs = readFileSync('server/app.js', 'utf8');
const aiJs = readFileSync('server/ai.js', 'utf8');
const studio = readFileSync('public/studio.js', 'utf8');

// ---------------------------------------------------------------------------
// (1) Generate gambar jadi ASYNC dua fase
// ---------------------------------------------------------------------------

test('D-283: server punya createKieImageTask + pollKieImageTask (fase 1 & 2)', () => {
  assert.ok(aiJs.includes('export async function createKieImageTask'),
    'harus ada createKieImageTask (buat task tanpa menunggu)');
  assert.ok(aiJs.includes('export async function pollKieImageTask'),
    'harus ada pollKieImageTask (cek status task)');
  // createTask TIDAK boleh berisi loop poll (itulah yang bikin timeout).
  const start = aiJs.indexOf('export async function createKieImageTask');
  const end = aiJs.indexOf('export async function pollKieImageTask');
  const body = aiJs.slice(start, end);
  assert.ok(!body.includes('while (Date.now() <'),
    'createKieImageTask tidak boleh menunggu/poll di dalam request');
  assert.ok(body.includes('createTask'), 'harus tetap memanggil createTask Kie');
});

test('D-283: POST /api/ai/image membalas SEKETIKA dengan id task (202)', () => {
  const start = appJs.indexOf("app.post('/api/ai/image'");
  const end = appJs.indexOf("app.get('/api/ai/image/:id'");
  assert.ok(start > 0 && end > start, 'kedua route harus ada');
  const body = appJs.slice(start, end);
  // Balas 202 + id task, bukan menunggu gambar.
  assert.ok(body.includes('res.status(202).json'), 'harus balas 202 (accepted)');
  assert.ok(body.includes('async: true'), 'payload harus menandai mode async');
  assert.ok(body.includes('id: task.id'), 'payload harus membawa id task untuk polling');
  // Tidak boleh ada poll blocking di route POST.
  assert.ok(!body.includes('kiePollImageTask'), 'route POST tidak boleh poll di dalam request');
});

test('D-283: ada route GET /api/ai/image/:id untuk polling + simpan aset', () => {
  const start = appJs.indexOf("app.get('/api/ai/image/:id'");
  assert.ok(start > 0, 'route poll gambar harus ada');
  const body = appJs.slice(start, start + 3500);
  assert.ok(body.includes('pollKieImageTask'), 'route poll harus memanggil pollKieImageTask');
  assert.ok(body.includes('saveAsset'), 'gambar hasil harus disimpan sebagai aset');
  assert.ok(body.includes('detectDimensions'), 'dimensi harus dibaca (biar landscape ter分类 benar)');
  assert.ok(body.includes("kind: 'generate'"), 'aset hasil generate harus kind=generate');
  assert.ok(body.includes('signedAsset'), 'harus balik signed URL ke client');
});

test('D-283: client poll gambar (dua fase) & masukkan hasil ke galeri', () => {
  assert.ok(studio.includes('async function pollImage()'), 'client harus punya pollImage');
  assert.ok(studio.includes("fetch('/api/ai/image/' + imageTask.id"),
    'client harus poll endpoint gambar');
  assert.ok(studio.includes('if (d.async && d.id)'), 'client harus deteksi mode async');
  assert.ok(studio.includes('let imageTask = null'), 'harus ada state imageTask');
  assert.ok(studio.includes('let imageTimer = null'), 'harus ada timer polling');
  assert.ok(studio.includes('id="stImageProgress"'), 'harus ada elemen progres gambar');
  // Hasil akhir harus masuk galeri.
  const pollStart = studio.indexOf('async function pollImage()');
  const pollBody = studio.slice(pollStart, pollStart + 1600);
  assert.ok(pollBody.includes('assets.unshift(d.asset)'), 'hasil harus masuk galeri');
  assert.ok(pollBody.includes('renderGallery()'), 'galeri harus di-render ulang');
  assert.ok(pollBody.includes("d.status === 'fail'"), 'kegagalan harus ditampilkan');
});

test('D-283: jalur sinkron Kie yang lama sudah dibuang dari /api/ai/image', () => {
  const start = appJs.indexOf("app.post('/api/ai/image'");
  const end = appJs.indexOf("app.get('/api/ai/image/:id'");
  const body = appJs.slice(start, end);
  // Tidak boleh ada generateImageWithKie (yang poll 55 detik) lagi di route ini.
  assert.ok(!body.includes('generateImageWithKie'),
    'route gambar tidak boleh pakai jalur sinkron yang bisa kena timeout 60 dtk');
  // Gemini & provider custom tetap boleh (keduanya < 30 detik).
  assert.ok(body.includes('generateImageWithGemini'), 'Gemini tetap sinkron');
});

// ---------------------------------------------------------------------------
// (2) Durasi audio lipsync dihitung benar
// ---------------------------------------------------------------------------

test('D-283: durasi WAV dibaca PERSIS dari header (bukan estimasi 16 kHz)', () => {
  for (const sec of [3, 4, 5, 10, 15, 20]) {
    const wav = pcmToWav(Buffer.alloc(24000 * 2 * sec), 24000);
    assert.equal(wavDurationSeconds(wav), sec, `durasi ${sec} detik harus terbaca tepat`);
    const b64 = wav.toString('base64');
    assert.equal(audioDurationFromBase64(b64), sec, `durasi base64 ${sec} detik harus tepat`);
    // Estimasi lama (yang dipakai sebelum D-283) salah ~3x.
    const lama = Math.max(1, Math.round((b64.length * 0.75) / 16000));
    assert.ok(lama > sec, `estimasi lama harus memang lebih besar (${lama} > ${sec})`);
  }
});

test('D-283: durasi audio TTS dipakai di route lipsync (bukan rumus lama)', () => {
  assert.ok(appJs.includes('audioDurationFromBase64(audioBase64)'),
    'route lipsync harus pakai audioDurationFromBase64');
  assert.ok(!appJs.includes('(audioBase64.length * 0.75) / 16000'),
    'rumus estimasi lama harus hilang dari route lipsync');
  assert.ok(appJs.includes('import { lipsyncErrorMessage }'),
    'route lipsync harus mengimpor penerjemah error');
});

test('D-283: pesan "naskah terlalu panjang" menyebut durasi asli', () => {
  assert.ok(appJs.includes('durasi suara'), 'pesan harus menyebut durasi suara');
  assert.ok(appJs.includes("' detik, maksimal ' + maxSeconds"), 'pesan harus menyebut batas detik');
  assert.ok(appJs.includes('Pendekkan naskah'), 'pesan harus memberi saran');
});

// ---------------------------------------------------------------------------
// (3) Error Kie kriptik diterjemahkan
// ---------------------------------------------------------------------------

test('D-283: error Kie "Connection timed out" diterjemahkan jadi pesan actionable', () => {
  const msg = lipsyncErrorMessage('ConnectException: Operation timed out (Connection timed out)');
  assert.ok(msg.includes('Kie gagal menarik file'), 'harus menjelaskan penyebabnya');
  assert.ok(msg.includes('Coba lagi'), 'harus memberi saran');
  assert.ok(!/^ConnectException/.test(msg), 'pesan mentah tidak boleh jadi pesan utama');
});

test('D-283: penerjemah error menutupi kasus-kasus umum lipsync', () => {
  const tooLong = lipsyncErrorMessage('audio too long');
  assert.ok(tooLong.includes('terlalu panjang'), 'audio kepanjangan harus dikenali');
  const credit = lipsyncErrorMessage('insufficient credit balance');
  assert.ok(credit.includes('Kredit Kie AI habis'), 'kredit habis harus dikenali');
  const rate = lipsyncErrorMessage('429 rate limit exceeded');
  assert.ok(rate.includes('Terlalu banyak permintaan'), 'rate limit harus dikenali');
  const key = lipsyncErrorMessage('401 Unauthorized');
  assert.ok(key.includes('Kunci Kie AI ditolak'), 'kunci ditolak harus dikenali');
  const unknown = lipsyncErrorMessage('entah apa');
  assert.ok(unknown.length > 0, 'error tak dikenal tetap dikembalikan');
});

// ---------------------------------------------------------------------------
// (4) Lipsync tetap punya dua fase (aman dari timeout 60 dtk)
// ---------------------------------------------------------------------------

test('D-283: client mengecek batas durasi lipsync sebelum kirim', () => {
  const start = studio.indexOf('async function generateLipsync()');
  const end = studio.indexOf('function renderVideoProgress()', start);
  assert.ok(start > 0 && end > start, 'fungsi generateLipsync harus ada');
  const body = studio.slice(start, end);
  // Cek maksimum durasi sebelum request dikirim.
  assert.ok(body.includes('estSec > maxSec + 3'), 'client harus menolak naskah kepanjangan');
  assert.ok(body.includes('Pendekkan'), 'pesan harus memberi saran pemangkasan');
  assert.ok(body.includes('maxSec * 13 / 10'), 'pesan harus menyebut jumlah karakter maksimum');
  // Estimasi durasi client & server harus konsisten (13 karakter/detik).
  assert.ok(studio.includes('Math.ceil(chars / 13)'), 'estimasi client = 13 karakter/detik');
});

test('D-283: meta lipsync menandai naskah yang melebihi batas', () => {
  assert.ok(studio.includes('terlalu panjang, pendekkan naskah'),
    'baris info harus memberi tahu naskah kepanjangan');
});

test('D-283: lipsync tetap memakai pola task async (aman timeout Vercel)', () => {
  const start = appJs.indexOf("app.post('/api/ai/lipsync'");
  const end = appJs.indexOf("app.get('/api/ai/video/:id'");
  assert.ok(start > 0 && end > start, 'route lipsync harus ada');
  const body = appJs.slice(start, end);
  assert.ok(body.includes('createVideoTask'), 'harus membuat task (bukan menunggu hasil)');
  assert.ok(body.includes('res.status(202).json'), 'harus balas 202 + id task');
  assert.ok(body.includes('generateLipsyncWithKie'), 'harus tetap memakai generator Kie');
  // Tidak boleh poll Kie di dalam route pembuatan task.
  assert.ok(!body.includes('pollKieVideoTask'), 'route pembuatan tidak boleh poll Kie');
});
