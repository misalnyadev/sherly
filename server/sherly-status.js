// D-268 · Status harian Sherly — dibuat OTOMATIS oleh AI dari bible/persona,
// berlaku 24 jam, lalu otomatis dihapus dari DB.
//
// Cara kerja (tanpa cron — aman di Vercel serverless):
//   1. Client memanggil GET /api/sherly-status.
//   2. Server membersihkan status kedaluwarsa (expires_at <= now).
//   3. Kalau masih ada status valid -> kirim (tidak perlu AI).
//   4. Kalau tidak ada -> tentukan JADWAL Acak: 1-2x sehari di rentang
//      jam 08:00-22:00 (waktu Indonesia). Kalau belum waktunya ganti,
//      pakai status terakhir yang masih ada / fallback bawaan.
//   5. Generate status baru lewat AI (dari persona bible), simpan ke DB
//      dengan expires_at = now() + 24 jam.
//
// Efeknya: status berubah sendiri 1-2x sehari, tiap status hanya hidup
// 24 jam, dan baris kedaluwarsa dibersihkan dari DB otomatis.

/** Status cadangan kalau AI gagal / belum ada key — tetap enak dilihat. */
export const STATUS_FALLBACKS = [
  'Lagi rapiin ide konten sambil nge-cek kopi',
  'Mood lagi estetik — sizingan wardrobe dirapikan lagi',
  'Santai, tapi otak tetap ngebut ide campaign',
  'Sedang cari angle konten yang beda dari biasanya',
  'Energi oke buat ngobrolin strategi hari ini',
  'Lagi baca inspirational shoot dari banyak references',
  'Kopinya sudah dingin, tapi idenya baru panas',
  'Mode brainstorm: disusun kode konten minggu ini',
];

/** Teks status yang mengandung karakter aneh / terlalu panjang dibuang. */
export function sanitizeStatusText(raw) {
  const text = String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')          // buang tag
    .replace(/^[\s"'`\-–—•*#]+/, '')  // buang tanda baca di awal
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  // Buang sisa label AI ("Status: ...") -> ambil bagian setelah tanda baca.
  const cleaned = text.replace(/^(status|pesan)\s*[:\-–]\s*/i, '').trim();
  const out = (cleaned || text).slice(0, 160).trim();
  return out;
}

/**
 * Jadwal acak: 1-2x sehari, jam acak di rentang 08:00-22:00 (WIB).
 * Mengembalikan epoch ms saat status berikutnya boleh diganti.
 *
 * Logika: dari `now`, ambil slot-slot acak di hari ini & besok. Kalau slot
 * hari ini sudah lewat, ambil slot berikutnya. Minimal 3 jam antar slot
 * supaya perubahannya terasa "organic", bukan tiap menit.
 */
export function nextSlotMs(now = Date.now(), rand = Math.random) {
  const HOUR = 3600_000;
  const START_HOUR = 8;   // mulai 08:00 WIB
  const END_HOUR = 22;    // selesai 22:00 WIB
  const MIN_GAP_H = 3;    // jarak minimal antar penggantian
  const dayMs = 24 * HOUR;
  const WIB_OFFSET_H = 7; // Indonesia Barat = UTC+7 (tanpa DST)
  // Awal "hari WIB" (tanggal 00:00 WIB) dalam epoch ms.
  const wibNow = now + WIB_OFFSET_H * HOUR;
  const dayStart = Math.floor(wibNow / dayMs) * dayMs - WIB_OFFSET_H * HOUR;

  // Kumpulkan slot acak untuk hari ini & 2 hari ke depan (semua dalam WIB).
  const slots = [];
  for (let day = 0; day < 3; day += 1) {
    const base = dayStart + day * dayMs;
    const picks = [];
    for (let i = 0; i < 2; i += 1) {           // 1-2 slot per hari
      const slot = base + (START_HOUR + rand() * (END_HOUR - START_HOUR)) * HOUR;
      picks.push(slot);
    }
    picks.sort((a, b) => a - b);
    // Jaga jarak minimal antar slot di hari yang sama. Slot yang geser
    // melewati batas 22:00 WIB dibuang (bukan dipindah ke luar rentang).
    const kept = [];
    for (const p of picks) {
      const last = kept.length ? kept[kept.length - 1] : null;
      const candidate = last === null ? p : Math.max(p, last + MIN_GAP_H * HOUR);
      if (candidate >= base + END_HOUR * HOUR) continue; // melewati 22:00 WIB
      kept.push(candidate);
    }
    slots.push(...kept);
  }
  slots.sort((a, b) => a - b);
  // Jaga jarak minimal antar slot secara global (termasuk lintas hari) —
  // supaya pergantian status terasa "organic", bukan berdekatan.
  const spaced = [];
  for (const s of slots) {
    if (!spaced.length || s - spaced[spaced.length - 1] >= MIN_GAP_H * HOUR) spaced.push(s);
  }
  const future = spaced.find((s) => s > now);
  return future ?? (now + 12 * HOUR);
}

/**
 * Bangun prompt status dari bible/persona Sherly.
 * `bible` = ringkasan persona (nama, peran, sifat, nada bicara, pilar).
 */
export function statusPrompt(bible = {}) {
  const p = bible || {};
  const lines = [];
  if (p.name) lines.push(`Nama: ${p.name}`);
  if (p.role) lines.push(`Peran: ${p.role}`);
  if (p.location) lines.push(`Domisili: ${p.location}`);
  if (p.tagline) lines.push(`Tagline: ${p.tagline}`);
  if (p.bio) lines.push(`Bio: ${p.bio}`);
  if (Array.isArray(p.traits) && p.traits.length) lines.push(`Sifat: ${p.traits.join(', ')}`);
  if (p.voice?.gaya) lines.push(`Nada bicara: ${p.voice.gaya}`);
  if (p.voice?.khas) lines.push(`Ciri khas: ${p.voice.khas}`);
  if (p.voice?.pantangan) lines.push(`Pantangan: ${p.voice.pantangan}`);
  if (Array.isArray(p.pillars) && p.pillars.length) {
    lines.push(`Pilar konten: ${p.pillars.map((x) => x?.title || '').filter(Boolean).join(', ')}`);
  }
  const now = new Date();
  const hari = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full' }).format(now);
  const jam = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', timeStyle: 'short' }).format(now);
  return `Kamu adalah Sherly, kreator konten lifestyle & beauty dari Indonesia.

BIBLE / PERSONA:
${lines.join('\n')}

TANGGAL & JAM SEKARANG: ${hari}, ${jam} (WIB).

TUGAS: tulis SATU kalimat status singkat yang sedang Sherly alami/kerjakan hari ini.
- Panjang: 4-14 kata. Bahasa Indonesia santai & hangat, seperti status WhatsApp.
- Terlihat natural & personal (bukan marketing, bukan tagline, bukan KPI).
- Boleh menyebut aktivitas nyata (ngedit foto, cari angle konten, baca inspiration, ngopi).
- JANGAN pakai emoji, JANGAN pakai tanda kutip, JANGAN memberi label "Status:".
- JANGAN menyebut AI, mesin, atau sistem — Sherly tetap manusia.
- Cukup satu aktivitas, bukan daftar panjang.

Balas HANYA kalimat statusnya, tanpa penjelasan.`;
}

/** SYSTEM PROMPT khusus status — persona tetap manusia, nada Santai. */
export const STATUS_SYSTEM_PROMPT =
  'Kamu Sherly — kreator konten lifestyle & beauty yang hangat, tenang, dan sedikit playful. '
  + 'Kamu menulis status personal singkat tentang apa yang sedang kamu kerjakan/makami hari itu. '
  + 'Selalu dalam bahasa Indonesia, santai, singkat, tanpa emoji, tanpa label, tanpa basa-basi.';

/** Fallback acak (dipakai kalau AI tidak tersedia). */
export function pickFallback(rand = Math.random) {
  const list = STATUS_FALLBACKS;
  return list[Math.floor(rand() * list.length) % list.length];
}
