// ===== D-196: Studio multi-karakter (@mention) + keberlanjutan adegan =====
//
// Studio ala Google Flow: prompt bisa menyebut karakter dengan "@nama".
// Setiap karakter yang disebut membawa dua master foto miliknya sendiri:
//   1. Potret (reference_image_path) — foto utama wajah karakter.
//   2. Master sheet (board_path) — sheet referensi 3 panel (ganti/opsional).
// Ditambah satu gambar referensi adegan (frame akhir adegan sebelumnya atau
// referensi lokasi) untuk menjaga kontinuitas.
//
// Semua aset di-resolve di server dari Storage milik user — client hanya
// mengirim mention (nama/slug) dan gambar referensi adegan, bukan data karakter.

/** Batas keras sesuai keputusan user: maksimal 3 karakter per adegan. */
export const MAX_MENTION_CHARACTERS = 3;
/** Batas gambar referensi per request (potret+sheet 2 karakter pertama, sisanya potret, + 1 frame adegan). */
export const MAX_REFERENCE_IMAGES = 7;
/** Batas ukuran satu gambar inline (base64) — sama seperti D-98. */
const MAX_IMAGE_CHARS = 3_500_000;

/** Normalisasi nama karakter -> slug yang aman untuk pencocokan "@nama". */
export function slugifyName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Parse "@nama" di dalam prompt.
 * Mengembalikan daftar unik { token, name } sesuai urutan kemunculan.
 * Token yang dipakai di prompt: "@sherly" (tanpa spasi).
 */
export function parseMentions(prompt, characters) {
  const text = String(prompt || '');
  if (!text.includes('@') || !Array.isArray(characters) || !characters.length) return [];
  const bySlug = new Map();
  for (const c of characters) {
    const slug = slugifyName(c?.name);
    if (!slug) continue;
    bySlug.set(slug, c);
  }
  const out = [];
  const seen = new Set();
  const re = /@([a-z0-9][a-z0-9_-]{0,59})/gi;
  let m;
  while ((m = re.exec(text))) {
    const slug = String(m[1] || '').toLowerCase();
    const char = bySlug.get(slug);
    if (!char || seen.has(char.id)) continue;
    seen.add(char.id);
    out.push({ token: '@' + slug, name: char.name, id: char.id });
    if (out.length >= MAX_MENTION_CHARACTERS) break;
  }
  return out;
}

/** Ambil profil suara karakter dalam bentuk ringkas untuk prompt. */
export function voiceDescriptor(char) {
  const v = char?.voice;
  if (!v || typeof v !== 'object') return '';
  const name = String(v.name || '').trim();
  const style = String(v.style || '').trim();
  if (!name && !style) return '';
  if (name && style) return `Suara: voice Gemini "${name}", gaya bicara: ${style}`;
  if (name) return `Suara: voice Gemini "${name}"`;
  return `Gaya bicara: ${style}`;
}

/**
 * Susun blok prompt untuk karakter yang disebut.
 * Menandai gambar mana yang potret dan mana yang master sheet supaya model
 * tahu peran tiap referensi (penting untuk konsistensi wajah & sheet).
 */
export function buildCharacterPromptBlock(mentions, characters) {
  if (!mentions.length) return '';
  const lines = [`## Karakter yang muncul (maks ${MAX_MENTION_CHARACTERS})`];
  const byId = new Map(characters.map((c) => [c.id, c]));
  mentions.forEach((m, idx) => {
    const c = byId.get(m.id);
    if (!c) return;
    const assets = [];
    if (c.reference_image_path) assets.push('potret');
    if (c.board_path) assets.push('master sheet');
    const label = assets.length ? assets.join(' + ') : 'tanpa gambar referensi';
    lines.push(`### ${c.name} — ${label}`);
    lines.push(String(c.identity_prompt || '').trim());
    const voice = voiceDescriptor(c);
    if (voice) lines.push(voice);
    if (c.board_path) {
      lines.push(`Gambar ${idx + 1}: master sheet referensi untuk ${c.name} (wajah, warna rambut, pakaian, aksesori). Ikuti master sheet ini.`);
    }
    if (c.reference_image_path) {
      lines.push(`Gambar ${idx + 1}: foto potret resmi ${c.name}. Wajah dan identitas visual WAJIB konsisten dengan potret ini.`);
    }
  });
  return lines.join('\n');
}

/**
 * Muat gambar dari Storage milik user.
 * Return { mime, data } base64, atau null bila file tidak ada/gagal.
 */
export async function loadStoredImage(supabase, bucketName, path) {
  if (!path) return null;
  try {
    const { data: blob, error } = await supabase.storage.from(bucketName).download(path);
    if (error || !blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    if (!buf.length) return null;
    const mime = /\.jpe?g$/i.test(path) ? 'image/jpeg'
      : /\.webp$/i.test(path) ? 'image/webp'
      : /\.gif$/i.test(path) ? 'image/gif'
      : 'image/png';
    return { mime, data: buf.toString('base64') };
  } catch { return null; }
}

/**
 * Resolve mention -> daftar gambar referensi + label prompt.
 * Karakter 1 & 2 membawa potret + master sheet; karakter ke-3 hanya potret
 * supaya total gambar tidak melebihi batas model.
 */
export async function resolveCharacterReferences(supabase, bucketName, characters, mentions) {
  const images = [];
  const labels = [];
  const byId = new Map(characters.map((c) => [c.id, c]));
  for (const m of mentions) {
    const c = byId.get(m.id);
    if (!c) continue;
    const withSheet = images.length + 2 <= MAX_REFERENCE_IMAGES - 1;
    const portrait = await loadStoredImage(supabase, bucketName, c.reference_image_path);
    if (portrait) { images.push(portrait); labels.push({ name: c.name, kind: 'potret' }); }
    if (withSheet && c.board_path) {
      const board = await loadStoredImage(supabase, bucketName, c.board_path);
      if (board) { images.push(board); labels.push({ name: c.name, kind: 'master sheet' }); }
    }
    if (images.length >= MAX_REFERENCE_IMAGES - 1) break;
  }
  return { images, labels };
}

/** Sanitasi gambar referensi adegan yang dikirim client (frame akhir / referensi lokasi). */
export function sanitizeInlineImage(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.data !== 'string' || value.data.length < 8) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.mime)) return null;
  if (value.data.length > MAX_IMAGE_CHARS) return null;
  return { mime: value.mime, data: value.data };
}
