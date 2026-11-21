# PLAN-D249 — Mode "Motion Graphics" (render video programatik) + Skill Remotion

> Cabang: `arena/61b721fe-sherly` (base `6eebc18`)
> Status: **✅ SELESAI** — check 3✓, test **422/422**

---

## 0. Konteks

`docs/RESEARCH-REMOTION.md` (415 baris) hasil riset Remotion — statusnya masih
**"riset Only — belum ada implementasi"**. Rekomendasi therein:

| Prioritas | Isi | Status |
|---|---|---|
| **P0** | HyperFrames (Apache-2.0) | ⏭️ dilewati (user pilih Remotion) |
| **P1** | Install **skill Remotion** agent-side | ✅ **salah satu** ✅ |
| **P2** | Mode **"Motion Graphics"** di Studio (render lokal/server sendiri, $0) | ✅ **salah satu** ✅ |
| **P3** | Caption/subtitle massal | ⏭️ |
| **P4** | Hybrid Kie + Remotion | ⏭️ |

**Keputusan user:** gabung **P1 + P2**, deploy di **server sendiri / lokal → $0**
(bukan AWS Lambda, bukan min $100/bulan tier Automators).

**Yang TIDAK boleh terjadi** (dari riset):
- ❌ Render via AWS Lambda skala besar (biaya muncul).
- ❌ Fitur "user trigger render otomatis" tanpa cek lisensi → tier Automators.
- ❌ Ganti Studio ke React wholesale.

---

## 1. P1 — Skill Remotion agent-side

### Yang dipasang
`.claude/skills/` → **13 skill resmi** `remotion-dev/skills` (v4.0.545):

`remotion-best-practices` · `remotion-markup` · `remotion-create` · `remotion-render` ·
`remotion-studio` · `remotion-saas` · `remotion-captions` · `remotion-maps` ·
`remotion-interactivity` · `remotion-docs` · `remotion-license` · `remotion-multimedia` ·
`remotion-upgrade`

Fungsinya: bahan rujukan **API Remotion yang akurat** (SSR Node, `useCurrentFrame()`,
`interpolate()`, `spring()`, captions, FFmpeg, Studio) saat gw menulis komposisi.

### Skill MIT `liamrjohnston/remotion-motion-graphics-skill` — **DITOLAK**
Repo itu MIT & kegunaannya nyata (rasa & koreografi), **tapi**:
- Hard-gate `promptible-gate.mjs` (5 tahap: research → init → inspect → candidate → qa)
  yang **menolak build** kalau tak ada research brief 500+ karakter & reference MP4
  terverifikasi SHA-256.
- Hard rule **"Zero neon, glow, bloom, luminous edges, colored shadows, gradient
  orbs, cyan-purple gradients, glassmorphism"** → **bertentangan langsung** dengan
  brand Sherly (logo neon).
- Reference video milik produk lain (OpenMontage, TSenta, SmartLead, Kickbacks) +
  logo perusahaan lain (Claude, Cursor, Gemini, OpenAI, Slack, Notion…).
- Butuh **"independent critic"** (agent terpisah) — tidak tersedia di alur ini.

→ **Tidak dipasang** di `.claude/skills/` (karena akan auto-activate & bentrok).
Disimpan sebagai referensi di `docs/reference/remotion-motion-graphics-skill/`?

❌ DITOLAK — tidak dipasang. Rationale dicatat di PRD.

---

## 2. P2 — Mode "Motion Graphics" di Studio

### 2.1 Arsitektur

```
Studio (UI)  →  POST /api/studio/motion-graphics
                    ↓  (task, bukan request blocking)
              server/motion-graphics.js
                    ↓
              @remotion/bundler  →  bundle()  (1x, cache)
              @remotion/renderer →  selectComposition() + renderMedia()
                    ↓  (headless Chromium bawaan Remotion)
              MP4 → Supabase Storage (bucket studio-assets) → tabel assets
                    ↓
              UI polling → progres → galeri aset
```

**Kenapa Remotion & bukan HyperFrames:** user pilih Remotion; HyperFrames butuh
toolchain sendiri & belum diverifikasi di sandbox ini. Remotion Node SSR API
resmi & stabil.

**Kenapa in-process (bukan Lambda):** $0 total. Trade-off: 1 mesin, no
distributed queue, timeout server. → Karena itu render = **TASK** (tabel
`public.sherly_video_tasks` yang sudah ada, `provider='remotion'`), bukan
request blocking (batas `maxDuration` server = 60 dtk).

**Lisensi:** `licenseKey` = `process.env.REMOTION_LICENSE_KEY` kalau ada,
kalau tidak → `null` (bukan string kosong — string kosong invalid).
`isProduction: true` hanya kalau ada license key.

### 2.2 Komposisi

Project Remotion terpisah (butuh bundler + TSX/React), **tidak** dicampur ke
`public/`:

```
motion-graphics/
  package.json          (remotion, @remotion/bundler, @remotion/renderer, react, react-dom)
  remotion.config.ts
  src/
    index.ts            (registerRoot)
    Root.tsx            (daftar Composition)
    compositions/
      BrandedIntro.tsx  (intro branded 5-8 dtk — judul, subjudul, logo)
      CaptionedClip.tsx (klip + subtitle dari SRT/VTT)
      StatCard.tsx      (data-driven: angka + label)
```

**Penting (dari skill `remotion-markup`):**
- Animasi **WAJIB** pakai `useCurrentFrame()` + `interpolate()`/`spring()`.
  **DILARANG** CSS `transition`/`animation` (tidak akan ter-render).
- `fps` dari `useVideoConfig()` untuk semua konversi detik→frame.
- Safe area: teks utama ≥ 80 px dari sisi & 100 px dari atas/bawah (1080 px).
- Headline ≥ 84 px, teks pendukung ≥ 44 px (untuk 1080 px).

### 2.3 API

| Method | Route | Fungsi |
|---|---|---|
| `GET` | `/api/studio/motion-graphics/templates` | daftar template + aspect + durasi |
| `POST` | `/api/studio/motion-graphics` | buat task render (body: template, aspect, props) |
| `GET` | `/api/studio/motion-graphics/:id` | status task + progres + asset_id |

Task memakai tabel `public.sherly_video_tasks` yang sudah ada (kolom `provider`,
`model`, `status`, `progress`, `asset_id`, `meta`) → `provider='remotion'`.

### 2.4 UI

Mode baru di kotak **"Jenis Konten"** Studio:

```
Foto | Video | Karakter Bicara | Motion Graphics
```

- Ikon: `sparkles` atau `film`.
- Panel Pengaturan Konten += baris **Template** (Intro BerBranded / Caption /
  Stat Card) + **Durasi** (template punya durasi tetap →倒 ).
- Tombol aksi berubah jadi **"Render Video"** (bukan "Buat"/"Generate").
- Prompt tetap dipakai: prompt = **judul/teks** yang di-render (untuk intro);
  untuk Caption = teks subtitle (satu per baris = satu cue).
- Hasil render masuk **galeri aset** (grid atas composer) → bisa preview/download/
  reuse (D-198).

### 2.5 Test

`test/motion-graphics.test.js`:
1. Template terdaftar & endpoint ada di server.
2. `provider='remotion'` dipakai untuk task.
3. Task punya `asset_id` saat sukses.
4. Komposisi: tiap file `.tsx` memuat `useCurrentFrame` (anti CSS animation).
5. Tidak ada `animation:`/`transition:` di style inline komposisi.
6. UI: mode "Motion Graphics" ada di CONTENT_TYPES.
7. `licenseKey` handling: env → key, tidak ada → `null`.
8. Aset hasil render masuk bucket `studio-assets` (reuse `saveAsset`).

---

## 3. Urutan kerja — SELESAI

1. ✅ P1 — pasang 13 skill Remotion ke `.claude/skills/` (~1,5 MB markdown).
2. ✅ P2.1 — project `motion-graphics/` (Remotion 4.0.545 + React 19 + TS) + 3 komposisi
   (`BrandedIntro` · `CaptionedClip` · `StatCard`) + `theme.ts` (palet Sherly).
3. ✅ P2.2 — `server/motion-graphics.js` (validasi + license + bundle + render).
4. ✅ P2.3 — 3 route di `server/app.js` + runner background (`runMotionGraphicsRender`).
5. ✅ P2.4 — UI Studio: mode `motion`, bar template, tombol "Render", polling, progres bar,
   sembunyikan mode saat renderer tidak siap.
6. ✅ P2.5 — **32 test baru** (`test/motion-graphics.test.js` 25 + `test/motion-graphics-ui.test.js` 7).
   check 3✓ · test **422/422**.
7. ✅ Docs — `docs/PRD.md` entri D-249 + plan ini.

### Hasil verifikasi render nyata
| Template | Rasio | Output |
|---|---|---|
| BrandedIntro | 9:16 | 1080×1920 h264, 180 frame, 6,0 dtk, 382,6 KB |
| StatCard | 16:9 | 1920×1080, 371.844 B |
| CaptionedClip | 9:16 | 65.006 B |
| BrandedIntro | 1:1 | 1080×1080, 316.493 B |
| e2e via `server/motion-graphics.js` | 9:16 | 316.185 B, ~25 dtk (termasuk bundling) |

### Catatan operasional
- **Chromium**: sandbox memblokir host unduhan Remotion (`remotion.media`,
  `storage.googleapis.com`). Solusi: `@sparticuz/chromium` (Chromium 153) via npm →
  `REMOTION_BROWSER_EXECUTABLE` + `LD_LIBRARY_PATH` ke shared libs AL2023.
  Di server produksi: `npx remotion browser ensure` (Chrome Headless Shell) atau
  `REMOTION_BROWSER_EXECUTABLE`.
- **FFmpeg**: `@remotion/compositor-linux-x64-gnu` sudah membawa ffmpeg + ffprobe
  (h264/aac/prores/VP9) → tidak perlu install ffmpeg sistem.

---

## 4. Risiko & batasan

| Risiko | Mitigasi |
|---|---|
| Render butuh Chromium + FFmpeg; sandbox ini tidak punya | `@remotion/renderer` mengunduh Chrome Headless Shell sendiri (npm `@remotion/compositor`) → renderer自带 FFmpeg. Kalau gagal, feature flag OFF & UI sembunyikan mode. |
| Bundle Remotion butuh TSX + React → bobot repo | Project terpisah `motion-graphics/`, dependency terpisah → repo utama tetap ringan. |
| Render CPU lama & timeout server | Render = task async (tabel task) + `maxDuration` tak berlaku. Kontrol: durasi maks template ≤ 15 dtk. |
| Lisensi | `licenseKey` opsional; `isProduction` hanya kalau ada key. Docs: kalau produk jadi "render untuk user" → tier Automators (min $100/bln) → **jangan auto-render tanpa cek**. |
