// D-288 · POLLING LIPSYNC/VIDEO TIDAK BERHENTI SAAT JARINGAN GAGAL.
//
// User: *"test model lain gak bisa juga"* + payload Kie untuk 2 model
// (InfiniteTalk & OmniHuman 2.0).
//
// TEMUAN DB LIVE (Supabase, tabel `sherly_video_tasks`):
//
//   id 14e11def  model omnihuman-2-0        status "queued"   <- BELUM PERNAH dipoll
//   id 2cd827ab  model infinitalk/from-audio status "running" <- menggantung
//   id 81edf349  model infinitalk/from-audio status "running" <- menggantung
//
// SEMUA task punya `task_id` (artinya Kie MENERIMA task), tapi statusnya
// tidak pernah maju ke "success"/"fail" dan `kieRawState` = null ->
// **route polling TIDAK PERNAH berhasil**.
//
// AKAR MASALAH (terbukti dari kode + error Kie yang sudah kita kenal):
//
//   1. `pollKieVideoTask` → `fetch(recordInfo)` gagal/timeout
//      → throw → route balas HTTP 502
//      → client `pollVideo()` lihat `!r.ok` → `catch` → **videoTask = null**
//      → polling BERHENTI PERMANEN → task menggantung selamanya.
//
//   Kie SERING balas "ConnectException: Operation timed out" saat MENARIK file
//   potret/audio dari file host-nya (lihat server/lipsync-errors.js D-283).
//   Itu error SEMENTARA — job di sisi Kie tetap jalan. Jadi polling HARUS
//   retry, bukan menyerah.
//
// PERBAIKAN:
//   1. Server `pollKieVideoTask`: retry fetch recordInfo 3x (jeda 1.2/2.4 dtk).
//   2. Route `/api/ai/video/:id`: gagal polling → balas HTTP 200 dengan
//      status "running" + `retryable: true` (BUKAN 502) → client lanjut poll.
//   3. Client `pollVideo()`: `retryable` → retry dengan backoff
//      (3 → 6 → 9 → … → 15 dtk) sampai MAX_POLL_RETRIES (12).
//   4. Client `resumeRunningVideoTask()`: saat halaman dibuka, cari task yang
//      masih jalan lalu lanjut poll (task yang dibuat sebelum browser
//      ke-close tidak menggantung selamanya).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const ai = readFileSync('server/ai.js', 'utf8');
const appJs = readFileSync('server/app.js', 'utf8');

// ===== 1) Server: retry fetch recordInfo =====

test('D-288: server retry fetch recordInfo ke Kie (3x) sebelum menyerah', () => {
  const start = ai.indexOf('export async function pollKieVideoTask');
  assert.ok(start > 0, 'pollKieVideoTask harus ada');
  const body = ai.slice(start, start + 4000);
  // Loop retry.
  assert.ok(body.includes('for (let tries = 0; tries < 3'), 'harus ada retry 3x');
  assert.ok(body.includes('!qr || !qr.ok'), 'loop harus cek qr');
  // Jeda antar percobaan (backoff ringan).
  assert.ok(body.includes('setTimeout(r, 1200 * tries)'), 'harus ada jeda antar percobaan');
  // Timeout per fetch tetap ada (jangan menggantung).
  assert.ok(body.includes('AbortSignal.timeout(20000)'), 'timeout per request harus ada');
});

// ===== 2) Route: polling gagal = 200 + retryable, BUKAN 502 =====

test('D-288: route /api/ai/video/:id balas 200 + retryable saat poll gagal', () => {
  const start = appJs.indexOf("app.get('/api/ai/video/:id'");
  assert.ok(start > 0, 'route harus ada');
  const body = appJs.slice(start, start + 6000);
  // Harus ada retryable.
  assert.ok(body.includes('retryable: true'), 'harus menandai response sebagai retryable');
  assert.ok(body.includes("status: 'running'"), 'status harus running (bukan gagal)');
  // Tidak boleh balas 502 lagi (itu yang menghentikan client).
  assert.ok(!body.includes('res.status(status).json'), 'tidak boleh balas 502 saat poll gagal');
  // Tetap menandai task running di DB.
  assert.ok(body.includes("status: 'running'"), 'task harus tetap running di DB');
});

// ===== 3) Client: retry dengan backoff =====

test('D-288: client pollVideo retry saat request gagal (backoff sampai 15 dtk)', () => {
  const start = studio.indexOf('async function pollVideo()');
  assert.ok(start > 0, 'pollVideo harus ada');
  const body = studio.slice(studio.indexOf('catch (e) {', start), start + 4000);
  // Backoff.
  assert.ok(body.includes('Math.min(3000 * videoTask.pollErrors, 15000)'),
    'backoff harus naik dan dibatasi 15 detik');
  assert.ok(body.includes('MAX_POLL_RETRIES'), 'harus ada batas retry');
  // Tidak boleh langsunggv membatalkan videoTask sebelum retry.
  const cancelAt = body.indexOf('videoTask = null;');
  const retryAt = body.indexOf('MAX_POLL_RETRIES');
  assert.ok(retryAt >= 0 && retryAt < cancelAt,
    'retry harus dicek SEBELUM videoTask dibatalkan');
  // Pesan retryable harus disimpan (user melihat masih jalan).
  assert.ok(body.includes('Sambutan ke generator terputus sementara'),
    'ada pesan retry untuk user');
});

test('D-288: client menangani response retryable (200 + retryable) tanpa stop', () => {
  const start = studio.indexOf('async function pollVideo()');
  const body = studio.slice(start, start + 2600);
  assert.ok(body.includes('d.retryable'), 'harus mengecek flag retryable');
  assert.ok(body.includes('videoTask.pollErrors = 0'), 'poll sukses harus reset penghitung error');
});

// ===== 4) Client: resume polling saat halaman dibuka =====

test('D-288: resumeRunningVideoTask melanjutkan polling task yang tertinggal', () => {
  assert.ok(studio.includes('async function resumeRunningVideoTask()'),
    'harus ada fungsi resume');
  const start = studio.indexOf('async function resumeRunningVideoTask()');
  const body = studio.slice(start, start + 1400);
  // Cari task yang masih jalan.
  assert.ok(body.includes("t.status === 'running' || t.status === 'queued'"),
    'harus mencari task running/queued');
  assert.ok(body.includes('t.task_id'), 'hanya task yang punya task_id Kie');
  // Lanjut poll.
  assert.ok(body.includes('pollVideo()'), 'harus lanjut polling');
  // Dipanggil saat halaman dirender.
  assert.ok(studio.includes('resumeRunningVideoTask();'), 'harus dipanggil saat renderStudio');
});

test('D-288: MAX_POLL_RETRIES cukup lama untuk Kie (>= 10)', () => {
  assert.ok(studio.includes('const MAX_POLL_RETRIES = 12'), 'retry maksimal 12x');
});

// ===== 5) Regresi: format payload Kie tetap benar =====

test('D-288: payload OmniHuman 2.0 tetap sesuai format resmi Kie', async () => {
  const { buildLipsyncInput } = await import('../server/lipsync-models.js');
  const out = buildLipsyncInput(
    'omnihuman20',
    { prompt: 'Novi berbicara natural. di studio podcast.', resolution: '720p', aspect: '9:16' },
    'https://x.com/a.jpg',
    'https://x.com/a.wav');
  // Docs Kie: image_urls (array 1) + audio_url + prompt. TANPA resolution.
  assert.ok(Array.isArray(out.image_urls), 'image_urls harus array');
  assert.equal(out.image_urls.length, 1, 'tepat satu gambar');
  assert.ok(out.audio_url, 'audio_url harus ada');
  assert.ok(!('image_url' in out), 'image_url tidak boleh ikut');
  assert.ok(!('resolution' in out), 'resolution tidak boleh ikut (tidak didukung 2.0)');
  assert.ok(!('aspect_ratio' in out), 'aspect_ratio tidak boleh ikut');
});

test('D-288: payload InfiniteTalk tetap sesuai format resmi Kie', async () => {
  const { buildLipsyncInput } = await import('../server/lipsync-models.js');
  const out = buildLipsyncInput(
    'infinitalk',
    { prompt: 'Novi berbicara natural.', resolution: '480p', aspect: '16:9' },
    'https://x.com/a.jpg',
    'https://x.com/a.wav');
  assert.equal(out.image_url, 'https://x.com/a.jpg');
  assert.equal(out.audio_url, 'https://x.com/a.wav');
  assert.equal(out.resolution, '480p');
  assert.ok(!('image_urls' in out), 'image_urls tidak boleh ada di InfiniteTalk');
});
