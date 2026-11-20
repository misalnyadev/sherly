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

  const rawCat = String(input.category ?? 'umum').trim().toLowerCase();
  const category = CATEGORY_KEYS.includes(rawCat) ? rawCat : 'umum';

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
    value: { kind, label, category, content, slots, sort_order: sortOrder, is_active: isActive },
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
export async function listPromptEntries(supabase, userId) {
  const { data, error } = await supabase
    .from('prompt_bank')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
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
  for (const kind of PROMPT_KINDS) {
    for (const item of SEED_PROMPT_BANK[kind] || []) {
      const norm = normalizePromptEntry({ ...item, kind });
      if (!norm.ok) continue;
      rows.push({ user_id: userId, ...norm.value, sort_order: order++ });
    }
  }
  if (!rows.length) return 0;
  const { error: insErr } = await supabase.from('prompt_bank').insert(rows);
  if (insErr) throw Object.assign(new Error(insErr.message), { status: 500 });
  return rows.length;
}
