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
    // D-241: ByteDance Seedance 2.5 — video sampai 30 DETIK, native 4K,
    // s/d 30 referensi multimodal, ada mode `draft` (preview 480p murah).
    id: 'bytedance/seedance-2-5',
    provider: 'kie',
    label: 'Seedance 2.5',
    maker: 'ByteDance',
    schema: 'seedance25',
    durations: range(4, 30),
    resolutions: ['480p', '720p', '1080p', '4k'],
    aspects: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
    audio: true,
    firstLastFrame: true,
    note: 'ByteDance Seedance 2.5 — sampai 30 detik, native 4K, 30 referensi multimodal.',
    tiers: [
      { id: 'standard', label: 'Standard' },
      { id: 'draft', label: 'Draft (preview 480p)' },
    ],
    defaultTier: 'standard',
    defaultDuration: 10,
    defaultResolution: '1080p',
    defaultAspect: '9:16',
    maxReferences: 30,
  },
  {
    // D-241: Alibaba Wan 3.0 — 2-30 detik, multimodal (gambar + video + audio
    // + dokumen/PDF + webpage), paling hemat kelas atas ($0.08/dtk @720p).
    id: 'wan/3-0-video',
    provider: 'kie',
    label: 'Wan 3.0',
    maker: 'Alibaba',
    schema: 'wan3',
    durations: range(2, 30),
    resolutions: ['480p', '720p', '1080p'],
    aspects: ['16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive'],
    audio: true,
    firstLastFrame: true,
    note: 'Alibaba Wan 3.0 — 2-30 detik, multimodal (dokumen/webpage/audio), paling hemat.',
    tiers: [{ id: 'standard', label: 'Standard' }],
    defaultTier: 'standard',
    defaultDuration: 10,
    defaultResolution: '720p',
    defaultAspect: '9:16',
    maxReferences: 10,
  },
  {
    // D-241: Kuaishou Kling 4.0 — 30 detik, 4K HDR, stereo audio,
    // s/d 15 referensi (gambar/video/voice/subject).
    id: 'kling-4-0/reference-to-video',
    provider: 'kie',
    label: 'Kling 4.0',
    maker: 'Kuaishou',
    schema: 'kling4',
    durations: range(3, 30),
    resolutions: ['720p', '1080p', '4k'],
    aspects: ['auto', '16:9', '9:16', '1:1', '21:9', '4:3', '3:4'],
    audio: true,
    firstLastFrame: true,
    note: 'Kuaishou Kling 4.0 — 30 detik, 4K HDR, stereo audio, 15 referensi.',
    tiers: [
      { id: 'std', label: 'Standar' },
      { id: 'pro', label: 'Pro' },
      { id: '4K', label: '4K' },
      { id: 'hdr', label: '4K + HDR' },
    ],
    defaultTier: 'std',
    defaultDuration: 10,
    defaultResolution: '1080p',
    defaultAspect: '9:16',
    maxReferences: 15,
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
  if (schema === 'seedance25') {
    // D-241: ByteDance Seedance 2.5 (Kie).
    // Field: prompt, duration (4-30), resolution, aspect_ratio, generate_audio,
    //   reference_image_urls (s/d 30), first_frame_url + last_frame_url,
    //   omni_reference_task_type (auto/reference/edit/extend), draft (preview 480p).
    // `draft: true` -> preview 480p murah (task id valid 7 hari) buat iterasi.
    const input = {
      prompt,
      duration,
      resolution,
      aspect_ratio: aspect,
      generate_audio: Boolean(audio),
      nsfw_checker: true,
    };
    if (urls.length) {
      // S/d 30 referensi (potret karakter + master sheet + frame adegan).
      input.reference_image_urls = urls.slice(0, 30);
    }
    if (tier === 'draft') {
      // Mode draft Kie: hanya 480p, buat preview murah sebelum render final.
      input.draft = true;
      input.resolution = '480p';
    }
    return input;
  }
  if (schema === 'wan3') {
    // D-241: Alibaba Wan 3.0 (Kie).
    // Field: prompt (s/d 20.000 karakter, CN+EN), duration (2-30), resolution,
    //   aspect_ratio (termasuk 'adaptive'), audio (bool), seed, nsfw_checker,
    //   reference_image_urls (s/d 10), first_frame_url/last_frame_url.
    const input = {
      prompt,
      duration,
      resolution,
      aspect_ratio: aspect,
      audio: Boolean(audio),
      nsfw_checker: true,
    };
    if (urls.length) input.reference_image_urls = urls.slice(0, 10);
    return input;
  }
  if (schema === 'kling4') {
    // D-241: Kuaishou Kling 4.0 (Kie) — reference-to-video.
    // Field: prompt (s/d 8.000), duration (3-30), resolution, aspect_ratio,
    //   image_urls (s/d 10), video_urls (s/d 5), keep_original_sound.
    const input = {
      prompt,
      duration,
      resolution,
      aspect_ratio: aspect,
    };
    if (urls.length) input.image_urls = urls.slice(0, 10);
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
      longForm: !!m.durations.find((d) => d > 15),
      note: m.note,
      tiers: m.tiers,
      defaultTier: m.defaultTier,
      defaultDuration: m.defaultDuration,
      defaultResolution: m.defaultResolution,
      defaultAspect: m.defaultAspect,
    })),
  };
}
