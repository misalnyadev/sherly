// ===== D-207: Bank Prompt (Hybrid: template utuh + blok modular) =====
//
// Dua jenis entri di tabel public.prompt_bank:
//   kind = 'template' -> satu prompt lengkap siap pakai (mis. "Try Outfit", "Drone View")
//   kind = 'block'    -> satu blok susunan prompt (cahaya / kamera / tekstur / color / ...)
//                        yang dipilih user lalu ditumpuk sendiri di komposer.
//
// Modul ini hanya berisi aturan murni (validasi + normalisasi) supaya bisa
// diuji tanpa server/DB. Lapisan DB ada di server/app.js.

/** Jenis entri yang sah. */
export const PROMPT_KINDS = ['template', 'block'];

/**
 * Mode konten yang cocok untuk sebuah prompt.
 * D-208: prompt dipisah per jenis konten supaya tidak salah pilih —
 * mode 'foto' hanya muncul di Studio saat jenis konten Foto,
 * mode 'video' hanya muncul saat jenis konten Video.
 */
export const PROMPT_MODES = ['foto', 'video'];

/** Kelompok entri (untuk pengelompokan di UI & seed). */
export const PROMPT_GROUPS = ['umum', 'style', 'fotovideo', 'produk', 'flow'];

/**
 * Kategori blok. Urutan array = urutan susunan prompt saat dirakit komposer.
 * Ini urutan hasil riset: subjek/aksi dulu, baru cahaya, kamera, gaya, tekstur,
 * color, lalu negative prompt di paling akhir.
 */
export const PROMPT_CATEGORIES = [
  { key: 'kamera', label: 'Kamera & Angle' },
  { key: 'cahaya', label: 'Cahaya & Mood' },
  { key: 'gaya', label: 'Gaya Visual' },
  { key: 'tekstur', label: 'Tekstur & Detail' },
  { key: 'color', label: 'Color & Tone' },
  { key: 'kualitas', label: 'Kualitas & Realisme' },
  { key: 'negative', label: 'Negative Prompt' },
  { key: 'umum', label: 'Umum' },
];

/** Label kategori yang dikenal (untuk normalisasi). */
const CATEGORY_KEYS = PROMPT_CATEGORIES.map((c) => c.key);

/**
 * Normalisasi data entri bank prompt.
 * Mengembalikan { ok, value } atau { ok: false, error }.
 */
export function normalizePromptEntry(input = {}) {
  const label = String(input.label ?? '').trim();
  if (!label) return { ok: false, error: 'Label prompt wajib diisi.' };
  if (label.length > 80) return { ok: false, error: 'Label prompt maksimal 80 karakter.' };

  const kind = PROMPT_KINDS.includes(input.kind) ? input.kind : 'block';
  const content = String(input.content ?? '').trim();
  if (!content) return { ok: false, error: 'Isi prompt wajib diisi.' };
  if (content.length > 2000) return { ok: false, error: 'Isi prompt maksimal 2000 karakter.' };

  // D-208: mode (foto|video) & group (umum|style|fotovideo|produk|flow).
  const rawMode = String(input.mode ?? 'foto').trim().toLowerCase();
  const mode = PROMPT_MODES.includes(rawMode) ? rawMode : 'foto';
  const rawGroup = String(input.group ?? 'umum').trim().toLowerCase();
  const group = PROMPT_GROUPS.includes(rawGroup) ? rawGroup : 'umum';

  // D-210: group 'flow' (cheat code Google Flow) memakai kategori bebas
  // (mis. "UGC & Creator Style"), bukan kategori blok tetap.
  const rawCat = String(input.category ?? 'umum').trim();
  let category;
  if (group === 'flow') {
    category = rawCat.slice(0, 60) || 'umum';
  } else {
    const catKey = rawCat.toLowerCase();
    category = CATEGORY_KEYS.includes(catKey) ? catKey : 'umum';
  }

  // Slots: placeholder yang harus diisi user (mis. "outfit" untuk "try outfit { outfit }").
  let slots = [];
  if (Array.isArray(input.slots)) {
    slots = input.slots.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean).slice(0, 10);
  } else if (typeof input.slots === 'string' && input.slots.trim()) {
    slots = input.slots.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  }

  // Slot yang tidak disebut eksplisit tetap terdeteksi dari placeholder { ... }.
  const detected = [...content.matchAll(/\{([a-z0-9_ -]{1,40})\}/gi)].map((m) => m[1].trim().toLowerCase());
  for (const d of detected) if (!slots.includes(d)) slots.push(d);
  slots = slots.slice(0, 10);

  const sortOrder = Number.isFinite(Number(input.sort_order)) ? Math.trunc(Number(input.sort_order)) : 0;
  const isActive = input.is_active === undefined ? true : Boolean(input.is_active);

  return {
    ok: true,
    value: { kind, label, category, content, slots, sort_order: sortOrder, is_active: isActive, mode, group },
  };
}

/**
 * Susun blok-blok terpilih menjadi satu prompt rapi.
 * Urutan = urutan PROMPT_CATEGORIES (cahaya sebelum kamera? tidak — lihat catatan).
 *
 * Urutan susun mengikuti urutan fokal hasil riset:
 *   1. camera  (sudut pandang & lensa — menentukan "dari mana kita melihat")
 *   2. cahaya  (sumber & arah cahaya — penentu utama realisme)
 *   3. gaya    (medium/look visual)
 *   4. tekstur (detail mikro & ketidaksempurnaan)
 *   5. color   (grading & palet)
 *   6. kualitas(penanda realism & resolusi)
 *   7. negative (penjaga, selalu di akhir)
 *
 * @param {Array<{category:string, content:string, label?:string}>} blocks
 * @param {string} base prompt utama (isi komposer user)
 * @returns {string} prompt akhir
 */
export function composePrompt(blocks = [], base = '') {
  const byCat = new Map();
  for (const b of blocks) {
    const cat = CATEGORY_KEYS.includes(b?.category) ? b.category : 'umum';
    const text = String(b?.content ?? '').trim();
    if (!text) continue;
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(text);
  }

  const parts = [];
  const baseText = String(base ?? '').trim();
  if (baseText) parts.push(baseText);

  for (const { key } of PROMPT_CATEGORIES) {
    const list = byCat.get(key);
    if (list && list.length) parts.push(list.join(' '));
  }

  // Blok berkategori "umum" tetap ikut, ditaruh setelah kategori known.
  const umum = byCat.get('umum');
  if (umum && umum.length) parts.push(umum.join(' '));

  return parts.join('\n\n');
}

/**
 * Isi placeholder pada sebuah template.
 * Placeholder yang tidak diisi disisipkan sebagai penanda jelas supaya user
 * tahu masih ada yang harus diganti.
 *
 * @param {string} template
 * @param {Record<string,string>} values
 * @returns {{text:string, missing:string[]}}
 */
export function fillTemplate(template, values = {}) {
  const src = String(template ?? '');
  const missing = [];
  const text = src.replace(/\{([a-z0-9_ -]{1,40})\}/gi, (_m, key) => {
    const k = key.trim().toLowerCase();
    const v = String(values?.[k] ?? '').trim();
    if (!v) { missing.push(k); return `[${k}]`; }
    return v;
  });
  return { text, missing };
}

/**
 * ===== D-208: Optimasi susunan prompt =====
 *
 * Mengubah prompt bebas menjadi prompt berstruktur yang maximizes hasil:
 *   subjek/aksi -> kamera -> cahaya -> gaya -> tekstur -> color -> kualitas -> negative
 *
 * Aturan: frasa yang sudah ada tidak diduplikasi (anti-duplikat), blok kosong
 * dilewati, dan setiap kategori hanya mengambil frasa paling relevan.
 */

/** Petunjuk kategori untuk setiap kata kunci (dipakai auto-deteksi). */
const KEYWORD_HINTS = [
  { cat: 'negative', words: ['no text', 'no cartoon', 'no watermark', 'no logo', 'no cgi', 'no plastic', 'no illustration', 'tanpa teks', 'avoid ', 'without '] },
  // Cahaya dicek SEBELUM kamera: 'golden hour sunlight' bukan Terms kamera meski ada kata 'shot'.
  { cat: 'cahaya', words: ['golden hour', 'sunlight', 'softbox', 'rim light', 'rimlight', 'backlight', 'moonlight', 'daylight', 'overcast', 'volumetric', 'soft window light', 'studio lighting', 'natural light', 'soft light', 'hard light', 'lighting', 'light', 'shadow', 'shadows', 'neon', 'flash', 'bounce light', 'key light'] },
  { cat: 'kamera', words: ['shot', 'angle', 'lens', 'mm ', 'mm,', 'dof', 'depth of field', 'bokeh', 'view', 'camera', 'framing', 'close-up', 'close up', 'wide angle', 'wide shot', 'aerial', 'drone', "bird's eye", 'macro', 'portrait', 'composition', 'vlog', 'pov', 'top-down', 'top down', 'overhead', 'dutch', "worm's eye", 'low angle', 'high angle', 'three-quarter', 'eye level', 'full body', 'medium shot'] },
  { cat: 'tekstur', words: ['texture', 'porous', 'pores', 'skin texture', 'fabric', 'grain', 'wrinkle', 'material', 'imperfection', 'rough', 'dust', 'micro-detail', 'fine detail'] },
  { cat: 'color', words: ['color', 'colour', 'tone', 'tones', 'grading', 'palette', 'warm', 'cool', 'muted', 'saturated', 'vibrant', 'monochrome', 'neutral tones', 'teal', 'amber'] },
  { cat: 'kualitas', words: ['photorealistic', 'hyperrealistic', 'ultra-realistic', '8k', '4k', 'uhd', 'highly detailed', 'hyper-detailed', 'cinematic realism', 'dslr', 'ultra detailed'] },
  { cat: 'gaya', words: ['style', 'editorial', 'documentary', 'commercial', 'cinematic', 'vintage', 'minimalist', 'luxury', 'aesthetic', 'photography look'] },
];

/** Kata kunci negativ (bukan substring bebas) — pola kata utuh. */
const NEGATIVE_MARKERS = ['no ', 'without ', 'tanpa ', 'avoid '];

/**
 * Deteksi kategori sebuah frasa.
 * @param {string} phrase
 * @returns {string} key kategori
 */
export function detectCategory(phrase) {
  const p = String(phrase || '').toLowerCase().trim();
  if (!p) return 'umum';
  for (const m of NEGATIVE_MARKERS) if (p.startsWith(m)) return 'negative';
  for (const h of KEYWORD_HINTS) {
    for (const w of h.words) if (p.includes(w)) return h.cat;
  }
  return 'umum';
}

/**
 * Pisahkan prompt bebas menjadi frasa-frasa yang bisa dikelompokkan.
 * Menghormati tanda baca sebagai batas frasa.
 * @param {string} text
 * @returns {string[]}
 */
export function splitPhrases(text) {
  return String(text || '')
    .split(/(?<=[.,;!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '').trim())
    .filter((s) => s.length > 2);
}

/**
 * Optimalkan prompt: kelompokkan per kategori lalu susun ulang berurutan fokus.
 *
 * @param {string} raw prompt bebas dari komposer
 * @param {Array<{category?:string, content?:string}>} blocks blok yang sudah dipilih user
 * @returns {{prompt:string, parts:Object<string,string[]>, moved:number}}
 */
export function optimizePrompt(raw, blocks = []) {
  const collected = new Map();
  const add = (cat, text) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (!collected.has(cat)) collected.set(cat, []);
    const list = collected.get(cat);
    // Anti-duplikat: frasa yang sama (case-insensitive) tidak diulang.
    if (!list.some((x) => x.toLowerCase() === t.toLowerCase())) list.push(t);
  };

  // 1) Prompt utama = subjek/aksi (bagian pertama, sebelum kategori lain terdeteksi).
  const phrases = splitPhrases(raw);
  const subjectParts = [];
  const rest = [];
  let seenTechnical = false;
  for (const p of phrases) {
    const cat = detectCategory(p);
    if (cat === 'umum' && !seenTechnical) { subjectParts.push(p); continue; }
    seenTechnical = true;
    if (cat === 'umum') { rest.push(p); continue; }
    add(cat, p);
  }

  // 2) Blok yang sudah dipilih user (kategori eksplisit) ikut masuk.
  for (const b of blocks) {
    const cat = CATEGORY_KEYS.includes(b?.category) ? b.category : 'umum';
    if (cat === 'negative') add('negative', b.content);
    else add(cat, b.content);
  }

  const parts = {};
  parts.subject = subjectParts;
  for (const { key } of PROMPT_CATEGORIES) {
    const list = collected.get(key);
    if (list && list.length) parts[key] = list;
  }

  const order = ['subject', 'kamera', 'cahaya', 'gaya', 'tekstur', 'color', 'kualitas', 'negative'];
  const out = [];
  for (const key of order) {
    const list = parts[key];
    if (list && list.length) out.push(list.join(', '));
  }
  return { prompt: out.join('\n\n'), parts, moved: rest.length };
}

/**
 * Daftar placeholder yang ada di sebuah teks.
 * @returns {string[]}
 */
export function extractSlots(text) {
  return [...String(text ?? '').matchAll(/\{([a-z0-9_ -]{1,40})\}/gi)]
    .map((m) => m[1].trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Bank prompt bawaan (seed) hasil riset prompt fotorealistis.
 * Dipakai server untuk mengisi bank prompt user baru saat pertama kali,
 * dan dipakai juga sebagai fallback di frontend saat endpoint gagal.
 */
// D-208: seed tambahan — gaya foto (dari gaya lama) + 159 kode video dari PDF.
import { SEED_FOTO_STYLES, SEED_CODES_FOTOVIDEO, SEED_CODES_PRODUK, SEED_CODES_FLOW } from './prompt-seed.js';

export const SEED_PROMPT_BANK = {
  template: [
    {
      label: 'Try Outfit',
      category: 'umum',
      content:
        'full-body shot, eye-level camera angle, camera at the subject\'s height in front of her, looking straight at her. { outfit } on the model, natural relaxed pose, soft diffused daylight from a large window camera-left, subtle fill from camera-right, shallow depth of field, sharp focus on the eyes, visible fabric weave and natural skin texture with subtle pores, neutral natural color grading, photorealistic, hyper-detailed, subtle film grain, 8K.',
      slots: ['outfit'],
    },
    {
      label: 'Drone View',
      category: 'kamera',
      content:
        'aerial drone shot, camera high above looking straight down, wide angle 24mm lens look, bird\'s-eye view, deep focus across the whole scene, golden hour sunlight casting long soft shadows, natural color grading, photorealistic, hyper-detailed, 8K.',
      slots: [],
    },
    {
      label: 'Candid Street Style',
      category: 'umum',
      content:
        'candid street style photograph, 35mm documentary lens look, eye-level camera angle, shallow background blur, overcast natural daylight with soft even illumination, realistic shadows, muted natural tones, natural skin imperfections, subtle film grain, documentary realism, photorealistic, 8K.',
      slots: [],
    },
    {
      label: 'Studio Product Beauty',
      category: 'umum',
      content:
        'professional product photograph, 50mm lens look, front 45-degree angle, f/4 product photography look, clean low ISO studio quality, softbox lighting at 45 degrees camera-left with restrained fill, realistic contact shadow under the product, sharp focus on product edges, controlled reflections, dark matte surface with faint reflection, premium commercial photography, 8K.',
      slots: [],
    },
    {
      label: 'Golden Hour Portrait',
      category: 'umum',
      content:
        'portrait photograph, 85mm lens look, eye-level camera angle, shallow depth of field f/1.8, warm golden hour sunlight from camera-left, soft-edged shadows on the opposite side, natural catchlights in the eyes, visible skin pores and fine hair detail, warm highlights and cool-neutral shadows, gentle film grain, photorealistic, hyper-detailed, 8K.',
      slots: [],
    },
    {
      label: 'Low Angle Hero',
      category: 'kamera',
      content:
        'low-angle shot, camera near ground level in front of the subject, looking upward, hero framing, full-body shot, dramatic rim light separating the subject from a darker background, deep contrast, natural skin texture, cinematic color grading, photorealistic, 8K.',
      slots: [],
    },
    {
      label: 'Over The Shoulder',
      category: 'kamera',
      content:
        'over-the-shoulder shot, camera positioned behind one subject at shoulder height, looking toward what they are looking at, medium shot, natural window light from camera-left, realistic shadows, shallow depth of field, cinematic realism, photorealistic, 8K.',
      slots: [],
    },
    {
      label: 'Worm\'s Eye View',
      category: 'kamera',
      content:
        'extreme worm\'s-eye view, camera at ground level near the subject\'s feet, looking sharply upward, subject towering overhead against the sky, strong perspective distortion, dramatic backlight, photorealistic, hyper-detailed, 8K.',
      slots: [],
    },
    {
      label: 'Flat Lay Product',
      category: 'kamera',
      content:
        'top-down flat lay shot, camera directly overhead, 50mm lens look, even soft daylight, sharp focus on texture detail, clean minimal surface with negative space, realistic material texture and soft shadows, bright natural color grading, photorealistic, 8K.',
      slots: [],
    },
    {
      label: 'Cinematic Moody',
      category: 'gaya',
      content:
        'cinematic film still, 35mm anamorphic lens look, medium shot, low-key side lighting with deep shadows, volumetric light haze, muted teal and amber color palette, shallow depth of field, anamorphic bokeh, subtle film grain, dramatic atmosphere, photorealistic, 8K.',
      slots: [],
    },
  ],
  block: [
    {
      label: 'Drone View',
      category: 'kamera',
      content: 'aerial drone shot, camera high above looking straight down, bird\'s-eye view, wide angle 24mm lens look, deep focus',
      slots: [],
    },
    {
      label: 'Worm\'s Eye',
      category: 'kamera',
      content: 'worm\'s-eye view, camera at ground level looking sharply upward, extreme low angle',
      slots: [],
    },
    {
      label: 'Low Angle',
      category: 'kamera',
      content: 'low-angle shot, camera below the subject looking upward, hero framing',
      slots: [],
    },
    {
      label: 'High Angle',
      category: 'kamera',
      content: 'high-angle shot, camera above the subject looking downward',
      slots: [],
    },
    {
      label: 'Eye Level',
      category: 'kamera',
      content: 'eye-level shot, camera at the subject\'s height, straight-on view',
      slots: [],
    },
    {
      label: 'Dutch Angle',
      category: 'kamera',
      content: 'Dutch angle, camera noticeably tilted clockwise, diagonal horizon line',
      slots: [],
    },
    {
      label: 'Three Quarter',
      category: 'kamera',
      content: 'three-quarter view, camera turned 45 degrees, the most flattering angle',
      slots: [],
    },
    {
      label: 'Over The Shoulder',
      category: 'kamera',
      content: 'over-the-shoulder shot, camera behind one subject looking toward their view',
      slots: [],
    },
    {
      label: 'First Person POV',
      category: 'kamera',
      content: 'first-person POV, camera at eye level as if through the viewer\'s own eyes',
      slots: [],
    },
    {
      label: 'Close Up',
      category: 'kamera',
      content: 'close-up framing, sharp focus on the eyes, very shallow depth of field f/1.4',
      slots: [],
    },
    {
      label: 'Medium Shot',
      category: 'kamera',
      content: 'medium shot, camera framing the subject from the waist up',
      slots: [],
    },
    {
      label: 'Full Body',
      category: 'kamera',
      content: 'full-body shot, camera framing the subject head to toe',
      slots: [],
    },
    {
      label: '85mm Portrait',
      category: 'kamera',
      content: '85mm portrait lens look, shallow depth of field, natural bokeh',
      slots: [],
    },
    {
      label: '35mm Documentary',
      category: 'kamera',
      content: '35mm documentary lens look, candid composition, subtle background blur',
      slots: [],
    },
    {
      label: 'Macro',
      category: 'kamera',
      content: 'macro lens look, extreme close-up detail, razor-thin focus plane',
      slots: [],
    },
    {
      label: 'Golden Hour',
      category: 'cahaya',
      content: 'warm golden hour sunlight from camera-left, soft long shadows on the opposite side, natural falloff into a darker background',
      slots: [],
    },
    {
      label: 'Soft Window Light',
      category: 'cahaya',
      content: 'soft natural window light from camera-left, broad diffused source with soft-edged shadows, restrained fill from camera-right',
      slots: [],
    },
    {
      label: 'Studio Softbox',
      category: 'cahaya',
      content: 'studio softbox lighting, one large diffused key light 45 degrees camera-left, subtle fill, clean natural shadows',
      slots: [],
    },
    {
      label: 'Rembrandt',
      category: 'cahaya',
      content: 'Rembrandt lighting, soft key from camera-left and slightly above, natural shadow under the far cheek, defined but soft shadow on the background side',
      slots: [],
    },
    {
      label: 'Rim Light',
      category: 'cahaya',
      content: 'narrow rim light along one edge separating the subject from the background, controlled skin highlights',
      slots: [],
    },
    {
      label: 'Overcast',
      category: 'cahaya',
      content: 'overcast natural daylight, soft even shadowless illumination, flat street photography look',
      slots: [],
    },
    {
      label: 'Volumetric',
      category: 'cahaya',
      content: 'volumetric light haze, visible light beams through the air, dramatic atmospheric depth',
      slots: [],
    },
    {
      label: 'Editorial Fashion',
      category: 'gaya',
      content: 'high-fashion editorial photography, deliberate styling, clean studio backdrop, magazine composition',
      slots: [],
    },
    {
      label: 'Documentary',
      category: 'gaya',
      content: 'authentic documentary-style photography, unstaged natural moment, candid realism',
      slots: [],
    },
    {
      label: 'Cinematic',
      category: 'gaya',
      content: 'cinematic film still, anamorphic look, deliberate color grading, dramatic atmosphere',
      slots: [],
    },
    {
      label: 'Commercial Clean',
      category: 'gaya',
      content: 'clean commercial product photography, controlled reflections, premium advertising look',
      slots: [],
    },
    {
      label: 'Visible Skin Pores',
      category: 'tekstur',
      content: 'visible skin pores and fine natural skin texture, subtle peach fuzz, no plastic smoothing',
      slots: [],
    },
    {
      label: 'Fabric Weave',
      category: 'tekstur',
      content: 'detailed fabric weave and textile grain, realistic stitching and seams',
      slots: [],
    },
    {
      label: 'Natural Imperfections',
      category: 'tekstur',
      content: 'natural imperfections, faint scratches and dust, realistic material response',
      slots: [],
    },
    {
      label: 'Muted Tones',
      category: 'color',
      content: 'muted natural tones, restrained color palette, neutral white balance',
      slots: [],
    },
    {
      label: 'Warm Highlights',
      category: 'color',
      content: 'warm highlights and cool-neutral shadows, gentle filmic color grade',
      slots: [],
    },
    {
      label: 'Teal & Amber',
      category: 'color',
      content: 'teal and amber color palette, cinematic contrast between shadows and highlights',
      slots: [],
    },
    {
      label: 'Monochrome',
      category: 'color',
      content: 'monochrome black and white, deep tonal range, fine grain structure',
      slots: [],
    },
    {
      label: 'Photorealistic',
      category: 'kualitas',
      content: 'photorealistic, ultra-realistic, true-to-life textures, sharp focus, 8K UHD, high dynamic range',
      slots: [],
    },
    {
      label: 'Film Grain',
      category: 'kualitas',
      content: 'subtle film grain, fine sensor noise, natural analog texture',
      slots: [],
    },
    {
      label: 'No Cartoon',
      category: 'negative',
      content: 'no cartoon, no illustration, no CGI, no 3D render, no plastic skin, no waxy skin, no over-smoothed face, no AI-art aesthetic',
      slots: [],
    },
    {
      label: 'No Text',
      category: 'negative',
      content: 'no text, no watermark, no logo, no distorted hands, no extra fingers, no distorted facial features',
      slots: [],
    },
    {
      label: 'No Over Processing',
      category: 'negative',
      content: 'no oversaturated colors, no over-filtered colors, no excessive HDR, no harsh artificial shadows',
      slots: [],
    },
  ],
};

// ===== Lapisan DB =====
// Dipakai dari server/app.js. Semua operasi dibatasi user_id pemilik.

/**
 * Daftar entri bank prompt milik user.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function listPromptEntries(supabase, userId, opts = {}) {
  let q = supabase
    .from('prompt_bank')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  // D-208: filter per mode (foto|video) supaya tidak salah pilih prompt.
  if (opts.mode && PROMPT_MODES.includes(opts.mode)) q = q.eq('mode', opts.mode);
  const { data, error } = await q;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data || [];
}

/**
 * Simpan entri baru (atau seed bank kosong).
 * @returns {Promise<object>}
 */
export async function createPromptEntry(supabase, userId, input) {
  const norm = normalizePromptEntry(input);
  if (!norm.ok) throw Object.assign(new Error(norm.error), { status: 400 });
  const row = { user_id: userId, ...norm.value };
  const { data, error } = await supabase.from('prompt_bank').insert(row).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

/**
 * Perbarui entri yang ada.
 * @returns {Promise<object>}
 */
export async function updatePromptEntry(supabase, userId, id, input) {
  const norm = normalizePromptEntry(input);
  if (!norm.ok) throw Object.assign(new Error(norm.error), { status: 400 });
  const { data, error } = await supabase
    .from('prompt_bank')
    .update({ ...norm.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error('Entri prompt tidak ditemukan.'), { status: 404 });
  return data;
}

/**
 * Hapus entri.
 * @returns {Promise<{ok:boolean}>}
 */
export async function deletePromptEntry(supabase, userId, id) {
  const { data, error } = await supabase
    .from('prompt_bank')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error('Entri prompt tidak ditemukan.'), { status: 404 });
  return { ok: true };
}

/**
 * Seed bank prompt bawaan bila user belum punya entri sama sekali.
 * Aman dipanggil berkali-kali.
 * @returns {Promise<number>} jumlah entri yang dibuat
 */
export async function seedPromptBank(supabase, userId) {
  const { count, error } = await supabase
    .from('prompt_bank')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if ((count || 0) > 0) return 0;

  const rows = [];
  let order = 0;
  // D-207: template & blok dasar (mode foto).
  for (const kind of PROMPT_KINDS) {
    for (const item of SEED_PROMPT_BANK[kind] || []) {
      const norm = normalizePromptEntry({ ...item, kind, mode: 'foto', group: 'umum' });
      if (!norm.ok) continue;
      rows.push({ user_id: userId, ...norm.value, sort_order: order++ });
    }
  }
  // D-208: gaya lama jadi template transparan (mode foto).
  for (const item of SEED_FOTO_STYLES) {
    const norm = normalizePromptEntry({ ...item, kind: 'template', mode: 'foto', group: 'style' });
    if (!norm.ok) continue;
    rows.push({ user_id: userId, ...norm.value, sort_order: order++ });
  }
  // D-208: 159 kode video dari PDF (mode video).
  for (const [group, list] of [['fotovideo', SEED_CODES_FOTOVIDEO], ['produk', SEED_CODES_PRODUK]]) {
    for (const item of list) {
      const norm = normalizePromptEntry({ ...item, kind: 'template', mode: 'video', group });
      if (!norm.ok) continue;
      rows.push({ user_id: userId, ...norm.value, sort_order: order++ });
    }
  }
  // D-210: 200 cheat code Google Flow (produk foto -> video), mode video.
  for (const item of SEED_CODES_FLOW) {
    const norm = normalizePromptEntry({ ...item, kind: 'template', mode: 'video', group: 'flow' });
    if (!norm.ok) continue;
    rows.push({ user_id: userId, ...norm.value, sort_order: order++ });
  }
  if (!rows.length) return 0;
  const { error: insErr } = await supabase.from('prompt_bank').insert(rows);
  if (insErr) throw Object.assign(new Error(insErr.message), { status: 500 });
  return rows.length;
}
