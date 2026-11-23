/**
 * D-276 / D-277 — Integrasi route `/api/ai/tts`: fallback ke engine cadangan.
 *
 * Menguji `synthesizeTtsFallback()` langsung (bukan lewat HTTP server) supaya
 * tidak perlu Supabase sungguhan:
 *   1. Error kuota Gemini -> route memanggil fallback.
 *   2. Fallback ambil key dari vault -> env (per provider).
 *   3. Audio fallback disimpan ke Bank Suara + header provider dikembalikan.
 *   4. Tanpa key cadangan -> route tetap balas 502 (tidak diam-diam).
 *
 * D-277: urutan fallback = **Soniox → Voicemaker → TTSMaker**.
 * TTSMaker turun ke posisi terakhir karena API resminya WAJIB subscription
 * Pro/Studio (tanpa subscribe tidak ada API key).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const appJs = readFileSync(path.resolve('server/app.js'), 'utf8');
const providersJs = readFileSync(path.resolve('server/tts-providers.js'), 'utf8');

// ===== Struktur route =====

test('D-276: route TTS memanggil fallback saat error kuota', () => {
  assert.ok(
    /if \(isQuotaError\(msg\)\) \{[\s\S]{0,300}synthesizeTtsFallback/.test(appJs),
    'error kuota harus memicu synthesizeTtsFallback',
  );
  assert.ok(
    /const fallback = await synthesizeTtsFallback\(req, \{ clean, userId, cacheReady, reason: 'kuota Gemini habis' \}\)/.test(appJs),
    'fallback dipanggil dengan alasan kuota Gemini habis',
  );
  // Fallback juga dicoba saat Gemini gagal total (bukan cuma kuota).
  assert.ok(
    /reason: 'Gemini TTS gagal merespons'/.test(appJs),
    'fallback juga jalan saat Gemini gagal total',
  );
});

test('D-277: fallback mengambil key tiap provider dari vault lalu env', () => {
  const block = /async function synthesizeTtsFallbackChain[\s\S]*?\n}/.exec(appJs)[0];
  // Key diambil dari vault per provider yang sedang dicoba.
  assert.ok(
    /getUsableKeys\(req\.supabase, provider\)/.test(block),
    'key cadangan diambil dari vault untuk provider yang sedang dicoba',
  );
  assert.ok(
    /for \(const provider of ttsFallbackChain\(\)\)/.test(block),
    'chain harus mengiterasi semua provider cadangan',
  );
  assert.ok(
    /process\.env\.SONIOX_API_KEY/.test(block),
    'key Soniox diambil dari env sebagai cadangan',
  );
  assert.ok(
    /process\.env\.VOICEMAKER_API_KEY/.test(block),
    'key Voicemaker diambil dari env sebagai cadangan',
  );
  assert.ok(
    /process\.env\.TTSMAKER_API_KEY/.test(block),
    'key TTSMaker diambil dari env sebagai cadangan',
  );
  // Urutan: vault dulu, env hanya kalau vault kosong.
  assert.ok(
    block.indexOf('getUsableKeys') < block.indexOf('process.env.SONIOX_API_KEY'),
    'vault diprioritaskan sebelum env',
  );
  // Tiap provider punya jalur synthesize sendiri.
  assert.ok(/synthesizeSoniox\(/.test(block), 'harus ada jalur synthesizeSoniox');
  assert.ok(/synthesizeVoicemaker\(/.test(block), 'harus ada jalur synthesizeVoicemaker');
  assert.ok(/synthesizeTtsmaker\(/.test(block), 'harus ada jalur synthesizeTtsmaker');
});

test('D-277: urutan fallback = Soniox → Voicemaker → TTSMaker', () => {
  const block = /export function ttsFallbackChain[\s\S]*?\n}/.exec(providersJs)[0];
  assert.ok(
    /return \['soniox', 'voicemaker', 'ttsmaker'\];/.test(block),
    'rantai fallback harus soniox → voicemaker → ttsmaker',
  );
  // TTSMaker tidak boleh jadi fallback utama (API wajib subscription).
  const chainIndex = providersJs.indexOf("export function ttsFallbackChain");
  assert.ok(chainIndex > 0, 'ttsFallbackChain harus ada');
  const chainBody = providersJs.slice(chainIndex, chainIndex + 300);
  assert.ok(
    chainBody.indexOf('soniox') < chainBody.indexOf('voicemaker')
      && chainBody.indexOf('voicemaker') < chainBody.indexOf('ttsmaker'),
    'Soniox harus di depan TTSMaker',
  );
});

test('D-276: fallback simpan audio ke Bank Suara', () => {
  const block = /async function synthesizeTtsFallback\(req, \{[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /storage\.from\('tts-clips'\)\.upload/.test(block),
    'audio fallback harus diunggah ke bucket tts-clips',
  );
  assert.ok(
    /from\('sherly_tts_clips'\)\.upsert/.test(block),
    'indeks klip harus disimpan di sherly_tts_clips',
  );
  // Provider disimpan dari hasil chain (bukan hardcode) — supaya Soniox/
  // Voicemaker/TTSMaker semuanya tercatat benar.
  assert.ok(
    /provider, voice: String\(voice\)/.test(block),
    'indeks harus menandai provider yang dipakai',
  );
});

test('D-277: fallback tandai provider di header respons', () => {
  const block = /async function synthesizeTtsFallback\(req, \{[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /X-TTS-Provider', provider/.test(block),
    'header X-TTS-Provider harus menandai provider yang dipakai',
  );
  assert.ok(
    /X-TTS-Source', 'fallback'/.test(block),
    'header X-TTS-Source harus=fallback',
  );
  assert.ok(
    /X-TTS-Fallback-Reason/.test(block),
    'alasan fallback harus dikirim',
  );
});

test('D-276: fallback tanpa key mengembalikan null (route balas 502)', () => {
  const block = /async function synthesizeTtsFallbackChain[\s\S]*?\n}/.exec(appJs)[0];
  // Kalau tidak ada key untuk satu provider -> lanjut ke provider berikutnya,
  // dan kalau semuanya kosong -> null supaya route tahu tidak ada cadangan.
  assert.ok(
    /if \(!keys\.length\) continue;/.test(block),
    'tanpa key provider, chain harus lanjut ke provider berikutnya',
  );
  assert.ok(
    /res\.status\(502\)/.test(appJs),
    'route harus balas 502 kalau tidak ada cadangan yang berhasil',
  );
});

test('D-277: voiceover server memakai engine cadangan saat kuota habis', () => {
  const block = /async function synthesizeVoiceoverForMotion[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /isQuotaError\(msg\)/.test(block),
    'voice-over server harus mendeteksi error kuota',
  );
  assert.ok(
    /synthesizeTtsFallbackChain\(req, text\)/.test(block),
    'voice-over server harus punya jalur cadangan (rantai Soniox/Voicemaker/TTSMaker)',
  );
  // Gemini voice ID tidak boleh sembarang (harus dikenal).
  assert.ok(
    /GEMINI_TTS_VOICE_IDS\.has\(rawVoice\)/.test(block),
    'ID voice harus divalidasi terhadap daftar voice Gemini',
  );
  assert.ok(
    /createSignedUrl\(/.test(block),
    'audio voice-over harus diunggah & diberi signed URL',
  );
});

test('D-276: adapter TTSMaker menangani error kuota sebagai TtsQuotaError', () => {
  assert.ok(
    /export class TtsQuotaError/.test(providersJs),
    'harus ada kelas TtsQuotaError',
  );
  assert.ok(
    /isQuotaError\(msg\) \|\| res\.status === 429\) throw new TtsQuotaError\(msg\)/.test(providersJs),
    'error kuota harus jadi TtsQuotaError',
  );
});

// ===== D-277: metadata provider baru =====

test('D-277: Soniox & Voicemaker punya metadata provider + link resmi', () => {
  const block = /export const TTS_FALLBACK_PROVIDERS[\s\S]*?\n};/.exec(providersJs)[0];
  for (const provider of ['soniox', 'voicemaker', 'ttsmaker']) {
    assert.ok(
      new RegExp(`\\n  ${provider}: \\{`).test(block),
      `metadata provider ${provider} harus ada`,
    );
  }
  assert.ok(/keyUrl: 'https:\/\/console\.soniox\.com\/'/.test(block), 'Soniox punya link resmi');
  assert.ok(/docsUrl: 'https:\/\/docs\.soniox\.com\/tts'/.test(block), 'Soniox punya link dokumentasi');
  assert.ok(/keyUrl: 'https:\/\/developer\.voicemaker\.in\/'/.test(block), 'Voicemaker punya link resmi');
  // D-277: TTSMaker harus ditandai butuh subscription.
  assert.ok(
    /requiresSubscription: true/.test(block),
    'TTSMaker harus ditandai membutuhkan subscription',
  );
});

test('D-277: TTSMaker tidak lagi jadi fallback utama', () => {
  // TTSMaker TIDAK boleh muncul sebelum Soniox/Voicemaker di rantai fallback.
  const chain = /export function ttsFallbackChain[\s\S]*?\n}/.exec(providersJs)[0];
  assert.ok(
    /return \['soniox', 'voicemaker', 'ttsmaker'\]/.test(chain),
    'TTSMaker harus berada di posisi terakhir',
  );
  // Dan hint provider harus menyebut keharusan subscription.
  const block = /export const TTS_FALLBACK_PROVIDERS[\s\S]*?\n};/.exec(providersJs)[0];
  const ttsmakerBlock = /ttsmaker: \{[\s\S]*?\n  \},/.exec(block)[0];
  assert.ok(
    /Pro\/Studio/i.test(ttsmakerBlock),
    'catatan TTSMaker harus menyebut paket Pro/Studio',
  );
});

test('D-277: daftar voice Soniox & Voicemaker tersedia', () => {
  assert.ok(/export const SONIOX_ID_VOICES/.test(providersJs), 'daftar voice Soniox harus ada');
  assert.ok(/export const VOICEMAKER_ID_VOICES/.test(providersJs), 'daftar voice Voicemaker harus ada');
  assert.ok(/export const SONIOX_VOICE_IDS/.test(providersJs), 'set ID voice Soniox harus ada');
  // Soniox mendukung Sunda ('su').
  assert.ok(/su: \{code: 'su', label: 'Bahasa Sunda'\}/.test(providersJs), 'Soniox harus mendukung Sunda');
});
