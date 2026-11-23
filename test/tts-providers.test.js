/**
 * D-276 — Unit test adapter TTS (`server/tts-providers.js`).
 *
 * `fetch` dimock supaya kontrak API TTSMaker teruji tanpa memanggil
 * jaringan sungguhan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  synthesizeTtsmaker, getTtsmakerTokenStatus, listTtsmakerVoices,
  isQuotaError, sanitizeTtsText, ttsProviderOrder,
  TTSMAKER_ID_VOICES, TTSMAKER_VOICE_IDS, TTSMAKER_EMOTIONS,
  TTSMAKER_MAX_CHARS, TTS_FALLBACK_PROVIDERS, TtsQuotaError,
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

test('D-276: synthesizeTtsmaker membuat order lalu mengunduh audio', async () => {
  const seen = [];
  const restore = mockFetch((u) => {
    seen.push(u);
    if (u.includes('/create-tts-order')) {
      return json({
        error_code: 0,
        audio_download_url: 'https://api.ttsmaker.com/tmp/a.mp3',
        audio_file_format: 'mp3',
        tts_task_characters_count: 33,
      });
    }
    if (u.includes('/tmp/a.mp3')) {
      return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
    }
    return null;
  });
  try {
    const out = await synthesizeTtsmaker({apiKey: 'k-test', text: 'Halo dunia', voiceId: 729});
    assert.ok(out.audio.length === AUDIO.length, 'audio harus terunduh utuh');
    assert.equal(out.mimeType, 'audio/mpeg');
    assert.equal(out.voice, 729);
    assert.equal(out.chars, 33);
    assert.equal(out.model, 'ttsmaker-v2');
    assert.ok(seen.some((u) => u.includes('/create-tts-order')), 'harus memanggil create-tts-order');
    assert.ok(seen.some((u) => u.includes('/tmp/a.mp3')), 'harus mengunduh audio dari URL sementara');
  } finally {
    restore();
  }
});

test('D-276: format WAV menghasilkan mime audio/wav', async () => {
  const restore = mockFetch((u) => {
    if (u.includes('/create-tts-order')) {
      return json({
        error_code: 0,
        audio_download_url: 'https://api.ttsmaker.com/tmp/a.wav',
        audio_file_format: 'wav',
      });
    }
    if (u.includes('/tmp/a.wav')) return new Response(AUDIO, {status: 200});
    return null;
  });
  try {
    const out = await synthesizeTtsmaker({apiKey: 'k', text: 'Halo', format: 'wav'});
    assert.equal(out.mimeType, 'audio/wav');
  } finally {
    restore();
  }
});

test('D-276: error kuota TTSMaker jadi TtsQuotaError', async () => {
  const restore = mockFetch(() => json({error_code: 1, error_summary: 'Insufficient quota'}, 429));
  try {
    await assert.rejects(
      () => synthesizeTtsmaker({apiKey: 'k', text: 'Halo'}),
      (err) => {
        assert.ok(err instanceof TtsQuotaError, 'harus TtsQuotaError');
        assert.ok(/quota/i.test(err.message));
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('D-276: error lain jadi Error biasa (bukan TtsQuotaError)', async () => {
  const restore = mockFetch(() => json({error_code: 1, error_summary: 'Invalid api key'}, 401));
  try {
    await assert.rejects(
      () => synthesizeTtsmaker({apiKey: 'k', text: 'Halo'}),
      (err) => !(err instanceof TtsQuotaError) && /Invalid api key/.test(err.message),
    );
  } finally {
    restore();
  }
});

test('D-276: respons tanpa URL audio ditolak jelas', async () => {
  const restore = mockFetch(() => json({error_code: 0}));
  try {
    await assert.rejects(
      () => synthesizeTtsmaker({apiKey: 'k', text: 'Halo'}),
      /tidak mengembalikan URL audio/,
    );
  } finally {
    restore();
  }
});

test('D-276: getTtsmakerTokenStatus membaca sisa kuota', async () => {
  const restore = mockFetch(() => json({
    error_code: 0,
    data: {quota_characters: 100000, characters_used: 1200, available_quota: 98800},
  }));
  try {
    const out = await getTtsmakerTokenStatus('k');
    const st = out?.data || out;
    assert.equal(Number(st.available_quota), 98800);
  } finally {
    restore();
  }
});

test('D-276: listTtsmakerVoices mengambil daftar voice Indonesia', async () => {
  let asked = '';
  const restore = mockFetch((u) => {
    asked = u;
    return json({
      error_code: 0,
      voices_detailed_list: [
        {voice_id: 729, voice_name: 'Citra', language: 'id', limit_characters: 1000},
        {voice_id: 700001, voice_name: 'Sarah', language: 'su', limit_characters: 500},
      ],
    });
  });
  try {
    const out = await listTtsmakerVoices('k');
    assert.equal(out.voices.length, 2);
    assert.ok(asked.includes('language=id'), 'harus meminta filter bahasa Indonesia');
  } finally {
    restore();
  }
});

test('D-276: API key kosong ditolak sebelum memanggil jaringan', async () => {
  const restore = mockFetch(() => json({error_code: 0}));
  try {
    await assert.rejects(() => synthesizeTtsmaker({apiKey: '', text: 'Halo'}), /API key TTSMaker belum diisi/);
    await assert.rejects(() => getTtsmakerTokenStatus(''), /API key TTSMaker belum diisi/);
    await assert.rejects(() => listTtsmakerVoices(''), /API key TTSMaker belum diisi/);
  } finally {
    restore();
  }
});

test('D-276: teks kosong ditolak', async () => {
  const restore = mockFetch(() => json({error_code: 0}));
  try {
    await assert.rejects(() => synthesizeTtsmaker({apiKey: 'k', text: '   '}), /Teks untuk suara kosong/);
  } finally {
    restore();
  }
});

// ===== Utilitas =====

test('D-276: sanitizeTtsText merapikan & memotong', () => {
  assert.equal(sanitizeTtsText('  halo   dunia  '), 'halo dunia');
  assert.equal(sanitizeTtsText('a'.repeat(100), 10).length, 10);
  assert.equal(sanitizeTtsText(''), '');
  assert.equal(sanitizeTtsText(null), '');
  // Bawaan = TTSMAKER_MAX_CHARS.
  assert.equal(sanitizeTtsText('x'.repeat(TTSMAKER_MAX_CHARS + 50)).length, TTSMAKER_MAX_CHARS);
});

test('D-276: isQuotaError mengenali pola kuota', () => {
  for (const m of [
    '429 Too Many Requests',
    'RESOURCE_EXHAUSTED: quota exceeded',
    'You exceeded your current quota',
    'Rate limit reached for TTSMaker',
    'Insufficient quota characters',
    'HTTP 429',
  ]) {
    assert.ok(isQuotaError(m), `harus terdeteksi: ${m}`);
  }
  for (const m of ['', 'Internal server error', 'Invalid api key', 'Audio empty']) {
    assert.ok(!isQuotaError(m), `tidak boleh terdeteksi: ${m}`);
  }
});

test('D-276: ttsProviderOrder selalu Gemini dulu, tanpa duplikat', () => {
  assert.deepEqual(ttsProviderOrder([]), ['gemini']);
  assert.deepEqual(ttsProviderOrder(['ttsmaker']), ['gemini', 'ttsmaker']);
  assert.deepEqual(ttsProviderOrder(['ttsmaker', 'ttsmaker']), ['gemini', 'ttsmaker']);
  assert.deepEqual(ttsProviderOrder(['unknown']), ['gemini']);
});

// ===== Metadata =====

test('D-276: metadata voice Indonesia + Sunda lengkap', () => {
  assert.ok(TTSMAKER_ID_VOICES.length >= 8, 'minimal 8 voice');
  for (const v of TTSMAKER_ID_VOICES) {
    assert.ok(Number.isFinite(v.id), 'id voice harus angka');
    assert.ok(v.label, 'voice harus punya nama');
    assert.ok(v.key, 'voice harus punya key unik');
    assert.ok(v.limit > 0, `${v.label} harus punya batas karakter`);
    assert.ok(TTSMAKER_VOICE_IDS.has(v.id), `${v.label} harus ada di set id`);
  }
  assert.ok(TTSMAKER_ID_VOICES.some((v) => v.key.includes('sunda')), 'ada voice Sunda');
  assert.ok(TTSMAKER_ID_VOICES.some((v) => v.emotion), 'ada voice multi-emosi');
});

test('D-276: daftar emosi TTSMaker tidak kosong', () => {
  assert.ok(Array.isArray(TTSMAKER_EMOTIONS) && TTSMAKER_EMOTIONS.length > 0);
  for (const e of TTSMAKER_EMOTIONS) {
    // Key boleh kosong (emosi "Normal"), tapi label wajib ada & unik.
    assert.ok(typeof e.key === 'string', 'emosi harus punya key (boleh kosong)');
    assert.ok(e.label, 'emosi harus punya label');
  }
  // Ada emosi negatif & positif (bukan cuma netral).
  assert.ok(
    TTSMAKER_EMOTIONS.some((e) => ['cheerful', 'excited', 'friendly'].includes(e.key)),
    'ada emosi positif',
  );
  assert.ok(
    TTSMAKER_EMOTIONS.some((e) => ['sad', 'angry', 'terrified'].includes(e.key)),
    'ada emosi negatif',
  );
});

test('D-276: metadata provider punya link resmi + bahasa', () => {
  const info = TTS_FALLBACK_PROVIDERS.ttsmaker;
  assert.ok(info.keyUrl.startsWith('https://'), 'link ambil key');
  assert.ok(info.docsUrl.startsWith('https://'), 'link dokumentasi');
  assert.ok(info.languages.includes('Indonesia'), 'support bahasa Indonesia');
});
