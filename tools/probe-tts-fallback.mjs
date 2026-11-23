// D-278 · Probe end-to-end fallback TTS (provider free tier).
//
// Memalsukan API Azure Speech & ElevenLabs (fetch di-intercept) lalu memanggil
// adapter untuk memastikan: synthesize -> audio langsung (bukan URL sementara),
// daftar voice, deteksi kuota, dan urutan fallback.
//
// Pemakaian: node tools/probe-tts-fallback.mjs
import {
  synthesizeAzure, listAzureVoices,
  synthesizeElevenLabs,
  isQuotaError, ttsProviderOrder, ttsFallbackChain, sanitizeTtsText,
} from '../server/tts-providers.js';

const AUDIO_BYTES = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00, 0x01, 0x02, 0x03]);
const calls = [];

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push(u);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
  // Azure Speech — voice list.
  if (u.includes('cognitiveservices/voices/list')) {
    return json([
      {ShortName: 'id-ID-ArdiNeural', Locale: 'id-ID', Gender: 'Male'},
      {ShortName: 'id-ID-GadisNeural', Locale: 'id-ID', Gender: 'Female'},
      {ShortName: 'en-US-JennyNeural', Locale: 'en-US', Gender: 'Female'},
    ]);
  }
  // Azure Speech — sintesis (audio langsung di body).
  if (u.includes('cognitiveservices/v1')) {
    return new Response(AUDIO_BYTES, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  }
  // ElevenLabs — sintesis.
  if (u.includes('api.elevenlabs.io/v1/text-to-speech')) {
    return new Response(AUDIO_BYTES, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  }
  // ElevenLabs — daftar voice.
  if (u.includes('api.elevenlabs.io/v1/voices')) {
    return json({voices: [
      {voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel'},
      {voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam'},
    ]});
  }
  return realFetch(url, opts);
};

const failures = [];
const ok = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  GAGAL') + ' | ' + msg);
  if (!cond) failures.push(msg);
};

// 1) Urutan provider.
ok(
  JSON.stringify(ttsProviderOrder(['azure'])) === JSON.stringify(['gemini', 'azure']),
  'urutan fallback = gemini lalu azure',
);
ok(
  JSON.stringify(ttsFallbackChain()) === JSON.stringify(['azure', 'elevenlabs']),
  'rantai cadangan = azure → elevenlabs',
);
ok(ttsProviderOrder(['bogus']).length === 1, 'provider tak dikenal diabaikan');
ok(
  ttsProviderOrder(['ttsmaker']).length === 1,
  'provider yang wajib subscribe ditolak',
);

// 2) Deteksi kuota.
ok(isQuotaError('429 Too Many Requests'), 'deteksi 429');
ok(isQuotaError('RESOURCE_EXHAUSTED: quota exceeded'), 'deteksi RESOURCE_EXHAUSTED');
ok(isQuotaError('insufficient credits'), 'deteksi insufficient credits');
ok(!isQuotaError('Internal server error'), 'error lain bukan kuota');

// 3) Sanitasi teks.
ok(sanitizeTtsText('  halo   dunia  ') === 'halo dunia', 'teks dirapikan');
ok(sanitizeTtsText('x'.repeat(50), 10).length === 10, 'teks dipotong sesuai batas');

// 4) Daftar voice Azure (harus hanya id-ID).
const azureVoices = await listAzureVoices('probe-key', 'southeastasia');
ok(Array.isArray(azureVoices), 'daftar voice Azure terbaca');
ok(azureVoices.length === 2, `hanya voice id-ID (${azureVoices.length} voice)`);
ok(
  azureVoices.some((v) => v.ShortName === 'id-ID-ArdiNeural'),
  'ada voice Ardi (id-ID)',
);

// 5) Sintesis Azure — audio langsung, tanpa URL sementara.
const azureOut = await synthesizeAzure({
  apiKey: 'probe-key',
  text: 'Halo, ini uji suara bahasa Indonesia.',
  voice: 'id-ID-ArdiNeural',
  region: 'southeastasia',
});
ok(azureOut && azureOut.audio && azureOut.audio.length > 0, `audio Azure terambil (${azureOut?.audio?.length} byte)`);
ok(azureOut.mimeType === 'audio/mpeg', `mime type Azure = ${azureOut.mimeType}`);
ok(azureOut.voice === 'id-ID-ArdiNeural', `voice Azure = ${azureOut.voice}`);
ok(azureOut.chars > 0, `jumlah karakter tercatat (${azureOut.chars})`);
ok(
  calls.some((c) => c.includes('cognitiveservices/v1')) && !calls.some((c) => c.includes('/tmp/audio/')),
  'tidak ada URL sementara — audio langsung di body',
);

// 6) Sintesis ElevenLabs.
const elOut = await synthesizeElevenLabs({
  apiKey: 'probe-key',
  text: 'Halo, ini uji suara bahasa Indonesia.',
});
ok(elOut && elOut.audio && elOut.audio.length > 0, `audio ElevenLabs terambil (${elOut?.audio?.length} byte)`);
ok(elOut.mimeType === 'audio/mpeg', `mime type ElevenLabs = ${elOut.mimeType}`);
ok(elOut.model === 'eleven_multilingual_v2', `model = ${elOut.model} (multilingual → support Indonesia)`);
ok(
  calls.some((c) => c.includes('api.elevenlabs.io/v1/text-to-speech')),
  'endpoint ElevenLabs dipanggil',
);

globalThis.fetch = realFetch;

console.log('');
if (failures.length) {
  console.log('GAGAL (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('SEMUA LOLOS — D-278 fallback TTS (Azure + ElevenLabs) OK');
