# Motion Graphics — Remotion

Sub-project Remotion untuk mode **"Motion Graphics"** di Studio SherlyStudio
(D-249). Render berjalan **di server sendiri** (Node SSR API), **bukan AWS
Lambda** → biaya bulanan **$0**.

> Plan & keputusan: `docs/PLAN-D249.md` · Riset: `docs/RESEARCH-REMOTION.md`

## Struktur

```
motion-graphics/
  package.json          # remotion + @remotion/bundler + @remotion/renderer
  remotion.config.ts
  tsconfig.json
  src/
    index.ts            # registerRoot
    Root.tsx            # daftar Composition (3 template x 3 rasio)
    theme.ts            # palet Sherly + skala tipografi + rasio
    compositions/
      BrandedIntro.tsx  # Intro BerBrand
      CaptionedClip.tsx # Klip Bersubtitle
      StatCard.tsx      # Kartu Statistik
```

Sub-project **terpisah** dari repo utama (yang vanilla JS, tanpa bundler)
supaya bobot repo utama tetap ringan.

## Setup

```bash
cd motion-graphics
npm install
```

### Chromium untuk headless render

Remotion mengunduh Chrome Headless Shell sendiri saat render
(`npx remotion browser ensure`). Kalau jaringan server memblokir host
unduhan, pakai Chromium yang sudah ada:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/ke/chromium
```

Di sandbox repo ini dipakai `@sparticuz/chromium` (Chromium 153 via npm).

FFmpeg **tidak perlu install** — `@remotion/compositor-linux-x64-gnu` sudah
membawa ffmpeg + ffprobe.

## Development / preview

```bash
cd motion-graphics
npm run studio        # Remotion Studio (preview + edit komposisi)
npm run compositions  # daftar id komposisi
npm run render -- BrandedIntro out/intro.mp4
```

## Server (produksi)

`server/motion-graphics.js` memakai API SSR Node:

```js
bundle()            -> selectComposition()  -> renderMedia()  -> MP4
```

Server me-resolve `@remotion/*` manual dari `motion-graphics/node_modules`
(lewat `createRequire`) karena Node ESM tidak bisa import langsung ke folder.

## Lisensi

Remotion memakai **Remotion License** (custom, source-available):

- **Gratis** untuk individu, for-profit **≤ 3 orang**, non-profit, atau evaluasi.
- **Wajib bayar** (Company License) kalau for-profit **≥ 4 orang**.
- Kalau produk jadi layanan render otomatis untuk user lain → tier
  **Automators** ($0,01/render, min $100/bulan) → **jangan auto-render tanpa
  cek lisensi**.

Set `REMOTION_LICENSE_KEY` di environment server kalau punya key. Tanpa key,
render dijalankan sebagai `isProduction: false` (tidak dihitung render berlisensi).

## Aturan animasi (WAJIB)

- Animasi **harus** pakai `useCurrentFrame()` + `interpolate()` / `spring()`.
- **CSS `transition` / `animation` TIDAK akan ter-render** — dilarang.
- `fps` selalu dari `useVideoConfig()` (bukan konstanta).
- `useCurrentFrame()` harus di komponen **paling kecil** yang membutuhkannya.
- Safe area (1080 px): teks utama ≥ 80 px dari sisi, ≥ 100 px dari atas/bawah.
- Headline ≥ 84 px, teks pendukung ≥ 44 px.
