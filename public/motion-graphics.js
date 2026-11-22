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
 * Bitrate (bit/detik) supaya hasil muat di bawah batas upload.
 * @param {number} durationInSeconds
 * @returns {number}
 */
export function bitrateForDuration(durationInSeconds) {
  const dur = Math.max(1, Number(durationInSeconds) || 1);
  // Sisakan ~15% untuk overhead multipart + muxing.
  const targetBytes = MG_UPLOAD_MAX_BYTES * 0.85;
  const bits = Math.floor((targetBytes * 8) / dur);
  // Batas bawah & atas supaya tidak terlalu pecil nor overly besar.
  return Math.min(Math.max(bits, 800_000), 6_000_000);
}

/** Template Motion Graphics (harus sama dengan server/motion-graphics.js). */
export const MG_CLIENT_TEMPLATES = [
  {
    id: 'branded-intro',
    label: 'Intro BerBrand',
    hint: 'Judul + subjudul + logo Sherly, cocok buat pembuka konten.',
    icon: 'sparkles',
    defaultDuration: 6,
    durations: [5, 6, 8],
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
    durations: [6, 8, 10],
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
    durations: [4, 5, 6],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {key: 'value', label: 'Nilai', placeholder: 'Contoh: 3.2x', required: true},
      {key: 'label', label: 'Label', placeholder: 'Contoh: lebih cepat produksi', required: true},
      {key: 'note', label: 'Catatan', placeholder: 'Contoh: Data internal, Q3 2026'},
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

  // Spring: judul masuk ~0.35 dtk, subjudul ~1.15 dtk.
  const titleIn = spring(t - 0.35, {damping: 200, mass: 0.7});
  const subIn = spring(t - 1.15, {damping: 200, mass: 0.9});

  // Denyut cahaya (loop).
  const pulse = 0.72 + 0.28 * ((Math.sin(t * Math.PI * 0.9) + 1) / 2);

  ctx.save();
  ctx.globalAlpha = fadeOut;
  drawBackground(ctx, w, h, pulse * 0.9);

  const cx = w / 2;
  const cy = h / 2;

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
  const valueIn = spring(t - 0.3, {damping: 200, mass: 0.8});
  const labelIn = spring(t - 0.85, {damping: 200, mass: 1});
  const noteIn = spring(t - 1.35, {damping: 200, mass: 1.1});
  const cardScale = lerp(0.94, 1, clamp(valueIn, 0, 1));

  ctx.save();
  ctx.globalAlpha = fadeOut;
  drawBackground(ctx, w, h);

  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(cardScale, cardScale);
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

/** Dispatcher komposisi. */
const MG_COMPOSITIONS = {
  'branded-intro': drawBrandedIntro,
  'captioned-clip': drawCaptionedClip,
  'stat-card': drawStatCard,
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
  // Output harus started sebelum sample bisa masuk.
  await output.start();

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / MG_FPS;
    // Frame video ikut disinkronkan ke waktu render.
    if (videoEl) {
      try {
        videoEl.currentTime = Math.min(t, videoEl.duration || t);
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
  if (finalBlob.size > MG_UPLOAD_MAX_BYTES) {
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
  };
}

/**
 * D-252: render ulang dengan bitrate lebih rendah sampai muat.
 * @returns {Promise<Blob>}
 */
async function reencodeSmaller(canvas, size, durationInSeconds, codec, previousSize) {
  const mediabunny = await import('./vendor/mediabunny.min.mjs');
  const {Output, Mp4OutputFormat, BufferTarget, CanvasSource} = mediabunny;
  const totalFrames = Math.max(1, Math.round(durationInSeconds * MG_FPS));

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
    if (blob.size <= MG_UPLOAD_MAX_BYTES) return blob;
    if (blob.size >= previousSize) break;
  }
  return new Blob([], {type: 'video/mp4'});
}
