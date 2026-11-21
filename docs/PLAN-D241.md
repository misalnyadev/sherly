# D-241 — Rencana Model & Fitur Generator SherlyStudio

> Analisis gap: model & kapabilitas apa yang perlu ditambah supaya generator
> SherlyStudio bisa membuat konten jenis apa saja yang dibutuhkan kreator.
> Sumber data: katalog Kie AI (133 model / 717 SKU) + benchmark publik Nov 2026.

---

## 1. Kondisi saat ini (audit repo)

### Model video (`server/video-models.js`) — 5 model

| id | label | maker | durasi | resolusi | rasio | audio |
|---|---|---|---|---|---|---|
| `veo-3-1` | Veo 3.1 | Google | 4/6/8 dtk | 720p–4k | 16:9, 9:16 | ✅ |
| `kling-3.0/video` | Kling 3.0 | Kuaishou | 3–15 dtk | 720p–1080p | 16:9, 9:16, 1:1 | ✅ |
| `bytedance/seedance-2` | Seedance 2.0 | ByteDance | 4–15 dtk | 480p–4k | 6 rasio | ✅ |
| `bytedance/seedance-2-fast` | Seedance 2.0 Fast | ByteDance | 4–15 dtk | 480p–720p | 6 rasio | ✅ |
| `google/gemini-omni-flash-1-2` | Omni 1.2 Flash | Google | 3–15 dtk | 360p–4k | 16:9, 9:16, auto | ✅ |

### Model gambar (`server/image-models.js`) — 6 model

`nano-banana-2`, `nano-banana-pro`, `gpt-image-2-text-to-image`,
`bytedance/seedream-v5.0-lite`, `bytedance/seedream-5.0-pro`, `flux-2-pro-text-to-image`

### Mode konten — 2 jenis

`Foto` (`photo`) · `Video` (`video`) — `CONTENT_TYPES` di `public/studio.js`

---

## 2. Gap analysis — apa yang belum bisa dibuat kreator

### Gap A — Tidak ada konten "durasi panjang" (Reels/TikTok 30–60 dtk)

Semua model video kita mentok **15 detik**. Meanwhile:

| model | max clip | catatan |
|---|---|---|
| Seedance 2.5 | **30 dtk** | native 4K, s/d 30 reference, edit/extend |
| Wan 3.0 | **30 dtk** | multimodal (gambar+video+audio+dokumen+webpage) |
| Kling 4.0 | **30 dtk** | 4K HDR, stereo audio |

Kreator butuh 30 detik untuk konten sosmed. **Ini gap terbesar.**

### Gap B — Tidak ada lipsync / talking avatar ✅ **SELESAI (D-242)**

Sudah ada TTS (Gemini TTS, `server/tts.js`) + karakter + profil suara, tapi
**tidak ada model yang mengubah potret + audio → video karakter bicara**.
Kreator konten (vlog, testimonial, course, digital human) butuh ini.

Model Kie yang relevan:
- `infinitalk/from-audio` — potret + audio → talking avatar, 480p/720p, ≤15 dtk, **$0.015/dtk** ← **DIPAKAI (D-242)**
- `bytedance/omni-human` — full-body digital human
- `kwaivgi/kling-lip-sync` — text-based lip sync
- `zsxkib/multitalk` — percakapan multi-orang (2 karakter ngobrol)

> **Status D-242:** mode konten **"Karakter Bicara"** sudah diimplementasikan penuh —
> katalog `server/lipsync-models.js`, endpoint `GET /api/ai/lipsync/models` &
> `POST /api/ai/lipsync`, TTS Gemini memakai profil suara karakter, upload potret+audio
> ke Kie, task disimpan di `sherly_video_tasks` (`meta.kind='lipsync'`), hasil masuk
> galeri aset Studio. Sisa backlog Kie: `bytedance/omni-human`, `kwaivgi/kling-lip-sync`,
> `zsxkib/multitalk` (multi-orang).
>
> **Alur input (D-244):** pilih karakter (**hanya untuk profil suara**) → **mention 1 gambar**
> berisi karakter **di lokasi tertentu** (gambar itu jadi `image_url` — InfiniteTalk cuma punya
> satu slot gambar, jadi wajah + lokasi harus dari satu gambar yang sama) → **Arahan adegan**
> (lokasi/kamera/aksi/suasana → prompt Kie, maks 5.000 karakter) → **naskah** (→ TTS).
> Kalau tidak ada mention, potret karakter dipakai sebagai cadangan.
>
> **Model & provider lipsync (D-245).** Semua model lip-sync Kie berada di **satu provider:
> Kie AI**. Model tersedia: **InfiniteTalk** (`infinitalk/from-audio`, 480p/720p, maks 15 dtk,
> ~$0.015/dtk) dan **LTX 2.5 Fast A2V** (`ltx/2-5-fast-audio-to-video`, 720p/1080p/1440p,
> durasi **mengikuti audio** s/d 20 dtk, ~$0.054/dtk). Provider, model, dan resolusi bisa
> dipilih di panel **Pengaturan Konten** mode Karakter Bicara.
>
> **Durasi lipsync = OTOMATIS (D-243).** InfiniteTalk tidak punya parameter durasi;
> durasi video mengikuti **panjang naskah** (TTS membacakan naskah → audio), batas keras
> **15 detik** (≈ 195 karakter bahasa Indonesia). UI menampilkan estimasi realtime
> "±N dtk (maks 15)" di bar karakter + peringatan pink bila estimasi melewati batas.
> Tombol generate di semua mode diseragamkan berlabel "Buat" (+ ikon per mode) supaya
> tidak turun baris di HP.

### Gap C — Tidak ada tipe konten non-foto/non-video standar

Kreator butuh: **poster/infografis**, **logo & vektor**, **thumbnail YT**,
**story/reels (9:16)**. Saat ini "Foto" = generik, tanpa preset rasio sosial.

### Gap D — Tidak ada video upscaler

Aset 360p/720p yang di-generate perlu upscale ke 1080p/4K. Ada `Kie Image Upscaler`
(2×/4×/8× s/d 67 MP) — belum dipakai.

### Gap E — Tidak ada model "biaya rendah" untuk iterasi cepat

Harga Kie (per detik, 720p):

| model | $/detik |_catatan_ |
|---|---|---|
| Wan 3.0 | $0.08 | termurah kelas atas |
| Seedance 2.0 Fast | $0.034 | |
| Omni 1.2 Flash | $0.045 | termurah yang punya audio native |
| Seedance 2.5 | $0.19 | premium |
| Veo 3.1 | $0.15–0.40 | paling mahal |

---

## 3. Rekomendasi — prioritas

### PRIORITAS 1 (paling berdampak, langsung untuk kreator)

#### 1.1 Seedance 2.5 — `bytedance/seedance-2-5`
- Durasi **sampai 30 detik** → menutup Gap A
- Resolusi 480p/720p/1080p/**4K**
- Rasio 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, **adaptive**
- Field Kie: `prompt`, `first_frame_url`, `last_frame_url`, `reference_image_urls` (s/d **30**), `reference_video_urls` (s/d 10), `reference_audio_urls` (s/d 10), `generate_audio`, `resolution`, `aspect_ratio`, `duration`, `output_format`, `omni_reference_task_type` (auto/reference/edit/extend), `web_search`, `draft` (preview 480p murah!), `nsfw_checker`, `return_last_frame`
- **Bonus `draft: true`** → preview 480p murah sebelum render final = iteration jauh lebih murah

#### 1.2 Wan 3.0 — `wan/3-0-video`
- Durasi **2–30 detik** (atau `-1` = smart duration), `adaptive` aspect
- **Multimodal**: `reference_image_urls` (10), `reference_video_urls` (5), `reference_audio_urls` (5), `reference_file_urls` (PDF/DOCX/PPTX → **video dari brief/dokumen!**), `reference_link_urls` (webpage)
- Resolusi 480p/720p/1080p, field `audio` (bool), `seed`, `nsfw_checker`
- **Termurah kelas atas: $0.08/dtk @720p** → kartu "hemat" di UI
- **Teks Indonesia ke prompt** (20.000 karakter, CN+EN) → cocok banget buat kreator ID
- Keunikan: **dokumen/PDF/website → video** = fitur killer buat konten點 bisnis/EDM

#### 1.3 Lipsync — `infinitalk/from-audio`
- Potret + audio → talking avatar (480p/720p, ≤15 dtk)
- Field Kie: `image_url`, `audio_url`, `prompt`, `resolution`, `seed`, `nsfw_checker`
- Integrasi alami: karakter (potret + **profil suara yang sudah ada**) + TTS Gemini → video karakter bicara
- Ini yang bikin Studio jadi "studio digital human", bukan sekadar generator gambar

### PRIORITAS 2 (kelengkapan)

#### 2.1 Kling 4.0 — `kling-4-0/...`
- Durasi **sampai 30 detik**, 4K HDR, stereo audio
- API "coming soon" di Kie per beberapa sumber → verifikasi dulu sebelum implementasi

#### 2.2 Model gambar complements
| model | id Kie | buat apa |
|---|---|---|
| **Seedream 5.5** | `bytedance/seedream-5-5` | edit chain 100 putaran, **background transparan native**, teks kecil padat |
| **GPT Image 2.6 Flare/Sunburst** | `gpt-image-2-6/flare-text-to-image`, `.../sunburst-text-to-image` | layout/poster terbaik, **SVG output**, `background: transparent`, `quality` low→max, `output_format` png/jpeg/webp/**gif**/**svg**, `complexity`, `frame_count` (untuk GIF/animasi!) |
| **FLUX 3 / Klein** | `flux-3`, `flux-3-klein` | termurah ($0.008–0.036), volume tinggi |
| **Kling Image 4.0 long-image** | `kling-4-0/long-image` | **halaman detail produk e-commerce & desain webpage** (1K/2K) |
| **Ideogram 4.5 / Recraft V4.1** | `ideogram-4-5`, `recraft-v4-1` | tipografi & logo/vektor (Recraft = SVG) |

#### 2.3 Preset rasio sosial
Tambah ke mode Foto: preset `1:1` (IG feed), `4:5` (IG portrait), `9:16` (Story/Reels/TikTok), `16:9` (YT thumbnail), plus `21:9` (banner).

#### 2.4 Video upscaler
`kie` Image/Video Upscaler — 2×/4×/8× sampai 67 MP, pertahankan teks di gambar.

---

## 4. Prioritas implementasi (saran urutan kerja)

| # | Item | Estimasi | Nilai |
|---|---|---|---|
| 1 | Seedance 2.5 (+ `draft` preview) | sedang | 30 dtk + 4K + 30 referensi + preview murah |
| 2 | Wan 3.0 (+ `reference_file_urls` = PDF→video) | sedang | 30 dtk + multimodal + termurah + ID prompt |
| 3 | Lipsync (mode konten baru "Karakter Bicara") | besar | fitur digital human, pakai TTS + profil suara yang sudah ada |
| 4 | Seedream 5.5 + GPT Image 2.6 | kecil | teks kecil, background transparan, SVG, GIF |
| 5 | Preset rasio sosial | kecil |QoL harian |
| 6 | Kling 4.0 / FLUX 3 / Ideogram | kecil | pelengkap |
| 7 | Video upscaler | kecil | utilitas |

**Catatan arsitektur:** semua tambahan ini cukupitatambah entri di
`server/video-models.js` / `server/image-models.js` + satu blok `schema` di
`buildVideoInput()` / `buildImageInput()`. Frontend otomatis dapat karena
katalog diambil dari `/api/ai/video/models` & `/api/ai/image/models`.
Yang butuh kerja besar hanya **#3 lipsync** (mode konten baru + alur audio) —
**selesai di D-242** lewat `server/lipsync-models.js` + mode UI "Karakter Bicara"
(`/api/ai/lipsync/models` & `/api/ai/lipsync`, task reuse `sherly_video_tasks`).

---

## 5. Yang TIDAK perlu ditambahkan (pertaining)

- **Sora 2** — app ditutup 26 Apr 2026, API ditutup 24 Sep 2026. Jangan tambah.
- **Midjourney V8.2** — tidak ada API publik (subscription only).
- **DALL-E 2/3, gpt-image-1** — sudah ditutup OpenAI.
- **Kling 4.0** — API masih "coming soon" di Kie (per 2026-11).

---

## 5b. D-246 — Model lipsync tambahan (OmniHuman 1.5 + 2.0)

Katalog lipsync Kie sampai D-245 hanya **2 model** yang bisa dipakai lewat
`/market/other`: InfiniteTalk & LTX 2.5 Fast A2V. **LTX 2.5 Pro A2V TIDAK ADA**
di Kie (`docs.kie.ai/market/ltx/2-5-pro-audio-to-video` → 404; `kie.ai/ltx-2-5`
mendaftarkan 5 endpoint, dan A2V hanya varian **Fast**).

Alternatif yang ditemukan & disetujui user: **OmniHuman 1.5** & **OmniHuman 2.0**
(ByteDance) — keduanya digital human yang bisa gerak penuh (full-body), bukan
sekadar potret talk.

| | InfiniteTalk | LTX 2.5 Fast A2V | **OmniHuman 1.5** | **OmniHuman 2.0** |
|---|---|---|---|---|
| model id | `infinitalk/from-audio` | `ltx/2-5-fast-audio-to-video` | `omnihuman-1-5` | `omnihuman-2-0` |
| gambar | `image_url` | `image_url` | `image_url` | **`image_urls`** (array 1) |
| resolusi | 480p/720p | 720p/1080p/1440p | **`720P`/`1080P`** | **720p** saja |
| rasio | 16:9/9:16/1:1 | + 3:2, 2:3 | 16:9/9:16/1:1/4:5/3:4 | 16:9/9:16/1:1/4:5/3:4 |
| maks audio | 15 dtk | 20 dtk | **< 60 dtk** (rekomendasi ≤15) | **4–300 dtk** |
| prompt | 5.000 kar | 5.000 kar | **300 kar** | **300 kar** |
| extras | `seed` | `fps`, `duration`, `seed` | `mask_url`, `pe_fast_mode`, `seed` | `enable_watermark` |
| body | potret talk | potret talk | **full-body digital human**, emotion-aware | digital human + **multi-person** |

Catatan penting:
- **OmniHuman 1.5** memakai field **`output_resolution`** dengan **huruf besar**
  (`720P`/`1080P`) — BUKAN `resolution` seperti model lain, dan **tidak** ada
  `aspect_ratio` (rasio mengikuti gambar).
- **OmniHuman 2.0** memakai **`image_urls`** (JSON array, 1 elemen) — BUKAN
  `image_url`, dan **tidak** mengirim resolusi (fixed 720p).
- Prompt kedua model = "Character Tendency" (maks 300 karakter) → arahan adegan
  di UI dibatasi 300 karakter untuk model ini.
- `enable_watermark` default `true` → tidak dikirim bila user tidak mengubahnya.

### Sumber
- https://kie.ai/omnihuman-1-5
- https://kie.ai/omnihuman-2-0
- https://kie.ai/ltx-2-5 (konfirmasi Pro A2V tidak ada)
- https://docs.kie.ai/market/ltx/2-5-pro-audio-to-video (404)

---

## 6. Sumber

- Kie AI katalog: https://kie.ai/market · https://kie.ai/pricing
- Seedance 2.5: https://kie.ai/seedance-2-5
- Wan 3.0: https://kie.ai/wan3.0-video
- GPT Image 2.6: https://kie.ai/gpt-image-2-6
- Gemini Omni 1.2 Flash: https://kie.ai/gemini-omni-1-2-flash
- InfiniteTalk lip sync: https://kie.ai/infinitalk
- Benchmark 20 model video: https://getleadwave.io/blog/best-ai-video-generators
- Perbandingan model video Nov 2026: https://www.teamday.ai/blog/best-ai-video-models-2026
- Perbandingan model gambar Nov 2026: https://www.teamday.ai/blog/best-ai-image-models-2026
