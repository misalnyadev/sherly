// D-280 · Probe end-to-end fallback TTS (provider free tier).
//
// Memalsukan API TTSForFree (TTS Forge) & ElevenLabs (fetch di-intercept) lalu
// memanggil adapter untuk memastikan: synthesize -> audio langsung, daftar
// voice, deteksi kuota, dan urutan fallback.
//
// Pemakaian: node tools/probe-tts-fallback.mjs
import {
  synthesizeElevenLabs,
  isQuotaError, ttsProviderOrder, ttsFallbackChain, sanitizeTtsText,
} from '../server/tts-providers.js';
import {
  synthesizeTtsforfree, listTtsforfreeVoices,
  TTSFORFREE_ID_VOICES, TTSFORFREE_MAX_CHARS, TTSFORFREE_MONTHLY_CHARS,
} from '../server/ttsforfree-provider.js';

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
  // TTSForFree — daftar voice.
  if (u.includes('api.ttsforfree.com/api/Common/GetListVoice')) {
    return json({Id: 1, Message: 'Success', Data: [
      {Voice: 'v1:ardi', DisplayName: 'Ardi (Natural) (Indonesia)', Provider: 'Azure'},
      {Voice: 'v1:gadis', DisplayName: 'Gadis (Natural) (Indonesia)', Provider: 'Azure'},
      {Voice: 'v1:id-id-wavenet-b', DisplayName: 'id-ID-Wavenet-B', Provider: 'Google'},
    ]});
  }
  // TTSForFree — buat job.
  if (u.includes('api.ttsforfree.com/api/TTS/CreateBy')) {
    return json({Id: 123, Status: 'PENDING'});
  }
  // TTSForFree — status job.
  if (u.includes('api.ttsforfree.com/api/TTS/Status/')) {
    return json({Id: 123, Status: 'SUCCESS', Data: 'https://cdn.ttsforfree.com/out/123.mp3'});
  }
  // Unduh audio TTSForFree.
  if (u === 'https://cdn.ttsforfree.com/out/123.mp3') {
    return new Response(AUDIO_BYTES, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  }
  // ElevenLabs — sintesis.
  if (u.includes('api.elevenlabs.io/v1/text-to-speech')) {
    return new Response(AUDIO_BYTES, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
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
  JSON.stringify(ttsProviderOrder(['ttsforfree'])) === JSON.stringify(['gemini', 'ttsforfree']),
  'urutan fallback = gemini lalu ttsforfree',
);
ok(
  JSON.stringify(ttsFallbackChain()) === JSON.stringify(['ttsforfree', 'elevenlabs']),
  'rantai cadangan = ttsforfree → elevenlabs',
);
ok(ttsProviderOrder(['bogus']).length === 1, 'provider tak dikenal diabaikan');
for (const gone of ['ttsmaker', 'soniox', 'voicemaker', 'azure']) {
  ok(ttsProviderOrder([gone]).length === 1, `provider "${gone}" ditolak`);
}

// 2) Deteksi kuota.
ok(isQuotaError('429 Too Many Requests'), 'deteksi 429');
ok(isQuotaError('RESOURCE_EXHAUSTED: quota exceeded'), 'deteksi RESOURCE_EXHAUSTED');
ok(isQuotaError('insufficient credits'), 'deteksi insufficient credits');
ok(!isQuotaError('Internal server error'), 'error lain bukan kuota');

// 3) Sanitasi teks.
ok(sanitizeTtsText('  halo   dunia  ') === 'halo dunia', 'teks dirapikan');
ok(sanitizeTtsText('x'.repeat(50), 10).length === 10, 'teks dipotong sesuai batas');

// 4) Kuota & batas (dokumentasi resmi).
ok(TTSFORFREE_MONTHLY_CHARS === 30000, 'kuota bulanan = 30.000 karakter');
ok(TTSFORFREE_MAX_CHARS === 20000, 'batas per request = 20.000 karakter');
ok(TTSFORFREE_ID_VOICES.length >= 5, `daftar voice Indonesia lokal (${TTSFORFREE_ID_VOICES.length})`);

// 5) Daftar voice TTSForFree.
const voices = await listTtsforfreeVoices('probe-key');
ok(voices.length === 3, `daftar voice terbaca (${voices.length} voice)`);
ok(
  voices.some((v) => v.id === 'v1:ardi'),
  'ada voice Indonesia Ardi',
);
ok(
  voices.some((v) => v.id === 'v1:gadis'),
  'ada voice Indonesia Gadis',
);

// 6) Sintesis TTSForFree — async create → poll → unduh.
const tffOut = await synthesizeTtsforfree({
  apiKey: 'probe-key',
  text: 'Halo, ini uji suara bahasa Indonesia.',
  voice: 'v1:ardi',
});
ok(tffOut && tffOut.audio && tffOut.audio.length > 0, `audio TTSForFree terambil (${tffOut?.audio?.length} byte)`);
ok(tffOut.mimeType === 'audio/mpeg', `mime type TTSForFree = ${tffOut.mimeType}`);
ok(tffOut.voice === 'v1:ardi', `voice TTSForFree = ${tffOut.voice}`);
ok(tffOut.chars > 0, `jumlah karakter tercatat (${tffOut.chars})`);
ok(tffOut.jobId === 123, `job id tercatat (${tffOut.jobId})`);
ok(
  calls.some((c) => c.includes('/api/TTS/CreateBy')) && calls.some((c) => c.includes('/api/TTS/Status/')),
  'urutan panggilan = create job lalu poll status',
);

// 7) Sintesis ElevenLabs.
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
console.log('SEMUA LOLOS — D-280 fallback TTS (TTSForFree + ElevenLabs) OK');
