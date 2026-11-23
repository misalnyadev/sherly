/**
 * D-276 — Model beat untuk Motion Graphics.
 *
 * "Beat" = satu unit konten dalam video: satu blok teks dengan durasi,
 * gaya visual, dan (opsional) CTA sendiri. Video panjang bukan satu
 * teks diam — ia rangkaian beat yang bergantian, persis struktur
 * short-form yang naval: HOOK → BODY → PAYOFF → CTA.
 *
 * Format input (dipakai user di kolom isian Studio):
 *
 *   === Hook ===
 *   Judul besar pembuka
 *   Subtitle satu baris
 *
 *   === Poin 1 ===
 *   Teks beat pertama
 *
 *   === CTA ===
 *   Simpan videonya!
 *   @sherlystudio
 *
 * Aturan parsing:
 *  - Baris yang persis `=== Nama ===` (atau `## Nama`) memulai beat baru.
 *  - Baris kosong diabaikan; sisa baris jadi "baris teks" beat tersebut.
 *  - Tanpa header sama sekali -> 1 beat tunggal (backward compatible).
 *  - Nama beat menentukan peran: hook | body | payoff | cta | outro.
 *    Nama yang tidak dikenal = `body`.
 */
export type BeatRole = 'hook' | 'body' | 'payoff' | 'cta' | 'outro';

export type Beat = {
  /** Nama beat seperti yang ditulis user (mis. "Hook", "Poin 1"). */
  name: string;
  /** Peran visual beat. Ditentukan dari nama. */
  role: BeatRole;
  /** Baris-baris teks beat. */
  lines: string[];
  /** Durasi beat dalam detik. */
  durationInSeconds: number;
  /** Frame mulai beat. */
  startFrame: number;
  /** Frame selesai beat. */
  endFrame: number;
};

/** Nama beat yang dipetakan ke peran tertentu. */
const ROLE_BY_NAME: Record<string, BeatRole> = {
  hook: 'hook',
  pembuka: 'hook',
  opening: 'hook',
  intro: 'hook',
  body: 'body',
  isi: 'body',
  konten: 'body',
  poin: 'body',
  feature: 'body',
  fitur: 'body',
  problem: 'body',
  masalah: 'body',
  solution: 'body',
  solusi: 'body',
  payoff: 'payoff',
  hasil: 'payoff',
  benefit: 'payoff',
  manfaat: 'payoff',
  impact: 'payoff',
  cta: 'cta',
  calltoaction: 'cta',
  aksi: 'cta',
  ajakan: 'cta',
  outro: 'outro',
  penutup: 'outro',
  closing: 'outro',
};

/**
 * Normalisasi nama beat -> peran.
 * "Poin 1" / "poin-1" / "point 1" -> body.
 * "CTA" / "Ajakan" -> cta.
 */
export function roleForBeatName(name: string): BeatRole {
  const key = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  if (!key) return 'body';
  if (ROLE_BY_NAME[key]) return ROLE_BY_NAME[key];
  // "poin1", "poin2", "point1", "langkah3" ... -> body
  if (/^(poin|point|step|langkah|bagian)\d+$/.test(key)) return 'body';
  return 'body';
}

/** Parse header beat: `=== Nama ===` / `## Nama` / `[Nama]`. */
function parseBeatHeader(line: string): string | null {
  const t = line.trim();
  if (!t) return null;
  // === Nama ===
  let m = /^={2,}\s*(.+?)\s*={2,}$/.exec(t);
  if (m) return m[1].trim();
  // ## Nama (minimal 2 pagar di depan)
  m = /^#{2,}\s*(.+?)\s*#{0,}$/.exec(t);
  if (m) return m[1].trim();
  // [Nama]
  m = /^\[(.+)\]$/.exec(t);
  if (m) return m[1].trim();
  return null;
}

/**
 * Parse teks mentah -> daftar beat (tanpa durasi).
 * @param {string} raw
 */
export function parseBeats(
  raw: string,
): Array<{name: string; role: BeatRole; lines: string[]}> {
  const text = String(raw || '');
  const out: Array<{name: string; role: BeatRole; lines: string[]}> = [];
  let current: {name: string; role: BeatRole; lines: string[]} | null = null;

  for (const line of text.split(/\r?\n/)) {
    const header = parseBeatHeader(line);
    if (header !== null) {
      if (current) out.push(current);
      current = {name: header, role: roleForBeatName(header), lines: []};
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!current) {
      // Teks sebelum header pertama -> beat "Hook" default.
      current = {name: 'Hook', role: 'hook', lines: []};
    }
    current.lines.push(trimmed);
  }
  if (current) out.push(current);

  // Beat tanpa teks (header doang) -> buang.
  return out.filter((b) => b.lines.length > 0);
}

/** Hitung bobot tiap beat (proporsional jumlah karakter teks). */
export function beatWeights(beats: Array<{lines: string[]}>): number[] {
  return beats.map((b) => {
    const chars = b.lines.join(' ').trim().length;
    // Beat kosong tetap dapat bobot minimal supaya tidak nol.
    return Math.max(chars, 8);
  });
}

/**
 * Bagi durasi total ke beat, lalu isi startFrame/endFrame.
 *
 * Aturan:
 *  - Durasi tiap beat proporsional jumlah karakternya.
 *  - Durasi minimum (1,2 dtk) supaya beat singkat tidak cuma 1 frame.
 *  - Durasi maksimum (8 dtk) supaya beat panjang tidak bikin video monoton.
 *  - Sisa durasi dibagi rata ke beat yang masih boleh (belum max / belum min).
 *
 * @param {Array<{name: string; role: BeatRole; lines: string[]}>} beats
 * @param {number} totalSeconds
 * @param {number} fps
 */
export const MIN_BEAT_SECONDS = 1.2;
export const MAX_BEAT_SECONDS = 8;

export function distributeBeats(
  beats: Array<{name: string; role: BeatRole; lines: string[]}>,
  totalSeconds: number,
  fps: number,
): Beat[] {
  if (!beats.length) return [];
  const totalFrames = Math.max(1, Math.round(totalSeconds * fps));
  const minFrames = Math.round(MIN_BEAT_SECONDS * fps);
  const maxFrames = Math.round(MAX_BEAT_SECONDS * fps);

  const weights = beatWeights(beats);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  // Jatuhkan durasi proporsional, lalu clamp ke min/max.
  let frames = weights.map((w) => Math.round((w / weightSum) * totalFrames));
  frames = frames.map((f) => Math.min(Math.max(f, minFrames), maxFrames));

  // Total bisa meleset setelah clamp -> rapikan.
  let diff = totalFrames - frames.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 10_000) {
    guard++;
    const order = diff > 0
      ? frames.map((f, i) => ({i, room: maxFrames - f})).filter((x) => x.room > 0)
      : frames.map((f, i) => ({i, room: f - minFrames})).filter((x) => x.room > 0);
    if (!order.length) break;
    const step = diff > 0 ? 1 : -1;
    for (const {i, room} of order) {
      if (diff === 0) break;
      const give = Math.min(room, Math.abs(diff), Math.max(1, Math.round(Math.abs(diff) / order.length)));
      frames[i] += step * give;
      diff -= step * give;
    }
  }

  // Sisa frame (mis. total > kapasitas maksimum semua beat) ditaruh di beat
  // terakhir supaya durasi total tetap PERSIS sama dengan durasi video.
  if (diff !== 0 && frames.length) {
    frames[frames.length - 1] = Math.max(1, frames[frames.length - 1] + diff);
    diff = 0;
  }

  // Bangun hasil.
  const out: Beat[] = [];
  let cursor = 0;
  for (let i = 0; i < beats.length; i++) {
    const len = Math.max(1, frames[i]);
    out.push({
      name: beats[i].name,
      role: beats[i].role,
      lines: beats[i].lines,
      durationInSeconds: len / fps,
      startFrame: cursor,
      endFrame: cursor + len,
    });
    cursor += len;
  }
  return out;
}

/** Beat contoh — dipakai kalau user mengosongkan kolom beat. */
export const EXAMPLE_BEATS_TEXT = [
  '=== Hook ===',
  '3,2x lebih cepat produksi',
  'Tanpa hrs bayar lebih',
  '',
  '=== Poin 1 ===',
  'Template siap pakai',
  'Pilih, isi, render',
  '',
  '=== Poin 2 ===',
  'Subtitle otomatis',
  'Audio naratif siap pakai',
  '',
  '=== CTA ===',
  'Coba sekarang di SherlyStudio',
  '@sherlystudio',
].join('\n');

/**
 * Beat siap pakai untuk template/client.
 * Kalau teks kosong -> pakai beat contoh (biar render tidak kosong).
 */
export function beatsFromText(raw: string, totalSeconds: number, fps: number): Beat[] {
  const parsed = parseBeats(raw);
  const source = parsed.length ? parsed : parseBeats(EXAMPLE_BEATS_TEXT);
  const spread = distributeBeats(source, totalSeconds, fps);
  // Pecah beat yang terlalu panjang -> pacing konsisten, total tetap sama.
  const split = splitLongBeats(spread, MAX_BEAT_SECONDS);
  return reindexBeats(split, fps);
}

/**
 * Pecah beat yang melebihi batas maksimum jadi beberapa beat dengan peran sama.
 * Dipakai supaya durasi 20–30 detik dengan satu blok teks tetap punya pacing
 * (potongan <= MAX_BEAT_SECONDS) dan total durasi tetap persis.
 */
export function splitLongBeats(beats: Beat[], maxSeconds: number): Beat[] {
  const limit = Math.max(MIN_BEAT_SECONDS, Number(maxSeconds) || MAX_BEAT_SECONDS);
  const out: Beat[] = [];
  for (const beat of beats) {
    if (beat.durationInSeconds <= limit + 1e-6) {
      out.push(beat);
      continue;
    }
    const parts = Math.ceil(beat.durationInSeconds / limit);
    const each = beat.durationInSeconds / parts;
    for (let i = 0; i < parts; i++) {
      out.push({
        ...beat,
        name: parts > 1 ? `${beat.name} ${i + 1}/${parts}` : beat.name,
        durationInSeconds: each,
      });
    }
  }
  return out;
}

/** Hitung ulang startFrame/endFrame setelah beat dipecah, preserving total durasi. */
export function reindexBeats(beats: Beat[], fps: number): Beat[] {
  let cursor = 0;
  return beats.map((b) => {
    const len = Math.max(1, Math.round(b.durationInSeconds * fps));
    const out: Beat = {
      ...b,
      durationInSeconds: len / fps,
      startFrame: cursor,
      endFrame: cursor + len,
    };
    cursor += len;
    return out;
  });
}

/** Beat yang aktif pada frame tertentu (atau null). */
export function beatAtFrame(beats: Beat[], frame: number): Beat | null {
  if (!beats.length) return null;
  for (const b of beats) {
    if (frame >= b.startFrame && frame < b.endFrame) return b;
  }
  return beats[beats.length - 1];
}
