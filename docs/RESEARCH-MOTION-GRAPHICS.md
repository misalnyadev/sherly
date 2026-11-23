# Riset: Motion Graphics SherlyStudio — durasi, hook, dan TTS

> Status: **bagian durasi sudah diimplementasikan (D-275)** — lihat §2.5.
> Bagian hook/beat/CTA/TTS masih **riset** (belum diimplementasikan).
> Tanggal riset: 2026-11-23.

---

## 1. Ringkasan jawaban langsung

| Pertanyaan | Jawaban |
|---|---|
| Durasi Motion Graphics paling panjang **sebelum** D-275? | **10 detik** (template `captioned-clip`: `[6, 8, 10]`) |
| Durasi Motion Graphics paling panjang **sekarang**? | **30 detik** (`captioned-clip`: `[6, 8, 10, 12, 15, 20, 25, 30]`) |
| Batas sebenarnya? | **Bukan** batas template — **4 MB upload** (batas body Vercel). Setelah signed-upload (D-263) aktif, jalur **client** tidak lagi terbatas oleh 4 MB. |
| Batas maksimum yang aman? | **30 detik** untuk hook-style (Reels/TikTok), **60 detik** untuk konten explainer |
| Kenapa dulu cuma 10 detik? | Template memang dirancang pendek; `bitrateForDuration()` sizing ke 4 MB konservatif walau jalur client pakai signed-upload |
| TTS untuk audio? | **GPT-SoVITS** (MIT, 5 detik sample) — TAPI **tidak mendukung bahasa Indonesia** |
| TTS Indonesia yang lebih cocok? | Gemini TTS (sudah dipakai di repo) atau **Qwen3-TTS** (Apache-2.0, 10 bahasa) |
| **Fallback TTS kalau kredit Gemini habis?** | **Azure Speech** (F0 gratis 500.000 karakter/bulan, tanpa info pembayaran, voice native `id-ID`) → **ElevenLabs** (gratis 10.000 kredit/bulan, tanpa kartu kredit, Multilingual v2). Keduanya **free tier tanpa subscribe** (D-278). Detail di **§4.6** |

---

## 2. Durasi Motion Graphics — Analisis Batasan

### 2.1 Kondisi sebelum D-275

```
server/motion-graphics.js  → MG_TEMPLATES[].durations
  branded-intro   : [5, 6, 8]      default 6
  captioned-clip  : [6, 8, 10]     default 8     ← MAKSIMUM 10 detik (sebelum D-275)
  stat-card       : [4, 5, 6]      default 5
```

Client (`public/motion-graphics.js`) punya salinan identik (`MG_CLIENT_TEMPLATES`) — **wajib disinkronkan manual**.
Sesudah D-275 daftar durasinya berubah; angka barunya ada di §2.5 dan dijaga oleh
`test/motion-graphics-duration.test.js` (test "durasi server & client SINKRON").

### 2.2 Yang sebenarnya membatasi (bukan template)

Rantai render client:

```
Canvas 2D → CanvasSource → mediabunny → MP4 Blob → upload
                                              ↑
                          2 jalur: < 4 MB → POST multipart (server)
                                   ≥ 4 MB → uploadBlobDirect() (signed, D-263)
```

**Kode yang relevan** (`public/studio.js`):

```js
if (result.blob.size >= 4 * 1024 * 1024) {
  mgAsset = await uploadBlobDirect(result.blob, ...);   // signed-upload — TANPA batas 4 MB
} else {
  const up = await fetch('/api/studio/motion-graphics/asset', {...});  // multipart — batas 4,5 MB
}
```

Artinya: **jalur client (yang dipakai user Vercel) TIDAK punya batas 4 MB** — asal file ≥ 4 MB, dia lewat signed-upload.

### 2.3 Tapi bitrate-nya sizing ke 4 MB (terlalu konservatif)

```js
export function bitrateForDuration(durationInSeconds) {
  const targetBytes = MG_UPLOAD_MAX_BYTES * 0.85;   // 4 MB * 0.85 = 3,4 MB
  const bits = Math.floor((targetBytes * 8) / dur);
  return Math.min(Math.max(bits, 800_000), 6_000_000);
}
```

Hasil hitungannya:

| Durasi | Bitrate | Perkiraan ukuran | Catatan |
|---|---|---|---|
| 5s | 5.704.253 bps | 3,40 MB | |
| 10s | 2.852.126 bps | 3,40 MB | **maks sekarang** |
| 15s | 1.901.417 bps | 3,40 MB | masih aman |
| 20s | 1.426.063 bps | 3,40 MB | masih aman |
| 30s | 950.708 bps | 3,40 MB | **batas bawah mulai|dekat** |
| 45s | 800.000 bps | 4,29 MB | menyentuh batas bawah → pecil |
| 60s | 800.000 bps | 5,72 MB | **keluar batas** |

**Kesimpulan:** durasi **sampai 30 detik masih aman** dengan bitrate sekarang. Di atas 45 detik, bitrate turun ke lantai 800 kbps dan visual jadi pecil — itu batas **kualitas**, bukan batas **upload**.

### 2.4 Rekomendasi durasi

| Skenario | Durasi | Alasan |
|---|---|---|
| Hook / pembuka | 3–6 detik | AturanRetention: viewer putuskan dalam 1–3 detik |
| Caption / explainer pendek | 8–15 detik | 1 ide per klip |
| **Konten lengkap** | **15–30 detik** | Sweet spot Reels/TikTok |
| Explainer panjang | 45–60 detik | Hanya kalau script-nya kuat |

Rekomendasi teknis: **buka 30 detik**, sediakan bitrate terpisah untuk durasi panjang (turunkan `keyFrameInterval`, naikkan `bitrate` di 30–60 detik ke 1,5–2,5 Mbps karena file boleh lebih besar lewat signed-upload).

### 2.5 D-275 — Implementasi durasi (sudah dikerjakan)

Riset di atas dipakai untuk membuka durasi Motion Graphics jadi **maksimum 30 detik**.
Semua angka durasi di `server/motion-graphics.js` dan `public/motion-graphics.js` harus
**sinkron** (ada test yang menjaga ini).

| Template | Durasi sebelum | Durasi sekarang |
|---|---|---|
| `branded-intro` | 5 / 6 / 8 | 5 / 6 / 8 / 10 / 12 / 15 |
| `captioned-clip` | 6 / 8 / 10 | 6 / 8 / 10 / 12 / 15 / 20 / 25 / **30** |
| `stat-card` | 4 / 5 / 6 | 4 / 5 / 6 / 8 / 10 / 12 / 15 |

Yang ikut berubah (bukan cuma daftar dropdown):

1. **Bug render server diperbaiki.** `renderMotionGraphic()` pernah menghitung
   `durationInFrames` lalu membuangnya, sehingga `renderMedia()` selalu memakai
   durasi statis dari `Root.tsx` (6/8/5 detik) — pilihan durasi di UI tidak
   berefek. Sekarang `compositionWithDuration` diteruskan ke `renderMedia()`.
2. **`calculateMetadata` di `Root.tsx`.** Semua 8 komposisi punya
   `calculateMetadata` yang membaca `durationInSeconds` dari props dan
   overriding `durationInFrames` sebelum render (dibatasi 1–30 detik).
3. **Bitrate durasi panjang dinaikkan, bukan diturunkan.** Durasi > 12 detik
   memakai jalur signed-upload (tanpa batas body), jadi file boleh lebih besar:
   15s → 2,5 Mbps · 20s → 2,0 · 25s → 1,8 · 30s → 1,4 (≈ 5 MB). Durasi ≤ 12
   detik tetap sizing ke 4 MB supaya upload lewat multipart server tetap aman.
4. **Intro & kartu statistik "menahan" (hold) + bernapas.** Animasi masuk
   selesai di ~1,6 detik; tanpa perubahan, video 10+ detik jadi layar diam.
   Sekarang intro ditahan sampai fade out dengan napas pelan (scale ±1,2 %).
5. **Video sumber di-loop** kalau lebih pendek dari durasi pilihan, supaya
   layar tidak beku di frame terakhir (`t % vDur` di client, `loop` di Remotion).
6. **Subtitle ikut mengisi durasi baru** — `parseCaptions()` sudah
   mend distribusikan cue berdasarkan `totalMs`, jadi baris subtitle otomatis
   memenuhi video 30 detik.
7. **Bug panel Pengaturan diperbaiki.** `settingChoices('mgdur')` memakai
   `motionTemplate()` yang membaca `state.motionTemplateId`. Padahal di panel
   Pengaturan, template yang dipilih ada di `settingsDraft`. Akibatnya user
   memilih "Klip Bersubtitle" (30 detik) di panel, tapi daftar durasi masih
   milik template lama (intro, 15 detik) — opsi 20/25/30 detik ikut
   tersembunyi sampai panel ditutup & dibuka lagi. Sekarang daftar durasi
   membaca `ctx.motionTemplateId` (draft lebih dulu, lalu state).

Verifikasi end-to-end (Remotion 4.0.545, Chromium lokal):

```
durationInSeconds=5  -> 150f (5.00s)   | 20 -> 600f (20.00s)
durationInSeconds=12 -> 360f (12.00s)  | 30 -> 900f (30.00s)
clamp 999            -> 900f (30.00s)
render MP4 30 detik  -> mvhd duration = 30000/1000 = 30.000 detik
```

---

## 3. Struktur Motion Graphics yang bikin konten menarik

### 3.1 Temuan riset — apa yang bikin short-form video nahan

Sumber: Remotion blog, Hootsuite, TikTok Creative Codes (2026).

**Struktur universal: HOOK → BODY → PAYOFF → CTA**

| Bagian | Waktu (30s) | Isi |
|---|---|---|
| Hook | 0–3s | Klaim tajam / pertanyaan / visual disruptif |
| Problem/konteks | 3–8s | Kenapa ini relevan |
| Value/payoff | 8–22s | Satu insight/fitur yang konkret |
| CTA | 22–30s | Satu aksi jelas |

### 3.2 Aturan first-frame (WAJIB)

1. **Tidak boleh ada frame hitam** — bahkan 0,2 detik black leader turunkan retensi.
2. **Tidak boleh logo/intro animation di awal** — itu buat website, bukan feed.
3. **Teks minimal 36pt di kanvas 1080×1920**, kontras ≥ 4,5:1, maksimal 6 kata per baris.
4. Subtitle di **middle third** biar yang menonton tanpa suara tetap paham.

### 3.3 Irama & hook

- Cut setiap **3–5 detik** setelah hook; micro-cut 0,4–1,2 detik di 2–3 shot pertama.
- Reset perhatian setiap **5–8 detik**: ganti sudut, punch-in, statistik on-screen, atau kartu pertanyaan.
- Micro-hook/open loop tiap **10–15 detik**.
- **Loop engineering**: frame terakhir harus cocok dengan frame pertama → replay terasa disengaja.
- Jangan pakai outro verbal ("jadi begini", "terima kasih") — memicu swipe cepat.

### 3.4 Yang BELUM ada di Motion Graphics sekarang

| Kekurangan | Dampak |
|---|---|
| **Durasi maks 10 detik** | Gak bisa bikin konten 15–30 detik yang lengkap |
| **Gak ada hook/beat structure** | Template statis: masuk → keluar |
| **Gak ada audio sama sekali** | Sunyi = kurang menarik + tidak ada narration |
| **Gak ada transisi antar-beat** | Terlalu "datar" |
| **Gak ada CTA di akhir** | Gak ada tujuan dari video |
| **Gak ada loop-friendly ending** | Gak ada rewatches |
| Cuma 3 template | Template statis yang terbatas |

### 3.5 Struktur yang disarankan (D-275)

**A. Sistem "beat"** — bukan durasi tunggal, tapi komposisi dari beberapa beat:

```
[HOOK 0-3s] → [BODY 3-12s] → [PAYOFF 12-25s] → [CTA 25-30s]
```

Tiap beat punya: teks sendiri, durasi sendiri, animasi masuk/kelu sendiri.

**B. Intro "hook" terpisah** — satu template kecil (2–3 detik) yang bisa dipasang di depan video apa pun. Ini yang paling murah dan impact-nya paling besar per usaha.

**C. Template baru yanginnen:**
- `hook` — 1 klaim besar + visual, 3 detik, dirancang untuk frame pertama
- `captioned-clip` — durasi panjang 15–30 detik + caption timing + CTA di akhir
- `listicle` — "3 hal yang…" dengan item muncul bertahap (pattern interrupt tiap 5 detik)
- `stat-card` — dengan animasi counter naik + "before/after"
- `cta-card` — kartu CTA + logo,  untuk menutup video

**D. Audio (lihat bagian 4)** — voiceover naratif + musik latar + SFX.

**E. Transisi** — simple tapi deliberate: hard cut, fade, whip pan (translate cepat), zoom punch-in.

**F. Loop engineering** — frame terakhir == frame pertama, plus hint "⋯" atau panah.

---

## 4. TTS untuk audio Motion Graphics

### 4.1 Yang sudah ada di repo

`server/tts.js` — **Gemini TTS**:
- 14 voice bawaan (Kore, Aoede, Leda, Zephyr, Sulafat, Callirrhoe, Despina, Puck, Charon, Fenrir, Orus, Iapetus, Enceladus, Umbriel)
- Model: `gemini-3.8-flash-tts` → `gemini-2.5-flash-preview-tts`
- Output: WAV PCM 16-bit mono, 24 kHz, fade-out 25ms
- Guna: Bank Suara (voice profile karakter), TTS mode "Karakter Bicara"

**TTS sudah ada dan jalan. Yang belum ada: passe audio ke Motion Graphics.**

### 4.2 GPT-SoVITS — riset Mendalam

Sumber: https://github.com/RVC-Boss/GPT-SoVITS (commit `6d51ffc`, 11 Nov 2026)

| Aspek | Detail |
|---|---|
| Lisensi | **MIT** (code + weights) → boleh komersial ✅ |
| Zero-shot | **5 detik** sample voice → langsung TTS |
| Few-shot | **1 menit** training data |
| Cross-lingual | Inference bahasa beda dari training |
| Bahasa | **zh, en, ja, ko, yue** (v2) — **TIDAK ADA Indonesia** |
| Inference speed | RTF 0,028 (4060Ti) · 0,014 (4090) · 0,526 (M4 CPU) |
| Deployment | Docker (`xxxxrt666/gpt-sovits`), API FastAPI port 9880 |
| Lisensi model | Pretrained di HuggingFace `lj1995/GPT-SoVITS` |

**API (`api_v2.py`)**:

```
GET/POST /tts
  text, text_lang, ref_audio_path, prompt_text, prompt_lang,
  speed_factor, top_k, top_p, temperature, text_split_method,
  media_type ("wav"|"mp3"), streaming_mode, seed, ...
GET /set_refer_audio?refer_audio_path=
GET /set_gpt_weights / /set_sovits_weights
GET /control?command=...
```

### 4.3 ⚠️ Temuan kritis: GPT-SoVITS tidak bisa bahasa Indonesia

Di `GPT_SoVITS/text/cleaner.py`:

```python
language_module_map = {"zh": "chinese2", "ja": "japanese", "en": "english",
                        "ko": "korean", "yue": "cantonese"}
if language not in language_module_map:
    language = "en"
    text = " "          # ← TEKS DIKOSONGKAN DIAM-DIAM!
```

Kalau kirim `text_lang="id"`, teksnya **diblank-kan tanpa error** → output diam. Ini footgun besar.

**Workaround:** kirim `text_lang="en"`. Bahasa Indonesia alfabet latin & fonetik, jadi G2P english *cukup* approximates — tapi pengucapan vokal (a/e/o) bisa meleset, dan intonasiASEP tidak natural.

### 4.4 Perbandingan engine TTS 2026

| Engine | Lisensi | Bahasa | Voice clone | GPU | Link |
|---|---|---|---|---|---|
| **GPT-SoVITS** | **MIT** | 5 (tanpa ID) | 5 detik | Ya (CPU lambat) | [1] |
| **Qwen3-TTS** | **Apache-2.0** | 10 | 3 detik | Ya | [2][5] |
| Chatterbox | MIT | 23 | 5–10 detik | Ya | [3][4] |
| Kokoro-82M | Apache-2.0 | 8 | ❌ | **CPU cepat** | [7] |
| Supertonic 3 | Apache-2.0 | 31 | ❌ | **CPU** | [8] |
| XTTS-v2 | CPML **non-komersial** | 17 | 6 detik | Ya | [1][2] |
| F5-TTS | MIT / CC-BY-NC | — | 5 detik | Ya | [2] |
| **Gemini TTS** (dipakai) | proprietary | 70+ | ❌ (preset voice) | — | sudah di repo |

> ⚠️ **Chatterbox retired** (Agustus 2026) — READMErepository sudah jadi retirement notice.

### 4.5 Rekomendasi TTS untuk SherlyStudio

**Fase 1 (paling masuk akal):**
- Pakai **Gemini TTS yang sudah ada** (`server/tts.js`) → langsung dukung bahasa Indonesia, tanpa infra baru, $0 tambahan.
- Tambah **audio track** di Motion Graphics: voiceover naratif + musik latar + SFX.

**Fase 2 (kalau mau voice cloning):**
- **GPT-SoVITS** kalau karakter SherlyStudio perlu suara kloning (5 detik sample).
- Deploy di **VPS sendiri** (butuh GPU) — BUKAN di Vercel (serverless, tanpa GPU).
- Kirim `text_lang="en"` untuk teks Indonesia (workaround), atau `auto` untuk auto-detect.
- Simpan `ref_audio_path` per karakter di Supabase (bucket voice-clone).

**Jangan pakai XTTS-v2** untuk produk komersial (CPML non-komersial).

**Jangan pakai Qwen3-TTS kalau butuh bahasa Indonesia** — 10 bahasanya tidak termasuk ID (perlu konfirmasi).

### 4.6 D-276 — Riset TTS hosted yang support bahasa Indonesia (fallback saat kredit Gemini habis)

Kebutuhan user: *"untuk audio kita pake yang support bahasa indonesia saja, cari lagi untuk tts yang bisa kita gunakan untuk pilihan jika kredit gemini habis"*.

Dua kandidat yang disebut user dicek langsung: **TTSMaker** (`ttsmaker.com/id`) dan **Voicemaker** (`voicemaker.in/text-to-speech/indonesian`).

#### 4.6.1 TTSMaker — ✅ API resmi, `language=id` didukung (REKOMENDASI UTAMA)

Halaman `ttsmaker.com/id` memuat voice **native Indonesia** (bukan aksen Inggris):

| voice_id | Nama | Karakter | Batas/konversi |
|---|---|---|---|
| 111008 | ardi 🇮🇩 | Indonesia male | 3.000 karakter |
| 729 | citra 🇮🇩 | Indonesia female | **tak terbatas** |
| 1729 | citra v2 multi-emotion 🇮🇩 | Indonesia female | 2.000 karakter + **9 emosi** (serius/sedih/menjijikkan/cemburu/senang/takut/lembut/marah) |
| 112001 | ayu 🇮🇩 | Indonesia female | 100 karakter |
| 112002 | stefan 🇮🇩 | Indonesia male | 300 karakter |
| 112003 | indah 🇮🇩 | Indonesia female | 200 karakter |
| 111019 | gadis 🇮🇩 | Indonesia female | 3.000 karakter |
| 270 | dewi 🇮🇩 | Indonesia female | **tak terbatas** |
| 700001 | sarah 🇮🇩 | **Sundanese** female | 1.000 karakter |
| 700002 | william 🇮🇩 | **Sundanese** male | 1.000 karakter |

⭐ **Ada voice Sundanese** (`700001`/`700002`) — bonus unik buat konten Jawa.

**API V2 resmi** (`api.ttsmaker.com/v2`), 3 endpoint:

```
GET  /v2/get-voice-list?api_key=...&language=id
POST /v2/create-tts-order        (Content-Type: application/json)
GET  /v2/get-token-status?api_key=...
```

Body `create-tts-order` (semua fieldoptional kecuali 3 pertama):

```json
{
  "api_key": "...",
  "text": "Halo, ini contoh.",
  "voice_id": 1729,
  "audio_format": "mp3",
  "audio_speed": 1.0,
  "audio_volume": 1.0,
  "audio_pitch": 1.0,
  "audio_high_quality": 0,
  "text_paragraph_pause_time": 0,
  "emotion_style_key": "",
  "emotion_intensity": 1.0
}
```

Response sukses (`error_code: 0`):

```json
{
  "error_code": 0,
  "msg": "TTS Task Executed Successfully",
  "tts_task_characters_count": 52,
  "audio_download_url": "https://s5-8.ttsmaker-vip-file.com/file/....mp3",
  "audio_download_backup_url": "https://ttsmaker-file2.com/s5/file/....mp3",
  "audio_file_format": "mp3",
  "audio_file_expiration_timestamp": 1723646681,
  "account_status": {
    "quota_characters": 1000000,
    "characters_used": 40937,
    "available_quota": 959063,
    "subscription_period": "month"
  }
}
```

Fitur yang berguna untuk Motion Graphics:
- `audio_format`: mp3 / **wav** / ogg / aac / opus → mp3 cukup (Mediabunny sudah support).
- `audio_speed` 0.5–2.0 → **mengatur tempo narasi supaya pas dengan beat**.
- `text_paragraph_pause_time` (0–10.000 ms) → **jeda antar baris = jeda antar beat**. Ini persis yang dibutuhkan sistem beat.
- `[[break=1000]]` → jeda eksplisit di dalam teks (maks 10 dtk, 200 tag/API).
- `emotion_style_key` + `emotion_intensity` → intonasi per beat (voice 1729 punya 9 emosi).
- `audio_high_quality: 1` → file ~2× lebih besar (1024 kbps vs 512 kbps).
- **URL audio sementara berlaku 2 jam** (docs menyebut 24 jam) → server harus **langsung download** audio lalu simpan ke Supabase Storage, jangan menyimpan URL-nya.

⚠️ **Batas penting:** API **wajib subscription Pro/Studio** — akun Lite/FREE tidak bisa pakai API. Gratis web = 20.000 karakter/minggu + **captcha** (jadi tidak bisa dipakai dari server). QPS = **1/detik** (HTTP 429 kalau lebih).

#### 4.6.2 Voicemaker — ✅ API resmi, `Indonesian` didukung (alternatif)

Dokumentasi resmi `developer.voicemaker.in/apidocs` (REST + WebSocket):

- **Bahasa**: Indonesian & **Javanese** termasuk daftar 130+ bahasa.
- **Model & biaya (multiplier per karakter)**: `ProPlus Expressive` 4× (70+ bahasa, storytelling/performance), `ProPlus High-Res` 4× (30+ bahasa, produksi studio), `ProPlus Turbo` 2× (30+ bahasa, latensi ~250–300 ms), `Pro2` 2× (30+ bahasa), `Pro1` 1× (90+ bahasa), **Default AI1–AI6** 1× (130+ bahasa).
- **Format**: MP3 / **WAV** / OGG / PCM (sampai 48 kHz).
- Endpoint: `Generate TTS` (POST), `List Voices` (POST), `Generate TTS with VoxFX` (POST), `Voice Cloning` (CRUD), Speech-to-Speech, Speech-to-Text.
- Prix: pay-as-you-go, token dari `developer.voicemaker.in`.
- ⚠️ Bedanya dengan TTSMaker: **tidak ada voice native Indonesia** yang sebanyak TTSMaker — daftar voice Indonesia-nya lebih kecil, dan model multilingual-nyahandle aksen, bukan pelafalan lokal se-natural TTSMaker.

#### 4.6.3 Perbandingan lengkap untuk fallback

| Kriteria | Gemini TTS (sekarang) | **TTSMaker** | **Voicemaker** | Azure Neural | ElevenLabs |
|---|---|---|---|---|---|
| Bahasa Indonesia | ✅ | ✅ **native + Sundanese** | ✅ (+Javanese) | ✅ | ✅ (multilingual v2) |
| API resmi + key | ✅ (vault) | ✅ (`api.ttsmaker.com/v2`) | ✅ (`developer.voicemaker.in`) | ✅ | ✅ |
| **Tanpa GPU / self-host** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Harga | ~$0 (kuota free) | **$12,99/bln** Pro (1 jt karakter = ±23 jam audio) | pay-as-you-go | $15–16/1M karakter, **500 rb free/bulan** | $6–22/bln, 10–20 rb karakter free/bulan |
| Lisensi komersial | proprietary ToS | ✅ websitori: **100% hak komersial** | ✅ | ✅ | ✅ (paket berbayar) |
| Kontrol tempo | ❌ | ✅ `audio_speed` 0,5–2,0 | ✅ `master_speed` | ✅ SSML | ✅ |
| Jeda per paragraf | ❌ | ✅ `text_paragraph_pause_time` | ✅ SSML | ✅ SSML | ❌ |
| Emosi | ✅ (style hint, 14 voice) | ✅ 9 emosi (voice 1729) | ✅ VoxFX | ❌ | ✅ |
| Output langsung ke server | ✅ inline base64 | ⚠️ URL sementara (2 jam) | ⚠️ URL | ✅ | ✅ |
| Batas速率 | kuota Gemini | **1 QPS** | lebih longgar | 20–30 rps | ada |
| Cache hash di repo | ✅ `ttsClipHash` | ✅ (hash + provider) | ✅ | — | — |

**Rekomendasi D-276 (fallback berjenjang):**

1. **Gemini TTS** (default, sudah ada) — kualitas terbaik, gratis selama kuota. Kalau error **429 / RESOURCE_EXHAUSTED / quota**, jangan langsung gagal.
2. **TTSMaker** (fallback #1) — alasan utama: voice **native Indonesia** (bukan aksen Inggris), ada voice **Sundanese**, `audio_speed` + `text_paragraph_pause_time` **pas untuk sistem beat**, `emotion_style_key` untuk intonasi per beat, dan **100% hak komersial**. Butuh subscription Pro (~$13/bulan).
3. **Voicemaker** (fallback #2) — kalau punya token; punya Javanese + VoxFX + voice cloning, dan endpoint-nya lebih cepat (Turbo ~250 ms).

> ⚠️ **Kenapa bukan GPT-SoVITS / Qwen3-TTS sebagai fallback hosted?** Keduanya butuh GPU (VPS sendiri) dan/atau tidak support ID. See §4.3.
> ⚠️ **Kenapa bukan Azure/ElevenLabs?** Keduanya support ID dan API-nya stabil, tapi **tidak ada voice native Indonesia** yang sekelas TTSMaker — hasilnya aksen Inggris, persis masalah yang bikin GPT-SoVITS gagal. Cocok jadi fallback level-3 kalau TTSMaker/Voicemaker kosong, bukan level-1.

### 4.6.4 D-277 / D-278 — Evaluasi ulang fallback TTS (hanya yang free tier)

#### 4.6.4.1 Aturan D-278

> **Fallback TTS WAJIB bisa dipakai tanpa subscribe.**
> Setiap provider cadangan harus punya **free tier bulanan** yang bisa dipakai
> **tanpa langganan, tanpa kartu kredit, tanpa info pembayaran**.

#### 4.6.4.2 Hasil evaluasi kandidat (dicek langsung ke sumber resmi)

| Kandidat | Bahasa Indonesia | Key tanpa subscribe? | Free tier | Putusan |
|---|---|---|---|---|
| **EasyVoice** (`easyvoice.ae/geo/id`) | ❌ **TIDAK ADA** — situs resmi: tidak punya voice Bahasa Indonesia dan tidak direncanakan | — | free 2.000–5.000 karakter/hari (UI web) | ❌ dibuang |
| **Soniox** (`soniox.com`) | ✅ native `id` + `su` | ✅ ya | ❌ free credit signup baru **dihentikan** (Okt 2025) → praktis pay-as-you-go | ❌ **dibuang** |
| **TTSForFree** (`ttsforfree.com/id/`) | ✅ Ardi & Gadis | — | free 200 karakter/hari | ❌ **dibuang** — tanpa API resmi, provider di belakangnya Gemini/OpenAI/Azure |
| **Voicemaker** (`developer.voicemaker.in`) | ✅ native `id-ID` + Jawa | ⚠️ developer API pay-as-you-go; free plan web tidak membawa API | free web 100 konversi/minggu (UI saja) | ❌ **dibuang** |
| **TTSMaker** (`ttsmaker.com`) | ✅ native `id` + Sunda | ❌ **subscription Pro/Studio wajib** — tanpa subscribe tidak ada API key | — | ❌ **dibuang** |
| **Groq Orpheus TTS** | ❌ **hanya English + Arabic** | ✅ ya | free, maks 200 karakter/request | ❌ dibuang — tidak support Indonesia |
| **Azure Speech** (`azure.microsoft.com`) | ✅ **native `id-ID`** (`id-ID-ArdiNeural`, `id-ID-GadisNeural`, + Neural HD) | ✅ **ya** | ✅ **500.000 karakter/bulan (F0), tanpa info pembayaran**, reset bulanan, tak pernah kedaluwarsa | ✅ **FALLBACK #1** |
| **ElevenLabs** (`elevenlabs.io`) | ✅ **Multilingual v2** (29 bahasa termasuk Indonesia) | ✅ **ya, tanpa kartu kredit** | ✅ **10.000 kredit/bulan (~10 menit audio)** | ✅ **FALLBACK #2** |
| **VideoGrid AI** (`videogridai.com`) | n/a (video, bukan TTS) | — | — | ❌ bukan kandidat (tanpa API publik) |

> ⚠️ **Jangan tertukar:** `videogridai.com` (**Video Grid AI**) berbeda dari
> `vidogrid.ai` (**VidoGrid AI**). Yang punya REST API + webhook adalah
> **VidoGrid AI** (`api.vidogrid.ai`, plan $199/bln) — bukan yang diminta user.

#### 4.6.4.3 Detail Azure Speech (fallback utama)

- **Endpoint**: `POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`
  - Header `Ocp-Apim-Subscription-Key` (subscription key resource Speech).
  - Header `Content-Type: application/ssml+xml` (bukan JSON).
  - Header `X-Microsoft-OutputFormat` → `audio-24khz-48kbitrate-mono-mp3` (default),
    `audio-16khz-128kbitrate-mono-mp3`, `ogg-24khz-16bit-mono-opus`, `riff-24khz-16bit-mono-pcm`.
  - Body: SSML `<speak xml:lang="id-ID"><voice name="id-ID-ArdiNeural">…</voice></speak>`.
  - **Respons**: body = file audio langsung (mp3/wav/ogg) — tidak ada URL sementara.
- **Region**: dari resource Azure (mis. `southeastasia`, `jakarta`). Disimpan di
  env `AZURE_SPEECH_REGION` atau default `southeastasia`.
- **Daftar voice**: `GET https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list`
  → array voice; Ambil yang `Locale` diawali `id-ID`.
- **Voice Indonesia**: `id-ID-ArdiNeural` (pria), `id-ID-GadisNeural` (wanita),
  `id-ID-Ardi:DragonHDLatestNeural` & `id-ID-Gadis:DragonHDLatestNeural` (Neural HD).
- **Kontrol**: SSML `<prosody rate="…" pitch="…%">` → ngatur tempo & pitch narasi
  supaya pas dengan beat.
- **Free tier F0**: 500.000 karakter/bulan **neural**, reset tiap bulan, **tidak
  pernah kedaluwarsa**, dan **tidak butuh info pembayaran** di langganan Azure Free.
  Setelah kuota habis → $15–16/1M karakter (neural). Rate limit free tier 20 req/menit.

#### 4.6.4.4 Detail ElevenLabs (fallback kedua)

- **Endpoint**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`
  - Header `xi-api-key`.
  - Body JSON: `{text, model_id: 'eleven_multilingual_v2', voice_settings: {stability, similarity_boost, speed}}`.
  - **Respons**: body = file mp3 langsung.
- **Daftar voice**: `GET https://api.elevenlabs.io/v1/voices`.
- **Model**: `eleven_multilingual_v2` → 29 bahasa termasuk **Indonesian**; model
  mendeteksi bahasa dari teks otomatis, jadi voice apa pun bisa berbahasa Indonesia.
- **Free tier**: 10.000 kredit/bulan (~10 menit audio), **tanpa kartu kredit**,
  tidak ada rollover; API key bisa dibuat di `elevenlabs.io/app/settings/api-keys`.
- ⚠️ **Batasan free plan**: **TIDAK ada hak komersial** + wajib atribusi
  ("elevenlabs.io"/"11.ai") kalau audio dipublikasikan. Karena itu ElevenLabs
  hanya jadi cadangan **terakhir**; Azure (yang punya free tier neural +
  komersial) jadi cadangan utama.

#### 4.6.4.5 Urutan fallback final (D-278)

```
1. Gemini TTS      → default, gratis selama kuota (14 voice + style hint)
2. Azure Speech    → fallback #1. 500rb karakter/bulan, tanpa info pembayaran, native id-ID
3. ElevenLabs      → fallback #2. 10rb kredit/bulan, tanpa kartu kredit, multilingual (ID)
```

Provider yang **wajib subscribe di awal** (TTSMaker, Soniox, Voicemaker) **dihapus
total** dari kode, vault, dan constraint DB.

#### 4.6.4.6 Perbandingan biaya praktis (30 detik Motion Graphics)

| Provider | Karakter ± 75 kata (≈ 450 karakter) | Biaya |
|---|---|---|
| Gemini TTS | 450 | $0 (kuota free) |
| Azure Speech (F0) | 450 | $0 (dalam free tier 500rb/bln) |
| ElevenLabs (Free) | 450 | $0 (dalam free tier 10rb kredit/bln) |

> 30 detik Motion Graphics ≈ 450 karakter ≈ 45 detik audio. Free tier Azure
> (500rb karakter/bulan) ≈ **1.100 video 30 detik per bulan**; ElevenLabs
> (10rb kredit/bulan) ≈ **±20 video 30 detik per bulan** sebagai cadangan terakhir.

### 4.7 Cara pasang audio ke Motion Graphics

**Sudah siap!** `public/vendor/mediabunny.min.mjs` sudah expose:
- `AudioBufferSource`
- `addAudioTrack`
- `getFirstEncodableAudioCodec`
- `AudioBuffer`

Contoh dari dokumentasi mediabunny:

```js
const output = new Output({format: new Mp4OutputFormat(), target: new BufferTarget()});
const videoSource = new CanvasSource(canvas, {codec: videoCodec, bitrate, keyFrameInterval: 2});
output.addVideoTrack(videoSource, {frameRate: 30});
const audioSource = new AudioBufferSource({codec: 'aac', bitrate: 128e3});
output.addAudioTrack(audioSource);
await output.start();
// ... render frame video ...
await audioSource.add(audioBuffer);   // AudioBuffer dari decode WAV
await audioSource.close();
await output.finalize();
```

**Remotion (jalur server) juga mendukung audio** — `<Audio>` dari `remotion` (atau `@remotion/media` untuk renderer baru):

```tsx
import {Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';

export const FadeInAudio = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const volume = interpolate(frame, [0, fps], [0, 1], {extrapolateRight: 'clamp'});
  return <Audio src={staticFile('voice.mp3')} volume={volume} />;
};
```

Prop yang berguna: `volume` (number **atau** fungsi frame → number), `playbackRate`, `trimBefore`/`trimAfter` (frame), `loop`. Format didukung: mp3 (paling recommended), wav, aac/m4a, ogg, flac. Multiple `<Audio>` bisa ditumpuk → musik + voiceover + SFX mix otomatis.

### 4.8 Catatan penting: audio & durasi

Menambah audio track berarti MP4 jadi lebih besar → **harus naikkan batas `bitrateForDuration()`** dan pastikan signed-upload dipakai (sudah otomatis di ≥ 4 MB).

TTS naratif harus **mengikuti durasi**: 1 detik ≈ 2,5 kata (Indonesia). Jadi untuk 30 detik → ± 75 kata. Kalau TTS lebih pendek dari durasi, pakai `loop`/`ping-pong` atau tambahkan musik.

---

## 5. Angka kunci untuk implementasi

| Angka | Nilai | Sumber |
|---|---|---|
| Durasi sekarang maks | 10 detik | `server/motion-graphics.js` |
| Batas upload multipart | 4,5 MB | hard limit Vercel |
| Ambang signed-upload | 4 MB | `public/studio.js` |
| Bitrate floor | 800 kbps | `bitrateForDuration()` |
| Bitrate ceiling | 6 Mbps | `bitrateForDuration()` |
| FPS | 30 | `MG_FPS` |
| Kanvas | 1080×1920 / 1920×1080 / 1080×1080 | `MG_ASPECTS` |
| Font headline | 84px @1080 | `typeScale()` |
| Hook window | 1–3 detik | [2][10] |
| Cut interval | 3–5 detik | [5] |
| Attention reset | 5–8 detik | [5] |
| Micro-hook | 10–15 detik | [6] |
| Teks min on-screen | 36pt @1080×1920 | [2] |
| Kontras min | 4,5:1 | [5] |
| Kata/detik TTS Indonesia | ±2,5 | estimasi |
| RTF GPT-SoVITS (4090) | 0,014 | [1] |

---

## 6. Referensi

[1] https://github.com/RVC-Boss/GPT-SoVITS
[2] https://www.assemblyai.com/blog/free-open-source-text-to-speech
[3] https://www.femaleswitch.com/directories/tpost/open-source-voice-cloning-tools
[4] https://micdrop.dev/blog/open-source-voice-cloning
[5] https://www.dograh.com/hub/blogs/open-source-tts-models
[6] https://reelmind.ai/blogs/trending-short-form-video-formats-and-creative-strategies
[7] https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox
[8] https://www.yaps.ai/blog/best-local-tts-models
[9] https://www.remotionvideo.com/blog/best-practices-for-video-marketing
[10] https://terramarketgroup.com/blog/short-form-video-retention-hooks-2026-25-openings-that-keep-viewers-watching
[11] https://www.remotionvideo.com/blog/video-scripting-template
[12] https://mediabunny.dev/guide/converting-media-files
[13] https://www.remotion.dev/docs/audio
[14] https://ttsmaker.com/developer-api-docs
[15] https://pro.ttsmaker.com/api-platform/api-docs-v2
[16] https://api.ttsmaker.com/v2/docs
[17] https://ttsmaker.com/id
[18] https://pro.ttsmaker.com/pricing
[19] https://developer.voicemaker.in/apidocs/
[20] https://developer.voicemaker.in/apidocs/introduction
[21] https://voicemaker.in/faq
[22] https://elevenlabs.io/docs/overview/capabilities/text-to-speech
[23] https://azure.microsoft.com/en-us/pricing/details/speech/
