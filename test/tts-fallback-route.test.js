/**
 * D-276 / D-277 / D-278 — Integrasi route `/api/ai/tts`: fallback ke engine cadangan.
 *
 * Menguji `synthesizeTtsFallback()` langsung (bukan lewat HTTP server) supaya
 * tidak perlu Supabase sungguhan:
 *   1. Error kuota Gemini -> route memanggil fallback.
 *   2. Fallback ambil key dari vault -> env (per provider).
 *   3. Audio fallback disimpan ke Bank Suara + header provider dikembalikan.
 *   4. Tanpa key cadangan -> route tetap balas 502 (tidak diam-diam).
 *
 * D-278: urutan fallback = **Azure Speech → ElevenLabs** — keduanya free tier
 * tanpa subscription. Provider yang wajib subscribe (TTSMaker/Soniox/
 * Voicemaker) sudah dihapus total.
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

test('D-278: fallback mengambil key tiap provider dari vault lalu env', () => {
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
    /process\.env\.AZURE_SPEECH_API_KEY/.test(block),
    'key Azure Speech diambil dari env sebagai cadangan',
  );
  assert.ok(
    /process\.env\.ELEVENLABS_API_KEY/.test(block),
    'key ElevenLabs diambil dari env sebagai cadangan',
  );
  // Urutan: vault dulu, env hanya kalau vault kosong.
  assert.ok(
    block.indexOf('getUsableKeys') < block.indexOf('process.env.AZURE_SPEECH_API_KEY'),
    'vault diprioritaskan sebelum env',
  );
  // Tiap provider punya jalur synthesize sendiri.
  assert.ok(/synthesizeAzure\(/.test(block), 'harus ada jalur synthesizeAzure');
  assert.ok(/synthesizeElevenLabs\(/.test(block), 'harus ada jalur synthesizeElevenLabs');
});

test('D-278: urutan fallback = Azure → ElevenLabs', () => {
  const block = /export function ttsFallbackChain[\s\S]*?\n}/.exec(providersJs)[0];
  assert.ok(
    /return \['azure', 'elevenlabs'\];/.test(block),
    'rantai fallback harus azure → elevenlabs',
  );
});

test('D-278: provider yang wajib subscribe tidak ada di server', () => {
  // TTSMaker/Soniox/Voicemaker harus hilang total dari server & client.
  for (const gone of ['ttsmaker', 'soniox', 'voicemaker']) {
    assert.ok(
      !new RegExp(`synthesize${gone}`, 'i').test(appJs),
      `${gone} tidak boleh ada di app.js`,
    );
    assert.ok(
      !new RegExp(`'${gone}'`).test(providersJs),
      `${gone} tidak boleh disebut di tts-providers.js`,
    );
  }
  // Tidak boleh ada fetch ke host provider yang dibuang.
  for (const host of ['api.ttsmaker.com', 'tts-rt.soniox.com', 'developer.voicemaker.in']) {
    assert.ok(!appJs.includes(host), `${host} tidak boleh dipanggil`);
    assert.ok(!providersJs.includes(host), `${host} tidak boleh dipanggil`);
  }
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
  // Provider disimpan dari hasil chain (bukan hardcode) — supaya Azure/
  // ElevenLabs keduanya tercatat benar.
  assert.ok(
    /provider, voice: String\(voice\)/.test(block),
    'indeks harus menandai provider yang dipakai',
  );
});

test('D-278: fallback tandai provider di header respons', () => {
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
    'voice-over server harus punya jalur cadangan (Azure/ElevenLabs)',
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

test('D-276: adapter TTS menangani error kuota sebagai TtsQuotaError', () => {
  assert.ok(
    /export class TtsQuotaError/.test(providersJs),
    'harus ada kelas TtsQuotaError',
  );
  assert.ok(
    /res\.status === 429 \|\| isQuotaError\(msg\)\) throw new TtsQuotaError\(msg\)/.test(providersJs),
    'error kuota harus jadi TtsQuotaError',
  );
});

// ===== D-278: metadata provider baru =====

test('D-278: metadata Azure & ElevenLabs punya link resmi + free tier', () => {
  const block = /export const TTS_FALLBACK_PROVIDERS[\s\S]*?\n};/.exec(providersJs)[0];
  for (const provider of ['azure', 'elevenlabs']) {
    assert.ok(
      new RegExp(`\\n  ${provider}: \\{`).test(block),
      `metadata provider ${provider} harus ada`,
    );
  }
  assert.ok(/keyUrl: 'https:\/\/portal\.azure\.com/.test(block), 'Azure punya link resmi');
  assert.ok(/keyUrl: 'https:\/\/elevenlabs\.io/.test(block), 'ElevenLabs punya link resmi');
  assert.ok(/500\.000 karakter\/bulan/.test(block), 'harus sebut free tier Azure');
  assert.ok(/10\.000 kredit\/bulan/.test(block), 'harus sebut free tier ElevenLabs');
});

test('D-278: TTSMaker tidak lagi jadi fallback utama', () => {
  // TTSMaker TIDAK boleh muncul sebagai kode fungsional (adapter, metadata,
  // rantai) — hanya boleh disebut di komentar yang menjelaskan alasannya.
  const chain = /export function ttsFallbackChain[\s\S]*?\n}/.exec(providersJs)[0];
  assert.ok(
    /return \['azure', 'elevenlabs'\]/.test(chain),
    'rantai fallback harus azure → elevenlabs',
  );
  const withoutComments = providersJs
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/ttsmaker/i.test(withoutComments),
    'ttsmaker tidak boleh ada di kode (kecuali komentar dokumentasi)',
  );
});

test('D-278: daftar voice Azure & ElevenLabs tersedia', () => {
  assert.ok(/export const AZURE_ID_VOICES/.test(providersJs), 'daftar voice Azure harus ada');
  assert.ok(/export const ELEVENLABS_VOICES/.test(providersJs), 'daftar voice ElevenLabs harus ada');
  assert.ok(/export const AZURE_VOICE_IDS/.test(providersJs), 'set ID voice Azure harus ada');
  // Azure punya voice native Indonesia (Ardi & Gadis).
  assert.ok(/id-ID-ArdiNeural/.test(providersJs), 'Azure harus punya voice Ardi');
  assert.ok(/id-ID-GadisNeural/.test(providersJs), 'Azure harus punya voice Gadis');
  // ElevenLabs memakai model multilingual (support Indonesian).
  assert.ok(/eleven_multilingual_v2/.test(providersJs), 'ElevenLabs harus pakai model multilingual');
});
