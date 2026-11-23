/**
 * D-276 / D-277 / D-278 — Unit test adapter TTS (`server/tts-providers.js`).
 *
 * `fetch` dimock supaya kontrak API Azure Speech & ElevenLabs teruji tanpa
 * memanggil jaringan sungguhan.
 *
 * D-278: fallback TTS **wajib bisa dipakai tanpa subscribe** — provider yang
 * mewajibkan langganan (TTSMaker/Soniox/Voicemaker) sudah dihapus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  synthesizeAzure, listAzureVoices,
  synthesizeElevenLabs,
  isQuotaError, sanitizeTtsText, ttsProviderOrder, ttsFallbackChain,
  TTS_FALLBACK_PROVIDERS, TtsQuotaError,
  AZURE_ID_VOICES, AZURE_VOICE_IDS, AZURE_OUTPUT_FORMATS,
  ELEVENLABS_VOICES, ELEVENLABS_VOICE_IDS, ELEVENLABS_MODEL,
} from '../server/tts-providers.js';

const AUDIO = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x01, 0x02, 0x03, 0x04]);

/** Pasang mock fetch untuk satu test, kembalikan fungsi pembersih. */
function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const r = handler(u, opts);
    if (r) return r;
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}});
  };
  return () => { globalThis.fetch = real; };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {'Content-Type': 'application/json'},
});

// ===== Azure Speech (fallback #1) =====

test('D-278: synthesizeAzure POST SSML ke endpoint region & balas audio langsung', async () => {
  let called = null;
  const restore = mockFetch((u, opts) => {
    called = {u, opts};
    return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  });
  try {
    const out = await synthesizeAzure({apiKey: 'k-azure', text: 'Halo dunia', voice: 'id-ID-ArdiNeural', region: 'southeastasia'});
    assert.ok(out.audio.length === AUDIO.length, 'audio harus utuh');
    assert.equal(out.mimeType, 'audio/mpeg');
    assert.equal(out.voice, 'id-ID-ArdiNeural');
    assert.equal(out.model, 'azure-speech-v1');
    assert.equal(out.chars, 'Halo dunia'.length);
    assert.ok(called.u.includes('southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'), 'endpoint Azure benar');
    assert.equal(called.opts.method, 'POST');
    assert.equal(called.opts.headers['Ocp-Apim-Subscription-Key'], 'k-azure');
    assert.equal(called.opts.headers['Content-Type'], 'application/ssml+xml');
    assert.ok(called.opts.headers['X-Microsoft-OutputFormat'], 'harus ada header output format');
    const body = String(called.opts.body);
    assert.ok(body.includes('id-ID-ArdiNeural'), 'SSML harus menyebut voice');
    assert.ok(body.includes('xml:lang="id-ID"'), 'SSML harus bahasa id-ID');
    assert.ok(body.includes('Halo dunia'), 'SSML harus berisi teks');
  } finally {
    restore();
  }
});

test('D-278: synthesizeAzure meng-escape XML di teks', async () => {
  let body = null;
  const restore = mockFetch((u, opts) => {
    body = String(opts.body);
    return new Response(AUDIO, {status: 200});
  });
  try {
    await synthesizeAzure({apiKey: 'k', text: 'A & B <tag> "kutip"'});
    assert.ok(!body.includes('<tag>'), 'tag harus di-escape');
    assert.ok(body.includes('&amp;'), 'ampersand harus di-escape');
    assert.ok(body.includes('&lt;'), 'kurang dari harus di-escape');
    assert.ok(body.includes('&quot;'), 'kutip harus di-escape');
  } finally {
    restore();
  }
});

test('D-278: synthesizeAzure pakai voice default kalau voice tidak dikenal', async () => {
  let body = null;
  const restore = mockFetch((u, opts) => {
    body = String(opts.body);
    return new Response(AUDIO, {status: 200});
  });
  try {
    const out = await synthesizeAzure({apiKey: 'k', text: 'Halo', voice: 'voice-ngawur'});
    assert.equal(out.voice, 'id-ID-ArdiNeural', 'harus jatuh ke voice default');
    assert.ok(body.includes('id-ID-ArdiNeural'));
  } finally {
    restore();
  }
});

test('D-278: synthesizeAzure error kuota jadi TtsQuotaError', async () => {
  const restore = mockFetch(() => json({message: 'Quota exceeded'}, 429));
  try {
    await assert.rejects(
      () => synthesizeAzure({apiKey: 'k', text: 'Halo'}),
      (e) => e instanceof TtsQuotaError,
    );
  } finally {
    restore();
  }
});

test('D-278: synthesizeAzure error lain jadi Error biasa', async () => {
  const restore = mockFetch(() => json({message: 'Invalid subscription key'}, 401));
  try {
    await assert.rejects(
      () => synthesizeAzure({apiKey: 'k', text: 'Halo'}),
      (e) => !(e instanceof TtsQuotaError) && /Invalid subscription key/.test(e.message),
    );
  } finally {
    restore();
  }
});

test('D-278: listAzureVoices hanya mengembalikan voice id-ID', async () => {
  const restore = mockFetch(() => json([
    {ShortName: 'id-ID-ArdiNeural', Locale: 'id-ID'},
    {ShortName: 'id-ID-GadisNeural', Locale: 'id-ID'},
    {ShortName: 'en-US-JennyNeural', Locale: 'en-US'},
  ]));
  try {
    const out = await listAzureVoices('k-azure', 'southeastasia');
    assert.equal(out.length, 2, 'hanya voice id-ID');
    assert.ok(out.every((v) => v.Locale === 'id-ID'));
  } finally {
    restore();
  }
});

test('D-278: Azure API key kosong ditolak sebelum memanggil jaringan', async () => {
  let called = false;
  const restore = mockFetch(() => { called = true; return new Response(AUDIO, {status: 200}); });
  try {
    await assert.rejects(() => synthesizeAzure({apiKey: '', text: 'Halo'}), /API key Azure Speech/);
    assert.equal(called, false, 'tidak boleh memanggil jaringan tanpa key');
  } finally {
    restore();
  }
});

test('D-278: format output Azure lengkap (mp3/wav/opus)', () => {
  for (const key of ['mp3', 'mp3_16k', 'opus', 'wav']) {
    const fmt = AZURE_OUTPUT_FORMATS[key];
    assert.ok(fmt, `format ${key} harus ada`);
    assert.ok(fmt.header.startsWith('audio-') || fmt.header.startsWith('ogg-') || fmt.header.startsWith('riff-'), `header ${key} valid`);
    assert.ok(fmt.mimeType.startsWith('audio/'), `mime ${key} valid`);
  }
});

// ===== ElevenLabs (fallback #2) =====

test('D-278: synthesizeElevenLabs POST ke /text-to-speech/{voice}', async () => {
  let called = null;
  const restore = mockFetch((u, opts) => {
    called = {u, opts};
    return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  });
  try {
    const out = await synthesizeElevenLabs({apiKey: 'k-el', text: 'Halo dunia', voice: '21m00Tcm4TlvDq8ikWAM'});
    assert.ok(out.audio.length === AUDIO.length, 'audio harus utuh');
    assert.equal(out.mimeType, 'audio/mpeg');
    assert.equal(out.voice, '21m00Tcm4TlvDq8ikWAM');
    assert.equal(out.model, ELEVENLABS_MODEL);
    assert.ok(called.u.includes('/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM'), 'endpoint ElevenLabs benar');
    assert.equal(called.opts.method, 'POST');
    assert.equal(called.opts.headers['xi-api-key'], 'k-el');
    const body = JSON.parse(called.opts.body);
    assert.equal(body.text, 'Halo dunia');
    assert.equal(body.model_id, ELEVENLABS_MODEL, 'harus pakai model multilingual (support Indonesia)');
    assert.ok(body.voice_settings, 'harus ada voice_settings');
  } finally {
    restore();
  }
});

test('D-278: ElevenLabs error kuota jadi TtsQuotaError', async () => {
  const restore = mockFetch(() => json({detail: [{msg: 'quota_exceeded'}]}, 429));
  try {
    await assert.rejects(
      () => synthesizeElevenLabs({apiKey: 'k', text: 'Halo'}),
      (e) => e instanceof TtsQuotaError,
    );
  } finally {
    restore();
  }
});

test('D-278: ElevenLabs error detail string diteruskan sebagai pesan', async () => {
  const restore = mockFetch(() => json({detail: 'Invalid API key'}, 401));
  try {
    await assert.rejects(
      () => synthesizeElevenLabs({apiKey: 'k', text: 'Halo'}),
      (e) => /Invalid API key/.test(e.message),
    );
  } finally {
    restore();
  }
});

test('D-278: ElevenLabs API key kosong ditolak sebelum memanggil jaringan', async () => {
  let called = false;
  const restore = mockFetch(() => { called = true; return new Response(AUDIO, {status: 200}); });
  try {
    await assert.rejects(() => synthesizeElevenLabs({apiKey: '', text: 'Halo'}), /API key ElevenLabs/);
    assert.equal(called, false, 'tidak boleh memanggil jaringan tanpa key');
  } finally {
    restore();
  }
});

// ===== Umum =====

test('D-278: teks kosong ditolak', async () => {
  await assert.rejects(() => synthesizeAzure({apiKey: 'k', text: '   '}), /kosong/);
  await assert.rejects(() => synthesizeElevenLabs({apiKey: 'k', text: ''}), /kosong/);
});

test('D-276: sanitizeTtsText merapikan & memotong', () => {
  assert.equal(sanitizeTtsText('  Halo   dunia \n'), 'Halo dunia');
  assert.equal(sanitizeTtsText('abcdef', 3), 'abc');
});

test('D-276: isQuotaError mengenali pola kuota', () => {
  for (const m of [
    '429 Too Many Requests',
    'RESOURCE_EXHAUSTED: quota exceeded',
    'You exceeded your current quota',
    'Rate limit reached',
    'insufficient_quota',
    'Monthly limit reached',
    'insufficient credits',
  ]) {
    assert.ok(isQuotaError(m), `harus terdeteksi: ${m}`);
  }
  for (const m of ['', 'Internal server error', 'Invalid api key', 'Audio empty']) {
    assert.ok(!isQuotaError(m), `tidak boleh terdeteksi: ${m}`);
  }
});

test('D-278: ttsProviderOrder selalu Gemini dulu, tanpa duplikat', () => {
  assert.deepEqual(ttsProviderOrder([]), ['gemini']);
  assert.deepEqual(ttsProviderOrder(['azure']), ['gemini', 'azure']);
  assert.deepEqual(ttsProviderOrder(['elevenlabs']), ['gemini', 'elevenlabs']);
  assert.deepEqual(ttsProviderOrder(['azure', 'azure']), ['gemini', 'azure']);
  assert.deepEqual(ttsProviderOrder(['unknown']), ['gemini']);
  // Provider yang dihapus D-278 tidak boleh diterima lagi.
  assert.deepEqual(ttsProviderOrder(['ttsmaker']), ['gemini']);
  assert.deepEqual(ttsProviderOrder(['soniox']), ['gemini']);
  assert.deepEqual(ttsProviderOrder(['voicemaker']), ['gemini']);
});

test('D-278: ttsFallbackChain = Azure → ElevenLabs', () => {
  assert.deepEqual(ttsFallbackChain(), ['azure', 'elevenlabs']);
});

// ===== Metadata =====

test('D-278: metadata voice Azure Indonesia lengkap', () => {
  assert.ok(AZURE_ID_VOICES.length >= 2, 'minimal 2 voice Azure Indonesia');
  for (const v of AZURE_ID_VOICES) {
    assert.ok(v.id.startsWith('id-ID-'), `${v.id} harus locale id-ID`);
    assert.ok(v.label, 'voice harus punya nama');
    assert.ok(AZURE_VOICE_IDS.has(v.id), `${v.label} harus ada di set id`);
  }
  assert.ok(AZURE_ID_VOICES.some((v) => v.key === 'ardi'), 'ada voice Ardi');
  assert.ok(AZURE_ID_VOICES.some((v) => v.key === 'gadis'), 'ada voice Gadis');
});

test('D-278: metadata voice ElevenLabs lengkap', () => {
  assert.ok(ELEVENLABS_VOICES.length >= 3, 'minimal 3 voice ElevenLabs');
  for (const v of ELEVENLABS_VOICES) {
    assert.ok(v.id, 'voice harus punya id');
    assert.ok(v.label, 'voice harus punya label');
    assert.ok(ELEVENLABS_VOICE_IDS.has(v.id), `${v.label} harus ada di set id`);
  }
  // Model default harus support Indonesian (multilingual).
  assert.equal(ELEVENLABS_MODEL, 'eleven_multilingual_v2');
});

test('D-278: metadata provider punya link resmi + free tier', () => {
  for (const provider of ['azure', 'elevenlabs']) {
    const info = TTS_FALLBACK_PROVIDERS[provider];
    assert.ok(info, `metadata ${provider} harus ada`);
    assert.ok(info.keyUrl.startsWith('https://'), `${provider} punya link ambil key`);
    assert.ok(info.docsUrl.startsWith('https://'), `${provider} punya link dokumentasi`);
    assert.ok(info.languages.includes('Indonesia'), `${provider} support bahasa Indonesia`);
    assert.ok(info.freeTier, `${provider} harus menyebut free tier-nya`);
  }
});

test('D-278: ElevenLabs ditandai tanpa hak komersial (free plan)', () => {
  const info = TTS_FALLBACK_PROVIDERS.elevenlabs;
  assert.equal(info.commercial, false, 'free plan ElevenLabs tidak ada hak komersial');
  assert.ok(/atribusi/i.test(info.hint + ' ' + (info.attribution || '')), 'harus menyebut kewajiban atribusi');
});

test('D-278: provider yang wajib subscribe sudah dihapus total', () => {
  for (const gone of ['ttsmaker', 'soniox', 'voicemaker']) {
    assert.equal(TTS_FALLBACK_PROVIDERS[gone], undefined, `${gone} harus dihapus`);
  }
  const chain = ttsFallbackChain();
  for (const gone of ['ttsmaker', 'soniox', 'voicemaker']) {
    assert.ok(!chain.includes(gone), `${gone} tidak boleh ada di rantai fallback`);
  }
});
