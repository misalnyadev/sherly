// ===== D-242: Katalog model LIPSYNC / talking avatar =====
//
// Satu sumber kebenaran untuk model "Karakter Bicara": potret + audio ->
// video karakter bicara (lip-sync).
//
// Model yang tersedia lewat Kie AI (Kie.ai/infinitalk, Nov 2026):
//   InfiniteTalk (MeiGen-AI) — image-to-talking-video, prompt-guided lip sync.
//     - image_url   : potret (wajib), JPEG/PNG/WEBP, maks 10 MB
//     - audio_url   : audio (wajib), MPEG/WAV/X-WAV/AAC/MP4/OGG, maks 10 MB,
//                     durasi audio <= 15 detik
//     - prompt      : panduan framing/ekspresi (wajib), maks 5.000 karakter
//     - resolution  : 480p | 720p (default 480p)
//     - seed        : 10000..1000000 (opsional)
//     - nsfw_checker: default true
//   Harga: 3 credit/dtk (480p) ~ $0.015/dtk; 12 credit/dtk (720p) ~ $0.06/dtk.
//
// Referensi model lain di Kie (untuk backlog, belum diimplementasikan):
//   bytedance/omni-human  — digital human full-body
//   kwaivgi/kling-lip-sync — lip sync berbasis teks
//   zsxkib/multitalk      — percakapan multi-orang

/** Batas keras InfiniteTalk (dari docs Kie). */
export const LIPSYNC_MAX_SECONDS = 15;
export const LIPSYNC_MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Model lipsync yang tersedia.
 * id        : id model di Kie (dipakai sebagai `model` pada createTask)
 * schema    : skema payload Kie
 * label     : nama yang tampil di UI
 * maker     : pembuat model
 * resolutions: resolusi yang didukung
 * aspects   : rasio aspek yang didukung
 * note      : keterangan singkat untuk UI
 */
export const LIPSYNC_MODELS = [
  {
    id: 'infinitalk/from-audio',
    provider: 'kie',
    schema: 'infinitalk',
    label: 'InfiniteTalk',
    maker: 'MeiGen-AI',
    resolutions: ['480p', '720p'],
    aspects: ['16:9', '9:16', '1:1'],
    maxSeconds: LIPSYNC_MAX_SECONDS,
    note: 'MeiGen-AI InfiniteTalk — potret + audio jadi karakter bicara (lip-sync akurat).',
    defaultResolution: '720p',
    defaultAspect: '9:16',
  },
];

/** Model lipsync default. */
export const DEFAULT_LIPSYNC_MODEL = 'infinitalk/from-audio';

/** Cari model lipsync by id. */
export function findLipsyncModel(id) {
  return LIPSYNC_MODELS.find((m) => m.id === String(id || '')) || null;
}

/**
 * Normalisasi parameter lipsync terhadap kapabilitas model.
 * Return { ok:true, model, resolution, aspect } atau { ok:false, error }.
 */
export function normalizeLipsyncParams({ model, resolution, aspect } = {}) {
  const m = findLipsyncModel(model) || findLipsyncModel(DEFAULT_LIPSYNC_MODEL);
  if (!m) return { ok: false, error: 'Model lipsync tidak dikenal.' };
  const res = String(resolution || m.defaultResolution).toLowerCase();
  if (!m.resolutions.includes(res)) {
    return { ok: false, error: 'Resolusi ' + res + ' tidak tersedia untuk ' + m.label + '. Pilihan: ' + m.resolutions.join(', ') + '.' };
  }
  const asp = String(aspect || m.defaultAspect);
  if (!m.aspects.includes(asp)) {
    return { ok: false, error: 'Rasio aspek ' + asp + ' tidak tersedia untuk ' + m.label + '.' };
  }
  return { ok: true, model: m, resolution: res, aspect: asp };
}

/**
 * Susun `input` request Kie untuk InfiniteTalk.
 * imageUrl : URL publik potret karakter
 * audioUrl : URL publik audio (TTS / rekaman)
 */
export function buildLipsyncInput(schema, params, imageUrl, audioUrl) {
  const { prompt, resolution, aspect, seed } = params;
  const input = {
    prompt: String(prompt || '').slice(0, 5000),
    resolution,
  };
  if (imageUrl) input.image_url = imageUrl;
  if (audioUrl) input.audio_url = audioUrl;
  if (Number.isInteger(seed) && seed >= 10000 && seed <= 1000000) input.seed = seed;
  return input;
}

/** Katalog ringkas untuk dikirim ke frontend. */
export function lipsyncCatalog() {
  return {
    defaultModel: DEFAULT_LIPSYNC_MODEL,
    maxSeconds: LIPSYNC_MAX_SECONDS,
    models: LIPSYNC_MODELS.map((m) => ({
      id: m.id,
      provider: m.provider,
      label: m.label,
      maker: m.maker,
      resolutions: m.resolutions,
      aspects: m.aspects,
      maxSeconds: m.maxSeconds,
      note: m.note,
      defaultResolution: m.defaultResolution,
      defaultAspect: m.defaultAspect,
    })),
  };
}
