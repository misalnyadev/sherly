/**
 * D-276 — Integrasi route `/api/ai/tts`: fallback ke engine cadangan.
 *
 * Menguji `synthesizeTtsFallback()` langsung (bukan lewat HTTP server) supaya
 * tidak perluSupabase sungguhan:
 *   1. Error kuota Gemini -> route memanggil fallback.
 *   2. Fallback ambil key dari vault -> env.
 *   3. Audio fallback disimpan ke Bank Suara + header provider dikembalikan.
 *   4. Tanpa key cadangan -> route tetap balas 502 (tidak diam-diam).
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

test('D-276: fallback ambil key dari vault lalu env', () => {
  const block = /async function synthesizeTtsFallback[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /getUsableKeys\(req\.supabase, 'ttsmaker'\)/.test(block),
    'key TTSMaker diambil dari vault',
  );
  assert.ok(
    /process\.env\.TTSMAKER_API_KEY/.test(block),
    'key TTSMaker diambil dari env sebagai cadangan',
  );
  // Urutan: vault dulu, env hanya kalau vault kosong.
  assert.ok(
    block.indexOf('getUsableKeys') < block.indexOf('process.env.TTSMAKER_API_KEY'),
    'vault diprioritaskan sebelum env',
  );
});

test('D-276: fallback simpan audio ke Bank Suara', () => {
  const block = /async function synthesizeTtsFallback[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /storage\.from\('tts-clips'\)\.upload/.test(block),
    'audio fallback harus diunggah ke bucket tts-clips',
  );
  assert.ok(
    /from\('sherly_tts_clips'\)\.upsert/.test(block),
    'indeks klip harus disimpan di sherly_tts_clips',
  );
  assert.ok(
    /provider: 'ttsmaker'/.test(block),
    'indeks harus menandai provider ttsmaker',
  );
});

test('D-276: fallback tandai provider di header respons', () => {
  const block = /async function synthesizeTtsFallback[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /X-TTS-Provider',\s*'ttsmaker'/.test(block),
    'header X-TTS-Provider harus=ttsmaker',
  );
  assert.ok(
    /X-TTS-Source',\s*'fallback'/.test(block),
    'header X-TTS-Source harus=fallback',
  );
  assert.ok(
    /X-TTS-Fallback-Reason/.test(block),
    'alasan fallback harus dikirim',
  );
});

test('D-276: fallback tanpa key mengembalikan null (route balas 502)', () => {
  const block = /async function synthesizeTtsFallback[\s\S]*?\n}/.exec(appJs)[0];
  // Kalau tidak ada key -> return null supaya route tahu tidak ada cadangan.
  const early = block.slice(0, block.indexOf('for (const k of keys)'));
  assert.ok(
    /if \(!keys\.length\) return null;/.test(early),
    'tanpa key cadangan fallback harus return null',
  );
  assert.ok(
    /res\.status\(502\)/.test(appJs),
    'route harus balas 502 kalau tidak ada cadangan yang berhasil',
  );
});

test('D-276: voiceover server memakai engine cadangan saat kuota habis', () => {
  const block = /async function synthesizeVoiceoverForMotion[\s\S]*?\n}/.exec(appJs)[0];
  assert.ok(
    /isQuotaError\(msg\)/.test(block),
    'voice-over server harus mendeteksi error kuota',
  );
  assert.ok(
    /synthesizeTtsmaker\(/.test(block),
    'voice-over server harus punya jalur cadangan TTSMaker',
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
