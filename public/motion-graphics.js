// ===== D-251: Motion Graphics — render di browser (Canvas 2D + WebCodecs) =====
//
// Render video programatik TANPA server: komposisi digambar di Canvas 2D,
// di-encode pake WebCodecs (H.264), lalu di-mux ke MP4 pake mediabunny.
//
// Kenapa client-side: aplikasi SherlyStudio deploy di Vercel serverless,
// yang tidak punya (a) filesystem bisa tulis, (b) proses > 60 detik,
// (c) Chromium headless. Jadi render harus jalan di browser user.
//
// Pipeline:
//   1. Komposisi (Intro/Caption/StatCard) digambar frame per frame di Canvas
//      2D (pakai rAF + timestamp, deterministik per frame).
//   2. Canvas -> VideoFrame -> VideoEncoder (avc1) -> EncodedVideoChunk.
//   3. Chunk -> mediabunny -> MP4 Blob.
//   4. Blob -> POST multipart ke /api/studio/assets (bucket studio-assets).
//
// Fallback: kalau WebCodecs / mediabunny tidak tersedia (browser lama),
// UI menampilkan pesan jelas, bukan diam.
//
// CATATAN PALET: warna di file ini WAJIB dari palet resmi Sherly
// (lihat tools/check-palette.js) — gelap + pink + putih saja.

// D-276: model beat dipakai client-side. WAJIB sinkron dengan
// motion-graphics/src/beats.ts (versi server-side).
import {
  beatsFromText,
  beatAtFrame,
} from './motion-graphics-beats.js';

/** Gaya visual per peran beat (sinkron dengan BeatSequence.tsx). */
const MG_BEAT_ROLE_STYLE = {
  hook: {headlineScale: 1.18, plum: true, rule: true, badge: false, ctaButton: false},
  body: {headlineScale: 1, plum: false, rule: true, badge: true, ctaButton: false},
  payoff: {headlineScale: 1.08, plum: true, rule: true, badge: true, ctaButton: false},
  cta: {headlineScale: 1, plum: true, rule: false, badge: true, ctaButton: true},
  outro: {headlineScale: 0.9, plum: false, rule: false, badge: false, ctaButton: false},
};

/** Label badge peran beat (sinkron dengan BeatSequence.tsx). */
const MG_BEAT_ROLE_BADGE = {
  hook: 'HOOK',
  body: '',
  payoff: 'HASIL',
  cta: 'SEKARANG',
  outro: 'TERIMA KASIH',
};

const MG_PALETTE = {
  bg: '#070b14',
  bgElevated: '#0c1422',
  plum: '#24142a',
  line: '#24344e',
  pink: '#f044a8',
  pinkBright: '#ff72c5',
  pinkSoft: '#ff9bdc',
  white: '#f4f5fb',
  textDim: '#cfd6e4',
  textGhost: '#91a2b9',
};

const MG_ASPECTS = {
  '9:16': {width: 1080, height: 1920},
  '16:9': {width: 1920, height: 1080},
  '1:1': {width: 1080, height: 1080},
};

const MG_FPS = 30;

// D-252: Batas request body Vercel serverless = 4,5 MB (hard limit, tidak
// bisa dinaikkan). File hasil render dikirim sebagai multipart ke server,
// jadi ukuran MP4 HARUS di bawah itu. Bitrate dipilih dinamis per durasi
// supaya hasil muat — video Motion Graphics mostly datar, jadi bitrate
// lebih rendah tetap terlihat tajam.
export const MG_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4 MB (sisakan ruang untuk multipart)

/**
 * D-275: durasi maksimum Motion Graphics = 30 detik.
 *
 * ANGKA-ANGKA INI WAJIB SINKRON dengan server/motion-graphics.js.
 * Batas sebenarnya bukan upload — jalur client lewat signed-upload (D-263)
 * untuk file >= 4 MB. Yang membatasi adalah KUALITAS: di 45+ detik bitrate
 * menyentuh lantai 800 kbps dan video jadi pecil. 30 detik masih ~950 kbps.
 */
export const MG_MAX_DURATION = 30;

/** Durasi yang boleh dipilih (detik). */
export const MG_DURATIONS = [5, 6, 8, 10, 12, 15, 20, 25, 30];

/**
 * Bitrate (bit/detik) supaya hasil muat di bawah batas upload.
 *
 * D-275: untuk durasi pendek (<= 12 detik) tetap sizing ke 4 MB supaya file
 * kecil & upload cepat. Untuk durasi panjang, file LEBIH besar diizinkan
 * (signed-upload, tanpa batas body) — jadi bitrate dinaikkan ke ~1,8-2,5 Mbps
 * supaya tidak pecil, bukan diturunkan.
 *
 * @param {number} durationInSeconds
 * @returns {number}
 */
export function bitrateForDuration(durationInSeconds) {
  const dur = Math.max(1, Number(durationInSeconds) || 1);
  if (dur > 12) {
    // Durasi panjang: file boleh lebih besar (signed-upload), tapi jangan
    // berlebihan supaya render & upload tetap cepat.
    // 15s -> 2,5 Mbps | 20s -> 2,0 | 25s -> 1,8 | 30s -> 1,6
    const bits = Math.floor((3_200_000 * 12) / dur);
    return Math.min(Math.max(bits, 1_400_000), 2_500_000);
  }
  // Durasi pendek: sisakan ~15% untuk overhead multipart + muxing.
  const targetBytes = MG_UPLOAD_MAX_BYTES * 0.85;
  const bits = Math.floor((targetBytes * 8) / dur);
  // Batas bawah & atas supaya tidak terlalu pecil nor overly besar.
  return Math.min(Math.max(bits, 800_000), 6_000_000);
}

/**
 * D-276 — Ambil audio voice-over TTS dari server.
 *
 * Server otomatis memakai provider cadangan (TTSMaker, bahasa Indonesia)
 * kalau kuota Gemini habis —客户端 cukup menerima audio yang benar.
 *
 * @param {string} text
 * @param {{voice?: string, style?: string}} opts
 * @returns {Promise<{buffer: ArrayBuffer, mimeType: string, provider: string}|null>}
 */
export async function fetchTtsAudio(text, opts = {}) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: JSON.stringify({
      text: clean,
      voice: opts.voice || undefined,
      style: opts.style || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'Gagal membuat voice-over.'), {status: res.status});
  }
  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return {
    buffer,
    mimeType: res.headers.get('Content-Type') || 'audio/wav',
    // D-277: fallback chain = Soniox → Voicemaker → TTSMaker (server yang
    // memilih; header ini hanya untuk menampilkan provider di toast/metadata).
    provider: res.headers.get('X-TTS-Provider') || (res.headers.get('X-TTS-Source') === 'fallback' ? 'soniox' : 'gemini'),
  };
}

/**
 * D-276 — Ubah ArrayBuffer audio (WAV/MP3) jadi AudioBuffer siap tempel.
 * Memakai OfflineAudioContext supaya bisa di-decode tanpa <audio> element.
 *
 * @param {ArrayBuffer} buffer
 * @param {number} sampleRate
 * @returns {Promise<AudioBuffer|null>}
 */
export async function decodeAudioBuffer(buffer, sampleRate = 44100) {
  try {
    const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx(1, 1024, sampleRate);
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * D-276 — Decode audio (WAV/MP3) jadi AudioBuffer.
 *
 * Jalur 1: Web Audio (OfflineAudioContext.decodeAudioData) — paling luas
 * didukung, otomatis resample ke sample rate context.
 * Jalur 2: mediabunny (mp3/webm input) — cadangan kalau Web Audio tidak
 * bisa decode format tertentu (mis. MP3 di browser lama).
 *
 * @param {ArrayBuffer} buffer
 * @param {number} sampleRate
 * @returns {Promise<AudioBuffer|null>}
 */
export async function decodeTtsAudio(buffer, sampleRate = 44100) {
  const viaWebAudio = await decodeAudioBuffer(buffer, sampleRate);
  if (viaWebAudio) return viaWebAudio;
  try {
    const mediabunny = await import('./vendor/mediabunny.min.mjs');
    if (typeof mediabunny.Input !== 'function') return null;
    const input = new mediabunny.Input({
      formats: mediabunny.ALL_FORMATS,
      source: new mediabunny.BlobSource(new Blob([buffer])),
    });
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    const sink = new mediabunny.AudioBufferSink(track);
    return await sink.getAudioBuffer();
  } catch {
    return null;
  }
}

/** Template Motion Graphics (harus sama dengan server/motion-graphics.js). */
export const MG_CLIENT_TEMPLATES = [
  {
    id: 'branded-intro',
    label: 'Intro BerBrand',
    hint: 'Judul + subjudul + logo Sherly, cocok buat pembuka konten.',
    icon: 'sparkles',
    defaultDuration: 6,
    durations: [5, 6, 8, 10, 12, 15],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {key: 'title', label: 'Judul', placeholder: 'Contoh: Kreasi Tanpa Batas', required: true},
      {key: 'subtitle', label: 'Subjudul', placeholder: 'Contoh: Studio kreatif bertenaga AI'},
    ],
  },
  {
    id: 'captioned-clip',
    label: 'Klip Bersubtitle',
    hint: 'Tempel video lalu kasih subtitle per baris.',
    icon: 'captions',
    defaultDuration: 8,
    durations: [6, 8, 10, 12, 15, 20, 25, 30],
    aspects: ['9:16', '16:9'],
    fields: [
      {key: 'src', label: 'URL video', placeholder: 'https://… (kosong = latarnya teks saja)'},
      {key: 'captionsText', label: 'Subtitle', placeholder: 'Satu baris = satu cue', type: 'textarea'},
    ],
  },
  {
    id: 'stat-card',
    label: 'Kartu Statistik',
    hint: 'Satu angka besar + label, buat kutipan atau ringkasan data.',
    icon: 'bar-chart',
    defaultDuration: 5,
    durations: [4, 5, 6, 8, 10, 12, 15],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {key: 'value', label: 'Nilai', placeholder: 'Contoh: 3.2x', required: true},
      {key: 'label', label: 'Label', placeholder: 'Contoh: lebih cepat produksi', required: true},
      {key: 'note', label: 'Catatan', placeholder: 'Contoh: Data internal, Q3 2026'},
    ],
  },
  {
    id: 'beat-sequence',
    label: 'Rangkaian Beat',
    // D-276: video 10-30 detik berisi beberapa blok teks (HOOK -> BODY ->
    // PAYOFF -> CTA). Tiap beat punya durasi & gaya sendiri, jadi videonya
    // punya irama — bukan satu teks diam.
    hint: 'Video multi-bloc: hook, isi, lalu CTA. Format: "=== Hook ===" lalu teksnya.',
    icon: 'layers',
    defaultDuration: 15,
    durations: [10, 12, 15, 20, 25, 30],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {
        key: 'beatsText',
        label: 'Isi Beat',
        type: 'textarea',
        rows: 7,
        required: true,
        placeholder: '=== Hook ===\n3,2x lebih cepat produksi\n\n=== Poin 1 ===\nTemplate siap pakai\n\n=== CTA ===\nCoba sekarang\n@sherlystudio',
      },
      {key: 'ctaLabel', label: 'Teks Tombol CTA', placeholder: 'Contoh: Simpan Videonya'},
      {
        key: 'voiceoverText',
        label: 'Naskah Voice-over (opsional)',
        type: 'textarea',
        rows: 3,
        placeholder: 'Kosongkan kalau tidak mau suara. Kalau diisi, videonya dapat narasi TTS bahasa Indonesia.',
      },
      {
        key: 'voice',
        label: 'Suara (opsional)',
        type: 'select',
        placeholder: 'Pakai bawaan sistem',
      },
    ],
  },
];

// ===== Utilitas matematika (deterministik per frame) =====

/** Linear interpolate. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Batasi nilai di antara min & max. */
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Interpolasi dengan ease — cerminan Remotion's `interpolate()`.
 * input range [inMin, inMax] -> output [outMin, outMax], clamp di luar range.
 */
/**
 * Interpolasi dengan ease — cerminan Remotion's `interpolate()`.
 *
 * Bentuk Remotion: `interpolate(value, inputRange, outputRange)`
 *   interpolate(0.5, [0, 1], [0, 100]) -> 50
 *   interpolate(5, [0, 10], [100, 0]) -> 50
 */
export function interpolate(value, inputRange, outputRange) {
  const [inMin, inMax] = Array.isArray(inputRange) ? inputRange : [inputRange, inputRange];
  const [outMin, outMax] = Array.isArray(outputRange) ? outputRange : [outputRange, outputRange];
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

/** Ease-in-out cubic. */
export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Spring sederhana (deterministik, tanpa fisika real-time).
 * Meniru弹簧 Remotion: mulai dari 0, naik ke ~1 dengan overshoot kecil.
 * `progress` = frame / fps (detik).
 */
export function spring(progress, {damping = 200, mass = 0.8} = {}) {
  if (progress <= 0) return 0;
  // Bentuk kurva: exponential decay dari 1 -> 0, dibalik.
  const omega = 10 / Math.sqrt(mass);
  const dampingRatio = damping / 200;
  const t = progress;
  if (dampingRatio >= 1) {
    // Critical damping.
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  }
  const decay = Math.exp(-dampingRatio * omega * t);
  return 1 - decay * Math.cos(Math.sqrt(1 - dampingRatio * dampingRatio) * omega * t);
}

// ===== Skala tipografi (sama persis server/motion-graphics.js) =====

function typeScale(width) {
  const k = width / 1080;
  return {
    headline: Math.round(84 * k),
    subhead: Math.round(48 * k),
    body: Math.round(34 * k),
    caption: Math.round(26 * k),
    kicker: Math.round(30 * k),
  };
}

function safePadding(width) {
  return Math.round(width * 0.074);
}

// ===== Parsing subtitle =====

/** Parse teks subtitle -> daftar cue {text, startMs, endMs}. */
export function parseCaptions(raw, totalMs) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const srtRe = /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
  if (srtRe.test(text)) {
    const cues = [];
    for (const block of text.split(/\r?\n\r?\n/)) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const timeLine = lines.find((l) => srtRe.test(l));
      if (!timeLine) continue;
      const body = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l)).join(' ');
      if (!body) continue;
      const m = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
      if (!m) continue;
      const startMs = Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4].padEnd(3, '0'));
      const endMs = Number(m[5]) * 3600000 + Number(m[6]) * 60000 + Number(m[7]) * 1000 + Number(m[8].padEnd(3, '0'));
      cues.push({text: body, startMs, endMs: Math.max(endMs, startMs + 200)});
    }
    if (cues.length) return cues;
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const slot = Math.max(1200, Math.floor(totalMs / lines.length));
  return lines.map((line, i) => {
    const startMs = Math.min(i * slot, Math.max(0, totalMs - 600));
    return {text: line, startMs, endMs: Math.min(startMs + slot, totalMs)};
  });
}

// ===== Komposisi: menggambar frame ke Canvas 2D =====
//
// Setiap komposisi menggambar 1 frame pada waktu `t` (detik) dengan state
// `opts`. Bersih: tidak ada state antar-frame -> deterministik.

/** Gambar hati logo Sherly (sama seperti di komposisi server). */
function drawHeart(ctx, cx, cy, size, color) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-12, -12);
  ctx.beginPath();
  ctx.moveTo(12, 21);
  ctx.bezierCurveTo(12, 21, 4.5, 16.3, 2.4, 11.8);
  ctx.bezierCurveTo(0.9, 8.1, 3, 4.6, 6.3, 4.6);
  ctx.bezierCurveTo(8.3, 4.6, 9.9, 5.7, 10.9, 7.2);
  ctx.lineTo(12, 8.8);
  ctx.lineTo(13.1, 7.2);
  ctx.bezierCurveTo(14.1, 5.7, 15.7, 4.6, 17.7, 4.6);
  ctx.bezierCurveTo(21, 4.6, 23.1, 8.1, 21.6, 11.8);
  ctx.bezierCurveTo(19.5, 16.3, 12, 21, 12, 21);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Radial gradient di belakang (glow). Tanpa filter blur (tidak didukung Safari). */
function drawGlow(ctx, cx, cy, radius, color, alpha) {
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, hexToRgba(color, 0.45 * alpha));
  g.addColorStop(0.55, hexToRgba(color, 0.16 * alpha));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ubah hex (#rrggbb) -> rgba string dengan alpha. */
export function hexToRgba(hex, alpha) {
  const h = String(hex || '#000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

/** Background gelap + gradasi plum (sama persis server). */
function drawBackground(ctx, w, h, glowAlpha = 0) {
  ctx.fillStyle = MG_PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.36, 0, w / 2, h * 0.36, Math.max(w, h) * 0.62);
  g.addColorStop(0, MG_PALETTE.plum);
  g.addColorStop(1, MG_PALETTE.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (glowAlpha > 0) {
    drawGlow(ctx, w / 2, h * 0.38, w * 0.52, MG_PALETTE.pink, glowAlpha * 0.5);
  }
}

/** Bungkus teks jadi beberapa baris (word wrap). */
function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = current + ' ' + words[i];
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = words[i];
    } else {
      current = test;
    }
  }
  lines.push(current);
  return lines;
}

/** Gambar teks multi-baris dengan rata tengah. */
function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
  return y + (lines.length - 1) * lineHeight;
}

/**
 * Komposisi "Intro BerBrand".
 * Mirip motion-graphics/src/compositions/BrandedIntro.tsx.
 */
function drawBrandedIntro(ctx, w, h, t, props, totalSeconds) {
  const type = typeScale(w);
  const pad = safePadding(w);
  const title = String(props.title || 'SherlyStudio');
  const subtitle = String(props.subtitle || '');
  const brand = String(props.brand || 'SherlyStudio');
  const accent = String(props.accent || MG_PALETTE.pink);

  const total = Math.max(1, totalSeconds);
  const fadeOut = interpolate(t, [total - 0.6, total], [1, 0]);

  // D-275: intro bisa dipilih sampai 15 detik. Animasi lama selesai di
  // ~1,5 detik, jadi video 10+ detik akan jadi "layar diam" yang membosankan.
  // Perbaikan: intro tetap tampil sebagai BERTAHAN (hold), dan gerakannya
  // "bernapas" pelan supaya layar tidak benar-benar statis.
  //   - Timeline intro dipadatkan ke max 2,4 detik.
  //   - Setelah masuk, konten "napas" pelan (scale + opacity denyut kecil).
  const INTRO_MAX = 2.4;
  const introLen = Math.min(total, INTRO_MAX);
  // Skala waktu: kalau durasi > INTRO_MAX, animasi tetap pakai langkah
  // waktu asli (tidak dipercepat) tapi tidak boleh melebihi introLen.
  const animT = Math.min(t, introLen);
  const isHolding = t > introLen;

  // Spring: judul masuk ~0.35 dtk, subjudul ~1.15 dtk.
  const titleIn = spring(animT - 0.35, {damping: 200, mass: 0.7});
  const subIn = spring(animT - 1.15, {damping: 200, mass: 0.9});

  // Denyut cahaya (loop) + "napas" pelan saat menahan.
  const pulse = 0.72 + 0.28 * ((Math.sin(t * Math.PI * 0.9) + 1) / 2);
  const breath = isHolding
    ? Math.sin(((t - introLen) / Math.max(0.6, total - introLen)) * Math.PI)
    : 0;
  const breathScale = 1 + breath * 0.012;

  ctx.save();
  ctx.globalAlpha = fadeOut;
  drawBackground(ctx, w, h, pulse * 0.9);

  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(breathScale, breathScale);
  ctx.translate(-cx, -cy);

  // Logo hati.
  const heartSize = Math.round(w * 0.085);
  const heartY = cy - h * 0.09 - (1 - titleIn) * 30;
  ctx.save();
  ctx.globalAlpha = fadeOut * clamp(titleIn, 0, 1);
  ctx.translate(cx, heartY);
  const hs = lerp(0.7, 1, clamp(titleIn, 0, 1));
  ctx.scale(hs, hs);
  drawHeart(ctx, 0, 0, heartSize, accent);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Kicker (nama brand).
  ctx.font = `600 ${type.kicker}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = MG_PALETTE.textGhost;
  ctx.letterSpacing = '6px';
  ctx.globalAlpha = fadeOut * clamp(subIn, 0, 1);
  ctx.fillText(brand.toUpperCase(), cx, heartY + heartSize * 0.75 + type.kicker);
  ctx.letterSpacing = '0px';

  // Judul.
  ctx.font = `800 ${type.headline}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = MG_PALETTE.white;
  ctx.globalAlpha = fadeOut * clamp(titleIn, 0, 1);
  const titleLines = wrapText(ctx, title, w - pad * 2);
  const titleLineHeight = type.headline * 1.08;
  let titleY = heartY + heartSize * 0.75 + type.kicker + type.headline * 0.9 + (1 - clamp(titleIn, 0, 1)) * 40;
  titleY = drawLines(ctx, titleLines, cx, titleY, titleLineHeight);

  // Garis aksen.
  const lineW = lerp(0, Math.min(w * 0.34, 420), clamp(titleIn, 0, 1));
  if (lineW > 1) {
    const lineH = Math.max(4, Math.round(w * 0.005));
    const lineY = titleY + type.headline * 0.42;
    const lg = ctx.createLinearGradient(cx - lineW / 2, 0, cx + lineW / 2, 0);
    lg.addColorStop(0, MG_PALETTE.pinkBright);
    lg.addColorStop(1, accent);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.roundRect(cx - lineW / 2, lineY, lineW, lineH, lineH / 2);
    ctx.fill();
  }

  // Subjudul.
  if (subtitle) {
    ctx.font = `500 ${type.subhead}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = MG_PALETTE.textDim;
    ctx.globalAlpha = fadeOut * clamp(subIn, 0, 1);
    const subLines = wrapText(ctx, subtitle, w - pad * 2.4);
    const subY = titleY + type.headline * 0.42 + type.subhead * 1.5 + (1 - clamp(subIn, 0, 1)) * 26;
    drawLines(ctx, subLines, cx, subY, type.subhead * 1.35);
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Komposisi "Klip Bersubtitle".
 * Kalau `src` kosong -> latar gradasi + hint (sama seperti server).
 */
function drawCaptionedClip(ctx, w, h, t, props, totalSeconds, videoEl) {
  const type = typeScale(w);
  const pad = safePadding(w);
  const totalMs = Math.max(1, Math.round(totalSeconds * 1000));
  const cues = parseCaptions(props.captionsText, totalMs);
  const nowMs = t * 1000;
  const active = cues.find((c) => nowMs >= c.startMs && nowMs <= c.endMs);

  const fadeOut = interpolate(t, [totalSeconds - 0.4, totalSeconds], [1, 0]);
  ctx.save();
  ctx.globalAlpha = fadeOut;

  // Latar: video kalau ada, kalau tidak gradasi.
  if (videoEl && videoEl.readyState >= 2) {
    const vw = videoEl.videoWidth || w;
    const vh = videoEl.videoHeight || h;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    try {
      ctx.drawImage(videoEl, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } catch {
      drawBackground(ctx, w, h);
    }
  } else {
    drawBackground(ctx, w, h);
    ctx.textAlign = 'center';
    ctx.font = `400 ${type.body}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = MG_PALETTE.textGhost;
    const lines = wrapText(ctx, 'Tempel video untuk diberi subtitle.', w - pad * 2);
    drawLines(ctx, lines, w / 2, h * 0.46, type.body * 1.5);
  }

  // Caption bar.
  if (active) {
    const inMs = nowMs - active.startMs;
    const outMs = active.endMs - nowMs;
    const opacity = Math.min(
      interpolate(inMs, [0, 180], [0, 1]),
      interpolate(outMs, [0, 180], [0, 1]),
    );
    const rise = interpolate(inMs, [0, 180], [12, 0]);

    ctx.font = `600 ${type.body}px Inter, system-ui, -apple-system, sans-serif`;
    const lines = wrapText(ctx, active.text, w - pad * 2 - Math.round(w * 0.044));
    const lineHeight = type.body * 1.35;
    const boxPadY = Math.round(w * 0.014);
    const boxPadX = Math.round(w * 0.022);
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + boxPadX * 2;
    const boxH = lines.length * lineHeight + boxPadY * 2;
    const boxX = (w - textW) / 2;
    const boxY = h * 0.91 - boxH - h * 0.04 + rise;

    ctx.globalAlpha = fadeOut * opacity;
    ctx.fillStyle = 'rgba(4,7,15,0.86)';
    ctx.strokeStyle = MG_PALETTE.line;
    ctx.lineWidth = Math.max(1, Math.round(w * 0.001));
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, textW, boxH, Math.round(w * 0.014));
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = MG_PALETTE.white;
    ctx.textAlign = 'center';
    drawLines(ctx, lines, w / 2, boxY + boxPadY + type.body, lineHeight);
  }
  ctx.restore();
}

/**
 * Komposisi "Kartu Statistik".
 */
function drawStatCard(ctx, w, h, t, props, totalSeconds) {
  const type = typeScale(w);
  const pad = safePadding(w);
  const value = String(props.value || '');
  const label = String(props.label || '');
  const note = String(props.note || '');
  const brand = String(props.brand || 'SherlyStudio');
  const accent = String(props.accent || MG_PALETTE.pink);

  const total = Math.max(1, totalSeconds);
  const fadeOut = interpolate(t, [total - 0.5, total], [1, 0]);
  // D-275: kartu statistik bisa sampai 15 detik. Animasi masuk selesai di
  // ~1,6 detik, jadi durasi panjang perlu "tahan" + napas pelan supaya
  // layarnya tidak diam total.
  const INTRO_MAX = 2.4;
  const introLen = Math.min(total, INTRO_MAX);
  const animT = Math.min(t, introLen);
  const isHolding = t > introLen;
  const valueIn = spring(animT - 0.3, {damping: 200, mass: 0.8});
  const labelIn = spring(animT - 0.85, {damping: 200, mass: 1});
  const noteIn = spring(animT - 1.35, {damping: 200, mass: 1.1});
  const cardScale = lerp(0.94, 1, clamp(valueIn, 0, 1));
  // Napas pelan saat menahan.
  const breath = isHolding
    ? Math.sin(((t - introLen) / Math.max(0.6, total - introLen)) * Math.PI)
    : 0;
  const breathScale = 1 + breath * 0.014;

  ctx.save();
  ctx.globalAlpha = fadeOut;
  drawBackground(ctx, w, h);

  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(cardScale * breathScale, cardScale * breathScale);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = fadeOut * clamp(valueIn, 0, 1);

  // Kartu.
  const cardW = Math.min(w - pad * 2, 900);
  const cardH = Math.round(cardW * 0.52);
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;
  ctx.fillStyle = MG_PALETTE.bgElevated;
  ctx.strokeStyle = MG_PALETTE.line;
  ctx.lineWidth = Math.max(1, Math.round(w * 0.001));
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, Math.round(w * 0.022));
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';

  // Nilai besar.
  const valueSize = Math.round(type.headline * 1.6);
  ctx.font = `800 ${valueSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = MG_PALETTE.white;
  const valueY = cardY + cardH * 0.42 + (1 - clamp(valueIn, 0, 1)) * 46;
  ctx.fillText(value, cx, valueY);

  // Garis aksen.
  const lineW = Math.round(w * 0.09);
  const lineH = Math.max(4, Math.round(w * 0.005));
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(cx - lineW / 2, valueY + lineH * 1.6, lineW, lineH, lineH / 2);
  ctx.fill();

  // Label.
  ctx.font = `600 ${type.subhead}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = MG_PALETTE.textDim;
  ctx.globalAlpha = fadeOut * clamp(labelIn, 0, 1);
  const labelLines = wrapText(ctx, label, cardW - Math.round(w * 0.09));
  drawLines(ctx, labelLines, cx, valueY + lineH * 1.6 + type.subhead * 1.7, type.subhead * 1.3);

  // Catatan.
  if (note) {
    ctx.font = `400 ${type.caption}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = MG_PALETTE.textGhost;
    ctx.globalAlpha = fadeOut * clamp(noteIn, 0, 1);
    ctx.fillText(note, cx, cardY + cardH - Math.round(w * 0.03));
  }
  ctx.restore();

  // Brand di bawah kartu.
  ctx.font = `500 ${type.caption}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.letterSpacing = '4px';
  ctx.fillStyle = MG_PALETTE.textGhost;
  ctx.globalAlpha = fadeOut * clamp(noteIn, 0, 1);
  ctx.textAlign = 'center';
  ctx.fillText(brand.toUpperCase(), cx, cardY + cardH + Math.round(w * 0.06));
  ctx.letterSpacing = '0px';

  ctx.restore();
}

/**
 * D-276 — Komposisi "Rangkaian Beat".
 *
 * Video 10–30 detik berisi beberapa blok teks (HOOK → BODY → PAYOFF → CTA).
 * Tiap beat punya durasi & gaya sendiri, jadi videonya punya irama.
 *
 * WAJIB SINKRON dengan motion-graphics/src/compositions/BeatSequence.tsx.
 */
function drawBeatSequence(ctx, w, h, t, props, totalSeconds) {
  const type = typeScale(w);
  const pad = safePadding(w);
  const brand = String(props.brand || 'SherlyStudio');
  const accent = String(props.accent || MG_PALETTE.pink);
  const ctaLabel = String(props.ctaLabel || '').trim();

  const total = Math.max(1, totalSeconds);
  const frame = Math.round(t * MG_FPS);
  const beats = beatsFromText(String(props.beatsText || ''), total, MG_FPS);
  const active = beatAtFrame(beats, frame);
  if (!active) return;

  const style = MG_BEAT_ROLE_STYLE[active.role] || MG_BEAT_ROLE_STYLE.body;
  const local = frame - active.startFrame;
  const beatFrames = Math.max(1, active.endFrame - active.startFrame);

  const enter = spring(local / MG_FPS, {damping: 200, mass: 0.7});
  const exit = interpolate(local / beatFrames, [0.88, 1], [1, 0]);
  const fadeOut = interpolate(t, [total - 0.4, total], [1, 0]);
  const visible = enter * exit * fadeOut;

  ctx.save();
  ctx.globalAlpha = fadeOut;
  if (style.plum) drawBackground(ctx, w, h);
  else {
    drawBackground(ctx, w, h);
    ctx.fillStyle = MG_PALETTE.bgSoft;
    ctx.globalAlpha = fadeOut * 0.55;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = fadeOut;
  }

  const cx = w / 2;
  const cy = h / 2;
  const rise = (1 - clamp(enter, 0, 1)) * 34;

  ctx.save();
  ctx.globalAlpha = visible;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.translate(0, rise);

  // Badge peran beat (hook tidak pakai badge — harus langsung to the point).
  if (style.badge && MG_BEAT_ROLE_BADGE[active.role]) {
    ctx.font = `700 ${type.caption}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.letterSpacing = '4px';
    ctx.fillStyle = accent;
    const badgeText = MG_BEAT_ROLE_BADGE[active.role];
    const bw = ctx.measureText(badgeText).width + Math.round(w * 0.044);
    const bh = Math.round(type.caption * 2);
    const by = cy - h * 0.2;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, by, bw, bh, bh / 2);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = visible * 0.55;
    ctx.lineWidth = Math.max(1, Math.round(w * 0.001));
    ctx.stroke();
    ctx.globalAlpha = visible;
    ctx.fillText(badgeText, cx, by + bh * 0.68);
    ctx.letterSpacing = '0px';
  }

  // Headline beat.
  const head = active.lines[0] || '';
  const sub = active.lines.slice(1);
  const headSize = Math.round(type.headline * style.headlineScale);
  ctx.font = `800 ${headSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = MG_PALETTE.white;
  const headLines = wrapText(ctx, head, w - pad * 2);
  const headLineHeight = headSize * 1.1;
  let headY = cy - h * 0.12 - (headLines.length * headLineHeight) / 2;
  headY = drawLines(ctx, headLines, cx, headY, headLineHeight);

  // Garis aksen.
  if (style.rule) {
    const lineW = Math.round(w * 0.09);
    const lineH = Math.max(4, Math.round(w * 0.005));
    const lineY = headY + type.headline * 0.42;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(cx - lineW / 2, lineY, lineW, lineH, lineH / 2);
    ctx.fill();
  }

  // Subjudul (baris tambahan).
  if (sub.length) {
    ctx.font = `500 ${type.subhead}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = MG_PALETTE.textDim;
    const subY = headY + type.headline * 0.42 + type.subhead * 1.5;
    drawLines(ctx, sub, cx, subY, type.subhead * 1.4);
  }

  // Tombol CTA.
  if (style.ctaButton) {
    // D-276: kalau label tidak diisi, pakai teks handle ("@sherlystudio")
    // kalau ada — bukan mengulang headline (yang bakalan tampil dobel).
    const handle = sub.find((l) => l.trim().startsWith('@'))?.trim() || '';
    const btnText = ctaLabel || handle || 'Coba Sekarang';
    ctx.font = `800 ${type.subhead}px Inter, system-ui, -apple-system, sans-serif`;
    const bw = ctx.measureText(btnText).width + Math.round(w * 0.1);
    const bh = Math.round(type.subhead * 1.8);
    const bx = cx - bw / 2;
    const by = headY + type.headline * 0.42 + type.subhead * 3.1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = MG_PALETTE.bg;
    ctx.fillText(btnText, cx, by + bh * 0.68);
  }

  ctx.restore();

  // Brand kecil di bawah.
  ctx.font = `500 ${type.caption}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.letterSpacing = '4px';
  ctx.fillStyle = MG_PALETTE.textGhost;
  ctx.globalAlpha = fadeOut * 0.75;
  ctx.textAlign = 'center';
  ctx.fillText(brand.toUpperCase(), cx, h - pad * 0.5);
  ctx.letterSpacing = '0px';

  // Progress bar beat — indikator irama.
  const barH = Math.max(3, Math.round(h * 0.0035));
  ctx.globalAlpha = fadeOut;
  ctx.fillStyle = MG_PALETTE.line;
  ctx.fillRect(0, h - barH, w, barH);
  ctx.fillStyle = accent;
  ctx.fillRect(0, h - barH, Math.round(w * clamp(local / beatFrames, 0, 1)), barH);

  ctx.restore();
}

/** Dispatcher komposisi. */
const MG_COMPOSITIONS = {
  'branded-intro': drawBrandedIntro,
  'captioned-clip': drawCaptionedClip,
  'stat-card': drawStatCard,
  'beat-sequence': drawBeatSequence,
};

/**
 * Gambar satu frame komposisi ke ctx (dipakai untuk preview & test).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} templateId
 * @param {number} width
 * @param {number} height
 * @param {number} time  detik
 * @param {object} props
 * @param {number} totalSeconds
 * @param {HTMLVideoElement|null} videoEl
 */
export function drawCompositionFrame(ctx, templateId, width, height, time, props = {}, totalSeconds = 6, videoEl = null) {
  const draw = MG_COMPOSITIONS[templateId];
  if (!draw) throw new Error('Template Motion Graphics tidak dikenal: ' + templateId);
  draw(ctx, width, height, time, props, totalSeconds, videoEl);
}

/**
 * Dukungan render client-side?
 * Perlu: WebCodecs (VideoEncoder) + mediabunny + Canvas 2D.
 */
export function clientRenderSupported() {
  return typeof window !== 'undefined'
    && typeof window.VideoEncoder === 'function'
    && typeof window.VideoFrame === 'function'
    && typeof document !== 'undefined'
    && typeof document.createElement('canvas').getContext === 'function';
}

/**
 * Render Motion Graphics di browser -> Blob MP4.
 *
 * @param {object} req  {template, aspect, duration, props}
 * @param {object} opts {onProgress({progress, phase})}
 * @returns {Promise<{blob: Blob, width: number, height: number, durationMs: number}>}
 */
export async function renderMotionGraphicsOnClient(req, opts = {}) {
  if (!clientRenderSupported()) {
    throw Object.assign(new Error('Browser ini belum mendukung render video (WebCodecs). Coba Chrome 94+, Firefox 130+, atau Safari 26+.'), {status: 415});
  }
  const templateId = String(req.template || '').trim();
  const draw = MG_COMPOSITIONS[templateId];
  if (!draw) {
    throw Object.assign(new Error('Template Motion Graphics tidak dikenal.'), {status: 400});
  }
  const template = MG_CLIENT_TEMPLATES.find((t) => t.id === templateId);
  const aspect = template?.aspects?.includes(req.aspect) ? req.aspect : (template?.aspects?.[0] || '9:16');
  const size = MG_ASPECTS[aspect];
  const durationInSeconds = template?.durations?.includes(Number(req.duration))
    ? Number(req.duration)
    : (template?.defaultDuration || 6);
  const props = req.props && typeof req.props === 'object' ? req.props : {};

  const totalFrames = Math.max(1, Math.round(durationInSeconds * MG_FPS));

  // Mediabunny dimuat dinamis (besar) — hanya saat render benar-benar jalan.
  // Vendor ESM diletakkan di public/vendor/ supaya tanpa bundler pun bisa
  // di-import browser (Vercel menyajikan public/ apa adanya).
  opts.onProgress?.({progress: 0, phase: 'preparing'});
  const mediabunny = await import('./vendor/mediabunny.min.mjs');
  const {Output, Mp4OutputFormat, BufferTarget, CanvasSource, getFirstEncodableVideoCodec} = mediabunny;

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) {
    throw Object.assign(new Error('Canvas 2D tidak tersedia di browser ini.'), {status: 415});
  }

  // Video sumber (kalau template caption punya src).
  let videoEl = null;
  if (templateId === 'captioned-clip' && props.src) {
    videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.src = String(props.src);
    try {
      await videoEl.play();
    } catch {
      // Autoplay bisa ditolak -> tetap jalan dengan latar teks.
    }
  }

  // Codec: H.264 (avc) dulu supaya MP4-nya universal, lalu vp9/av1.
  let videoCodec = null;
  try {
    videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {
      width: size.width,
      height: size.height,
    });
  } catch { /* biopsy — fallback ke cek manual */ }
  if (!videoCodec) {
    throw Object.assign(new Error('Browser ini tidak mendukung encoder video (H.264/VP9). Coba Chrome 94+, Firefox 130+, atau Safari 26+.'), {status: 415});
  }

  const output = new Output({
    format: new Mp4OutputFormat({fastStart: 'in-memory'}),
    target: new BufferTarget(),
  });

  const source = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: bitrateForDuration(durationInSeconds),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, {frameRate: MG_FPS});

  // D-276 — Voice-over TTS (opsional). Kalau ada, audio-nya ditempel sebagai
  // track terpisah lalu di-mux ke MP4 yang sama.
  let audioBuffer = null;
  let ttsProvider = null;
  const voiceText = String(props.voiceoverText || '').trim();
  if (voiceText) {
    opts.onProgress?.({progress: 2, phase: 'voiceover'});
    try {
      const tts = await fetchTtsAudio(voiceText, {
        voice: props.voice,
        style: props.voiceStyle,
        headers: opts.headers || {},
      });
      if (tts) {
        audioBuffer = await decodeTtsAudio(tts.buffer);
        ttsProvider = tts.provider;
        if (!audioBuffer) {
          // Audio tidak bisa di-decode -> video tetap jadi tanpa suara.
          opts.onWarning?.('Audio voice-over tidak bisa di-decode di browser ini.');
          opts.onProgress?.({progress: 3, phase: 'voiceover'});
        }
      }
    } catch (error) {
      // Voice-over gagal -> video tetap dirender (tanpa suara), jangan gagal
      // seluruh render.
      opts.onProgress?.({progress: 3, phase: 'voiceover'});
      opts.onWarning?.('Voice-over gagal dibuat: ' + (error?.message || 'tidak diketahui'));
    }
  }

  let audioSourceToFeed = null;
  if (audioBuffer && typeof mediabunny.AudioBufferSource === 'function') {
    // D-276: track audio — codec WAJIB diisi (tanpa itu mediabunny melempar
    // "Invalid audio codec undefined"). AAC = standar MP4, tapi tidak semua
    // browser bisa encode konfigurasi itu -> cek dulu lewat
    // getFirstEncodableAudioCodec, lalu jatuh ke MP3.
    // Urutan codec: AAC (standar MP4, paling universal) -> MP3 -> Opus
    // -> PCM. Tidak semua browser bisa encode AAC/MP3 (mis. Chromium
    // headless di sandbox ini cuma punya Opus + PCM), jadi WAJIB dicek dulu.
    let audioCodec = 'aac';
    try {
      if (typeof mediabunny.getFirstEncodableAudioCodec === 'function') {
        const found = await mediabunny.getFirstEncodableAudioCodec(['aac', 'mp3', 'opus', 'pcm-s16']);
        if (found) audioCodec = found;
      }
    } catch { /* biarkan default aac */ }
    if (audioCodec === 'pcm-s16') {
      // PCM tidak lossy -> file lebih besar, tapi selalu bisa di-encode.
      opts.onWarning?.('Codec audio fallback PCM (tidak terkompresi).');
    }
    try {
      const audioSource = new mediabunny.AudioBufferSource({
        codec: audioCodec,
        bitrate: mediabunny.QUALITY_HIGH ?? 128e3,
      });
      output.addAudioTrack(audioSource);
      audioSourceToFeed = audioSource;
    } catch (error) {
      // Codec tidak didukung -> video tetap jadi tanpa suara.
      opts.onWarning?.('Codec audio tidak didukung: ' + (error?.message || 'tidak diketahui'));
    }
  }

  // Output harus started sebelum sample bisa masuk.
  await output.start();

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / MG_FPS;
    // Frame video ikut disinkronkan ke waktu render.
    // D-275: kalau video sumber lebih pendek dari durasi pilihan, video
    // diulang (loop) supaya layar tidak beku di frame terakhir.
    if (videoEl) {
      try {
        const vDur = Number(videoEl.duration) || 0;
        const seek = vDur > 0 ? (t % vDur) : t;
        videoEl.currentTime = Math.min(seek, vDur > 0 ? vDur : t);
      } catch { /* seeking belum siap */ }
    }
    draw(ctx, size.width, size.height, t, props, durationInSeconds, videoEl);

    // CanvasSource.add() melakukan encode sendiri (WebCodecs internal mediabunny)
    // dan menghormati backpressure writer.
    await source.add(t, 1 / MG_FPS);

    if (frame % 3 === 0) {
      opts.onProgress?.({progress: Math.round((frame / totalFrames) * 85), phase: 'rendering'});
      // Yield supaya UI tetap responsif.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // D-276: kirim voice-over ke track audio (AudioBufferSource.add), lalu tutup.
  if (audioSourceToFeed && audioBuffer) {
    try {
      await audioSourceToFeed.add(audioBuffer);
    } catch (error) {
      opts.onWarning?.('Gagal menyisipkan audio: ' + (error?.message || 'tidak diketahui'));
    }
    try { await audioSourceToFeed.close(); } catch { /* abaikan */ }
  }

  opts.onProgress?.({progress: 90, phase: 'encoding'});
  await output.finalize();
  opts.onProgress?.({progress: 97, phase: 'muxing'});

  const buffer = output.target.buffer;
  const blob = new Blob([buffer], {type: 'video/mp4'});

  if (videoEl) {
    try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch { /* abaikan */ }
  }

  // D-252: pastikan hasil muat di batas upload (Vercel 4,5 MB). Kalau
  // kelewat besar, kompres ulang dengan bitrate lebih rendah; kalau tetap
  // besar, beri pesan jelas (bukan gagal diam-diam di server).
  let finalBlob = blob;
  if (finalBlob.size > MG_UPLOAD_MAX_BYTES) {
    opts.onProgress?.({progress: 98, phase: 'compressing'});
    finalBlob = await reencodeSmaller(canvas, size, durationInSeconds, videoCodec, finalBlob.size);
  }
  // D-275: durasi panjang menghasilkan file > 4 MB. Jalur client-side
  // mengirim file >= 4 MB lewat signed-upload (uploadBlobDirect) yang tidak
  // punya batas body, jadi batas keras di sini hanya relevan untuk jalur
  // multipart server (limit ~4,5 MB Vercel).
  // Batas client: 24 MB — cukup untuk 30 detik di bitrate 1,4 Mbps (~5 MB).
  const HARD_MAX_BYTES = 24 * 1024 * 1024;
  if (finalBlob.size > HARD_MAX_BYTES) {
    throw Object.assign(
      new Error('Video terlalu besar untuk dikirim (' + (finalBlob.size / 1024 / 1024).toFixed(1) + ' MB). Pilih durasi lebih pendek.'),
      {status: 413},
    );
  }

  opts.onProgress?.({progress: 100, phase: 'done'});
  return {
    blob: finalBlob,
    width: size.width,
    height: size.height,
    durationMs: Math.round(durationInSeconds * 1000),
    bytes: finalBlob.size,
    // D-276: info voice-over (provider mana yang dipakai).
    hasAudio: Boolean(audioBuffer),
    ttsProvider: ttsProvider || null,
  };
}

/**
 * D-252: render ulang dengan bitrate lebih rendah sampai muat.
 *
 * D-275: target ukuran mengikuti jalur upload yang akan dipakai:
 *  - durasi pendek (<= 12 detik) -> 4 MB (multipart server, Vercel ~4,5 MB)
 *  - durasi panjang (> 12 detik)  -> 24 MB (signed-upload, tanpa batas body)
 * @returns {Promise<Blob>}
 */
async function reencodeSmaller(canvas, size, durationInSeconds, codec, previousSize) {
  const mediabunny = await import('./vendor/mediabunny.min.mjs');
  const {Output, Mp4OutputFormat, BufferTarget, CanvasSource} = mediabunny;
  const totalFrames = Math.max(1, Math.round(durationInSeconds * MG_FPS));
  const targetBytes = durationInSeconds > 12
    ? 24 * 1024 * 1024
    : MG_UPLOAD_MAX_BYTES;

  // Bitrate turun bertahap: 60% -> 40% -> 25% dari nilai semula.
  const base = bitrateForDuration(durationInSeconds);
  for (const factor of [0.6, 0.4, 0.25]) {
    const output = new Output({
      format: new Mp4OutputFormat({fastStart: 'in-memory'}),
      target: new BufferTarget(),
    });
    const source = new CanvasSource(canvas, {
      codec,
      bitrate: Math.max(400_000, Math.floor(base * factor)),
      keyFrameInterval: 2,
    });
    output.addVideoTrack(source, {frameRate: MG_FPS});
    await output.start();
    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / MG_FPS;
      await source.add(t, 1 / MG_FPS);
    }
    await output.finalize();
    const blob = new Blob([output.target.buffer], {type: 'video/mp4'});
    if (blob.size <= targetBytes) return blob;
    if (blob.size >= previousSize) break;
  }
  return new Blob([], {type: 'video/mp4'});
}
