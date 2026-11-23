/**
 * D-203: Katalog model gambar (image models).
 *
 * Sumber kebenaran untuk pemilihan model gambar di Studio — provider Kie AI
 * (Nano Banana / GPT Image / Seedream / FLUX) plus Gemini sebagai opsi non-Kie.
 * Setiap model punya metadata maker, resolusi, rasio aspek, jumlah referensi
 * yang didukung, dan skema request Kie-nya.
 *
 * Pola ini mengikuti `video-models.js` (D-200) supaya frontend bisa menghitung
 * pilihan secara dinamis dari katalog yang sama.
 */

// D-274: tarif kredit Kie per model gambar (dipakai frontend untuk badge kredit).
import { IMAGE_CREDITS } from './kie-credits.js';

/** Resolusi umum (Kie memakai 1K/2K/4K). */
export const IMAGE_RESOLUTIONS = ['1K', '2K', '4K'];

/** Rasio aspek yang dipakai Studio untuk foto. */
export const IMAGE_ASPECTS = ['1:1', '4:5', '9:16', '16:9'];

/**
 * Model gambar.
 *  id            : id model di Kie (dipakai sebagai `model` pada createTask)
 *  provider      : kie | gemini | custom
 *  schema        : skema payload Kie (nano-banana | gpt-image | seedream | flux | gemini)
 *  maker         : pembuat model
 *  label         : nama yang tampil di UI
 *  resolutions   : resolusi yang didukung
 *  aspects       : rasio aspek yang didukung
 *  maxReferences : jumlah gambar referensi/multi-reference yang diterima
 *  note          : keterangan singkat untuk UI
 */
export const IMAGE_MODELS = [
  {
    id: 'nano-banana-2',
    provider: 'kie',
    schema: 'nano-banana',
    maker: 'Google',
    label: 'Nano Banana 2',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '3:2', '4:3', '2:3', '5:4', '21:9', '2:1', '1:2'],
    maxReferences: 10,
    note: 'Google Nano Banana 2 — cepat, konsisten karakter, teks rapi, sampai 4K.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
  {
    id: 'nano-banana-pro',
    provider: 'kie',
    schema: 'nano-banana',
    maker: 'Google',
    label: 'Nano Banana Pro',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '5:4', '21:9'],
    maxReferences: 8,
    note: 'Google Nano Banana Pro — kualitas premium, konsistensi wajah paling kuat.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
  {
    id: 'gpt-image-2-text-to-image',
    provider: 'kie',
    schema: 'gpt-image',
    maker: 'OpenAI',
    label: 'GPT Image 2',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '5:4', '3:2', '2:3', '21:9'],
    maxReferences: 16,
    note: 'OpenAI GPT Image 2 — terbaik untuk teks di dalam gambar & photorealism.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
  {
    id: 'bytedance/seedream-v5.0-lite',
    provider: 'kie',
    schema: 'seedream',
    maker: 'ByteDance',
    label: 'Seedream 5.0 Lite',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '21:9'],
    maxReferences: 10,
    note: 'ByteDance Seedream 5.0 Lite — cepat & murah untuk produksi harian.',
    defaultResolution: '1K',
    defaultAspect: '4:5',
  },
  {
    id: 'bytedance/seedream-5.0-pro',
    provider: 'kie',
    schema: 'seedream',
    maker: 'ByteDance',
    label: 'Seedream 5.0 Pro',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '21:9'],
    maxReferences: 10,
    note: 'ByteDance Seedream 5.0 Pro — detail tajam, multi-reference, layout desain.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
  {
    // D-241: ByteDance Seedream 5.5 — edit chain 100 putaran, background
    // TRANSPARAN native, teks kecil padat (Kie, Nov 2026).
    id: 'bytedance/seedream-5-5',
    provider: 'kie',
    schema: 'seedream55',
    maker: 'ByteDance',
    label: 'Seedream 5.5',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '21:9'],
    maxReferences: 10,
    note: 'ByteDance Seedream 5.5 — background transparan, edit chain panjang, teks kecil rapi.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
  {
    // D-241: OpenAI GPT Image 2.6 — layout/poster terbaik, output SVG & GIF,
    // quality low→max, background transparan (Kie, Nov 2026).
    id: 'gpt-image-2-6/flare-text-to-image',
    provider: 'kie',
    schema: 'gpt-image-26',
    maker: 'OpenAI',
    label: 'GPT Image 2.6',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9', '2:11', '1:2'],
    maxReferences: 16,
    note: 'OpenAI GPT Image 2.6 — poster & layout paling rapi, bisa SVG/GIF & transparan.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
  {
    id: 'flux-2-pro-text-to-image',
    provider: 'kie',
    schema: 'flux',
    maker: 'Black Forest Labs',
    label: 'FLUX 2 Pro',
    resolutions: ['1K', '2K', '4K'],
    aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '21:9'],
    maxReferences: 4,
    note: 'FLUX 2 Pro — komposisi tegas & tipografi tajam.',
    defaultResolution: '2K',
    defaultAspect: '4:5',
  },
];

/** Model gambar default Studio (Nano Banana 2). */
export const DEFAULT_IMAGE_MODEL = 'nano-banana-2';

/** Cari model gambar by id. */
export function findImageModel(id) {
  return IMAGE_MODELS.find((m) => m.id === String(id || '')) || null;
}

/**
 * Normalisasi parameter gambar terhadap kapabilitas model terpilih.
 * Return { ok:true, model, resolution, aspect, quality } atau { ok:false, error }.
 */
export function normalizeImageParams(params = {}) {
  const rawModel = params.model;
  const m = findImageModel(rawModel);
  if (!m) {
    return { ok: false, error: 'Model gambar "' + String(rawModel || '') + '" tidak dikenal. Pilih model yang tersedia di daftar.' };
  }
  const resolution = String(params.resolution || '').toUpperCase();
  if (resolution && !m.resolutions.includes(resolution)) {
    return { ok: false, error: 'Resolusi ' + resolution + ' tidak tersedia untuk ' + m.label + '. Pilihan: ' + m.resolutions.join(', ') + '.' };
  }
  const aspect = String(params.aspect || '');
  if (aspect && !m.aspects.includes(aspect)) {
    return { ok: false, error: 'Rasio aspek ' + aspect + ' tidak tersedia untuk ' + m.label + '.' };
  }
  return {
    ok: true,
    model: m,
    resolution: resolution || m.defaultResolution,
    aspect: aspect || m.defaultAspect,
    quality: params.quality ? String(params.quality) : 'medium',
  };
}

/**
 * Bangun payload `input` untuk Kie createTask sesuai skema model.
 * urls = array URL gambar referensi (sudah diupload ke Kie).
 */
export function buildImageInput(schema, params = {}, urls = []) {
  const prompt = String(params.prompt || '').slice(0, 20000);
  const aspect = params.aspect || '1:1';
  const resolution = params.resolution || '1K';
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];

  if (schema === 'nano-banana') {
    return {
      prompt,
      aspect_ratio: aspect,
      resolution,
      output_format: 'png',
      ...(list.length ? { image_input: list.slice(0, 10) } : {}),
    };
  }
  if (schema === 'gpt-image') {
    return {
      prompt,
      aspect_ratio: aspect,
      resolution,
      background: 'opaque',
      nsfw_checker: false,
      ...(list.length ? { input_urls: list.slice(0, 16) } : {}),
    };
  }
  if (schema === 'seedream') {
    return {
      prompt,
      aspect_ratio: aspect,
      resolution,
      output_format: 'png',
      ...(list.length ? { image_input: list.slice(0, 10) } : {}),
    };
  }
  if (schema === 'seedream55') {
    // D-241: ByteDance Seedream 5.5 (Kie).
    // Field: prompt, aspect_ratio, resolution, sequential_image_generation,
    //   sequential_image_generation_mode (auto/multi), output_format (png),
    //   image_input (s/d 10 referensi).
    return {
      prompt,
      aspect_ratio: aspect,
      resolution,
      output_format: 'png',
      ...(list.length ? { image_input: list.slice(0, 10) } : {}),
    };
  }
  if (schema === 'gpt-image-26') {
    // D-241: OpenAI GPT Image 2.6 (Kie).
    // Field: prompt, aspect_ratio, resolution, quality (low..max), background
    //   (transparent/opaque/auto), output_format (png/jpeg/webp/gif/svg),
    //   input_urls (s/d 16), mask_url.
    return {
      prompt,
      aspect_ratio: aspect,
      resolution,
      quality: 'medium',
      background: 'opaque',
      output_format: 'png',
      ...(list.length ? { input_urls: list.slice(0, 16) } : {}),
    };
  }
  if (schema === 'flux') {
    return {
      prompt,
      aspect_ratio: aspect,
      resolution,
      output_format: 'png',
      enable_translation: true,
      ...(list.length ? { image_input: list.slice(0, 4) } : {}),
    };
  }
  return { prompt, aspect_ratio: aspect, resolution };
}

/** Katalog ringkas untuk dikirim ke frontend. */
export function imageCatalog() {
  return {
    defaultModel: DEFAULT_IMAGE_MODEL,
    models: IMAGE_MODELS.map((m) => ({
      id: m.id,
      provider: m.provider,
      label: m.label,
      maker: m.maker,
      resolutions: m.resolutions,
      aspects: m.aspects,
      maxReferences: m.maxReferences,
      note: m.note,
      defaultResolution: m.defaultResolution,
      defaultAspect: m.defaultAspect,
      // D-274: estimasi kredit Kie per resolusi (angka saja, tanpa USD).
      credits: IMAGE_CREDITS[m.id] || null,
    })),
  };
}
