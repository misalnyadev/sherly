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
//   OmniHuman 1.5 (ByteDance) — digital human full-body, emotion-aware:
//     - image_url   : potret (wajib), JPEG/PNG/WEBP, maks 10 MB
//     - audio_url   : audio (wajib), maks 10 MB, durasi < 60 detik (rekomendasi <=15 dtk)
//     - prompt      : maks 300 karakter, bahasa: CN/EN/JP/KR/ES-MX/ID
//     - output_resolution : 720P | 1080P (default 1080P)
//     - mask_url    : opsional, hasil subject-detection (siapa yang bicara)
//     - pe_fast_mode: boolean, mode cepat (sedikit downgrade kualitas)
//     - seed        : default -1 (random)
//   Harga: 27 credit/dtk (~$0.135).
//
//   OmniHuman 2.0 (ByteDance) — digital human full-body + multi-person:
//     - image_urls  : array 1 elemen (wajib), JPEG/PNG/WEBP/BMP/TIFF/GIF, maks 30 MB
//     - audio_url   : audio (wajib), MPEG/WAV/X-WAV, maks 15 MB, durasi 4-300 detik
//     - prompt      : maks 300 karakter, "Character Tendency", bahasa sama s/d 1.5
//     - enable_watermark : boolean (default true)
//   Harga: 14 credit/dtk (~$0.07). Output 720p, durasi mengikuti audio.
//
// Referensi model lain (untuk backlog, belum diimplementasikan):
//   kwaivgi/kling-lip-sync — lip sync berbasis teks (tidak ada di Kie)
//   zsxkib/multitalk      — percakapan multi-orang (tidak ada di Kie)

// D-274: tarif kredit Kie per model lipsync (dipakai frontend untuk badge kredit).
import { LIPSYNC_CREDITS } from './kie-credits.js';

/** Batas keras InfiniteTalk (dari docs Kie). */
export const LIPSYNC_MAX_SECONDS = 15;
export const LIPSYNC_MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** Batas keras LTX 2.5 Fast A2V (durasi mengikuti audio, maks 20 detik). */
export const LIPSYNC_MAX_SECONDS_LTX = 20;
/** Batas keras OmniHuman 1.5 (audio < 60 detik; <= 15 detik paling stabil). */
export const LIPSYNC_MAX_SECONDS_OH15 = 60;
/** Batas keras OmniHuman 2.0 (durasi audio 4-300 detik = 5 menit). */
export const LIPSYNC_MAX_SECONDS_OH20 = 300;

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
    promptMax: 5000,
    minSeconds: 1,
  },
  {
    id: 'ltx/2-5-fast-audio-to-video',
    provider: 'kie',
    schema: 'ltx25a2v',
    label: 'LTX 2.5 Fast A2V',
    maker: 'Lightricks',
    resolutions: ['720p', '1080p', '1440p'],
    aspects: ['16:9', '9:16', '1:1', '3:2', '2:3'],
    maxSeconds: LIPSYNC_MAX_SECONDS_LTX,
    note: 'Lightricks LTX 2.5 Fast — durasi mengikuti audio (s/d 20 dtk), sampai 1440p.',
    defaultResolution: '1080p',
    defaultAspect: '9:16',
    promptMax: 5000,
    minSeconds: 1,
  },
  {
    id: 'omnihuman-1-5',
    provider: 'kie',
    schema: 'omnihuman15',
    label: 'OmniHuman 1.5',
    maker: 'ByteDance',
    resolutions: ['720P', '1080P'],
    aspects: ['16:9', '9:16', '1:1', '4:5', '3:4'],
    maxSeconds: LIPSYNC_MAX_SECONDS_OH15,
    note: 'ByteDance OmniHuman 1.5 — digital human full-body, ekspresi & gestur ikut emosi, sampai 1080p.',
    defaultResolution: '1080P',
    defaultAspect: '9:16',
    // D-246: prompt Kie dibatasi 300 karakter.
    promptMax: 300,
    minSeconds: 1,
  },
  {
    id: 'omnihuman-2-0',
    provider: 'kie',
    schema: 'omnihuman20',
    label: 'OmniHuman 2.0',
    maker: 'ByteDance',
    resolutions: ['720p'],
    aspects: ['16:9', '9:16', '1:1', '4:5', '3:4'],
    maxSeconds: LIPSYNC_MAX_SECONDS_OH20,
    note: 'ByteDance OmniHuman 2.0 — digital human + multi-person, durasi s/d 5 menit.',
    defaultResolution: '720p',
    defaultAspect: '9:16',
    // D-246: prompt Kie dibatasi 300 karakter & audio minimal 4 detik.
    promptMax: 300,
    minSeconds: 4,
  },
];

/** Model lipsync default. */
export const DEFAULT_LIPSYNC_MODEL = 'infinitalk/from-audio';

/**
 * D-245: provider yang bisa dipakai untuk lipsync.
 * Saat ini semua model lipsync ada di Kie AI (satu kunci, satu billing).
 */
export const LIPSYNC_PROVIDERS = [
  { id: 'kie', label: 'Kie AI', note: 'Semua model lipsync via satu kunci Kie' },
];

/** Cari model lipsync by id. */
export function findLipsyncModel(id) {
  return LIPSYNC_MODELS.find((m) => m.id === String(id || '')) || null;
}

/**
 * Normalisasi parameter lipsync terhadap kapabilitas model.
 * Return { ok:true, model, resolution, aspect } atau { ok:false, error }.
 */
export function normalizeLipsyncParams({ model, resolution, aspect, fps, duration } = {}) {
  const m = findLipsyncModel(model) || findLipsyncModel(DEFAULT_LIPSYNC_MODEL);
  if (!m) return { ok: false, error: 'Model lipsync tidak dikenal.' };
  // D-246: OmniHuman 1.5 memakai format "720P"/"1080P" (huruf besar).
  const rawRes = String(resolution || m.defaultResolution);
  const res = m.resolutions.some((r) => r === rawRes.toUpperCase())
    ? rawRes.toUpperCase() : rawRes.toLowerCase();
  if (!m.resolutions.includes(res)) {
    return { ok: false, error: 'Resolusi ' + res + ' tidak tersedia untuk ' + m.label + '. Pilihan: ' + m.resolutions.join(', ') + '.' };
  }
  const asp = String(aspect || m.defaultAspect);
  if (!m.aspects.includes(asp)) {
    return { ok: false, error: 'Rasio aspek ' + asp + ' tidak tersedia untuk ' + m.label + '.' };
  }
  const out = { ok: true, model: m, resolution: res, aspect: asp };
  // D-245: LTX 2.5 A2V punya fps & durasi opsional.
  if (m.schema === 'ltx25a2v') {
    if ([24, 25, 48, 50].includes(Number(fps))) out.fps = Number(fps);
    const dur = Number(duration);
    if (Number.isFinite(dur) && dur >= 2 && dur <= m.maxSeconds) out.duration = Math.round(dur);
  }
  return out;
}

/**
 * Susun `input` request Kie untuk InfiniteTalk.
 * imageUrl : URL publik potret karakter
 * audioUrl : URL publik audio (TTS / rekaman)
 */
export function buildLipsyncInput(schema, params, imageUrl, audioUrl) {
  const { prompt, resolution, aspect, seed, fps, duration } = params;
  const input = {
    prompt: String(prompt || '').slice(0, 5000),
    resolution,
  };
  if (imageUrl) input.image_url = imageUrl;
  if (audioUrl) input.audio_url = audioUrl;
  // D-245: seed punya rentang berbeda per model.
  //  InfiniteTalk : 10000..1000000
  //  LTX 2.5 A2V : 0..2147483647
  // D-246: OmniHuman 1.5 memakai seed acak (default -1) — tidak ada rentang
  //  numerik yang didokumentasikan, jadi seed tidak dikirim untuk model ini.
  if (Number.isInteger(seed)) {
    if (schema === 'ltx25a2v') {
      if (seed >= 0 && seed <= 2147483647) input.seed = seed;
    } else if (schema !== 'omnihuman15' && schema !== 'omnihuman20'
      && seed >= 10000 && seed <= 1000000) {
      input.seed = seed;
    }
  }
  // D-245: LTX 2.5 A2V punya parameter tambahan (fps & duration).
  if (schema === 'ltx25a2v') {
    if ([24, 25, 48, 50].includes(Number(fps))) input.fps = Number(fps);
    if (Number.isFinite(Number(duration)) && Number(duration) >= 2 && Number(duration) <= 20) {
      input.duration = Number(duration);
    }
    // Rasio aspek hanya relevan bila TIDAK ada gambar (output mengikuti gambar).
    if (!imageUrl && aspect) input.aspect_ratio = aspect;
  }
  // D-246: OmniHuman 1.5 — digital human full-body.
  //  - image_url : potret (satu)
  //  - output_resolution : 720P | 1080P (bukan "resolution")
  //  - prompt    : maks 300 karakter
  //  - pe_fast_mode : mode cepat (opsional)
  //  - mask_url : hasil subject-detection (opsional)
  if (schema === 'omnihuman15') {
    delete input.resolution;
    // Format Kie: huruf besar (720P / 1080P).
    const oh15Res = String(resolution || '').toUpperCase();
    input.output_resolution = oh15Res === '1080P' ? '1080P' : '720P';
    input.prompt = String(input.prompt || '').slice(0, 300);
    if (params.peFastMode) input.pe_fast_mode = true;
    if (params.maskUrl) input.mask_url = params.maskUrl;
    // Output mengikuti rasio gambar — aspect_ratio TIDAK dikirim.
    delete input.aspect_ratio;
  }
  // D-246: OmniHuman 2.0 — digital human + multi-person.
  //  - image_urls : ARRAY 1 elemen (bukan image_url)
  //  - prompt     : maks 300 karakter
  //  - enable_watermark : opsional
  if (schema === 'omnihuman20') {
    if (imageUrl) input.image_urls = [imageUrl];
    delete input.image_url;
    delete input.resolution;
    input.prompt = String(input.prompt || '').slice(0, 300);
    if (params.enableWatermark === false) input.enable_watermark = false;
    delete input.aspect_ratio;
  }
  return input;
}

/** Katalog ringkas untuk dikirim ke frontend. */
export function lipsyncCatalog() {
  return {
    defaultModel: DEFAULT_LIPSYNC_MODEL,
    maxSeconds: LIPSYNC_MAX_SECONDS,
    providers: LIPSYNC_PROVIDERS,
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
      // D-245: info tambahan untuk UI (pilihan model & setelan).
      fps: m.schema === 'ltx25a2v' ? [24, 25, 48, 50] : null,
      supportsDuration: m.schema === 'ltx25a2v',
      // Rasio aspek hanya bisa dipilih kalau TIDAK ada gambar (LTX).
      aspectFromImage: m.schema === 'ltx25a2v',
      // D-246: info untuk OmniHuman (prompt dibatasi 300 karakter).
      promptMax: m.promptMax || 5000,
      // Digital human full-body + gestur tubuh (bukan cuma wajah).
      fullBody: m.schema === 'omnihuman15' || m.schema === 'omnihuman20',
      // Batas durasi audio minimum (OmniHuman 2.0 butuh >= 4 detik).
      minSeconds: m.minSeconds || 1,
      // D-274: tarif kredit Kie per detik (untuk badge kredit di composer).
      credits: LIPSYNC_CREDITS[m.id] || null,
    })),
  };
}
