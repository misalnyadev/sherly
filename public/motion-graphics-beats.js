/**
 * D-276 — Model beat untuk Motion Graphics (versi client-side).
 *
 * WAJIB SINKRON dengan `motion-graphics/src/beats.ts` (versi server-side).
 * Test `test/motion-graphics-beats.test.js` menjaga kedua file ini tetap
 * sama perilakunya.
 *
 * "Beat" = satu unit konten dalam video: satu blok teks dengan durasi dan
 * gaya visual sendiri. Video 10–30 detik bukan satu teks diam — ia
 * rangkaian beat: HOOK → BODY → PAYOFF → CTA.
 *
 * Format input:
 *   === Hook ===
 *   Judul besar pembuka
 *
 *   === Poin 1 ===
 *   Teks beat pertama
 *
 *   === CTA ===
 *   Simpan videonya!
 */

/** @typedef {'hook'|'body'|'payoff'|'cta'|'outro'} BeatRole */

/**
 * @typedef {object} Beat
 * @property {string} name
 * @property {BeatRole} role
 * @property {string[]} lines
 * @property {number} durationInSeconds
 * @property {number} startFrame
 * @property {number} endFrame
 */

const ROLE_BY_NAME = {
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
 * Normalisasi nama beat -> peran visual.
 * @param {string} name
 * @returns {BeatRole}
 */
export function roleForBeatName(name) {
  const key = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  if (!key) return 'body';
  if (ROLE_BY_NAME[key]) return ROLE_BY_NAME[key];
  if (/^(poin|point|step|langkah|bagian)\d+$/.test(key)) return 'body';
  return 'body';
}

/** Parse header beat: `=== Nama ===` / `## Nama` / `[Nama]`. */
function parseBeatHeader(line) {
  const t = line.trim();
  if (!t) return null;
  let m = /^={2,}\s*(.+?)\s*={2,}$/.exec(t);
  if (m) return m[1].trim();
  m = /^#{2,}\s*(.+?)\s*#{0,}$/.exec(t);
  if (m) return m[1].trim();
  m = /^\[(.+)\]$/.exec(t);
  if (m) return m[1].trim();
  return null;
}

/**
 * Parse teks mentah -> daftar beat (tanpa durasi).
 * @param {string} raw
 * @returns {Array<{name: string, role: BeatRole, lines: string[]}>}
 */
export function parseBeats(raw) {
  const text = String(raw || '');
  const out = [];
  let current = null;

  for (const line of text.split(/\r?\n/)) {
    const header = parseBeatHeader(line);
    if (header !== null) {
      if (current) out.push(current);
      current = {name: header, role: roleForBeatName(header), lines: []};
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!current) current = {name: 'Hook', role: 'hook', lines: []};
    current.lines.push(trimmed);
  }
  if (current) out.push(current);

  return out.filter((b) => b.lines.length > 0);
}

/**
 * Bobot tiap beat (proporsional jumlah karakter teks).
 * @param {Array<{lines: string[]}>} beats
 */
export function beatWeights(beats) {
  return beats.map((b) => {
    const chars = b.lines.join(' ').trim().length;
    return Math.max(chars, 8);
  });
}

/**
 * Bagi durasi total ke beat, lalu isi startFrame/endFrame.
 * @param {Array<{name: string, role: BeatRole, lines: string[]}>} beats
 * @param {number} totalSeconds
 * @param {number} fps
 * @returns {Beat[]}
 */
export const MIN_BEAT_SECONDS = 1.2;
export const MAX_BEAT_SECONDS = 8;

export function distributeBeats(beats, totalSeconds, fps) {
  if (!beats.length) return [];
  const totalFrames = Math.max(1, Math.round(totalSeconds * fps));
  const minFrames = Math.round(MIN_BEAT_SECONDS * fps);
  const maxFrames = Math.round(MAX_BEAT_SECONDS * fps);

  const weights = beatWeights(beats);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  let frames = weights.map((w) => Math.round((w / weightSum) * totalFrames));
  frames = frames.map((f) => Math.min(Math.max(f, minFrames), maxFrames));

  let diff = totalFrames - frames.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 10000) {
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

  const out = [];
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

/**
 * Pecah beat yang melebihi batas maksimum jadi beberapa beat dengan peran sama.
 * Dipakai supaya durasi 20–30 detik dengan satu blok teks tetap punya pacing
 * (potongan <= MAX_BEAT_SECONDS) dan total durasi tetap persis.
 */
export function splitLongBeats(beats, maxSeconds) {
  const limit = Math.max(1.2, Number(maxSeconds) || 8);
  const out = [];
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
 * @param {string} raw
 * @param {number} totalSeconds
 * @param {number} fps
 * @returns {Beat[]}
 */
export function beatsFromText(raw, totalSeconds, fps) {
  const parsed = parseBeats(raw);
  const source = parsed.length ? parsed : parseBeats(EXAMPLE_BEATS_TEXT);
  const spread = distributeBeats(source, totalSeconds, fps);
  // Pecah beat yang terlalu panjang -> pacing konsisten, total tetap sama.
  const split = splitLongBeats(spread, MAX_BEAT_SECONDS);
  return reindexBeats(split, fps);
}

/**
 * Hitung ulang startFrame/endFrame setelah beat dipecah, preserving total durasi.
 * @param {Array} beats
 * @param {number} fps
 */
export function reindexBeats(beats, fps) {
  let cursor = 0;
  return beats.map((b) => {
    const len = Math.max(1, Math.round(b.durationInSeconds * fps));
    const out = {
      ...b,
      durationInSeconds: len / fps,
      startFrame: cursor,
      endFrame: cursor + len,
    };
    cursor += len;
    return out;
  });
}

/**
 * Beat yang aktif pada frame tertentu (atau null).
 * @param {Beat[]} beats
 * @param {number} frame
 */
export function beatAtFrame(beats, frame) {
  if (!beats.length) return null;
  for (const b of beats) {
    if (frame >= b.startFrame && frame < b.endFrame) return b;
  }
  return beats[beats.length - 1];
}
