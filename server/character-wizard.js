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

// D-105 (paritas AK Talent): gender & tinggi disimpan di traits jsonb (tanpa kolom baru),
// tapi BUKAN bagian analisis vision (tetap 17 field) — keduanya field form basics.
const TRAIT_EXTRA = ['gender', 'height'];

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
  for (const key of [...TRAIT_FIELDS, ...TRAIT_EXTRA]) {
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

/**
 * Prompt board final untuk route /api/ai/character-board.
 * Klien wizard (D-103) kini mengirim prompt SHEET LENGKAP (identitas + instruksi 3 panel,
 * bertanda "MASTER CHARACTER BOARD") — pakai apa adanya agar tidak dobel instruksi.
 * Klien lama / panggilan tanpa prompt hanya mengirim identitas — bungkus dengan boardPrompt().
 */
export function resolveBoardPrompt(identityPrompt) {
  const id = String(identityPrompt || '').trim();
  // D-103: sheet prompt lama bertanda "MASTER CHARACTER BOARD".
  // D-104: engine AK Talent bertanda "character-sheet engine".
  if (id.includes('MASTER CHARACTER BOARD') || id.includes('character-sheet engine')) return id;
  return boardPrompt(id);
}

// ===== D-99: suara karakter (TTS) + bible =====

/** Whitelist profil suara karakter dari klien (dipakai juga oleh biblePrompt). */
export function sanitizeVoiceProfile(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const name = typeof input.name === 'string' ? input.name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 40) : '';
  if (name) out.name = name;
  const style = typeof input.style === 'string' ? input.style.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 180) : '';
  if (style) out.style = style;
  const script = typeof input.script === 'string' ? input.script.trim().slice(0, 600) : '';
  if (script) out.script = script;
  return out;
}

/** System prompt penulis bible — dipakai sebagai override system prompt chatWithAI. */
export const BIBLE_SYSTEM_PROMPT = [
  'Kamu adalah penulis Character Bible untuk studio kreatif.',
  'Tugasmu: merangkum data karakter yang diberikan menjadi SATU dokumen referensi yang ringkas, faktual, dan mudah dipakai ulang untuk menjaga konsistensi karakter di semua konten.',
  'Gunakan HANYA data yang diberikan — jangan mengarang fakta baru (usia, ciri fisik, riwayat) yang tidak ada di data. Boleh merapikan bahasa, tidak boleh mengubah makna.',
  'Balas dalam Bahasa Indonesia dengan format Markdown ringkas sesuai struktur yang diminta, tanpa kalimat pembuka/penutup tambahan.',
].join(' ');

/** Susun instruksi pembuatan Character Bible dari data wizard (profil + traits + suara). */
export function biblePrompt(data) {
  const d = data || {};
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const b = {
    name: str(d.name, 80), role: str(d.role, 120), age: str(d.age, 8), origin: str(d.origin, 80),
    appearance: str(d.appearance, 900), personality: str(d.personality, 900), identity: str(d.identity_prompt, 1500),
    niche: Array.isArray(d.niche) ? d.niche.filter((x) => typeof x === 'string').slice(0, 8).map((x) => x.trim()).filter(Boolean) : [],
    platforms: Array.isArray(d.platforms) ? d.platforms.filter((x) => typeof x === 'string').slice(0, 6).map((x) => x.trim()).filter(Boolean) : [],
    language: str(d.language, 40),
  };
  const traits = sanitizeTraits(d.traits);
  const voice = sanitizeVoiceProfile(d.voice);
  const lines = ['Susun CHARACTER BIBLE untuk karakter berikut.'];
  lines.push('\nDATA KARAKTER:');
  lines.push('- Nama: ' + (b.name || '(tanpa nama)'));
  if (b.role) lines.push('- Peran: ' + b.role);
  if (b.age) lines.push('- Usia visual: ' + b.age + ' tahun');
  if (b.origin) lines.push('- Asal: ' + b.origin);
  if (b.language) lines.push('- Bahasa konten: ' + b.language);
  if (b.niche.length) lines.push('- Niche: ' + b.niche.join(', '));
  if (b.platforms.length) lines.push('- Platform: ' + b.platforms.join(', '));
  if (b.appearance) lines.push('- Penampilan umum: ' + b.appearance);
  if (b.personality) lines.push('- Kepribadian: ' + b.personality);
  const traitKeys = Object.keys(traits);
  if (traitKeys.length) {
    lines.push('- Detail fisik terstruktur:');
    for (const k of traitKeys) lines.push('  · ' + (TRAIT_LABELS[k] || k) + ': ' + traits[k]);
  }
  if (b.identity) lines.push('- Kunci identitas (master prompt): ' + b.identity);
  if (voice.name || voice.style || voice.script) {
    lines.push('- Suara karakter (sudah dikunci): voice Gemini "' + (voice.name || '-') + '", gaya: ' + (voice.style || '-') + (voice.script ? ', contoh naskah: "' + voice.script + '"' : ''));
  }
  lines.push('\nFORMAT KELUARAN (Markdown, Bahasa Indonesia):');
  lines.push('# <Nama> — <ringkasan 1 kalimat>');
  lines.push('## Identitas & Penampilan');
  lines.push('## Kepribadian & Gaya Bicara');
  lines.push('## Suara' + (voice.name ? ' (voice: ' + voice.name + ')' : ''));
  lines.push('## Kunci Konsistensi (aturan wajah, rambut, kulit, proporsi tubuh yang wajib sama di semua konten)');
  lines.push("## Do & Don't Konten");
  lines.push('\nPadat dan langsung isi; maksimal ±600 kata. Setiap bagian wajib berisi.');
  return lines.join('\n');
}
