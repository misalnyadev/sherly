// ===== Karakter Wizard v2 — traits terstruktur, analisis foto (vision), master board =====
// Adopsi pola AK Talent (docs/referensi-aktalent.md) di atas arsitektur SherlyStudio
// (server-side proxy + Supabase). Dipakai server untuk:
//  - sanitizeTraits: whitelist + pembersihan traits dari klien/model
//  - visionTraitsPrompt + parseVisionTraits: instruksi & parsing hasil analisis foto
//  - boardPrompt: prompt master board (sheet referensi 3 panel) dari master identity prompt
// Kompilasi "kunci identitas" versi klien (preview live) ada di public/character-wizard.js.

export const TRAIT_FIELDS = [
  'faceShape', 'skin', 'eyes', 'eyeDetail', 'eyebrows', 'nose', 'lips', 'lipDetail',
  'hair', 'hairDetail', 'hijab', 'bodyType', 'mark', 'outfit', 'style', 'accessories', 'skinTexture',
];

export const TRAIT_LABELS = {
  faceShape: 'Bentuk wajah', skin: 'Warna kulit', eyes: 'Mata', eyeDetail: 'Detail mata',
  eyebrows: 'Alis', nose: 'Hidung', lips: 'Bibir', lipDetail: 'Detail bibir',
  hair: 'Rambut', hairDetail: 'Detail rambut', hijab: 'Hijab', bodyType: 'Bentuk tubuh',
  mark: 'Ciri khas', outfit: 'Outfit / estetika fesyen', style: 'Gaya',
  accessories: 'Aksesoris', skinTexture: 'Tekstur kulit close-up',
};

const TRAIT_MAX = 300;

/** System prompt khusus analisis visual — dipakai sebagai override system prompt chatWithAI. */
export const VISION_SYSTEM_PROMPT = [
  'Kamu adalah asisten analisis visual untuk studio kreatif SherlyStudio.',
  'Tugasmu satu-satunya: mendeskripsikan detail fisik yang terlihat pada foto wajah secara objektif, spesifik, dan netral, sebagai referensi untuk membuat karakter virtual yang konsisten.',
  'Jangan menebak atau menyebut identitas orang nyata, nama, atau asal-usul foto. Jangan menilai kecantikan atau memberi saran. Fokus hanya pada deskripsi visual.',
  'Selalu balas HANYA dengan JSON yang diminta, tanpa teks pembuka, penjelasan, atau blok kode.',
].join(' ');

/** Whitelist + bersihkan traits. Kunci asing dibuang, nilai kosong dibuang, panjang dibatasi. */
export function sanitizeTraits(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const key of TRAIT_FIELDS) {
    const raw = input[key];
    if (typeof raw !== 'string') continue;
    const val = raw.replace(/[\r\n\t]+/g, ' ').trim().slice(0, TRAIT_MAX);
    if (val) out[key] = val;
  }
  return out;
}

/** Instruksi analisis foto wajah -> JSON traits (Bahasa Indonesia, deskriptif & spesifik). */
export function visionTraitsPrompt() {
  const fields = TRAIT_FIELDS.map((k) => `    "${k}": "..."`).join(',\n');
  return [
    'Analisis foto ini sebagai referensi wajah dan penampilan karakter.',
    'Isi detail fisik yang TERLIHAT pada foto secara spesifik dan deskriptif dalam Bahasa Indonesia — sebut warna, bentuk, dan tekstur secara wajar (mis. "oval dengan rahang lembut", bukan sekadar "oval").',
    'Untuk hijab: tulis "tidak ada" jika foto tidak berhijab. Untuk hal yang tidak terlihat jelas, tulis deskripsi terbaik yang masih konsisten dengan foto.',
    'Balas HANYA satu objek JSON valid (tanpa teks lain, tanpa penjelasan, tanpa blok kode) dengan bentuk persis:',
    '{\n' + fields + '\n}',
  ].join('\n');
}

const JSON_BLOCK = /\{[\s\S]*?\}/;

/** Ambil objek JSON traits dari jawaban model — toleran teks/fence di sekelilingnya. */
export function parseVisionTraits(text) {
  const raw = String(text || '').trim();
  if (!raw) throw Object.assign(new Error('Analisis mengembalikan jawaban kosong.'), { status: 502 });
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const candidates = [stripped, raw, ...((raw.match(new RegExp(JSON_BLOCK.source, 'g')) || []).slice(0, 3))];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const obj = JSON.parse(c);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const clean = sanitizeTraits(obj);
        if (Object.keys(clean).length) return clean;
      }
    } catch { /* coba kandidat berikutnya */ }
  }
  throw Object.assign(new Error('Analisis mengembalikan format yang tidak bisa dibaca — coba lagi.'), { status: 502 });
}

/** Prompt master board: satu sheet referensi karakter dari master identity prompt. */
export function boardPrompt(identityPrompt) {
  const id = String(identityPrompt || '').trim();
  if (!id) throw Object.assign(new Error('Master identity prompt masih kosong — isi dulu di langkah 3.'), { status: 400 });
  return [
    id,
    '',
    'MASTER CHARACTER BOARD — buat satu lembar referensi karakter (character reference sheet) dengan tiga panel bergrid rapi:',
    '1) full body dari kepala sampai kaki, 2) potret setengah badan menghadap kamera, 3) close-up macro wajah.',
    'Latar polos netral yang seragam di semua panel, pencahayaan studio merata, tanpa teks, label, atau watermark.',
    'Wajah, rambut, kulit, dan proporsi tubuh HARUS identik dan konsisten di ketiga panel — jangan menjadi orang lain.',
  ].join('\n');
}
