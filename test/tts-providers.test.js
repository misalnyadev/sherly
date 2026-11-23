/**
 * D-280 — Unit test adapter TTS (`server/tts-providers.js` + `server/ttsforfree-provider.js`).
 *
 * `fetch` dimock supaya kontrak API TTSForFree (TTS Forge) & ElevenLabs teruji
 * tanpa memanggil jaringan sungguhan.
 *
 * D-280: Azure Speech DIHAPUS (user tidak bisa mendaftar — butuh kartu kredit
 * verifikasi akun + region). Cadangan sekarang: TTSForFree → ElevenLabs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  synthesizeElevenLabs,
  isQuotaError, sanitizeTtsText, ttsProviderOrder, ttsFallbackChain,
  TTS_FALLBACK_PROVIDERS, TtsQuotaError,
  ELEVENLABS_VOICES, ELEVENLABS_VOICE_IDS, ELEVENLABS_MODEL,
} from '../server/tts-providers.js';
import {
  synthesizeTtsforfree, listTtsforfreeVoices,
  TTSFORFREE_ID_VOICES, TTSFORFREE_VOICE_IDS, TTSFORFREE_DEFAULT_VOICE,
  TTSFORFREE_MAX_CHARS, TTSFORFREE_MONTHLY_CHARS, TTSFORFREE_API_BASE,
} from '../server/ttsforfree-provider.js';

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

// ===== TTSForFree (fallback #1) =====

test('D-280: synthesizeTtsforfree buat job → poll → unduh audio', async () => {
  const calls = [];
  const restore = mockFetch((u, opts) => {
    calls.push({u, opts});
    if (u.endsWith('/api/TTS/CreateBy')) return json({Id: 42, Status: 'PENDING'});
    if (u.includes('/api/TTS/Status/42')) {
      return json({Id: 42, Status: 'SUCCESS', Data: 'https://cdn.ttsforfree.com/out/42.mp3'});
    }
    if (u === 'https://cdn.ttsforfree.com/out/42.mp3') {
      return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
    }
    return null;
  });
  try {
    const out = await synthesizeTtsforfree({apiKey: 'k-tff', text: 'Halo dunia', voice: 'v1:ardi'});
    assert.ok(out.audio.length > 0, 'audio harus terunduh');
    assert.equal(out.mimeType, 'audio/mpeg');
    assert.equal(out.voice, 'v1:ardi');
    assert.equal(out.chars, 10);
    assert.equal(out.jobId, 42);
    // Urutan: create → status → unduh.
    assert.ok(calls[0].u.endsWith('/api/TTS/CreateBy'), 'panggilan pertama = CreateBy');
    assert.ok(calls[1].u.includes('/api/TTS/Status/42'), 'panggilan kedua = Status');
    assert.equal(calls[2].u, 'https://cdn.ttsforfree.com/out/42.mp3');
  } finally {
    restore();
  }
});

test('D-280: CreateBy kirim header X-API-Key + body Texts/Voice/Pitch', async () => {
  let body = null;
  let headers = null;
  const restore = mockFetch((u, opts) => {
    if (u.endsWith('/api/TTS/CreateBy')) {
      headers = opts.headers;
      body = JSON.parse(opts.body);
      return json({Id: 7, Status: 'PENDING'});
    }
    if (u.includes('/api/TTS/Status/7')) {
      return json({Id: 7, Status: 'SUCCESS', Data: 'https://cdn.ttsforfree.com/x.mp3'});
    }
    return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  });
  try {
    await synthesizeTtsforfree({apiKey: 'secret-key', text: 'Halo', voice: 'v1:gadis', pitch: 5});
    assert.equal(headers['X-API-Key'], 'secret-key');
    assert.equal(body.Texts, 'Halo');
    assert.equal(body.Voice, 'v1:gadis');
    assert.equal(body.Pitch, 5);
  } finally {
    restore();
  }
});

test('D-280: status ERROR → error biasa (bukan quota) dilempar', async () => {
  const restore = mockFetch((u) => {
    if (u.endsWith('/api/TTS/CreateBy')) return json({Id: 9, Status: 'PENDING'});
    if (u.includes('/api/TTS/Status/9')) return json({Id: 9, Status: 'ERROR', Message: 'Voice tidak valid'});
    return null;
  });
  try {
    await assert.rejects(
      () => synthesizeTtsforfree({apiKey: 'k', text: 'Halo'}),
      /Voice tidak valid/,
    );
  } finally {
    restore();
  }
});

test('D-280: 429 saat create → TtsQuotaError', async () => {
  const restore = mockFetch(() => json({Message: 'Too many requests'}, 429));
  try {
    await assert.rejects(
      () => synthesizeTtsforfree({apiKey: 'k', text: 'Halo'}),
      (err) => {
        assert.ok(err instanceof TtsQuotaError, 'harus TtsQuotaError');
        assert.equal(err.quota, true);
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('D-280: 429 saat polling → TtsQuotaError', async () => {
  const restore = mockFetch((u) => {
    if (u.endsWith('/api/TTS/CreateBy')) return json({Id: 11, Status: 'PENDING'});
    return json({Message: 'Too many requests'}, 429);
  });
  try {
    await assert.rejects(
      () => synthesizeTtsforfree({apiKey: 'k', text: 'Halo'}),
      (err) => err instanceof TtsQuotaError,
    );
  } finally {
    restore();
  }
});

test('D-280: 403 saat create → TtsQuotaError (akses/kuota ditolak)', async () => {
  const restore = mockFetch(() => json({Message: 'Forbidden'}, 403));
  try {
    await assert.rejects(
      () => synthesizeTtsforfree({apiKey: 'k', text: 'Halo'}),
      (err) => err instanceof TtsQuotaError,
    );
  } finally {
    restore();
  }
});

test('D-280: teks kosong ditolak tanpa memanggil API', async () => {
  let called = false;
  const restore = mockFetch(() => { called = true; return null; });
  try {
    await assert.rejects(() => synthesizeTtsforfree({apiKey: 'k', text: '   '}), /kosong/i);
    assert.equal(called, false, 'API tidak boleh dipanggil untuk teks kosong');
  } finally {
    restore();
  }
});

test('D-280: API key kosong ditolak tanpa memanggil API', async () => {
  let called = false;
  const restore = mockFetch(() => { called = true; return null; });
  try {
    await assert.rejects(() => synthesizeTtsforfree({apiKey: '', text: 'Halo'}), /API key/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test('D-280: voice tidak dikenal → jatuh ke default', async () => {
  let body = null;
  const restore = mockFetch((u, opts) => {
    if (u.endsWith('/api/TTS/CreateBy')) {
      body = JSON.parse(opts.body);
      return json({Id: 3, Status: 'PENDING'});
    }
    if (u.includes('/api/TTS/Status/3')) {
      return json({Id: 3, Status: 'SUCCESS', Data: 'https://cdn.ttsforfree.com/a.mp3'});
    }
    return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  });
  try {
    await synthesizeTtsforfree({apiKey: 'k', text: 'Halo', voice: 'v1:bogus'});
    assert.equal(body.Voice, TTSFORFREE_DEFAULT_VOICE);
  } finally {
    restore();
  }
});

test('D-280: batas panjang teks 20.000 karakter (dokumentasi resmi)', async () => {
  assert.equal(TTSFORFREE_MAX_CHARS, 20000);
  assert.equal(TTSFORFREE_MONTHLY_CHARS, 30000);
  assert.match(TTSFORFREE_API_BASE, /^https:\/\/api\.ttsforfree\.com$/);
});

test('D-280: listTtsforfreeVoices baca array & Data[]', async () => {
  const restore = mockFetch((u) => {
    assert.ok(u.includes('lang=id'), 'harus pakai lang=id');
    return json({Id: 1, Message: 'Success', Data: [
      {Voice: 'v1:ardi', DisplayName: 'Ardi (Natural) (Indonesia)', Provider: 'Azure'},
      {Voice: 'v1:gadis', DisplayName: 'Gadis (Natural) (Indonesia)', Provider: 'Azure'},
    ]});
  });
  try {
    const list = await listTtsforfreeVoices('k');
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'v1:ardi');
    assert.equal(list[0].provider, 'azure');
  } finally {
    restore();
  }
});

test('D-280: listTtsforfreeVoices 429 → TtsQuotaError', async () => {
  const restore = mockFetch(() => json({Message: 'Too many requests'}, 429));
  try {
    await assert.rejects(() => listTtsforfreeVoices('k'), (e) => e instanceof TtsQuotaError);
  } finally {
    restore();
  }
});

test('D-280: metadata voice Indonesia TTSForFree lengkap', () => {
  assert.ok(TTSFORFREE_ID_VOICES.length >= 5, 'minimal 5 voice Indonesia');
  assert.ok(TTSFORFREE_ID_VOICES.some((v) => v.label.includes('Ardi')));
  assert.ok(TTSFORFREE_ID_VOICES.some((v) => v.label.includes('Gadis')));
  for (const v of TTSFORFREE_ID_VOICES) {
    assert.ok(TTSFORFREE_VOICE_IDS.has(v.id), `${v.id} harus ada di set valid`);
    assert.ok(v.label.includes('Indonesia'), `${v.id} harus ditandai Indonesia`);
  }
});

// ===== ElevenLabs (fallback #2) =====

test('D-280: synthesizeElevenLabs POST ke endpoint text-to-speech & balas mp3', async () => {
  let called = null;
  const restore = mockFetch((u, opts) => {
    called = {u, opts};
    return new Response(AUDIO, {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  });
  try {
    const out = await synthesizeElevenLabs({apiKey: 'k-el', text: 'Halo dunia', voice: '21m00Tcm4TlvDq8ikWAM'});
    assert.ok(out.audio.length > 0);
    assert.equal(out.mimeType, 'audio/mpeg');
    assert.equal(out.voice, '21m00Tcm4TlvDq8ikWAM');
    assert.equal(out.model, ELEVENLABS_MODEL);
    assert.ok(called.u.includes('/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM'));
    assert.equal(called.opts.headers['xi-api-key'], 'k-el');
  } finally {
    restore();
  }
});

test('D-280: ElevenLabs 429 → TtsQuotaError', async () => {
  const restore = mockFetch(() => json({detail: [{msg: 'quota exceeded'}]}, 429));
  try {
    await assert.rejects(
      () => synthesizeElevenLabs({apiKey: 'k', text: 'Halo'}),
      (e) => e instanceof TtsQuotaError,
    );
  } finally {
    restore();
  }
});

test('D-280: ElevenLabs tanpa key ditolak tanpa jaringan', async () => {
  let called = false;
  const restore = mockFetch(() => { called = true; return null; });
  try {
    await assert.rejects(() => synthesizeElevenLabs({apiKey: '', text: 'Halo'}), /API key/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

// ===== Umum =====

test('D-280: sanitizeTtsText merapikan & memotong', () => {
  assert.equal(sanitizeTtsText('  halo   dunia  '), 'halo dunia');
  assert.equal(sanitizeTtsText('x'.repeat(50), 10).length, 10);
});

test('D-280: isQuotaError mengenali pola kuota', () => {
  assert.ok(isQuotaError('429 Too Many Requests'));
  assert.ok(isQuotaError('RESOURCE_EXHAUSTED: quota exceeded'));
  assert.ok(isQuotaError('insufficient credits'));
  assert.ok(isQuotaError('monthly limit reached'));
  assert.ok(!isQuotaError('Internal server error'));
});

test('D-280: ttsProviderOrder menaruh Gemini di depan', () => {
  assert.deepEqual(ttsProviderOrder(['ttsforfree']), ['gemini', 'ttsforfree']);
  assert.equal(ttsProviderOrder(['bogus']).length, 1);
});

test('D-280: ttsProviderOrder menolak provider yang butuh subscribe', () => {
  for (const gone of ['ttsmaker', 'soniox', 'voicemaker', 'azure']) {
    assert.deepEqual(ttsProviderOrder([gone]), ['gemini'], `${gone} harus ditolak`);
  }
});

test('D-280: ttsFallbackChain = ttsforfree → elevenlabs', () => {
  assert.deepEqual(ttsFallbackChain(), ['ttsforfree', 'elevenlabs']);
});

test('D-280: metadata provider cadangan lengkap', () => {
  for (const p of ['ttsforfree', 'elevenlabs']) {
    const info = TTS_FALLBACK_PROVIDERS[p];
    assert.ok(info, `${p} harus punya metadata`);
    assert.ok(info.label);
    assert.match(info.keyUrl, /^https:\/\//);
    assert.match(info.signupUrl, /^https:\/\//);
    assert.match(info.docsUrl, /^https:\/\//);
    assert.ok(info.freeTier, `${p} harus punya info freeTier`);
    assert.match(info.languages, /Indonesia/);
  }
});

test('D-280: TTSForFree & ElevenLabs non-komersial → wajib disebut', () => {
  assert.equal(TTS_FALLBACK_PROVIDERS.ttsforfree.commercial, false);
  assert.ok(TTS_FALLBACK_PROVIDERS.ttsforfree.attribution);
  assert.equal(TTS_FALLBACK_PROVIDERS.elevenlabs.commercial, false);
  assert.ok(TTS_FALLBACK_PROVIDERS.elevenlabs.attribution);
});

test('D-280: hint TTSForFree menyebut free tier & tanpa kartu kredit', () => {
  const hint = TTS_FALLBACK_PROVIDERS.ttsforfree.hint;
  assert.match(hint, /30\.000 karakter/i);
  assert.match(hint, /tanpa kartu kredit/i);
});

test('D-280: provider wajib-subscribe & azure hilang dari metadata', () => {
  for (const gone of ['ttsmaker', 'soniox', 'voicemaker', 'azure']) {
    assert.equal(TTS_FALLBACK_PROVIDERS[gone], undefined, `${gone} harus dihapus`);
  }
});

test('D-280: metadata voice ElevenLabs utuh', () => {
  assert.ok(ELEVENLABS_VOICES.length >= 6);
  for (const v of ELEVENLABS_VOICES) {
    assert.ok(ELEVENLABS_VOICE_IDS.has(v.id));
  }
});
