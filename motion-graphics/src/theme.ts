/**
 * D-249 — Tema Motion Graphics SherlyStudio.
 *
 * Token warna disalin PERSIS dari palet resmi app (lihat tools/check-palette.js):
 * gelap (biru-hitam/plum) + pink + putih. Tidak ada warna lain yang boleh
 * masuk ke komposisi — supaya hasil render terasa satu keluarga dengan UI.
 */

export const theme = {
  bg: '#070b14',
  bgElevated: '#0c1422',
  bgSoft: '#101b2c',
  plum: '#24142a',
  plumLight: '#311738',
  line: '#24344e',
  lineSoft: '#1c2b40',
  pink: '#f044a8',
  pinkBright: '#ff72c5',
  pinkSoft: '#ff9bdc',
  pinkPale: '#ffd0ec',
  pinkDeep: '#d82d91',
  white: '#f4f5fb',
  textDim: '#cfd6e4',
  textFaint: '#a9b8cd',
  textGhost: '#91a2b9',
};

/**
 * Rasio yang didukung Studio.
 * Nilai = [lebar, tinggi] dalam piksel. Mengikuti skill `remotion-create`
 * (video-layout.md): teks utama >= 80px dari sisi, >= 100px dari atas/bawah.
 */
export const ASPECTS = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
} as const;

export type AspectKey = keyof typeof ASPECTS;

/**
 * Skala tipografi relatif terhadap lebar komposisi.
 * Dari skill `remotion-create/video-layout.md`: untuk 1080px -> headline 84px,
 * teks pendukung 44px. Di sini diskalakan proporsional terhadap lebar.
 */
export function typeScale(width: number) {
  const k = width / 1080;
  return {
    headline: Math.round(84 * k),
    subhead: Math.round(48 * k),
    body: Math.round(34 * k),
    caption: Math.round(26 * k),
    kicker: Math.round(30 * k),
  };
}

/** Padding aman (px) mengikuti lebar komposisi. */
export function safePadding(width: number) {
  return Math.round(width * 0.074); // ~80px pada 1080
}
