# D-196 — Rencana: Studio Multi-Karakter (@mention) + Keberlanjutan Adegan

Status: **RENCANA (menunggu persetujuan)** · Branch: `arena/97f57007-sherly` · Base: `7fe0c8b`

## 1. Latar belakang (riset tren 2026)

Tren konten 2026 yang relevan:
1. **Short-form vertical + storytelling POV** (15–45 dtk, hook 3 detik) — masih dominan.
2. **AI-generated content mainstream** (Sora 2 / Veo 3 / Gemini Nano Banana) — paling kuat saat sisi AI-nya ditonjolkan (fantasi, surreal, cerita bersambung).
3. **Kontinuitas scene-to-scene** ala Google Flow — cerita per adegan + karakter konsisten = format binge-able yang memancing penasaran.
4. **Hyperlocal Indonesia** — effortless, sesuai DNA SherlyStudio (contoh: "berjalan di GBK").
5. **AI sebagai workflow produksi** — 73% marketer sudah memakai AI di harian; audiens makin anti konten "terlalu otomatis".

Sintesis: **cerita bersambung multi-karakter** = tren 1+2+3+4 dalam satu format, dan persis arah "Sherly hidup nyata di dunia digital".

## 2. Keputusan user (D-196 scope)

| # | Keputusan | Konsekuensi teknis |
|---|---|---|
| A | Referensi karakter = **aset karakter yang sudah ada**: foto potret + master sheet + suara | Pakai `characters.reference_image_path`, `board_path`, `voice` (jsonb) & `voice_path` |
| B | Saat `@mention` → membawa **foto potret + sheet + suara** karakter tersebut | Server kirim multi-image reference (potret + board) + blok deskripsi suara ke prompt |
| C | **2 foto master** yang sudah di-set di karakter | Portret + master board (sheet) |
| D | Riwayat rantai adegan **disimpan lokal** (localStorage) + **bisa dihapus** | Tombol "Hapus rantai adegan" — chain lokal, bukan server |
| E | **Pill karakter dihapus** — karakter dipanggil hanya lewat `@mention` di prompt | `state.charId` & pill `stCharPill` dibuang; alur `useRef`/`useIdentity` digabung ke sistem mention |

## 3. Arsitektur

### 3.1 Frontend — `public/studio.js`

#### A. Header Komposer — "Header Aset" (ala Google Flow)

Satu baris di **atas textarea** menjadi tempat semua penanda aset aktif. Dua jenis penanda:

| Jenis penanda | Tampilan | Sumber |
|---|---|---|
| **Karakter** | chip bulat kecil berisi **foto potret** karakter (avatar 28px) + nama; badge kecil "mic" bila punya suara, badge "sheet" bila punya master sheet | `@mention` di prompt |
| **Gambar referensi** | chip thumbnail kecil (36x36, rounded) + label "Frame adegan sebelumnya" atau "Referensi lokasi" | frame akhir adegan atau gambar lokasi |

- Karakter **maks 3** (batas keras sesuai keputusan user). Master sheet ditampilkan sebagai **badge** di chip karakter (bukan chip terpisah) supaya hemat slot.
- Chip gambar referensi: **1 slot aktif**, bisa diganti (frame adegan terakhir ATAU referensi lokasi).
- Setiap chip bisa dihapus (klik "x") -> langsung hilang dari header dan dari parse prompt.
- Header aset adalah **turunan parse prompt**, jadi hapus "@nama" manual di teks -> chip ikut hilang (satu sumber kebenaran).

#### B. Mention picker
- Ketik `@` -> dropdown di bawah textarea berisi karakter (avatar + nama + penanda suara/sheet). Navigasi atas/bawah/Enter/Esc.
- Memilih karakter menyisipkan `@nama` di teks **dan** menambah chip di header aset.
- Batas 3 karakter: dropdown memberi tahu "Maksimal 3 karakter" saat sudah penuh.

#### C. Panel "Rantai Adegan" (lokal)
- Strip horizontal berisi thumbnail frame adegan sebelumnya + tombol "Adean baru" + tombol "Hapus rantai".
- Tombol per kartu hasil: `Lanjut Adegan` (frame ini jadi referensi gambar + muncul sebagai chip di header), `Ke Planner`, `Hapus`.
- Referensi gambar = frame **akhir** adegan sebelumnya; opsi lain: gambar **lokasi** (upload/pilih) untuk menjaga kontinuity tempat.

#### D. Mode video
- `Lanjut Adegan` -> membawa frame ke mode video + prefill prompt.

#### E. Pill karakter DIHAPUS (sesuai opsi E)
- Semua pemanggilan karakter lewat `@mention` di prompt.

### 3.2 Prompt composition (server-side & client-side)
Prompt final disusun berurutan:

```
[Adegan 2 dari 3]                       <- nomor adegan (bila ada rantai)
<deskripsi user>

Gaya visual: <suffix style>
(Komposisi gambar dengan rasio aspek 4:5.)

## Karakter yang muncul (maks 3)
### Sherly - potret + master sheet
<identity_prompt>
Suara: voice Gemini "Puck", gaya: <voice.style>
### Novi - potret
<identity_prompt>
Suara: voice Gemini "Kore", gaya: <voice.style>

## Referensi gambar
Gambar terakhir adegan sebelumnya: pertahankan lokasi, pencahayaan, wardrobe, dan wajah yang konsisten.
Gambar referensi lokasi: <deskripsi singkat lokasi>

Lanjutkan adegan ini secara konsisten dengan adegan sebelumnya.
```

- `@mention` di prompt -> server mencari karakter berdasarkan nama/slug -> ambil `identity_prompt`, `voice`, `reference_image_path`, `board_path`.
- **Setiap karakter menyumbang 1-2 gambar**: potret + board (bila ada). Karakter 1 & 2 -> potret + sheet; karakter ke-3 -> potret saja.
- **Frame akhir adegan sebelumnya** = 1 gambar referensi tambahan (maks 7 gambar total per request).
- **Suara**: `voice.name` (Gemini voice ID) + `voice.style` masuk ke prompt sebagai atribut karakter; `voice_path` (sampel audio) = referensi preview di UI + pembawa identitas vokal untuk mode video (TTS), bukan dikirim ke model gambar.

### 3.3 Backend — `server/app.js` + `server/ai.js`
- `POST /api/ai/image` menerima payload baru:
  - `mentions: [{ id, slug, name }]` atau `mentionText: "..."` → server parse `@nama` dari prompt.
  - `continuityFrame: { mime, data }` (opsional) — gambar frame terakhir (base64 dari client, maks 3.5MB).
  - `references: [{ id, mime, data }]` — SERVER me-resolve sendiri dari character id (bukan trust client), untuk keamanan & hemat bandwidth.
- Server memuat karakter milik user (RLS-safe), validasi `user_id === req.user.id`.
- **Gemini**: `parts` = [text prompt] + [inlineData potret] + [inlineData board] + [inlineData continuity] → multi-image reference.
- Engine lain (kie/custom) yang tidak mendukung multi-reference → fallback ke Gemini otomatis + note di UI (sama seperti perilaku D-98).

### 3.4 Local chain (D-196-D)
- `localStorage` key `sherly.studio.chain.v1` = array of `{ id, sceneNo, prompt, mime, data, mentions[], ts }`.
- Maks 6 frame per rantai (agar tidak membebani localStorage); tombol hapus per frame + "Hapus rantai".
- Rantai dihapus otomatis saat pilihan "hapus".

## 4. File yang akan diubah

| File | Perubahan |
|---|---|
| `public/studio.js` | Mention picker, chips, rantai adegan (local), hapus pill karakter, tombol Lanjut Adegan |
| `server/app.js` | Route `/api/ai/image`: parse mention, resolve aset karakter (potret+board), terima continuity frame |
| `server/ai.js` | `generateImageWithGemini` menerima array `references` (multi-image) |
| `public/index.html` | CSS untuk mention dropdown + chips + strip rantai; ikon baru bila perlu |
| `docs/PRD.md` | Baris D-196 |
| — | **Tidak ada migrasi SQL** (semua aset & kolom sudah ada) |

## 5. Yang TIDAK dikerjakan (out of scope)
- Tidak ada tabel/rantai adegan di server (user pilih local).
- Voice cloning baru (Gemini TTS masih 14 prebuilt voice; `voice_path` = sampel referensi).
- Video generation engine (tetap "menyusul" — frame adegan siapDialihkan ke mode video).
- Tidak ada perubahan pada Wizard Karakter.

## 6. Urutan eksekusi
1. Server: multi-reference Gemini + route mention/continuity.
2. Frontend: mention picker + chips + parser.
3. Frontend: rantai adegan lokal + tombol Lanjut Adegan + hapus.
4. CSS + ikon.
5. Smoke test (jsdom) + cek 69 unit test.
6. PRD + commit + PR (merge hanya atas perintah eksplisit user).
