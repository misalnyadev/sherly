# Riset: Remotion (video-as-code) — November 2026

> Status: **riset Only** — belum ada implementasi. Dokumen ini bahan pertimbangan
> kalau nanti mau menambah capability baru di SherlyStudio.

---

## 1. Apa itu Remotion?

Framework **open-source (source-available)** untuk membuat video secara programatik
dengan **React**. Setiap frame video = render komponen React pada frame tertentu,
di-capture headless browser, lalu di-encode jadi MP4.

| | Detail |
|---|---|
| Divisi | Remotion GmbH, Zurich, Swiss (didirikan 2020, Jonny Burger) |
| Versi | **4.0.545** (npm, ~Nov 2026) — rilis hampir tiap hari |
| Stars | ~**64–67k** GitHub (agustus–oktober 2026) |
| Bahasa | TypeScript, internal stack Bun + Turborepo monorepo |
| Lisensi | **Remotion License** (bukan MIT) — custom, *source-available* |
| CLI | `npx create-video@latest`, `npx remotion studio`, `npx remotion render` |

**Konsep inti — "videos as code"**: komposisi = props, animasi = React state
terhadap `useCurrentFrame()`, bukan timeline/keyframe seperti After Effects.

---

## 2. Kenapa lagi tren sekarang? (Jan 2026)

### 2.1 Remotion Agent Skills — titik balik

**20 Januari 2026** Remotion resmi luncurkan **Agent Skills** (format SKILL.md
terbuka dari Vercel). Ini yang bikin viral:

- Demo resmi di X **6 juta views** dalam beberapa hari
- 8 minggu: **150.000 installs** di skills.sh — ranking **#5 overall**, **#1 skill
  non-platform company** (di atas Vercel/Anthropic/Microsoft)
- Per **5 Agustus 2026**: **> 440.000 installs**
- Cross-platform: Claude Code & Gemini CLI ~108k masing-masing, Cursor /
  OpenCode / Codex ~92–93k
- Demo produk jadi viral, community bikin "vibe editing"

Intinya: **barrier React/TS turun drastis** — cukup deskripsi natural language,
agent yang tulis kodenya.

### 2.2 Skill yang tersedia (13 official)

| Skill | Isi |
|---|---|
| `/remotion-best-practices` | umbrella — encompass semua skill lain |
| `/remotion-create` | buat project/composition baru |
| `/remotion-markup` | cara tulis React markup: animasi, layout, tipografi, media, audio, timing |
| `/remotion-studio` | jalankan preview |
| `/remotion-render` | render video/still, ekspor **OpenTimelineIO timeline** |
| `/remotion-captions` | subtitle & caption |
| `/remotion-maps` | animasi peta (Mapbox/MapLibre/MapTiler/GeoJSON, CesiumJS 3D flyover) |
| `/remotion-saas` | arsitektur aplikasi & integrasi produk |
| `/remotion-interactivity` | bikin elemen bisa diedit langsung di Studio |
| `/remotion-docs` | search dokumentasi + fetch halaman sebagai Markdown |
| `/remotion-license` | info lisensi & pembelian |
| `/remotion-upgrade` | upgrade Remotion + skill |
| `/remotion-multimedia` | mediabunny — metadata video/audio di browser |

**Install:**
```bash
npx remotion skills add          # di dalam project Remotion
npx skills add remotion-dev/skills  # CLI skills (kalau Remotion belum terinstall)
gh skill install remotion-dev/skills
npx create-video@latest --skills  # skip prompt saat buat project
```

> ⚠️ Anthropic advises: baca file skill sebelum install (skill bisa menyuruh agent
> menjalankan kode). Skill Remotion resmi, tapi tetap baik dicek.

### 2.3 Remotion Studio jadi interaktif (Nov 2026)

Remotion kini **bisa select, drag, trim, crop, edit** langsung — Studio jadi
editor visual di atas source yang sama (bukan layer terpisah seperti dulu).
=`"code becomes the video"`.

### 2.4 Context industri

- Pasar global AI video: **$18,6 M** akhir 2026, CAGR **34,2%** (dari $5,1 M di 2023)
- **78%** tim marketing sudah pakai AI video ≥1x per kuartal
- **73%** Fortune 500 mengintegrasikan AI video tools
- Biaya produksi: **$4.500/menit** (tradisional) → **~$400/menit** (AI), turun 91%
- Waktu produksi video 60 detik: **13 hari → 27 menit**
- Quote viral: *"Vibe Editing is going to kill Motion Designers"* — punitpalial

---

## 3. Perbandingan dengan yang sudah ada di SherlyStudio

| | Remotion | Kie AI (model video) | Shotstack / Creatomate |
|---|---|---|---|
| Nature | **programatik** (code) | generatif (diffusion) | template-based SaaS API |
| Output | deterministik, pixel-perfect | stokastik tiap render | deterministik |
| Kuat di | motion graphics, caption, data-viz, batch, template, UI demo | footage fotorealistis, shot sinematik | broadcast, JSON-driven, tidak perlu dev |
| Butuh dev | **ya** (React) | tidak | tidak |
| Biaya | lisensi + AWS | per detik/detik | per menit |

**Posisi Remotion = pelengkap, bukan pesaing Kie AI.** Satu framework untuk
*otomatisasi*, satu API untuk *konten generatif*. Kombinasi hybrid (agent pilih
metode per bagian) sudah jadi praktik umum.

---

## 4. Model lisensi & biaya (penting!)

### 4.1 Lisensi Remotion (custom)

| Lisensi | Untuk siapa | Harga |
|---|---|---|
| **Free License** | individu, non-profit, perusahaan **≤ 3 orang**, evaluasi | **$0** (termasuk komersial) |
| **Creators** | perusahaan 4+ orang, staf menulis video manual/bersama agent | **$25/bulan per seat** |
| **Automators** | render dari kode untuk pengguna (video editor, prompt-to-video app, batch) | **$0.01/render**, min **$100/bulan** (10.000 render) |
| **Enterprise** | terms kustom, compliance, support privat | **dari $500/bulan** |

> Catatan: **render compute (AWS) tidak termasuk lisensi** — ditagih terpisah ke
> akun AWS kita sendiri. Proposed Remotion 5.0: telemetry jadi wajib untuk tier
> Automators (opsi Enterprise untuk opt-out).
> ⚠️ Lisensi **tidak boleh menjual kembali** hasil turunan.

### 4.2 Biaya render Remotion Lambda (us-east-1, 2048 MB)

| Render | Warm | Cold |
|---|---|---|
| Hello World | $0,001 (7,56 s) | $0,001 (11,02 s) |
| **1 menit video** | **$0,017** (18,91 s) | $0,021 (15,52 s) |
| 10 menit remote HD | $0,103 (56,09 s) | $0,108 (60,98 s) |
| 10 detik 4K | $0,013 (45,28 s) | $0,014 (53,09 s) |

AWS Lambda: **$0,0000166667 per GB-second** (x86) + **$0,20 per juta request**.
Free tier 400.000 GB-second/bulan ≈ 390 render 1-menit.

**Contoh bulanan (1 menit 1080p, warm $0,017):**

| Tim | Lisensi | Lambda | Total |
|---|---|---|---|
| Studio kecil (3 org, 1.000 render) | $0 | $17,00 | **$18,38** |
| Tim marketing (8 org, 300 render) | $100 | $5,10 | **$105,51** |
| Produk video (10 org, 20.000 render) | $200 | $340,00 | **$666,60** |

> Untuk **prompt-to-video app** (use case SherlyStudio), yang relevan adalah tier
> **Automators**: $0,01/render + min $100/bulan + AWS. Totalnya ~$0,027–0,031 per
> video 1 menit.

### 4.3 Opsi rendering

| Backend | Package | Distributed | Max durasi | Catatan |
|---|---|---|---|---|
| **Lambda** | `@remotion/lambda` | ✅ parallel | 15 mnt timeout | **rekomendasi resmi**; biaya AWS sendiri |
| **Vercel Sandbox** | `@remotion/vercel` | ❌ 1 mesin | 45 mnt (Hobby) / 5 jam (Pro) | paling gampang setup |
| **Cloud Run** | `@remotion/cloudrun` | ❌ 1 mesin | 60 mnt | status **alpha** |
| **Server sendiri** | `@remotion/renderer` | ❌ | sesuai mesin | paling murah, idle tetap dibayar |
| **Browser (WebCodecs)** | client-side | — | — | stabil sejak v4.0.491 (subset elemen) |

---

## 5. Kompetitor

| Tool | Oleh | Lisensi | Stars | Bedanya |
|---|---|---|---|---|
| **Remotion** | Remotion GmbH | custom (free ≤3 org) | ~64k | React/TSX, paling matang |
| **HyperFrames** | HeyGen | **Apache-2.0** | ~14k (sedikit lebih tinggi dari Remotion di Okt 2026) | HTML+ CSS+ GSAP, **gratis selamanya**; HDR 10-bit, alpha, TTS lokal (Kokoro-82M), Whisper lokal, remove-bg bawaan. Render lokal 3,2 s vs Remotion 8,5 s; install 311 MB vs 870 MB |
| **Motion Canvas** | Motion Canvas | MIT | — | animasi = generator function TS; **repo inti tak rilis sejak Des 2024**, pindah ke fork (Canvas Commons, Revideo) |
| **Claude Motion** | Anthropic | ikut paket Claude Team/Enterprise | — | Artifact template di chat, **ekspor langsung MP4**, tapi 1 video/prompt, tanpa batch API |
| **CoAnimator** | CoAnimator | — | — | desktop studio, chat + timeline, agent-directed tanpa React; $99 sekali |
| Shotstack / Creatomate / JSON2Video | SaaS | — | — | JSON-driven, tanpa dev, tapi $/menit |

**Remotion vs HyperFrames** (penting buat SherlyStudio):

| Aspek | Remotion | HyperFrames |
|---|---|---|
| Bahasa | React/TSX | HTML+ CSS+ JS |
| Build step | wajib (bundler) | tidak |
| Seek-accurate | ❌ | ✅ |
| HDR / alpha | ❌ | ✅ |
| TTS & transkripsi lokal | ❌ | ✅ |
| Cloud distributed | ✅ Lambda (hyperscale) | ❌ lokal saja |
| Lisensi | custom, free ≤3 org | **Apache 2.0, gratis** |

**HyperFrames = lebih murah & open, tapi renderer-nya lokal saja** (belum ada
distributed cloud). Untuk SherlyStudio yang butuh server-side, Remotion lebih
matang.

---

## 6. Ekosistem & skill pihak ketiga

- **Remotion Motion Graphics Skill** (`liamrjohnston/remotion-motion-graphics-skill`) —
  **MIT**, 4 skill: kinetic text, AI workflow diagrams, cinematic camera moves,
  terminal demos, editorial highlights. Mandalur CLI mendeteksi 60+ agent
  (Claude Code, Codex, Cursor, OpenCode). Pasang bareng skill resmi:
  ```bash
  npx skills add liamrjohnston/remotion-motion-graphics-skill -g
  npx skills add remotion-dev/skills -g
  ```
  → skill ini kasih **rasa & koreografi**, skill resmi kasih **ketepatan API**.
- **ngram** — menjalankan Remotion di balik layar; user pilih gaya "Motion
  Graphics", tanpa terminal.
- Toolkit CBT: `@remotion/player` (embed composition di React app dengan inputs
  runtime → preview sebelum render server), **OpenTimelineIO export** (brid ke
  editor lain), **Mediabunny** (multimedia di browser).

---

## 7. Relevance untuk SherlyStudio

### 7.1 Yang cocok

| Kebutuhan SherlyStudio | Kenapa Remotion |
|---|---|
| **Caption/subtitle otomatis** massal | `/remotion-captions` — Nothing beats Remotion for captions |
| **Intro/outro branded** (5 detik depan, 8 detik belakang) | 1 template → judul/bahasa tak terbatas |
| **Data-driven video** (statistik, kasus studi, wrapper PDF → video) | props-driven, batch-friendly |
| **Batch/personalisasi** (100 video = 1 template) | "One video → traditional tools. 100 videos → Remotion" |
| **Preview di web** sebelum render | `@remotion/player` embed di React app |
| **Transisi ke After Effects** | export OpenTimelineIO |
| **Hybrid Kie + Remotion** | Kie untuk shot generatif, Remotion untuk layout/caption/animasi |

### 7.2 Yang TIDAK cocok

- ❌ Menggantikan Kie AI — bukan fotorealistis, bukan shot sinematik
- ❌ Non-developer — butuh React
- ❌ Render "1 video sekali" — tooling-nya lambat dibanding edit manual
- ❌ Modalitas "Karakter Bicara" (lipsync) — itu domain Kie/digital-human

### 7.3 blockers kalau mau integrasi

1. **Lisensi**: kalau SherlyStudio jadi **prompt-to-video app** untuk user lain →
   tier **Automators** ($0,01/render, min $100/bulan). Kalau hanya untuk internal
   kita sendiri & tim ≤3 → free.
2. **Rendering butuh Chromium headless** — di sandbox ini sudah ada
   (`@sparticuz/chromium` + `puppeteer-core`) tapi butuh alur Lambda/S3 kalau
   produksi.
3. **Stack React**: repo SherlyStudio sekarang **vanilla JS** (tanpa React,
   tanpa bundler) — pakai Remotion berarti menambah toolchain baru (bundler,
   TSX, kompilasi composition). Ini biaya engineering signifikan.
4. **Repo baru**: Remotion butuh project structure sendiri (`src/Root.tsx`,
   `Composition`, entry point `remotion`), bukan disisipkan ke `public/`.

---

## 8. Rekomendasi

**Jangan buru-buru.** Remotion tren karena Agent Skills + agent-friendly, bukan
karena menggantikan tools yang ada.

Prioritas kalau mau MOVE:

| Prioritas | Langkah | Estimasi |
|---|---|---|
| **P1** | **Pakai skill Remotion** di workflow agent-side (tanpa integrasi produk) — install `npx skills add remotion-dev/skills` + skill motion graphics, pakai buat membuat **intro/outro branded** & **video wrapper** untuk konten Studio | rendah |
| **P2** | Tambah **mode "Motion Graphics"** di Studio: generate composition TSX di repo terpisah, render via `@remotion/renderer` di server, hasilnya masuk galeri aset (pipeline `sherly_video_tasks` yang sudah ada) | tinggi |
| **P3** | Tambah **caption/subtitle massal** untuk hasil video Kie — pakai `/remotion-captions` atau alternatif lebih murah | sedang |
| **P4** | Integrasi **hybrid**: agent pilih Kie (visual generatif) vs Remotion (layout/anotasi) per bagian | tinggi |
| — | **Jangan** sekarang: ganti Studio ke React wholesale, atau Ads/Batch user-facing (masalah lisensi Automators) | — |

**Rekomendasi gw: mulai dari P1** (skill) — nol risiko lisensi, nol perubahan
arsitektur, tapi langsung memberi kita template intro/outro & motion graphics
yang bisa dipakai di konten Studio. P2 baru kalau ada user yang butuh
"video motion graphics" sebagai mode konten tersendiri.

---

## 9. Sumber

- https://www.remotion.dev/docs/ai/skills — daftar skill resmi
- https://www.remotion.dev/docs/lambda/cost-example — biaya Lambda
- https://www.remotion.dev/blog/make-videos-programmatically-interactively-and-agentically — Studio interaktif (Nov 2026)
- https://github.com/remotion-dev/skills — repo skill
- https://github.com/Liamrjohnston/remotion-motion-graphics-skill — skill motion graphics (MIT)
- https://www.npmjs.com/package/remotion — versi & release
- https://www.remotion.dev/docs/ — CLI & rendering options
- https://metavert.io/remotion — overview, lisensi, perbandingan motion canvas/hyperframes
- https://arceapps.com/blog/hyperframes-vs-remotion-2026/ — tabel perbandingan teknis
- https://www.wireflow.ai/blog/remotion-pricing — hitungan biaya bulanan
- https://www.stork.ai/en/remotion — review lisensi & harga
- https://www.ngram.com/blog/remotion-skills-sh-ai-video-creation — angka installs
- https://o-mega.ai/articles/remotion-video-generation-with-ai-agents-claude-code-2026 — use case
- https://www.startuphub.ai/ai-news/artificial-intelligence/2026/remotion-ai-video-makes-production-code-from-plain-prompts —.
