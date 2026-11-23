/**
 * D-280 — TTSForFree (TTS Forge API) — cadangan TTS bahasa Indonesia.
 *
 * ⚠️ KOREKSI RISET D-278: catatan lama menulis "TTSForFree tidak punya API
 * resmi". Itu **SALAH** — user mengoreksinya dan poinnya sudah dicek ulang ke
 * sumber resmi (`ttsforfree.com/en/docs/` + `/en/blogs/integrate-text-to-speech-api-ttsforfree/`).
 * TTSForFree memang punya **API publik resmi** ("TTS Forge API").
 *
 * Kontrak API (dari dokumentasi resmi):
 * - Base URL: `https://api.ttsforfree.com`
 * - Auth: header `X-API-Key: <key>` (key dibuat di `/en/profile/` → API Key)
 * - **Asynchronous**: create job → poll status → unduh audio dari URL.
 *   - `POST /api/TTS/CreateBy`  body `{Texts, Voice, Pitch, ConnectionId, CallbackUrl}`
 *     → `{Id, Status: "PENDING", Message}`
 *   - `GET  /api/TTS/Status/{id}` → `{Id, Status: "PENDING"|"SUCCESS"|"ERROR", Data: "<file>"}`
 *   - `GET  /api/Common/GetListVoice?lang=id&type=singlevoice` → daftar voice
 *   - `GET  /api/Common/GetListLanguage` → daftar bahasa
 * - Voice dikirim sebagai token opaque (`v1:...`), BUKAN nama voice biasa.
 *
 * Free tier (dari blog resmi):
 * - **30.000 karakter/bulan per akun**, reset bulanan.
 * - Maks **20.000 karakter per request**.
 * - Rate limit **60 request per 5 menit** per IP.
 * - Registrasi lewat Google Sign-In, **tanpa kartu kredit**.
 * - ⚠️ **Free plan = personal & non-commercial only.** Untuk pemakaian komersial
 *   perlu lisensi TTS Forge terpisah (admin@ttsforfree.com).
 * - ⚠️ Voice berlabel "Upgrade" (Chirp3-HD, Gemini premium) butuh plan berbayar —
 *   jadi kita pakai voice Standard/WaveNet/Neural2/Azure yang masuk free tier.
 */

import {sanitizeTtsText, TtsQuotaError, isQuotaError} from './tts-providers.js';

/** Base URL API TTSForFree. */
export const TTSFORFREE_API_BASE = 'https://api.ttsforfree.com';

/** Kuota karakter bulanan free tier (dari blog resmi). */
export const TTSFORFREE_MONTHLY_CHARS = 30000;

/** Batas karakter per request (dari blog resmi). */
export const TTSFORFREE_MAX_CHARS = 20000;

/** Batas karakter free tier per bulan untuk 1 request (biar tidak tembus kuota). */
export const TTSFORFREE_REQUEST_BUDGET = 20000;

/** Voice Indonesia yang tersedia di free tier (Standard/WaveNet/Neural2/Azure). */
export const TTSFORFREE_ID_VOICES = [
  {id: 'v1:ardi', key: 'ardi', label: 'Ardi · Indonesia', gender: 'male', provider: 'azure'},
  {id: 'v1:gadis', key: 'gadis', label: 'Gadis · Indonesia', gender: 'female', provider: 'azure'},
  {id: 'v1:id-id-wavenet-b', key: 'wavenet-b', label: 'Wavenet B · Indonesia', gender: 'male', provider: 'google'},
  {id: 'v1:id-id-wavenet-c', key: 'wavenet-c', label: 'Wavenet C · Indonesia', gender: 'male', provider: 'google'},
  {id: 'v1:id-id-wavenet-d', key: 'wavenet-d', label: 'Wavenet D · Indonesia', gender: 'male', provider: 'google'},
  {id: 'v1:id-id-standard-a', key: 'standard-a', label: 'Standard A · Indonesia', gender: 'female', provider: 'google'},
  {id: 'v1:id-id-standard-b', key: 'standard-b', label: 'Standard B · Indonesia', gender: 'male', provider: 'google'},
  {id: 'v1:id-id-standard-c', key: 'standard-c', label: 'Standard C · Indonesia', gender: 'male', provider: 'google'},
  {id: 'v1:id-id-standard-d', key: 'standard-d', label: 'Standard D · Indonesia', gender: 'female', provider: 'google'},
];

/** Token voice yang valid (dipakai validasi + UI). */
export const TTSFORFREE_VOICE_IDS = new Set(TTSFORFREE_ID_VOICES.map((v) => v.id));

/** Voice default (Ardi — Azure Neural, native Indonesia, masuk free tier). */
export const TTSFORFREE_DEFAULT_VOICE = 'v1:ardi';

/**
 * Hitung jeda polling (ms). Poll pertama setelah 3 detik, lalu bertambah
 * mild sampai maksimum 8 detik — supaya tidak membanjiri API (rate limit
 * 60 req/5 menit) tapi tetap responsif.
 * @param {number} attempt
 * @returns {number}
 */
function pollDelay(attempt) {
  return Math.min(3000 + attempt * 500, 8000);
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ambil daftar voice Bahasa Indonesia dari API.
 *
 * Endpoint: `GET /api/Common/GetListVoice?lang=id&type=singlevoice`
 * Respons TTSForFree: `{Id, Message, Data: [{Voice, VoiceName, DisplayName, ...}]}`
 * atau array langsung — keduanya ditangani.
 *
 * @param {string} apiKey
 * @returns {Promise<Array<object>>}
 */
export async function listTtsforfreeVoices(apiKey) {
  if (!apiKey) throw new Error('API key TTSForFree belum diisi.');
  const res = await fetch(`${TTSFORFREE_API_BASE}/api/Common/GetListVoice?lang=id&type=singlevoice`, {
    headers: {'X-API-Key': apiKey, Accept: 'application/json'},
    signal: AbortSignal.timeout(20000),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(payload?.Message || payload?.message || `TTSForFree error (${res.status})`).slice(0, 300);
    if (res.status === 429 || res.status === 403 || isQuotaError(msg)) throw new TtsQuotaError(msg);
    throw new Error(msg);
  }
  // Bentuk respons bisa: array, {Data: [...]}, atau {Voices: [...]}.
  const raw = Array.isArray(payload) ? payload
    : (Array.isArray(payload?.Data) ? payload.Data
      : (Array.isArray(payload?.Voices) ? payload.Voices : []));
  return raw
    .map((v) => ({
      id: String(v?.Voice || v?.voice || v?.VoiceName || '').trim(),
      label: String(v?.DisplayName || v?.VoiceName || v?.displayName || '').trim() || String(v?.Voice || ''),
      provider: String(v?.Provider || v?.provider || '').toLowerCase(),
    }))
    .filter((v) => v.id);
}

/**
 * Ambil URL audio dari payload status / detail job.
 * @param {object} payload
 * @returns {string}
 */
function extractAudioUrl(payload) {
  const candidates = [
    payload?.Data,
    payload?.data,
    payload?.FinalAudioUrl,
    payload?.AudioUrl,
    payload?.audioUrl,
    payload?.FilePath,
    payload?.filePath,
    payload?.Url,
    payload?.url,
    payload?.Data?.FinalAudioUrl,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
    if (c && typeof c === 'object') {
      const inner = c.FinalAudioUrl || c.AudioUrl || c.audioUrl || c.FilePath || c.filePath || c.Url || c.url;
      if (typeof inner === 'string' && /^https?:\/\//i.test(inner)) return inner;
    }
  }
  return '';
}

/**
 * Ambil status job dari payload.
 * @param {object} payload
 * @returns {string} PENDING | SUCCESS | ERROR | ''
 */
function extractStatus(payload) {
  const s = String(payload?.Status || payload?.status || payload?.StatusId || '').toUpperCase();
  if (s === 'SUCCESS' || s === '200') return 'SUCCESS';
  if (s === 'ERROR' || s === '-100' || s === 'FAILED') return 'ERROR';
  if (s === 'PENDING' || s === '100' || s === '150' || s === 'PROCESSING' || s === 'QUEUED') return 'PENDING';
  return s;
}

/**
 * Sintesis speech via TTSForFree (TTS Forge API).
 *
 * Alur (API-nya asynchronous):
 * 1. `POST /api/TTS/CreateBy` → dapat `Id` job.
 * 2. Poll `GET /api/TTS/Status/{id}` tiap 3–8 detik sampai `SUCCESS`/`ERROR`.
 * 3. Unduh file audio dari URL yang dikembalikan.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.text
 * @param {string} [opts.voice] token voice (`v1:...`)
 * @param {number} [opts.pitch] pitch (0 default)
 * @param {number} [opts.maxWaitMs] batas total menunggu (default 90 detik)
 * @returns {Promise<{audio: Buffer, mimeType: string, voice: string, model: string, chars: number}>}
 */
export async function synthesizeTtsforfree({
  apiKey,
  text,
  voice = TTSFORFREE_DEFAULT_VOICE,
  pitch = 0,
  maxWaitMs = 90000,
}) {
  const clean = sanitizeTtsText(text, TTSFORFREE_MAX_CHARS);
  if (!clean) throw new Error('Teks untuk suara kosong.');
  if (!apiKey) throw new Error('API key TTSForFree belum diisi.');

  const usedVoice = TTSFORFREE_VOICE_IDS.has(voice) ? voice : TTSFORFREE_DEFAULT_VOICE;
  const usedPitch = Math.max(-50, Math.min(50, Math.round(Number(pitch) || 0)));

  // 1) Buat job.
  const createRes = await fetch(`${TTSFORFREE_API_BASE}/api/TTS/CreateBy`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      Texts: clean,
      Voice: usedVoice,
      Pitch: usedPitch,
      ConnectionId: '',
      CallbackUrl: '',
    }),
    signal: AbortSignal.timeout(30000),
  });

  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    const msg = String(created?.Message || created?.message || `TTSForFree error (${createRes.status})`).slice(0, 300);
    if (createRes.status === 429 || createRes.status === 403 || isQuotaError(msg)) throw new TtsQuotaError(msg);
    throw new Error(msg);
  }

  const jobId = Number(created?.Id || created?.id || 0);
  if (!jobId) {
    throw new Error(`TTSForFree tidak mengembalikan Id job. ${String(created?.Message || '').slice(0, 200)}`.trim());
  }

  // 2) Poll status sampai selesai.
  const deadline = Date.now() + Math.max(15000, Number(maxWaitMs) || 90000);
  let attempt = 0;
  let audioUrl = '';
  let lastPayload = created;

  while (Date.now() < deadline) {
    await sleep(pollDelay(attempt));
    attempt += 1;

    let statusRes;
    try {
      statusRes = await fetch(`${TTSFORFREE_API_BASE}/api/TTS/Status/${jobId}`, {
        headers: {'X-API-Key': apiKey, Accept: 'application/json'},
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      // Jaringan hiccup saat polling — coba lagi, jangan gagalkan job.
      if (Date.now() >= deadline) throw new Error(`TTSForFree gagal mengecek status job: ${error?.message || error}`);
      continue;
    }

    if (!statusRes.ok) {
      const msg = `TTSForFree status error (${statusRes.status})`;
      if (statusRes.status === 429 || statusRes.status === 403) throw new TtsQuotaError(msg);
      throw new Error(msg);
    }

    const payload = await statusRes.json().catch(() => ({}));
    lastPayload = payload;
    const status = extractStatus(payload);

    if (status === 'SUCCESS') {
      audioUrl = extractAudioUrl(payload);
      if (!audioUrl) {
        // Status sukses tapi URL tidak ada di payload status — coba detail job.
        try {
          const detailRes = await fetch(`${TTSFORFREE_API_BASE}/api/TTS/GetJobTTSDetail?jobId=${jobId}`, {
            headers: {'X-API-Key': apiKey, Accept: 'application/json'},
            signal: AbortSignal.timeout(20000),
          });
          if (detailRes.ok) {
            const detail = await detailRes.json().catch(() => ({}));
            audioUrl = extractAudioUrl(detail?.Data || detail);
          }
        } catch {
          // Detail gagal — lanjut ke pesan error di bawah.
        }
      }
      if (!audioUrl) throw new Error('TTSForFree selesai tapi URL audio tidak ditemukan di respons.');
      break;
    }

    if (status === 'ERROR') {
      const msg = String(lastPayload?.Message || lastPayload?.message || 'TTSForFree gagal memproses audio.').slice(0, 300);
      if (isQuotaError(msg)) throw new TtsQuotaError(msg);
      throw new Error(msg);
    }
  }

  if (!audioUrl) {
    throw new Error(`TTSForFree belum selesai dalam ${Math.round((Number(maxWaitMs) || 90000) / 1000)} detik.`);
  }

  // 3) Unduh audio.
  const audioRes = await fetch(audioUrl, {
    headers: {'User-Agent': 'SherlyStudio'},
    signal: AbortSignal.timeout(45000),
  });
  if (!audioRes.ok) {
    throw new Error(`Gagal mengunduh audio TTSForFree (${audioRes.status}).`);
  }
  const audio = Buffer.from(await audioRes.arrayBuffer());
  if (!audio.length) throw new Error('Audio TTSForFree kosong.');

  const contentType = String(audioRes.headers.get('content-type') || '').toLowerCase();
  const mimeType = contentType.includes('wav') ? 'audio/wav'
    : contentType.includes('ogg') ? 'audio/ogg'
      : contentType.includes('mpeg') || contentType.includes('mp3') ? 'audio/mpeg'
        : 'audio/mpeg';

  return {
    audio,
    mimeType,
    voice: usedVoice,
    model: 'ttsforge-v1',
    chars: clean.length,
    jobId,
  };
}
