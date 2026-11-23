/**
 * D-276 — Provider TTS cadangan yang support bahasa Indonesia.
 *
 * Konteks: kalau kredit/kuota Gemini habis, TTS jangan langsung gagal —
 * ada engine lain yang **benar-benar bisa berbahasa Indonesia**.
 *
 * Kenapa TTSMaker jadi fallback utama:
 *  - Voice NATIVE Indonesia (bukan aksen Inggris): ardi, citra, ayu, stefan,
 *    indah, gadis, dewi — plus voice **Sundanese** (sarah, william).
 *  - `audio_speed` (0,5–2,0) -> ngatur tempo narasi.
 *  - `text_paragraph_pause_time` (0–10.000 ms) -> jeda antar baris = jeda
 *    antar beat. Persis yang dibutuhkan sistem beat.
 *  - `emotion_style_key` + `emotion_intensity` -> intonasi per beat.
 *  - 100% hak komersial (halaman resmi TTSMaker).
 *
 * API resmi: https://api.ttsmaker.com/v2
 *  - GET  /v2/get-voice-list?api_key=...&language=id
 *  - POST /v2/create-tts-order
 *  - GET  /v2/get-token-status?api_key=...
 * Catatan: wajib subscription Pro/Studio (Lite/FREE tidak bisa API), QPS 1/detik.
 *
 * Voicemaker (https://developer.voicemaker.in)Dicatat sebagai alternatif level-2:
 * juga support Indonesian + Javanese, punya Voice Cloning & VoxFX.
 */

/** Base URL API TTSMaker. */
export const TTSMAKER_API_BASE = 'https://api.ttsmaker.com/v2';

/**
 * Voice TTSMaker berbahasa Indonesia (dari katalog resmi `language=id`).
 * `id` = voice_id yang dipakai API. `limit` = batas karakter per konversi.
 */
export const TTSMAKER_ID_VOICES = [
  {id: 729, key: 'citra', label: 'Citra · Indonesia', gender: 'female', limit: 500, unlimited: true},
  {id: 270, key: 'dewi', label: 'Dewi · Indonesia', gender: 'female', limit: 500, unlimited: true},
  {id: 111008, key: 'ardi', label: 'Ardi · Indonesia', gender: 'male', limit: 3000},
  {id: 111019, key: 'gadis', label: 'Gadis · Indonesia', gender: 'female', limit: 3000},
  {id: 112001, key: 'ayu', label: 'Ayu · Indonesia', gender: 'female', limit: 100},
  {id: 112002, key: 'stefan', label: 'Stefan · Indonesia', gender: 'male', limit: 300},
  {id: 112003, key: 'indah', label: 'Indah · Indonesia', gender: 'female', limit: 200},
  {id: 1729, key: 'citra-emo', label: 'Citra · Indonesia (9 emosi)', gender: 'female', limit: 2000, emotion: true},
  {id: 700001, key: 'sarah-sunda', label: 'Sarah · Sunda', gender: 'female', limit: 1000},
  {id: 700002, key: 'william-sunda', label: 'William · Sunda', gender: 'male', limit: 1000},
];

/** Key voice yang valid (dipakai validasi + UI). */
export const TTSMAKER_VOICE_IDS = new Set(TTSMAKER_ID_VOICES.map((v) => v.id));

/** Emotion key yang didukung voice multi-emosi (voice 1729). */
export const TTSMAKER_EMOTIONS = [
  {key: '', label: 'Normal'},
  {key: 'assistant', label: 'Asisten'},
  {key: 'chat', label: 'Ngobrol'},
  {key: 'customerservice', label: 'Layanan'},
  {key: 'newscast', label: 'Berita'},
  {key: 'angry', label: 'Marah'},
  {key: 'cheerful', label: 'Ceria'},
  {key: 'sad', label: 'Sedih'},
  {key: 'excited', label: 'Semangat'},
  {key: 'friendly', label: 'Ramah'},
  {key: 'hopeful', label: 'Penuh Harapan'},
  {key: 'terrified', label: 'Takut'},
];

/** Batas panjang teks TTSMaker (dokumentasi resmi: 20.000 karakter). */
export const TTSMAKER_MAX_CHARS = 20000;

/** Peta provider -> label (untuk UI & pesan error). */
export const TTS_FALLBACK_PROVIDERS = {
  ttsmaker: {
    id: 'ttsmaker',
    label: 'TTSMaker',
    keyUrl: 'https://pro.ttsmaker.com/api-platform/api-key-list',
    signupUrl: 'https://pro.ttsmaker.com/pricing',
    docsUrl: 'https://ttsmaker.com/developer-api-docs',
    hint: 'Butuh TTSMaker Pro/Studio. Voice native Indonesia + Sundanese. Cek di https://pro.ttsmaker.com/pricing',
    languages: 'Bahasa Indonesia (native) + Sunda',
    commercial: true,
  },
  voicemaker: {
    id: 'voicemaker',
    label: 'Voicemaker',
    keyUrl: 'https://developer.voicemaker.in/',
    signupUrl: 'https://developer.voicemaker.in/user/subscribe',
    docsUrl: 'https://developer.voicemaker.in/apidocs/',
    hint: 'Ambil token di developer.voicemaker.in. Support Indonesia + Jawa, plus voice cloning.',
    languages: 'Bahasa Indonesia + Jawa',
    commercial: true,
  },
};

/**
 * Error khusus: menandai bahwa error ini karena kuota/limit habis —
 * pemanggil boleh pindah ke provider lain.
 */
export class TtsQuotaError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'TtsQuotaError';
    this.quota = true;
    if (cause) this.cause = cause;
  }
}

/**
 * Deteksi pesan error yang berarti "kuota habis / limit kena" —
 * supaya route bisa otomatis fallback ke provider lain.
 * @param {string} message
 * @returns {boolean}
 */
export function isQuotaError(message) {
  const m = String(message || '').toLowerCase();
  if (!m) return false;
  return (
    /\b429\b/.test(m) ||
    /resource[_ ]exhausted/.test(m) ||
    /quota/.test(m) ||
    /rate.?limit/.test(m) ||
    /too many requests/.test(m) ||
    /exceeded your current quota/.test(m) ||
    /billing|insufficient_quota|payment required/.test(m) ||
    /available_quota["\s:]*0/.test(m) ||
    /out of credits|credit balance is too low/.test(m)
  );
}

/**
 * Normalisasi teks untuk TTS.
 * @param {string} text
 * @param {number} maxChars
 */
export function sanitizeTtsText(text, maxChars = TTSMAKER_MAX_CHARS) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Buat urutan fallback berjenjang.
 * Gemini selalu jadi pilihan pertama (default repo), lalu engine ID lain.
 * @param {string[]} [fallbacks] provider fallback pilihan user
 * @returns {string[]}
 */
export function ttsProviderOrder(fallbacks = []) {
  const order = ['gemini'];
  for (const p of fallbacks) {
    const key = String(p || '').trim().toLowerCase();
    if ((key === 'ttsmaker' || key === 'voicemaker') && !order.includes(key)) {
      order.push(key);
    }
  }
  return order;
}

/**
 * Ambil daftar voice Indonesia dari TTSMaker (dipakai buat cek key & UI).
 * @param {string} apiKey
 * @returns {Promise<{voices: Array<object>, quota: object|null}>}
 */
export async function listTtsmakerVoices(apiKey) {
  if (!apiKey) throw new Error('API key TTSMaker belum diisi.');
  const url = `${TTSMAKER_API_BASE}/get-voice-list?api_key=${encodeURIComponent(apiKey)}&language=id`;
  const res = await fetch(url, {
    headers: {accept: 'application/json'},
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.error_code !== undefined && data?.error_code !== 0)) {
    const msg = data?.error_summary || data?.msg || `TTSMaker error (${res.status})`;
    throw new Error(String(msg).slice(0, 300));
  }
  return {
    voices: Array.isArray(data?.voices_detailed_list) ? data.voices_detailed_list : [],
    quota: data?.account_status || null,
  };
}

/**
 * Cek status token TTSMaker (sisa kuota karakter).
 * @param {string} apiKey
 */
export async function getTtsmakerTokenStatus(apiKey) {
  if (!apiKey) throw new Error('API key TTSMaker belum diisi.');
  const url = `${TTSMAKER_API_BASE}/get-token-status?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    headers: {accept: 'application/json'},
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.error_code !== undefined && data?.error_code !== 0)) {
    const msg = data?.error_summary || data?.msg || `TTSMaker error (${res.status})`;
    throw new Error(String(msg).slice(0, 300));
  }
  return data;
}

/**
 * Sintesis speech via TTSMaker.
 *
 * API mengembalikan URL sementara (berlaku ±2 jam) — file harus di-download
 * langsung ke server, bukan disimpan URL-nya.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.text
 * @param {number} [opts.voiceId]
 * @param {string} [opts.format] mp3 | wav | ogg | aac | opus
 * @param {number} [opts.speed] 0.5–2.0
 * @param {number} [opts.volume] 0.1–2.0
 * @param {number} [opts.pitch] 0.5–2.0
 * @param {boolean} [opts.highQuality] audio_high_quality = 1
 * @param {number} [opts.paragraphPauseMs] 0–10000
 * @param {string} [opts.emotion]
 * @param {number} [opts.emotionIntensity] 0.1–2.0
 * @returns {Promise<{audio: Buffer, mimeType: string, voice: number, model: string, chars: number}>}
 */
export async function synthesizeTtsmaker({
  apiKey,
  text,
  voiceId = 729,
  format = 'mp3',
  speed = 1,
  volume = 1,
  pitch = 1,
  highQuality = false,
  paragraphPauseMs = 0,
  emotion = '',
  emotionIntensity = 1,
}) {
  const clean = sanitizeTtsText(text);
  if (!clean) throw new Error('Teks untuk suara kosong.');
  if (!apiKey) throw new Error('API key TTSMaker belum diisi.');

  const body = {
    api_key: apiKey,
    text: clean,
    voice_id: Number(voiceId) || 729,
    audio_format: String(format || 'mp3').toLowerCase(),
    audio_speed: Math.min(Math.max(Number(speed) || 1, 0.5), 2),
    audio_volume: Math.min(Math.max(Number(volume) || 1, 0.1), 2),
    audio_pitch: Math.min(Math.max(Number(pitch) || 1, 0.5), 2),
    audio_high_quality: highQuality ? 1 : 0,
    text_paragraph_pause_time: Math.min(Math.max(Number(paragraphPauseMs) || 0, 0), 10000),
    emotion_style_key: String(emotion || ''),
    emotion_intensity: Math.min(Math.max(Number(emotionIntensity) || 1, 0.1), 2),
  };

  const res = await fetch(`${TTSMAKER_API_BASE}/create-tts-order`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', accept: 'application/json'},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.error_code !== undefined && data?.error_code !== 0)) {
    const msg = String(data?.error_summary || data?.msg || `TTSMaker error (${res.status})`).slice(0, 300);
    if (isQuotaError(msg) || res.status === 429) throw new TtsQuotaError(msg);
    throw new Error(msg);
  }

  const audioUrl = data?.audio_download_url || data?.audio_download_backup_url || '';
  if (!audioUrl) throw new Error('TTSMaker tidak mengembalikan URL audio.');

  // Download file audio (URL sementara -> langsung simpan, jangan simpan URL).
  const dl = await fetch(audioUrl, {signal: AbortSignal.timeout(45000)});
  if (!dl.ok) throw new Error(`Gagal mengunduh audio TTSMaker (${dl.status}).`);
  const audio = Buffer.from(await dl.arrayBuffer());
  if (!audio.length) throw new Error('Audio TTSMaker kosong.');

  const fmt = String(data?.audio_file_format || format || 'mp3').toLowerCase();
  const mimeType = fmt === 'wav' ? 'audio/wav'
    : fmt === 'ogg' ? 'audio/ogg'
      : fmt === 'opus' ? 'audio/opus'
        : fmt === 'aac' ? 'audio/aac'
          : 'audio/mpeg';

  return {
    audio,
    mimeType,
    voice: body.voice_id,
    model: 'ttsmaker-v2',
    chars: Number(data?.tts_task_characters_count) || clean.length,
  };
}
