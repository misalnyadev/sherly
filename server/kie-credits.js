// D-274 · Tarif kredit Kie AI untuk ditampilkan di komposer Studio.
//
// User: "kok banyak kali ya abis creditnya?" + "tampilkan informasi kredit yang
// akan dipakai di composer, cukup angka saja, contoh: [foto] [12]".
//
// Angka diambil dari harga resmi Kie AI (1 kredit ≈ $0.005), dibaca per model
// dan per opsi generate (resolusi gambar / tier + resolusi + durasi video).
// Sumber: https://kie.ai/pricing (+ halaman model masing-masing).
//
// CATATAN: ini ESTIMASI BIAYA generate, bukan saldo. Saldo live diambil dari
// endpoint Kie GET /api/v1/chat/credit (lihat fetchKieCredits di bawah).
//
// Bentuk data:
//   Gambar  : { [resolusi]: kredit per gambar }
//   Video   : { [tier]: { [resolusi]: kredit per detik } } atau { [tier]: kredit per detik }
//   Flat   : { flat: kredit }  -> satu harga untuk semua resolusi
//
// Model video yang dihitung PER VIDEO (bukan per detik) ditandai `perVideo: true`.

/** Tier video tanpa perbedaan resolusi (hanya satu harga per detik). */
const perSecond = (value) => ({ perSecond: value });

/**
 * Tarif model GAMBAR (kredit per gambar, per resolusi).
 */
export const IMAGE_CREDITS = {
  // Google Nano Banana 2 — 1K $0.04 / 2K $0.06 / 4K $0.09.
  'nano-banana-2': { '1K': 8, '2K': 12, '4K': 18 },
  // Google Nano Banana Pro — 1K/2K $0.09, 4K $0.12.
  'nano-banana-pro': { '1K': 18, '2K': 18, '4K': 24 },
  // OpenAI GPT Image 2 — 1K $0.03 / 2K $0.05 / 4K $0.08.
  'gpt-image-2-text-to-image': { '1K': 6, '2K': 10, '4K': 16 },
  // ByteDance Seedream 5.0 Lite — flat $0.0275 per gambar.
  'bytedance/seedream-v5.0-lite': { '1K': 5.5, '2K': 5.5, '4K': 5.5 },
  // ByteDance Seedream 5.0 Pro — 1K $0.035 / 2K $0.07.
  'bytedance/seedream-5.0-pro': { '1K': 7, '2K': 14, '4K': 14 },
  // ByteDance Seedream 5.5 — 1K & 1.5K $0.018, 2K $0.0315.
  'bytedance/seedream-5-5': { '1K': 3.6, '2K': 6.3, '4K': 6.3 },
  // OpenAI GPT Image 2.6 — harga per token, tabel acuan quality x resolusi
  // (default Kie = medium): 1K 7.82 / 2K 15.90 / 4K 26.43.
  'gpt-image-2-6/flare-text-to-image': { '1K': 7.82, '2K': 15.9, '4K': 26.43 },
  // Black Forest Labs FLUX 2 Pro — 1K $0.025 / 2K $0.035.
  'flux-2-pro-text-to-image': { '1K': 5, '2K': 7, '4K': 7 },
};

/**
 * Tarif model VIDEO.
 *  - `perSecond: { [resolusi]: kredit/detik }` -> total = tarif x durasi
 *  - `perVideo:  { [resolusi]: kredit/video }`   -> total = tarif (durasi tidak berpengaruh)
 */
export const VIDEO_CREDITS = {
  // Google Veo 3.1 — dihitung PER VIDEO.
  // Lite 720p 30 / 1080p 35 / 4K 150; Fast 60 / 65 / 180; Quality 250 / 255 / 370.
  'veo-3-1': {
    perVideo: {
      veo3_lite: { '720p': 30, '1080p': 35, '4k': 150 },
      veo3_fast: { '720p': 60, '1080p': 65, '4k': 180 },
      veo3: { '720p': 250, '1080p': 255, '4k': 370 },
    },
  },
  // Kling 3.0 — per detik. 720p std 15.1, 1080p pro 20.2, 4K 75.5 (tanpa audio).
  'kling-3.0/video': {
    perSecond: { std: { '720p': 15.1, '1080p': 15.1, '4k': 75.5 }, pro: { '720p': 20.2, '1080p': 20.2, '4k': 75.5 }, '4K': { '720p': 75.5, '1080p': 75.5, '4k': 75.5 } },
  },
  // ByteDance Seedance 2.0 — per detik.
  // Fast 480p 6.8 / 720p 15; Standard 480p 11.7 / 720p 24.8.
  'bytedance/seedance-2': {
    perSecond: {
      fast: { '480p': 6.8, '720p': 15, '1080p': 15, '4k': 15 },
      standard: { '480p': 11.7, '720p': 24.8, '1080p': 24.8, '4k': 24.8 },
    },
  },
  // ByteDance Seedance 2.0 Fast (model terpisah) — 480p 6.8 / 720p 15.
  'bytedance/seedance-2-fast': {
    perSecond: { fast: { '480p': 6.8, '720p': 15, '1080p': 15, '4k': 15 } },
  },
  // ByteDance Seedance 2.5 — per detik. Standard 480p 17 / 720p 38 / 1080p 95 / 4K 155.
  'bytedance/seedance-2-5': {
    perSecond: {
      standard: { '480p': 17, '720p': 38, '1080p': 95, '4k': 155 },
      draft: { '480p': 17, '720p': 17, '1080p': 17, '4k': 17 },
    },
  },
  // Google Gemini Omni Flash 1.2 — per detik.
  // 360p 4 / 720p 9 / 1080p 10 / 4K 22.
  'google/gemini-omni-flash-1-2': {
    perSecond: { standard: { '360p': 4, '720p': 9, '1080p': 10, '4k': 22 } },
  },
  // Alibaba Wan 3.0 — per detik. 480p 8 / 720p 16 / 1080p 32.
  'wan/3-0-video': {
    perSecond: { standard: { '480p': 8, '720p': 16, '1080p': 32, '4k': 32 } },
  },
  // Kuaishou Kling 4.0 — per detik (tanpa video input).
  // 720p 28.5 / 1080p 42.5 / 4K 99; HDR +8.5 (1080p) / +14 (4K).
  'kling-4-0/reference-to-video': {
    perSecond: {
      std: { '720p': 28.5, '1080p': 28.5, '4k': 28.5 },
      pro: { '720p': 42.5, '1080p': 42.5, '4k': 42.5 },
      '4K': { '720p': 99, '1080p': 99, '4k': 99 },
      hdr: { '720p': 28.5, '1080p': 51, '4k': 113 },
    },
  },
};

/**
 * Tarif model LIPSYNC (kredit per detik).
 */
export const LIPSYNC_CREDITS = {
  // InfiniteTalk — 480p $0.015/detik, 720p $0.06/detik.
  'infinitalk/from-audio': { '480p': 3, '720p': 12 },
  // LTX 2.5 Fast A2V — 720p 10.8 / 1080p 15.6 / 1440p 22.8 per detik.
  'ltx/2-5-fast-audio-to-video': { '720p': 10.8, '1080p': 15.6, '1440p': 22.8 },
  // OmniHuman 1.5 — $0.135/detik; OmniHuman 2.0 — $0.07/detik.
  'omnihuman-1-5': { '720p': 27, '720P': 27, '1080p': 27, '1080P': 27 },
  'omnihuman-2-0': { '720p': 14, '720P': 14 },
};

/** Bulatkan ke atas supaya angka di UI tidak pernah terlihat terlalu murah. */
function roundUp(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value - 0.0001);
}

/**
 * Estimasi kredit untuk satu generate FOTO.
 * @param {string} modelId id model Kie
 * @param {string} resolution 1K | 2K | 4K
 * @returns {number} jumlah kredit (0 kalau model tidak dikenal)
 */
export function estimateImageCredits(modelId, resolution) {
  const row = IMAGE_CREDITS[String(modelId || '')];
  if (!row) return 0;
  const res = String(resolution || '').toUpperCase();
  if (row[res] != null) return roundUp(row[res]);
  // Resolusi tak dikenal -> pakai harga paling murah yang tersedia.
  const values = Object.values(row).filter((v) => typeof v === 'number');
  return values.length ? roundUp(Math.min(...values)) : 0;
}

/**
 * Estimasi kredit untuk satu generate VIDEO.
 * @param {string} modelId id model Kie
 * @param {string} tier id tier (fast/standard/pro/…)
 * @param {number} duration durasi detik
 * @param {string} resolution resolusi (720p/1080p/4k)
 * @returns {number} jumlah kredit
 */
export function estimateVideoCredits(modelId, tier, duration, resolution) {
  const row = VIDEO_CREDITS[String(modelId || '')];
  if (!row) return 0;
  const sec = Math.max(1, Math.round(Number(duration) || 5));
  const res = String(resolution || '').toLowerCase();

  if (row.perVideo) {
    const tierRow = row.perVideo[String(tier || '')] || Object.values(row.perVideo)[0];
    if (!tierRow) return 0;
    const value = tierRow[res] ?? Object.values(tierRow)[0];
    return roundUp(value);
  }

  if (row.perSecond) {
    const tierRow = row.perSecond[String(tier || '')] || Object.values(row.perSecond)[0];
    if (!tierRow) return 0;
    const value = tierRow[res] ?? Object.values(tierRow)[0];
    if (!Number.isFinite(value)) return 0;
    return roundUp(value * sec);
  }
  return 0;
}

/**
 * Estimasi kredit untuk satu generate LIPSYNC (mode "Karakter Bicara").
 * @param {string} modelId id model Kie
 * @param {number} duration durasi detik
 * @param {string} resolution resolusi
 */
export function estimateLipsyncCredits(modelId, duration, resolution) {
  const row = LIPSYNC_CREDITS[String(modelId || '')];
  if (row == null) return 0;
  const sec = Math.max(1, Math.round(Number(duration) || 5));
  if (typeof row === 'number') return roundUp(row * sec);
  const res = String(resolution || '');
  const value = row[res] ?? row[res.toLowerCase()] ?? Object.values(row)[0];
  return roundUp(Number(value || 0) * sec);
}

/**
 * Saldo kredit Kie AI (live) — endpoint resmi: GET /api/v1/chat/credit.
 * Balas 401 kalau kunci salah/tidak ada.
 * @returns {Promise<{ ok: boolean, credits: number|null, error?: string }>}
 */
export async function fetchKieCredits(apiKey, base = 'https://api.kie.ai') {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return { ok: false, credits: null, error: 'Kunci Kie AI belum tersedia.' };
  }
  try {
    const res = await fetch(String(base).replace(/\/+$/, '') + '/api/v1/chat/credit', {
      headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.code != null && Number(data.code) !== 200)) {
      return { ok: false, credits: null, error: data?.msg || `kie.ai error (${res.status})` };
    }
    const credits = typeof data?.data === 'number' ? data.data : null;
    return { ok: true, credits };
  } catch (error) {
    return {
      ok: false,
      credits: null,
      error: error.name === 'TimeoutError' ? 'Timeout saat cek kredit.' : error.message,
    };
  }
}
