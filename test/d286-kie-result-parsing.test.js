// D-286 · Sanitasi URL media + parsing hasil Kie.
//
// Gejala yang dilaporkan user (payload Kie yang gagal):
//   image_url = "[https://tempfile.redpandaai.co/.../lipsync-xxx.jpg"  <- "[" nyasar
//   prompt    = "Novi] berbicara natural. ..."                          <- "]" nyasar
//
// Dua akar masalah:
//
// 1) **URL upload Kie bisa mengandung karakter jejas** -> `image_url`/`audio_url`
//    rusak -> Kie menolak / gagal diam-diam. Diperbaiki `sanitizeMediaUrl()`.
//
// 2) **URL HASIL Kie tidak terbaca** -> task menggantung di status "running"
//    selamanya. Kie menjawab (terbukti di data produksi):
//      resultJson = { code, data: { result_urls: [...], origin_urls: [...] } }
//    Kode lama memakai `||` berantai: `result_urls: []` itu TRUTHY di JS ->
//    rantai berhenti di array kosong -> `origin_urls` TIDAK pernah dicek ->
//    `resultUrls` kosong -> video tidak pernah muncul.
//
// Test ini memverifikasi KEDUA hal + normalisasi state Kie
// (waiting | queuing | generating | success | fail).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeMediaUrl } from '../server/ai.js';

const aiSrc = readFileSync('server/ai.js', 'utf8');

// ===== 1) Sanitasi URL =====

test('D-286: sanitizeMediaUrl membuang "[" nyasar di depan URL Kie', () => {
  const bad = '[https://tempfile.redpandaai.co/kieai/12362232/images/base64/lipsync-1795448167718.jpg';
  const out = sanitizeMediaUrl(bad);
  assert.equal(out,
    'https://tempfile.redpandaai.co/kieai/12362232/images/base64/lipsync-1795448167718.jpg',
    'URL harus bersih dari kurung siku');
  assert.ok(!out.includes('['), 'tidak boleh ada "["');
  assert.ok(out.startsWith('https://'), 'harus tetap URL http');
});

test('D-286: sanitizeMediaUrl membuang "]" nyasar & pembungkus markdown', () => {
  assert.equal(sanitizeMediaUrl('https://t.co/x.jpg]'), 'https://t.co/x.jpg');
  assert.equal(sanitizeMediaUrl('[https://t.co/x.mp3]'), 'https://t.co/x.mp3');
  assert.equal(sanitizeMediaUrl('](https://t.co/x.mp3)'), 'https://t.co/x.mp3');
  assert.equal(sanitizeMediaUrl('](https://t.co/x.mp3)'), 'https://t.co/x.mp3');
});

test('D-286: sanitizeMediaUrl membuang spasi & newline di tengah URL', () => {
  assert.equal(sanitizeMediaUrl('  https://t.co/x.jpg  '), 'https://t.co/x.jpg');
  assert.equal(sanitizeMediaUrl('https://t.co/a b.jpg'), 'https://t.co/ab.jpg');
  assert.equal(sanitizeMediaUrl('https://t.co/a\nb.jpg'), 'https://t.co/ab.jpg');
  assert.equal(sanitizeMediaUrl('https://t.co/a\tb.jpg'), 'https://t.co/ab.jpg');
});

test('D-286: sanitizeMediaUrl TIDAK merusak URL sah', () => {
  // Query string dengan "=" harus utuh.
  assert.equal(sanitizeMediaUrl('https://t.co/x.mp3?token=abc=def'),
    'https://t.co/x.mp3?token=abc=def');
  // Path ber-kurung adalah sah.
  assert.equal(sanitizeMediaUrl('https://t.co/a(b).mp3'), 'https://t.co/a(b).mp3');
  // Percent-encoding harus utuh.
  assert.equal(sanitizeMediaUrl('https://t.co/a%20b.jpg'), 'https://t.co/a%20b.jpg');
  // Nilai kosong -> kosong.
  assert.equal(sanitizeMediaUrl(''), '');
  assert.equal(sanitizeMediaUrl(null), '');
  assert.equal(sanitizeMediaUrl(undefined), '');
});

test('D-286: upload Kie memakai URL yang sudah dibersihkan', () => {
  // kieUploadBase64 harus memanggil sanitizeMediaUrl sebelum return.
  const start = aiSrc.indexOf('export async function kieUploadBase64');
  const body = aiSrc.slice(start, start + 2200);
  assert.ok(body.includes('sanitizeMediaUrl(raw)'), 'upload harus sanitize URL');
  assert.ok(body.includes('if (!u) throw new Error'), 'URL kosong harus error jelas');
});

// ===== 2) Parsing URL hasil Kie =====

test('D-286: URL hasil Kie dibaca dari result_urls DAN origin_urls', () => {
  // Helper kieResultUrls() harus memeriksa SEMUA sumber URL.
  const h = aiSrc.indexOf('export function kieResultUrls');
  assert.ok(h > 0, 'helper kieResultUrls harus ada');
  const body = aiSrc.slice(h, h + 2200);
  for (const key of ['resultUrls', 'result_urls', 'origin_urls']) {
    assert.ok(body.includes(key), 'harus membaca ' + key);
  }
  assert.ok(body.includes('const candidates = ['), 'harus kumpulkan kandidat URL');
  assert.ok(body.includes('for (const c of candidates)'), 'harus iterasi kandidat');
  // BUKAN pakai `||` berantai (array kosong = truthy -> rantai berhenti).
  assert.ok(!body.includes('rj?.resultUrls || rj?.data?.result_urls'),
    'jangan pakai || berantai (array kosong = truthy)');
  // Kedua polling (video & gambar) harus memakai helper.
  const v = aiSrc.indexOf('export async function pollKieVideoTask');
  assert.ok(aiSrc.slice(v, v + 4000).includes('kieResultUrls(rj, d)'),
    'polling video harus pakai helper');
  const i = aiSrc.indexOf('export async function pollKieImageTask');
  assert.ok(aiSrc.slice(i, i + 4000).includes('kieResultUrls(rj, d)'),
    'polling gambar harus pakai helper');
});

// ===== 3) Normalisasi state Kie =====

test('D-286: state Kie dinormalisasi (success/fail/varian)', () => {
  const h = aiSrc.indexOf('export function kieNormalizeState');
  assert.ok(h > 0, 'helper kieNormalizeState harus ada');
  const body = aiSrc.slice(h, h + 2000);
  assert.ok(body.includes('SUCCESS_STATES'), 'harus punya daftar state sukses');
  assert.ok(body.includes("'succeed'"), 'varian succeed harus dikenali');
  assert.ok(body.includes("'completed'"), 'varian completed harus dikenali');
  assert.ok(body.includes('FAIL_STATES'), 'harus punya daftar state gagal');
  assert.ok(body.includes("'waiting'") || body.includes("'queuing'")
    || body.includes("'generating'"), 'state in-flight harus dikenal');
  // Kedua polling harus memakai helper normalisasi.
  const v = aiSrc.indexOf('export async function pollKieVideoTask');
  assert.ok(aiSrc.slice(v, v + 4000).includes('kieNormalizeState(state, list, d)'),
    'polling video harus pakai helper');
});

test('D-286: state sukses tapi URL kosong = GAGAL, bukan menggantung', () => {
  const h = aiSrc.indexOf('export function kieNormalizeState');
  const body = aiSrc.slice(h, h + 2000);
  // Kalau sukses tapi tidak ada URL -> perlakukan fail dengan pesan jelas.
  assert.ok(body.includes("if (!list.length)"), 'sukses tanpa URL harus dicek');
  assert.ok(body.includes("state: 'fail'"), 'sukses tanpa URL harus jadi fail');
  assert.ok(body.includes('tidak mengembalikan URL video'),
    'harus ada pesan jelas untuk user');
});

test('D-286: polling video & polling gambar konsisten menangani state', () => {
  // Polling gambar (D-283) juga harus tahan terhadap varian state.
  const start = aiSrc.indexOf('async function kiePollImageTask');
  const body = aiSrc.slice(start, start + 3000);
  assert.ok(body.includes("st === 'success' || st === 'completed'"),
    'polling gambar harus tetap mengenali state sukses');
});

// ===== 4) Test PERILAKU: parsing respons Kie nyata =====

import { kieResultUrls, kieNormalizeState } from '../server/ai.js';

test('D-286: respons Kie dengan result_urls KOSONG + origin_urls berisi -> URL terbaca', () => {
  // Bentuk respons yang TERBUKTI terjadi di data produksi Kie.
  const rj = {
    code: 200,
    data: {
      result_urls: [],
      origin_urls: ['https://tempfile.redpandaai.co/kieai/123/output/video.mp4'],
    },
  };
  const list = kieResultUrls(rj, {});
  assert.equal(list.length, 1, 'URL harus terbaca dari origin_urls');
  assert.match(list[0], /^https:\/\//, 'harus URL valid');
  // Dan state sukses jadi "success" (bukan fail).
  const norm = kieNormalizeState('success', list, {});
  assert.equal(norm.state, 'success', 'state sukses dengan URL = success');
});

test('D-286: respons Kie dengan result_urls berisi -> URL dari situ', () => {
  const rj = { data: { result_urls: ['https://x.com/a.mp4'], origin_urls: ['https://x.com/b.mp4'] } };
  const list = kieResultUrls(rj, {});
  assert.equal(list[0], 'https://x.com/a.mp4', 'result_urls diprioritaskan');
  assert.equal(list.length, 1, 'tidak perlu duplikat dari origin_urls');
});

test('D-286: respons Kie dengan resultUrls top-level (format dokumentasi) -> OK', () => {
  const rj = { resultUrls: ['https://x.com/a.mp4'] };
  assert.deepEqual(kieResultUrls(rj, {}), ['https://x.com/a.mp4']);
});

test('D-286: response.data[].video_url (format OmniHuman) -> OK', () => {
  const rj = { data: { response: { data: [{ video_url: 'https://x.com/oh.mp4' }] } } };
  assert.deepEqual(kieResultUrls(rj, {}), ['https://x.com/oh.mp4']);
});

test('D-286: state "waiting"/"queuing"/"generating" -> running (client lanjut polling)', () => {
  for (const st of ['waiting', 'queuing', 'generating', 'processing', 'pending']) {
    assert.equal(kieNormalizeState(st, [], {}).state, 'running', st + ' harus running');
  }
});

test('D-286: state "success" tanpa URL -> fail dengan pesan jelas (bukan menggantung)', () => {
  const norm = kieNormalizeState('success', [], {});
  assert.equal(norm.state, 'fail', 'harus fail, bukan success tanpa URL');
  assert.match(norm.error, /tidak mengembalikan URL video/, 'ada pesan jelas');
});

test('D-286: state "fail" -> fail + pesan dari Kie', () => {
  const norm = kieNormalizeState('fail', [], { failMsg: 'input image_url invalid' });
  assert.equal(norm.state, 'fail');
  assert.equal(norm.error, 'input image_url invalid');
});

test('D-286: variant state sukses dikenali ("completed", "succeed", "finished")', () => {
  for (const st of ['completed', 'succeed', 'succeeded', 'finished', 'done']) {
    const norm = kieNormalizeState(st, ['https://x.com/a.mp4'], {});
    assert.equal(norm.state, 'success', st + ' harus success');
  }
});

// ===== 5) Pesan error yang bisa ditindaklanjuti =====

import { lipsyncErrorMessage } from '../server/lipsync-errors.js';

test('D-286: error "sukses tapi URL kosong" diterjemahkan jadi pesan jelas', () => {
  const msg = lipsyncErrorMessage(
    'Kie menandai task selesai tapi tidak mengembalikan URL video. Coba ulang dengan naskah lebih pendek atau resolusi 480p.',
    { model: 'InfiniteTalk', maxSeconds: 15 });
  assert.match(msg, /tidak mengembalikan URL video/i, 'pesan harus menjelaskan masalahnya');
  assert.match(msg, /Coba ulang/i, 'harus ada saran tindakan');
  assert.match(msg, /InfiniteTalk/, 'harus menyebut modelnya');
});

test('D-286: error URL input ditolak diterjemahkan', () => {
  const msg = lipsyncErrorMessage('invalid url input', { model: 'InfiniteTalk' });
  assert.match(msg, /URL file input/i, 'pesan harus menyebut URL input');
  assert.match(msg, /Coba pilih gambar lain|upload ulang/i, 'harus ada saran tindakan');
});

test('D-286: pesan error tidak boleh kosong atau teknis mentah', () => {
  const msg = lipsyncErrorMessage('ConnectException: Operation timed out', { model: 'InfiniteTalk' });
  assert.ok(msg.length > 30, 'pesan harus agak panjang');
  assert.match(msg, /Kie gagal menarik file/i, 'harus menerjemahkan error teknis');
});
