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
| **Remotion** | Remotion GmbH | custom (free ≤3 org) | ~64–73k | React/TSX, paling matang, Lambda distributed paling matang |
| **HyperFrames** ⭐ | HeyGen | **Apache-2.0** | **~85k** (per Nov 2026 — tembus Remotion) | HTML+ CSS+ JS, **gratis tanpa ambang seat/render**; 20 skill agent, ~450 blok siap pakai, alpha WebM/MOV, HLS, 4K+HDR, `--batch` JSON, Cloud Run/Docker/Lambda. Render lokal 3,2 s vs Remotion 8,5 s; install 311 MB vs 870 MB. Studio desktop (Mac/Win/Linux) + Claude Code plugin |
| **Motion Canvas** | Motion Canvas | MIT | — | animasi = generator function TS; **repo inti tak rilis sejak Des 2024**, pindah ke fork (Canvas Commons, Revideo) |
| **Claude Motion** | Anthropic | ikut paket Claude Team/Enterprise | — | Artifact template di chat, **ekspor langsung MP4**, tapi 1 video/prompt, tanpa batch API |
| **CoAnimator** | CoAnimator | — | — | desktop studio, chat + timeline, agent-directed tanpa React; $99 sekali |
| Shotstack / Creatomate / JSON2Video | SaaS | — | — | JSON-driven, tanpa dev, tapi $/menit |

**Remotion vs HyperFrames** (penting buat SherlyStudio):

| Aspek | Remotion | HyperFrames |
|---|---|---|
| Bahasa | React/TSX | HTML+ CSS+ JS |
| Build step | wajib (bundler) | **tidak** |
| Seek-accurate | ❌ | ✅ |
| HDR / alpha | ❌ | ✅ (alpha di WebM/MOV) |
| TTS & transkripsi lokal | ❌ | ✅ (Kokoro-82M 54 suara, Whisper) |
| Remove background | ❌ | ✅ (model neural bawaan) |
| Cloud distributed | ✅ Lambda (hyperscale) | ✅ AWS Lambda / Cloud Run / Docker / HeyGen cloud |
| Skill agent | 13 official | **20** + Claude Code plugin |
| Blok siap pakai | Remotion Elements | **~450** (`npx hyperframes add <name>`) |
| Output | MP4, ProRes, PNG seq, VP8/9, AV1 | MP4, WebM, MOV, GIF, PNG seq, **HLS** |
| Batch | props | `--variables` + `--batch rows.json` |
| Lisensi | custom, free ≤3 org, **bayar ≥4 org** | **Apache 2.0, gratis selamanya** |
| Headcount | ada ambang | **tidak ada ambang** |

**Kesimpulan 2026:** HyperFrames sekarang **lebih popular** (85k vs 73k stars),
lebih murah (**nol ambang lisensi**), dan **lebih cocok dengan repo SherlyStudio**
(vanilla JS, tanpa React/bundler). Remotion masih unggul di ecosystem React,
Lambda distributed, dan tooling berbayar berbasis seat.

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
   kita sendiri & tim ≤3 → free. **Atau pakai HyperFrames (Apache-2.0) → nol
   ambang, nol biaya lisensi.**
2. **Rendering butuh Chromium headless** — di sandbox ini sudah ada
   (`@sparticuz/chromium` + `puppeteer-core`) tapi butuh alur Lambda/S3 kalau
   produksi.
3. **Stack React**: repo SherlyStudio sekarang **vanilla JS** (tanpa React,
   tanpa bundler) — pakai Remotion berarti menambah toolchain baru (bundler,
   TSX, kompilasi composition). Ini biaya engineering signifikan.
   **HyperFrames tidak punya masalah ini** — komposisinya HTML/CSS/JS biasa,
   tanpa build step, dan bisa di-render dari string HTML yang disimpan di DB.
4. **Repo baru**: Remotion butuh project structure sendiri (`src/Root.tsx`,
   `Composition`, entry point `remotion`), bukan disisipkan ke `public/`.

---

## 7b. Bisa tanpa biaya bulanan? — **YA, ada 3 jalur gratis**

Pertanyaan kunci. Jawaban singkat: **bisa, tapi syaratnya "kita" bukan "produk
untuk orang lain"**.

### Jalur A — Remotion Free License (lisensi $0, tapi compute/AWS tetap ada)

Official LICENSE.md: gratis untuk
- individu,
- **for-profit dengan ≤ 3 karyawan**,
- non-profit,
- yang masih evaluasi (belum komersial).

Komersial **diizinkan**, tanpa batas. Syaratnya: *"Even if you are incorporated, you
can operate under the Free License, as long as your total headcount is 3 or less."*

⚠️ **Dua jebakan:**
1. **Hitung headcount, bukan revenue/pengguna.** Batasnya 3 orang, bukan "3 akun".
2. **"Collaborations"** — kalau klien yang memiliki/mengoperasikan project Remotion,
   headcount kedua pihak **digabung** untuk ambang 4 orang. Untuk agency, project
   milik klien = tambah headcount klien.

Yang **tidak** diizinkan: menjual/menyewakan/melicense turunan Remotion sendiri.

**Yang gratis vs yang tidak di jalur ini:**

| Komponen | Gratis? |
|---|---|
| Lisensi Remotion | **$0** (kalau ≤3 org) |
| Render lokal / server sendiri | **$0** — kita yang bayar CPU server sendiri |
| Remotion Studio / Player (preview) | **$0** — preview tidak dihitung render |
| AWS Lambda | ❌ $0,017–0,021 per menit 1080p (tagih ke akun AWS kita) |
| S3 storage + egress | ❌ $0,023/GB/bulan + $0,09/GB egress |
| Font/media pihak ketiga | ❌ terpisah |

### Jalur B — Render lokal/server sendiri (**$0 total**)

`@remotion/renderer` (Node.js/Bun API) — tanpa AWS sama sekali:
- Lisensi $0 (kalau ≤3 org) + **compute = server yang sudah kita punya** (Vercel/
  Railway/instance yang sudah berjalan) → **biaya bulanan = $0 tambahan**
- Trade-off: tidak distributed (1 mesin), tidak ada queue, dan kita yang bangun
  antrean/progress/logging sendiri
- Realistis untuk volume **rendah–menengah** (puluhan video/bulan)

### Jalur C — **HyperFrames (Apache-2.0) = $0 tanpa syarat apa pun**

Ini jawaban paling bersih kalau Concern utamanya "biaya bulanan":

| | Remotion | **HyperFrames** |
|---|---|---|
| Lisensi | custom, **bayar di ≥4 org** | **Apache-2.0 — gratis untuk semua**, tanpa ambang seat/render, tanpa commercial-use threshold |
| Render lokal | $0 | **$0**, tanpa watermark, tanpa pakai credit HeyGen |
| Skill agent | 13 skill resmi | **20 skill** + Claude Code plugin |
| Studio | browser | desktop app (Mac/Win/Linux) + browser |
| Block siap pakai | Remotion Elements | **~450** (`npx hyperframes add <name>`) |
| Output | MP4, ProRes, PNG seq, VP8/9, AV1 | MP4, WebM, MOV, GIF, PNG seq, **HLS**; alpha di WebM/MOV; 4K + HDR |
| Batch/personalisasi | props | `--variables` + `--batch rows.json` (satu output per baris JSON) |
| Cloud | AWS Lambda (matang) | AWS Lambda / Cloud Run / Docker / HeyGen cloud |
| Overlay transparan | ProRes/VP9 | WebM/MOV alpha |
| Headcount | ≤3 org | **tidak ada batas** |

**HyperFrames = Apache-2.0 sejati.** Tidak ada ambang, tidak ada per-render fee,
tidak ada minimal bulanan, boleh dipakai komersial & dimodifikasi. Yang dibayar
hanya compute sendiri (atau opsional AWS).

> Catatan: HyperFrames juga punya **Studio Pro $25/bulan** (25.000 credit + model AI
> premium + "Reverse any video") — itu **opsional**; engine-nya sendiri gratis.
> Cloud render HeyGen opsional ~$0,10/menit (1080p/30fps), 4K = 1,5× credit.

### Ringkasan jawaban "bisa tanpa biaya bulanan?"

| Skenario | Bisa $0? | Catatan |
|---|---|---|
| Kita pakai Remotion untuk konten internal, tim ≤3 | ✅ **ya** | lisensi $0, render di server sendiri |
| Kita pakai Remotion & expose "prompt-to-video" ke user | ❌ **tidak** | tier Automators: $0,01/render, **min $100/bulan** |
| Tim grows jadi 4+ org | ❌ tidak | wajib Company License ($25/seat) |
| Kita pakai **HyperFrames** | ✅ **ya, tanpa syarat** | Apache-2.0, render lokal/server sendiri |
| Kit render pakai AWS Lambda skala besar | ❌ tidak | $0,017/menit + S3 + egress |
| Kit render lokal (server yang sudah ada) | ✅ **ya** | incremental cost ≈ $0 (listrik & CPU) |

### Rekomendasi gw (revisi karena concern biaya)

1. **Kalau fokus "tanpa biaya bulanan" → pilih HyperFrames, bukan Remotion.**
   Apache-2.0, tanpa ambang seat, tanpa minimal bulanan, 20 skill agent, ~450
   blok siap pakai, output lebih lengkap (alpha, HLS, HDR). Repo SherlyStudio juga
   **vanilla JS** — HyperFrames menulis **HTML/CSS/JS** tanpa bundler & tanpa
   React, jadi **jauh lebih nyambung** dengan arsitektur kita sekarang.
2. **Kalau mau tetap Remotion** (React, ecosystem matang, Lambda distributed) →
   pakai **Free License** dan render **di server sendiri** (`@remotion/renderer`),
   bukan Lambda. Jangan build fitur "render untuk user" (tetap ada risiko lisensi
   Automators).
3. **Aturan main kita**: jangan pernah bikin fitur yang mengharuskan "user
   trigger render otomatis" tanpa cek lisensi dulu. Preview/Studio tidak dihitung
   render — aman.

### Checklist sebelum adopt

- [ ] Tim kita berapa orang? (≤3 → Free License aman; 4+ → bayar)
- [ ] Render-nya lokal/server sendiri atau AWS Lambda?
- [ ] Apakah produknya untuk user (Automators) atau untuk kita (Creators)?
- [ ] Kalau agency: siapa yang pegang project — kita atau klien? (headcount digabung)
- [ ] S3 + egress sudah dihitung? (bisa lebih besar dari lisensinya)
- [ ] Remotion 5.0 akan datang — cek ulang terms (telemetry jadi wajib untuk
      Automators, opsi opt-out Enterprise)

## 8. Rekomendasi

**Jangan buru-buru.** Remotion tren karena Agent Skills + agent-friendly, bukan
karena menggantikan tools yang ada.

**Tapi kalau kriterianya "tanpa biaya bulanan" → HyperFrames lebih tepat.**

| Prioritas | Langkah | Biaya | Estimasi |
|---|---|---|---|
| **P0** ⭐ | **Pakai HyperFrames** (`Apache-2.0`) buat bikin intro/outro branded, caption, dan motion graphics dari HTML/CSS/JS — render lokal di server kita (`@sparticuz/chromium` + FFmpeg) → hasil masuk galeri aset | **$0** | rendah–sedang |
| **P1** | Install **skill Remotion** di workflow agent-side aja (tanpa integrasi produk) — `npx skills add remotion-dev/skills` + skill motion graphics (MIT) | $0 (lisensi) | rendah |
| **P2** | Tambah **mode "Motion Graphics"** di Studio (HTML/CSS/JS composition, bukan TSX) → render server-side → masuk `sherly_video_tasks` | $0 kalau lokal | tinggi |
| **P3** | **Caption/subtitle massal** untuk hasil video Kie | $0 | sedang |
| **P4** | Integrasi **hybrid**: agent pilih Kie (visual generatif) vs motion graphics (layout/anotasi) per bagian | $0–murah | tinggi |
| ❌ | **Jangan** sekarang: render via AWS Lambda skala besar (biaya muncul), atau fitur "user trigger render" (risiko lisensi Automators), atau ganti Studio ke React wholesale | — | — |

**Rekomendasi final gw:**
1. **P0 — HyperFrames**, bukan Remotion, kalau prioritasnya nol biaya bulanan:
   Apache-2.0 (tanpa ambang seat/render), 20 skill agent, ~450 blok siap pakai,
   output lebih lengkap (alpha WebM/MOV, HLS, 4K HDR), **tanpa bundler & tanpa
   React** → cocok banget dengan repo SherlyStudio yang vanilla JS.
2. **P1 — skill Remotion** tetap worth install: ecosystems-nya paling matang,
   dan `/remotion-captions` + `/remotion-markup` jadi rujukan bagus untuk agent
   Even kalau produknya pakai HyperFrames.
3. **P2** baru kalau ada user yang butuh "motion graphics" sebagai mode konten
   tersendiri — dan pastikan render-nya lokal/server sendiri, bukan Lambda, supaya
   tagihan $0.

**Aturan main yang gw tulis buat diri sendiri:** sebelum bikin fitur yang
mengecek "render otomatis oleh user", cek dulu **apakah output-nya meant untuk
diteruskan/dijual** (itulah yang memicu biaya):

1. Kalau video hasil render **dipakai user sebagai output** (bukan dijual sebagai
   "software Remotion") → **tidak masalah**. Yang dibatasi lisensi adalah
   **menjual/menyewakan turunan Remotion itu sendiri**, bukan output videonya.
2. Yang memicu biaya Automators adalah **kita menyediakan layanan render
   otomatis ke user** (prompt-to-video app). Kalau user cuma triggers render di
   instance kita sendiri → ini abu-abu, **tanya Remotion** sebelum ship.
3. Kalau ragu → pakai **HyperFrames** (Apache-2.0, nol ambang) dan nggak pusing.

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
