// D-276 · Probe end-to-end fallback TTS.
//
// Memalsukan API TTSMaker (fetch di-intercept) lalu memanggil adapter untuk
// memastikan: buat order -> ambil status -> unduh audio sementara benar.
//
// Pemakaian: node tools/probe-tts-fallback.mjs
import {
  synthesizeTtsmaker, getTtsmakerTokenStatus, listTtsmakerVoices,
  isQuotaError, ttsProviderOrder, sanitizeTtsText,
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
  if (u.includes('/create-tts-order')) {
    return json({
      error_code: 0,
      audio_download_url: 'https://api.ttsmaker.com/tmp/audio/txn_probe_1.mp3',
      audio_file_format: 'mp3',
      tts_task_characters_count: 35,
    });
  }
  if (u.includes('/get-token-status')) {
    return json({
      error_code: 0,
      data: {quota_characters: 100000, characters_used: 1200, available_quota: 98800},
    });
  }
  if (u.includes('/get-voice-list')) {
    return json({
      error_code: 0,
      voices_detailed_list: [
        {voice_id: 729, voice_name: 'Citra', language: 'id', limit_characters: 1000},
        {voice_id: 700001, voice_name: 'Sarah', language: 'su', limit_characters: 500},
      ],
      account_status: {quota_characters: 100000, characters_used: 1200},
    });
  }
  if (u.includes('/tmp/audio/')) {
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
  JSON.stringify(ttsProviderOrder(['ttsmaker'])) === JSON.stringify(['gemini', 'ttsmaker']),
  'urutan fallback = gemini lalu ttsmaker',
);
ok(ttsProviderOrder(['bogus']).length === 1, 'provider tak dikenal diabaikan');

// 2) Deteksi kuota.
ok(isQuotaError('429 Too Many Requests'), 'deteksi 429');
ok(isQuotaError('RESOURCE_EXHAUSTED: quota exceeded'), 'deteksi RESOURCE_EXHAUSTED');
ok(!isQuotaError('Internal server error'), 'error lain bukan kuota');

// 3) Sanitasi teks.
ok(sanitizeTtsText('  halo   dunia  ') === 'halo dunia', 'teks dirapikan');
ok(sanitizeTtsText('x'.repeat(50), 10).length === 10, 'teks dipotong sesuai batas');

// 4) Status token (sisa kuota).
const status = await getTtsmakerTokenStatus('probe-key');
const st = status?.data || status;
ok(Number(st.available_quota) === 98800, `sisa kuota terbaca (${st.available_quota})`);

// 5) Daftar voice (harus ada Indonesia + Sunda).
const voices = await listTtsmakerVoices('probe-key');
const list = voices?.voices || [];
ok(list.length >= 2, `daftar voice terbaca (${list.length} voice)`);
ok(
  list.some((v) => String(v.language).startsWith('id')),
  'ada voice bahasa Indonesia',
);
ok(
  list.some((v) => String(v.language).startsWith('su')),
  'ada voice Bahasa Sunda',
);

// 6) Sintesis + unduh audio.
const out = await synthesizeTtsmaker({
  apiKey: 'probe-key',
  text: 'Halo, ini uji suara bahasa Indonesia.',
  voiceId: 729,
});
ok(out && out.audio && out.audio.length > 0, `audio terunduh (${out?.audio?.length} byte)`);
ok(out.mimeType === 'audio/mpeg', `mime type = ${out.mimeType}`);
ok(out.voice === 729 || String(out.voice) === '729', `voice = ${out.voice}`);
ok(out.chars > 0, `jumlah karakter tercatat (${out.chars})`);
ok(
  calls.some((c) => c.includes('/create-tts-order')) && calls.some((c) => c.includes('/tmp/audio/')),
  'urutan panggilan = create order lalu unduh audio',
);

globalThis.fetch = realFetch;

console.log('');
if (failures.length) {
  console.log('GAGAL (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('SEMUA LOLOS — D-276 fallback TTS TTSMaker OK');
