// Editor Video — helper murni tanpa DOM (D-158).
// Dipakai video-editor.js via window.VE_CORE dan dites unit di Node via globalThis.
(function () {
  'use strict';

  // Rasio → ukuran kanvas ekspor (sisi panjang 1080/1920).
  const VE_RATIOS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };

  // Filter sama seperti Editor foto (D-152) biar konsisten.
  const VE_FILTERS = [
    ['normal', 'Normal', ''],
    ['cerah', 'Cerah', 'brightness(1.12) saturate(1.15)'],
    ['kontras', 'Kontras', 'contrast(1.22) saturate(1.05)'],
    ['hangat', 'Hangat', 'sepia(0.28) saturate(1.25) brightness(1.05)'],
    ['dingin', 'Dingin', 'hue-rotate(-12deg) saturate(1.12) brightness(1.04)'],
    ['vintage', 'Vintage', 'sepia(0.45) contrast(0.92) brightness(1.12) saturate(0.85)'],
    ['mono', 'B&W', 'grayscale(1) contrast(1.12) brightness(1.08)'],
    ['drama', 'Drama', 'contrast(1.38) saturate(1.3) brightness(0.94)'],
  ];

  // Font sama seperti Editor foto (D-154): keluarga CSS + weight untuk render kanvas.
  const VFONTS = {
    list: [['Inter', 'Inter — rapi'], ['Caveat', 'Caveat — tulisan tangan'], ['Sacramento', 'Sacramento — mewah'], ['Bebas Neue', 'Bebas Neue — tegas'], ['Lora', 'Lora — klasik'], ['Archivo Black', 'Archivo Black — tebal']],
    family: { Inter: 'Inter, Arial, sans-serif', Caveat: 'Caveat, cursive', Sacramento: 'Sacramento, cursive', 'Bebas Neue': "'Bebas Neue', sans-serif", Lora: 'Lora, Georgia, serif', 'Archivo Black': "'Archivo Black', sans-serif" },
    weight: { Inter: 700, Caveat: 700, Sacramento: 400, 'Bebas Neue': 400, Lora: 400, 'Archivo Black': 400 },
  };

  const MIN_SEG = 0.5; // detik minimum per klip

  // 73.4 → "1:13.4"; null/negatif → "0:00.0".
  // Digit persepuluh dibulatkan dulu (double 4.8 = 4.7999… — floor mentah bisa meleset),
  // lalu carry ke detik & menit kalau membulat ke 10.
  function fmtTime(sec) {
    const s = Math.max(0, Number(sec) || 0);
    let m = Math.floor(s / 60);
    let r = s - m * 60;
    let d = Math.round((r % 1) * 100) / 10;
    if (d >= 10) { d = 0; r = Math.floor(r) + 1; }
    if (r >= 60) { r -= 60; m += 1; }
    return m + ':' + String(Math.floor(r)).padStart(2, '0') + '.' + Math.floor(d);
  }

  // Total durasi timeline (klip siap saja: dur > 0).
  function timelineDuration(clips) {
    return (Array.isArray(clips) ? clips : []).reduce((a, c) => a + Math.round(Math.max(0, (Number(c.end) || 0) - (Number(c.start) || 0)) * 1000) / 1000, 0);
  }

  // Posisi global t → klip aktif + waktu lokal. null kalau di luar rentang.
  function clipAt(clips, t) {
    if (!Array.isArray(clips)) return null;
    let acc = 0;
    for (let i = 0; i < clips.length; i++) {
      const len = Math.max(0, (Number(clips[i].end) || 0) - (Number(clips[i].start) || 0));
      if (t < acc + len || i === clips.length - 1) return { index: i, clip: clips[i], localT: Math.round(Math.min(Math.max(t - acc, 0), len) * 1000) / 1000 };
      acc += len;
    }
    return null;
  }

  // Rapikan titik trim ke batas aman: 0 ≤ start < end ≤ dur, segmen min MIN_SEG.
  // Video yang durasinya ≤ MIN_SEG dipakai utuh (tidak dipaksa 0,5 dtk).
  function clampTrim(dur, start, end) {
    const durN = Number(dur);
    const d = (!isFinite(durN) || durN <= 0) ? MIN_SEG : durN;
    if (d <= MIN_SEG) return { start: 0, end: +d.toFixed(3) };
    let s = Math.min(Math.max(Number(start) || 0, 0), d - MIN_SEG);
    let e = Math.min(Math.max(Number(end) || 0, s + MIN_SEG), d);
    return { start: +s.toFixed(3), end: +e.toFixed(3) };
  }

  // Bagi klip di titik t (waktu absolut dalam sumber video) → dua segmen.
  // null kalau terlalu mepet ke ujung (masing-masing sisi harus ≥ MIN_SEG).
  function splitAt(clip, t) {
    if (!clip || typeof clip !== 'object') return null;
    const cut = Number(t);
    if (!isFinite(cut)) return null;
    if (cut - (Number(clip.start) || 0) < MIN_SEG) return null;
    if ((Number(clip.end) || 0) - cut < MIN_SEG) return null;
    return {
      left: { ...clip, end: +cut.toFixed(3) },
      right: { ...clip, start: +cut.toFixed(3) },
    };
  }

  // Cover-fit: seluruh kanvas terisi video (mirip object-fit:cover) — untuk render ekspor.
  function coverFit(vw, vh, cw, ch) {
    const scale = Math.max(cw / vw, ch / vh);
    const w = vw * scale, h = vh * scale;
    return { dx: (cw - w) / 2, dy: (ch - h) / 2, dw: w, dh: h };
  }

  // Pilih mimetype MediaRecorder terbaik. `supports` = fn (mime) => bool (diuji di unit).
  function pickMime(supports) {
    const cand = [
      ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
      ['video/mp4', 'mp4'],
      ['video/webm;codecs=vp9,opus', 'webm'],
      ['video/webm;codecs=vp8,opus', 'webm'],
      ['video/webm', 'webm'],
    ];
    for (const [mime, ext] of cand) {
      try { if (supports(mime)) return { mime, ext }; } catch {}
    }
    return null;
  }

  // Nama file ekspor: sherly-video-2026-11-20-k3x9a2.webm
  function exportName(ext, now) {
    const d = now ? new Date(now) : new Date();
    const date = isNaN(d) ? '0000-00-00' : d.toISOString().slice(0, 10);
    const rand = Math.random().toString(36).slice(2, 8);
    return 'sherly-video-' + date + '-' + rand + '.' + (ext || 'webm');
  }

  const g = typeof window !== 'undefined' ? window : globalThis;
  g.VE_CORE = { VE_RATIOS, VE_FILTERS, VFONTS, MIN_SEG, fmtTime, timelineDuration, clipAt, clampTrim, splitAt, coverFit, pickMime, exportName };
})();
