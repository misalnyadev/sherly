/**
 * D-276 / D-277 / D-278 — Provider TTS cadangan yang support bahasa Indonesia.
 *
 * Konteks: kalau kredit/kuota Gemini habis, TTS jangan langsung gagal —
 * ada engine lain yang **benar-benar bisa berbahasa Indonesia**.
 *
 * ⚠️ D-278 — ATURAN BARU: fallback TTS **wajib bisa dipakai tanpa subscribe**.
 * Semua provider yang mewajibkan langganan/pembayaran di awal DIHAPUS:
 *   - TTSMaker  → API resmi hanya untuk paket Pro/Studio (tanpa subscribe tidak
 *                  ada API key sama sekali) → ❌ DIHAPUS
 *   - Soniox    → free credit signup baru dihentikan (Okt 2025), praktis
 *                  pay-as-you-go → ❌ DIHAPUS
 *   - Voicemaker→ developer API pay-as-you-go, free plan web tidak membawa API
 *                  → ❌ DIHAPUS
 *
 * Yang DIPAKAI (dua-duanya punya free tier bulanan, tanpa subscription):
 *   1. **Azure Speech** (F0) — **500.000 karakter/bulan gratis, tanpa info
 *      pembayaran**, reset tiap bulan, tidak pernah kedaluwarsa. Voice native
 *      Indonesia: `id-ID-ArdiNeural` (pria), `id-ID-GadisNeural` (wanita),
 *      plus Neural HD (`id-ID-Ardi:DragonHDLatestNeural`).
 *   2. **ElevenLabs** (Free) — **10.000 kredit/bulan gratis** (~10 menit audio),
 *      API key **tanpa kartu kredit**, Indonesian didukung Multilingual v2.
 *      ⚠️ Batasan penting: free plan **tidak memberi hak komersial** dan wajib
 *      atribusi ("elevenlabs.io"/"11.ai") kalau audio dipublikasikan.
 *      Karena itu ElevenLabs hanya jadi cadangan **terakhir**.
 *
 * Semua provider tetap **wajib punya API key sendiri** dari user (D-270:
 * tiap provider punya link resmi untuk memperoleh key).
 */

/** Batas panjang teks TTS (karakter). */
export const TTS_MAX_CHARS = 20000;

// ---------------------------------------------------------------------------
// Azure Speech (fallback #1) — free tier F0, tanpa info pembayaran
// ---------------------------------------------------------------------------

/** Host Azure Speech (region diambil dari key user, mis. `jakarta`, `southeastasia`). */
export const AZURE_SPEECH_HOST = 'tts.speech.microsoft.com';

/** Region default Azure Speech kalau user tidak mengisi region. */
export const AZURE_SPEECH_DEFAULT_REGION = 'southeastasia';

/**
 * Voice Azure Speech native Indonesia (`id-ID`).
 * Standard (Neuro) & Neural HD — Standard yang masuk free tier F0.
 * Sumber: dokumentasi resmi "Language and Voice Support for Azure Speech".
 */
export const AZURE_ID_VOICES = [
  {id: 'id-ID-ArdiNeural', key: 'ardi', label: 'Ardi · Indonesia', gender: 'male', tier: 'neural'},
  {id: 'id-ID-GadisNeural', key: 'gadis', label: 'Gadis · Indonesia', gender: 'female', tier: 'neural'},
  {id: 'id-ID-Ardi:DragonHDLatestNeural', key: 'ardi-hd', label: 'Ardi HD · Indonesia', gender: 'male', tier: 'hd'},
  {id: 'id-ID-Gadis:DragonHDLatestNeural', key: 'gadis-hd', label: 'Gadis HD · Indonesia', gender: 'female', tier: 'hd'},
];

/** Key voice Azure yang valid (dipakai validasi + UI). */
export const AZURE_VOICE_IDS = new Set(AZURE_ID_VOICES.map((v) => v.id));

/**
 * Peta format output Azure -> header `X-Microsoft-OutputFormat` + MIME.
 * `mp3` dipakai sebagai default (Mediabunny sudah support, kecil).
 */
export const AZURE_OUTPUT_FORMATS = {
  mp3: {header: 'audio-24khz-48kbitrate-mono-mp3', mimeType: 'audio/mpeg'},
  mp3_16k: {header: 'audio-16khz-128kbitrate-mono-mp3', mimeType: 'audio/mpeg'},
  opus: {header: 'ogg-24khz-16bit-mono-opus', mimeType: 'audio/ogg'},
  wav: {header: 'riff-24khz-16bit-mono-pcm', mimeType: 'audio/wav'},
};

// ---------------------------------------------------------------------------
// ElevenLabs (fallback #2) — free tier 10.000 kredit/bulan, tanpa kartu kredit
// ---------------------------------------------------------------------------

/** Base URL API ElevenLabs. */
export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

/** Model ElevenLabs yang dipakai (Multilingual v2 — mendukung Indonesian). */
export const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

/**
 * Voice ElevenLabs bawaan yang cocok untuk Bahasa Indonesia.
 * ElevenLabs mendeteksi bahasa otomatis dari teks, jadi voice yang dipilih
 * tetap bisa berbahasa Indonesia.
 */
export const ELEVENLABS_VOICES = [
  {id: '21m00Tcm4TlvDq8ikWAM', key: 'rachel', label: 'Rachel', gender: 'female'},
  {id: 'pNInz6obpgDQGcFmaJgB', key: 'adam', label: 'Adam', gender: 'male'},
  {id: 'TxGEqnHWrfWFTfGW9XjX', key: 'josh', label: 'Josh', gender: 'male'},
  {id: 'EXAVITQu4vr4xnSDxMaL', key: 'sarah', label: 'Sarah', gender: 'female'},
  {id: 'MF3mGyEYCl7XYWbV9V6O', key: 'ella', label: 'Ella', gender: 'female'},
  {id: 'N2lVS1w4EtoT3dr4eOWO', key: 'domi', label: 'Domi', gender: 'female'},
];

/** Key voice ElevenLabs yang valid (dipakai validasi + UI). */
export const ELEVENLABS_VOICE_IDS = new Set(ELEVENLABS_VOICES.map((v) => v.id));

/** Batas panjang teks ElevenLabs per request (dokumentasi resmi). */
export const ELEVENLABS_MAX_CHARS = 5000;

// ---------------------------------------------------------------------------
// Metadata provider (UI + pesan error)
// ---------------------------------------------------------------------------

/** Peta provider -> label (untuk UI & pesan error). */
export const TTS_FALLBACK_PROVIDERS = {
  azure: {
    id: 'azure',
    label: 'Azure Speech',
    keyUrl: 'https://portal.azure.com/#view/Microsoft_Azure_Services/Speech',
    signupUrl: 'https://portal.azure.com/#create/Microsoft.SpeechServices',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/speech-service/language-support',
    hint: 'Cadangan TTS bahasa Indonesia. Paket F0 gratis 500.000 karakter/bulan tanpa perlu info pembayaran. Voice native Indonesia (Ardi, Gadis).',
    languages: 'Bahasa Indonesia (native, 400+ voice, 140+ bahasa)',
    freeTier: '500.000 karakter/bulan (F0, reset bulanan)',
    commercial: true,
    needsRegion: true,
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    signupUrl: 'https://elevenlabs.io/sign-up',
    docsUrl: 'https://elevenlabs.io/docs/overview/capabilities/text-to-speech',
    hint: 'Cadangan terakhir. Gratis 10.000 kredit/bulan (~10 menit audio), API key tanpa kartu kredit. Paket gratis tidak termasuk hak komersial — wajib atribusi "elevenlabs.io" kalau audio dipublikasikan.',
    languages: 'Bahasa Indonesia (Multilingual v2, 29+ bahasa)',
    freeTier: '10.000 kredit/bulan (~10 menit audio)',
    commercial: false,
    attribution: 'Wajib tulis "elevenlabs.io" atau "11.ai" di judul saat memakai paket gratis.',
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
    /out of credits|credit balance is too low/.test(m) ||
    /exceeded your monthly|quota_exceeded/.test(m) ||
    /insufficient credits|monthly limit/.test(m)
  );
}

/**
 * Normalisasi teks untuk TTS.
 * @param {string} text
 * @param {number} maxChars
 */
export function sanitizeTtsText(text, maxChars = TTS_MAX_CHARS) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Buat urutan fallback berjenjang.
 * Gemini selalu jadi pilihan pertama (default repo), lalu engine ID lain.
 *
 * D-278: hanya provider dengan free tier tanpa subscription yang diterima.
 *
 * @param {string[]} [fallbacks] provider fallback pilihan user
 * @returns {string[]}
 */
export function ttsProviderOrder(fallbacks = []) {
  const order = ['gemini'];
  for (const p of fallbacks) {
    const key = String(p || '').trim().toLowerCase();
    if (TTS_FALLBACK_PROVIDERS[key] && !order.includes(key)) {
      order.push(key);
    }
  }
  return order;
}

/**
 * Urutan fallback TTS default (dipakai route saat Gemini gagal).
 * D-278: **Azure Speech** (free 500rb karakter/bulan, tanpa info pembayaran)
 * → **ElevenLabs** (free 10rb kredit/bulan, tanpa kartu kredit).
 * @returns {string[]}
 */
export function ttsFallbackChain() {
  return ['azure', 'elevenlabs'];
}

// ---------------------------------------------------------------------------
// Azure Speech
// ---------------------------------------------------------------------------

/**
 * Escape teks untuk disisipkan ke SSML.
 * @param {string} text
 * @returns {string}
 */
function escapeSsml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Ambil daftar voice Azure Speech (dipakai buat cek key & UI).
 * @param {string} apiKey
 * @param {string} [region]
 * @returns {Promise<Array<object>>}
 */
export async function listAzureVoices(apiKey, region = '') {
  if (!apiKey) throw new Error('API key Azure Speech belum diisi.');
  const reg = String(region || process.env.AZURE_SPEECH_REGION || AZURE_SPEECH_DEFAULT_REGION).trim();
  const res = await fetch(`https://${reg}.${AZURE_SPEECH_HOST}/cognitiveservices/voices/list`, {
    headers: {accept: 'application/json', 'Ocp-Apim-Subscription-Key': apiKey},
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data?.message || data?.error?.message || `Azure Speech error (${res.status})`).slice(0, 300);
    if (res.status === 429 || isQuotaError(msg)) throw new TtsQuotaError(msg);
    throw new Error(msg);
  }
  const voices = Array.isArray(data) ? data : [];
  return voices.filter((v) => String(v?.Locale || '').startsWith('id-ID'));
}

/**
 * Sintesis speech via Azure Speech.
 *
 * Endpoint: `POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`
 * Header: `Ocp-Apim-Subscription-Key` + `Content-Type: application/ssml+xml` +
 * `X-Microsoft-OutputFormat`.
 * Respons: body = file audio langsung (mp3/wav/ogg).
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.text
 * @param {string} [opts.voice] ShortName voice (default `id-ID-ArdiNeural`)
 * @param {string} [opts.region] region resource Azure (default `southeastasia`)
 * @param {string} [opts.format] mp3 | mp3_16k | opus | wav
 * @param {number} [opts.rate] kecepatan SSML (0.5–2)
 * @param {number} [opts.pitch] pitch SSML dalam persen (-50..50)
 * @returns {Promise<{audio: Buffer, mimeType: string, voice: string, model: string, chars: number}>}
 */
export async function synthesizeAzure({
  apiKey,
  text,
  voice = 'id-ID-ArdiNeural',
  region = '',
  format = 'mp3',
  rate = 1,
  pitch = 0,
}) {
  const clean = sanitizeTtsText(text, TTS_MAX_CHARS);
  if (!clean) throw new Error('Teks untuk suara kosong.');
  if (!apiKey) throw new Error('API key Azure Speech belum diisi.');

  const reg = String(region || process.env.AZURE_SPEECH_REGION || AZURE_SPEECH_DEFAULT_REGION).trim();
  const fmtKey = AZURE_OUTPUT_FORMATS[format] ? format : 'mp3';
  const fmt = AZURE_OUTPUT_FORMATS[fmtKey];
  const usedVoice = AZURE_VOICE_IDS.has(voice) ? voice : 'id-ID-ArdiNeural';

  const prosody = [];
  const r = Number(rate);
  if (Number.isFinite(r) && r !== 1) {
    prosody.push(`rate="${Math.min(Math.max(r, 0.5), 2).toFixed(2)}"`);
  }
  const p = Number(pitch);
  if (Number.isFinite(p) && p !== 0) {
    prosody.push(`pitch="${Math.min(Math.max(p, -50), 50).toFixed(0)}%"`);
  }
  const prosodyTag = prosody.length ? `<prosody ${prosody.join(' ')}>` : '';
  const prosodyClose = prosody.length ? '</prosody>' : '';

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="id-ID">`
    + `<voice name="${usedVoice}">${prosodyTag}${escapeSsml(clean)}${prosodyClose}</voice>`
    + `</speak>`;

  const res = await fetch(`https://${reg}.${AZURE_SPEECH_HOST}/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': fmt.header,
      'User-Agent': 'SherlyStudio',
    },
    body: ssml,
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = String(data?.message || data?.error?.message || `Azure Speech error (${res.status})`).slice(0, 300);
    if (res.status === 429 || isQuotaError(msg)) throw new TtsQuotaError(msg);
    throw new Error(msg);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (!audio.length) throw new Error('Audio Azure Speech kosong.');

  return {
    audio,
    mimeType: fmt.mimeType,
    voice: usedVoice,
    model: 'azure-speech-v1',
    chars: clean.length,
  };
}

// ---------------------------------------------------------------------------
// ElevenLabs
// ---------------------------------------------------------------------------

/**
 * Sintesis speech via ElevenLabs.
 *
 * Endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
 * Header: `xi-api-key`. Body JSON `{text, model_id, voice_settings}`.
 * Respons: body = file audio (mp3).
 *
 * ⚠️ Paket gratis: 10.000 kredit/bulan, TANPA hak komersial, wajib atribusi.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.text
 * @param {string} [opts.voice] voice_id (default Rachel)
 * @param {string} [opts.model] model_id (default `eleven_multilingual_v2`)
 * @param {number} [opts.stability] 0–1
 * @param {number} [opts.similarityBoost] 0–1
 * @param {number} [opts.speed] 0.7–1.2
 * @param {string} [opts.format] mp3 | pcm
 * @returns {Promise<{audio: Buffer, mimeType: string, voice: string, model: string, chars: number}>}
 */
export async function synthesizeElevenLabs({
  apiKey,
  text,
  voice = '21m00Tcm4TlvDq8ikWAM',
  model = ELEVENLABS_MODEL,
  stability = 0.5,
  similarityBoost = 0.75,
  speed = 1,
  format = 'mp3',
}) {
  const clean = sanitizeTtsText(text, ELEVENLABS_MAX_CHARS);
  if (!clean) throw new Error('Teks untuk suara kosong.');
  if (!apiKey) throw new Error('API key ElevenLabs belum diisi.');

  const usedVoice = ELEVENLABS_VOICE_IDS.has(voice) ? voice : '21m00Tcm4TlvDq8ikWAM';
  const fmt = String(format || 'mp3').toLowerCase();
  const body = {
    text: clean,
    model_id: String(model || ELEVENLABS_MODEL),
    voice_settings: {
      stability: Math.min(Math.max(Number(stability) || 0.5, 0), 1),
      similarity_boost: Math.min(Math.max(Number(similarityBoost) || 0.75, 0), 1),
      speed: Math.min(Math.max(Number(speed) || 1, 0.7), 1.2),
    },
  };

  const res = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(usedVoice)}?output_format=${fmt === 'pcm' ? 'pcm_16000' : 'mp3_44100_128'}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = data?.detail;
    const msg = String(
      (Array.isArray(detail) && detail[0]?.msg)
      || (typeof detail === 'string' ? detail : '')
      || data?.message
      || `ElevenLabs error (${res.status})`,
    ).slice(0, 300);
    if (res.status === 429 || isQuotaError(msg)) throw new TtsQuotaError(msg);
    throw new Error(msg);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (!audio.length) throw new Error('Audio ElevenLabs kosong.');

  return {
    audio,
    mimeType: fmt === 'pcm' ? 'audio/pcm' : 'audio/mpeg',
    voice: usedVoice,
    model: body.model_id,
    chars: clean.length,
  };
}
