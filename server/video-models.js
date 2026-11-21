// ===== D-200: Katalog model video (provider + model + durasi) =====
//
// Satu sumber kebenaran untuk model video yang tersedia lewat Kie AI.
// Setiap model punya provider, gaya parameter (schema request), daftar durasi
// yang valid, resolusi, rasio aspek, dan fitur (audio, first/last frame).
//
// Frontend menerima katalog ini lewat GET /api/ai/video/models sehingga pilihan
// provider/model/durasi di UI selalu sinkron dengan yang benar-benar didukung.
//
// Referensi (Kie AI docs, 2026):
//   Veo 3.1    — docs.kie.ai/veo3-api  (durasi 4/6/8, 16:9 & 9:16, 720p/1080p/4k)
//   Kling 3.0  — model "kling-3.0/video" (durasi 3-15, mode std/pro/4K, sound)
//   Seedance 2 — model "bytedance/seedance-2" (durasi 4-15, 480p..4k, 21:9)

/** Semua durasi yang mungkin (dipakai untuk rentang). */
const range = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

/**
 * Katalog model video.
 * schema menentukan bentuk request ke Kie (input field mana yang dipakai).
 */
export const VIDEO_MODELS = [
  {
    id: 'veo-3-1',
    provider: 'kie',
    label: 'Veo 3.1',
    maker: 'Google',
    schema: 'veo',
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    aspects: ['16:9', '9:16'],
    audio: true,
    firstLastFrame: true,
    note: 'Google Veo 3.1 — kualitas tinggi + audio native. Tier: fast/lite/quality.',
    tiers: [
      { id: 'veo3_fast', label: 'Fast (hemat)' },
      { id: 'veo3_lite', label: 'Lite (tercepat)' },
      { id: 'veo3', label: 'Quality (premium)' },
    ],
    defaultTier: 'veo3_fast',
    defaultDuration: 8,
    defaultResolution: '720p',
    defaultAspect: '9:16',
  },
  {
    id: 'kling-3.0/video',
    provider: 'kie',
    label: 'Kling 3.0',
    maker: 'Kuaishou',
    schema: 'kling',
    durations: range(3, 15),
    resolutions: ['720p', '1080p'],
    aspects: ['16:9', '9:16', '1:1'],
    audio: true,
    firstLastFrame: true,
    note: 'Kling 3.0 — storytelling multi-shot, durasi panjang sampai 15 detik.',
    tiers: [
      { id: 'std', label: 'Standar' },
      { id: 'pro', label: 'Pro' },
      { id: '4K', label: '4K' },
    ],
    defaultTier: 'std',
    defaultDuration: 5,
    defaultResolution: '720p',
    defaultAspect: '9:16',
  },
  {
    id: 'bytedance/seedance-2',
    provider: 'kie',
    label: 'Seedance 2.0',
    maker: 'ByteDance',
    schema: 'seedance',
    durations: range(4, 15),
    resolutions: ['480p', '720p', '1080p', '4k'],
    aspects: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    audio: true,
    firstLastFrame: true,
    note: 'Seedance 2.0 — paling konsisten & paling banyak rasio aspek.',
    tiers: [{ id: 'standard', label: 'Standard' }, { id: 'fast', label: 'Fast' }],
    defaultTier: 'standard',
    defaultDuration: 8,
    defaultResolution: '1080p',
    defaultAspect: '9:16',
    altModel: 'bytedance/seedance-2-fast',
  },
  {
    // D-239: Google Gemini Omni 1.2 Flash — video 15 detik + audio native,
    // multi-turn editing, reference consistency (Kie AI docs, Nov 2026).
    id: 'google/gemini-omni-flash-1-2',
    provider: 'kie',
    label: 'Omni 1.2 Flash',
    maker: 'Google',
    schema: 'omni',
    durations: range(3, 15),
    resolutions: ['360p', '720p', '1080p', '4k'],
    aspects: ['16:9', '9:16', 'auto'],
    audio: true,
    firstLastFrame: true,
    note: 'Google Gemini Omni 1.2 Flash — 15 detik, audio native, referensi karakter paling konsisten.',
    tiers: [{ id: 'standard', label: 'Standard' }],
    defaultTier: 'standard',
    defaultDuration: 8,
    defaultResolution: '720p',
    defaultAspect: '9:16',
    // Kie: first_frame_url + last_frame_url TIDAK boleh digabung dengan image_urls.
    firstLastFrameExclusive: true,
    maxReferences: 6,
  },
  {
    id: 'bytedance/seedance-2-fast',
    provider: 'kie',
    label: 'Seedance 2.0 Fast',
    maker: 'ByteDance',
    schema: 'seedance',
    durations: range(4, 15),
    resolutions: ['480p', '720p'],
    aspects: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    audio: true,
    firstLastFrame: true,
    note: 'Seedance 2.0 Fast — hanya sampai 720p tapi generates lebih cepat.',
    tiers: [{ id: 'fast', label: 'Fast' }],
    defaultTier: 'fast',
    defaultDuration: 8,
    defaultResolution: '720p',
    defaultAspect: '9:16',
  },
];

/** Model default Studio (Veo 3.1 tier fast). */
export const DEFAULT_VIDEO_MODEL = 'veo-3-1';

/** Cari model by id. */
export function findVideoModel(id) {
  return VIDEO_MODELS.find((m) => m.id === String(id || '')) || null;
}

/**
 * Validasi & normalisasi parameter video terhadap model.
 * Return { ok, error, model, tier, duration, resolution, aspect, audio }.
 */
export function normalizeVideoParams({ model, tier, duration, resolution, aspect, audio } = {}) {
  const m = findVideoModel(model);
  if (!m) return { ok: false, error: 'Model video tidak dikenal.' };
  const tierId = tier ? String(tier) : m.defaultTier;
  const validTiers = (m.tiers || []).map((t) => t.id);
  if (!validTiers.includes(tierId)) {
    return { ok: false, error: 'Tier model tidak tersedia untuk ' + m.label + '.' };
  }
  const dur = Number.isFinite(Number(duration)) ? Number(duration) : m.durations[m.durations.length - 1];
  const durOk = m.durations.includes(dur);
  if (!durOk) {
    return {
      ok: false,
      error: 'Durasi ' + dur + ' detik tidak tersedia untuk ' + m.label
        + ' (pilihan: ' + m.durations.join(', ') + ' detik).',
    };
  }
  const res = String(resolution || m.resolutions[0]);
  if (!m.resolutions.includes(res)) {
    return { ok: false, error: 'Resolusi ' + res + ' tidak tersedia untuk ' + m.label + '.' };
  }
  const asp = String(aspect || m.aspects[0]);
  if (!m.aspects.includes(asp)) {
    return { ok: false, error: 'Rasio aspek ' + asp + ' tidak tersedia untuk ' + m.label + '.' };
  }
  return {
    ok: true,
    model: m,
    tier: tierId,
    duration: dur,
    resolution: res,
    aspect: asp,
    audio: audio === undefined ? true : Boolean(audio),
  };
}

/**
 * Susun `input` request Kie sesuai schema model.
 * images: array URL publik (referensi karakter + frame adegan).
 */
export function buildVideoInput(schema, params, images) {
  const { prompt, tier, duration, resolution, aspect, audio } = params;
  const urls = Array.isArray(images) ? images.filter(Boolean) : [];
  if (schema === 'veo') {
    const input = {
      prompt,
      model: tier,
      aspect_ratio: aspect,
      duration,
      resolution,
      enable_translation: true,
    };
    if (urls.length) {
      input.image_urls = urls.slice(0, 3);
      input.generation_type = 'FIRST_AND_LAST_FRAMES_2_VIDEO';
    } else {
      input.generation_type = 'TEXT_2_VIDEO';
    }
    return input;
  }
  if (schema === 'kling') {
    const input = {
      prompt,
      duration: String(duration),
      aspect_ratio: aspect,
      mode: tier === '4K' ? '4K' : tier,
      sound: Boolean(audio),
      multi_shots: false,
    };
    if (urls.length) input.image_urls = urls.slice(0, 3);
    return input;
  }
  if (schema === 'omni') {
    // D-239: Google Gemini Omni 1.2 Flash (Kie).
    // Field: prompt, duration (3-15), resolution, aspect_ratio, image_urls (s/d 6),
    // first_frame_url + last_frame_url (TIDAK boleh digabung dengan image_urls).
    const input = {
      prompt,
      duration,
      resolution,
      aspect_ratio: aspect,
    };
    if (urls.length) {
      // Referensi karakter/aset -> image_urls (maks 6).
      input.image_urls = urls.slice(0, 6);
    }
    return input;
  }
  if (schema === 'seedance') {
    const input = {
      prompt,
      resolution,
      aspect_ratio: aspect,
      duration,
      generate_audio: Boolean(audio),
      web_search: false,
      nsfw_checker: true,
    };
    if (urls.length) {
      // Seedance: first_frame_url = frame awal adegan, sisanya reference.
      input.first_frame_url = urls[0];
      const rest = urls.slice(1);
      if (rest.length) input.reference_image_urls = rest;
    }
    return input;
  }
  return { prompt, duration, aspect_ratio: aspect, resolution };
}

/** Katalog ringkas untuk dikirim ke frontend. */
export function videoCatalog() {
  return {
    defaultModel: DEFAULT_VIDEO_MODEL,
    models: VIDEO_MODELS.map((m) => ({
      id: m.id,
      provider: m.provider,
      label: m.label,
      maker: m.maker,
      durations: m.durations,
      resolutions: m.resolutions,
      aspects: m.aspects,
      audio: m.audio,
      firstLastFrame: m.firstLastFrame,
      firstLastFrameExclusive: !!m.firstLastFrameExclusive,
      maxReferences: m.maxReferences || 3,
      note: m.note,
      tiers: m.tiers,
      defaultTier: m.defaultTier,
      defaultDuration: m.defaultDuration,
      defaultResolution: m.defaultResolution,
      defaultAspect: m.defaultAspect,
    })),
  };
}
