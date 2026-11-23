/**
 * D-276 / D-277 / D-278 / D-279 / D-280 — Provider TTS cadangan yang support
 * bahasa Indonesia.
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
 *   - Azure     → user tidak bisa mendaftar (butuh kartu kredit verifikasi
 *                  akun Azure + region wajib) → ❌ DIHAPUS (D-280)
 *
 * Yang DIPAKAI (dua-duanya free tier bulanan, tanpa subscription, tanpa
 * kartu kredit):
 *   1. **TTSForFree** (TTS Forge API) — **30.000 karakter/bulan gratis**,
 *      reset bulanan, API key **tanpa kartu kredit** (registrasi Google
 *      Sign-In), **44 voice Bahasa Indonesia** (Azure Ardi/Gadis, Google
 *      `id-ID-*` Standard/WaveNet, 4 voice Gemini).
 *      ⚠️ Batasan: free plan **personal & non-commercial only**; API
 *      **asynchronous** (create job → poll status → unduh audio).
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
  ttsforfree: {
    id: 'ttsforfree',
    label: 'TTSForFree',
    keyUrl: 'https://ttsforfree.com/en/profile/',
    signupUrl: 'https://ttsforfree.com/en/login/',
    docsUrl: 'https://ttsforfree.com/en/docs/',
    hint: 'Cadangan utama TTS bahasa Indonesia. Gratis 30.000 karakter/bulan (reset bulanan), API key tanpa kartu kredit (daftar lewat Google). 44 voice Indonesia (Ardi, Gadis, id-ID Standard/WaveNet). Paket gratis hanya untuk penggunaan pribadi — bukan komersial.',
    languages: 'Bahasa Indonesia (44 voice: Azure, Google id-ID, Gemini)',
    freeTier: '30.000 karakter/bulan (reset bulanan)',
    commercial: false,
    attribution: 'Paket gratis hanya untuk penggunaan pribadi/non-komersial. Untuk komersial perlu lisensi TTS Forge.',
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    signupUrl: 'https://elevenlabs.io/sign-up',
    docsUrl: 'https://elevenlabs.io/docs/overview/capabilities/text-to-speech',
    hint: 'Cadangan terakhir. Gratis 10.000 kredit/bulan (~10 menit), API key tanpa kartu kredit. ⚠️ WAJIB: setelah membuat key, edit key-nya → nyalakan permission "Text to Speech: Access" + "Voices: Read" + "User: Read" (key baru default-nya semua No Access). Paste API KEY PENUH berawalan "sk_", bukan "API Key ID". Paket gratis tanpa hak komersial — wajib atribusi.',
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
 * D-280: **TTSForFree** (free 30rb karakter/bulan, tanpa kartu kredit,
 * 44 voice Indonesia) → **ElevenLabs** (free 10rb kredit/bulan, tanpa kartu
 * kredit). Azure dihapus (user tidak bisa mendaftar).
 * @returns {string[]}
 */
export function ttsFallbackChain() {
  return ['ttsforfree', 'elevenlabs'];
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
    // D-281: pesan error yang bisa ditindaklanjuti (baca detail.code).
    const {elevenlabsErrorMessage} = await import('./elevenlabs-errors.js');
    const msg = elevenlabsErrorMessage(res.status, data).slice(0, 600);
    if (res.status === 429 || res.status === 401 && /quota|kredit/i.test(msg)) throw new TtsQuotaError(msg);
    if (res.status === 402 || /paid_plan_required|kuota habis/i.test(msg)) throw new TtsQuotaError(msg);
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
