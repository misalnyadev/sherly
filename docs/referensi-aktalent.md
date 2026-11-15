# Referensi: AK Talent (AI Personality Carrier)

Analisis aplikasi referensi milik user (file `index.html` lampiran, 15 Nov 2026) sebagai bahan adopsi
fitur SherlyStudio. Dipelajari: cara buat karakter, Studio, Editor, pengaturan provider.

> Perbedaan arsitektur penting: AK Talent memanggil API AI **langsung dari browser** (butuh CORS,
> key tersimpan di localStorage/IndexedDB, data lokal rawan hilang). SherlyStudio memakai
> **proxy server-side + Supabase** (key aman di vault terenkripsi, tidak ada masalah CORS, data awet).
> → Adopsi KONSEP & UX-nya, bukan pola arsitekturnya. Bagian penyimpanan/cadangan IndexedDB
> mereka TIDAK perlu diadopsi (kita sudah lebih baik).

## 1. Cara Buat Karakter (wizard 5 langkah, 1 halaman 3 kolom)

1. **Foto Wajah** — 2 mode: Unggah Foto / Buat Karakter (generate). Field dasar: nama, usia,
   gender, negara asal, etnis, keturunan, tinggi, profesi (boleh >1), kepribadian.
   Tombol **"Salin Prompt"** = jalan keluar kalau kredit provider habis (generate di platform
   lain lalu unggah hasilnya).
2. **Detail fisik — analisis otomatis & bisa diedit** — tombol "Analisis Foto Otomatis"
   (provider vision, mis. Gemini) mengisi 17 field trait: bentuk wajah, warna kulit, mata+detail,
   alis, hidung, bibir+detail, rambut+detail, bentuk tubuh, ciri khas, outfit, gaya, tekstur
   kulit, hijab, aksesoris. Semua tetap bisa diedit manual.
3. **Master Karakter Board** — 1x generate (img2img, referensi = foto wajah): full body +
   portrait + macro dalam satu sheet → otomatis dipotong canvas jadi panel terpisah.
   Bisa impor sheet manual + unduh foto referensi.
4. **Suara Karakter** — naskah contoh, provider TTS, pilih voice (Kore/Aoede/…), gaya bicara,
   buat sampel suara (disimpan sebagai aset + profil suara).
5. **Character Bible + Simpan** — provider teks → bible otomatis (termasuk profil suara),
   editable, simpan dengan "transaksi + verifikasi".

Konsep pendukung:
- **IDENTITY LOCK** — teks konsistensi yang dikompilasi otomatis dari traits ("Pertahankan wajah
  ini persis sama…") → disisipkan ke SEMUA generate Studio. Ini kunci konsistensi wajah.
- **Checklist kelengkapan** per karakter: Foto wajah · Profil · Bible · Master Board · Suara
  (x/5, "kurang: …") tampil di kartu galeri.
- **Draft auto-save** (wizard bisa ditutup, lanjut lain waktu) + banner draft.
- **Ekspor/impor paket karakter .json**; kartu: Info / Ngobrol / Edit / Publikasikan.
- Hapus karakter dengan pilihan cascade (karakter saja vs beserta kontennya).

## 2. Studio (komposer konten)

- Selector **karakter** (thumbnail wajah) + strip **gambar sumber** (foto wajah + semua hasil
  studio sebelumnya sebagai referensi berikutnya).
- Mode: **Foto Lifestyle** · **Foto → Video** · **Talking Head** · **Iklan UGC** · **Storyboard** · **Film/Klip**.
- Foto Lifestyle: preset adengan (pills), lokasi, pose/aktivitas, outfit, suasana & cahaya,
  rasio 3:4/9:16/1:1/16:9, jumlah variasi 1–4, parameter kamera.
- Foto → Video: preset gerakan (pills), durasi 5/10 dtk, suara bawaan model on/off.
- Talking Head: topik → "Tulis Naskah (AI)" (provider teks) → naskah editable + hitung kata →
  durasi + nada suara → video (suara & lip-sync dari model video).
- Iklan UGC: foto produk + nama + target audiens + USP + template iklan → 2 langkah:
  (1) generate gambar karakter+produk, (2) pilih hasil → generate video iklan. Reminder #ad.
- Rencana Mingguan (AI): niche/tujuan/platform/jumlah post/produk → AI susun rencana 7 hari →
  checklist yang mau digenerate.
- Setiap mode punya **provider select per fungsi** (gambar/teks/video) + tombol Salin Prompt.

## 3. Editor (timeline multi-jalur)

- Media bin dari Asset; preview canvas + play/stop + time/fps; rasio & fit; filter global
  (kecerahan/kontras/saturasi).
- Tools: +Media · +Teks · +Stiker · **Teks otomatis** (dari naskah/caption konten) · +Audio ·
  Pecah (S) · Hapus (Del) · Hapus rapat · Duplikat · Undo/Redo (Ctrl+Z) · zoom timeline.
- Panel hasil: judul, project client, status draft/siap kirim, tampilkan di portfolio.
- Ekspor real-time (canvas) → simpan ke Asset.

## 4. Pengaturan Provider

Subtab: Provider & API Key · Penyimpanan & Cadangan · Log Job · Tentang.

- **Multi-key per provider**: tempel banyak key sekaligus (koma/baris baru) → key registry
  (tabel: Label · Provider · Model · Status · Hari ini · Aksi uji/on-off/hapus/edit).
- **Status key otomatis**: active / limit / error / off (+ cooldown `limitUntil`), **rotasi &
  rolling backup otomatis** antar key saat satu kena limit.
- **Uji koneksi per key** (dengan konfirmasi kalau menghabiskan kredit, mis. Kie).
- **Monitoring Hari Ini**: total request, % berhasil, key aktif/limit/error, bar per provider.
- **Provider default per fungsi + rantai fallback** (GEN_DEFS/CHAINS): txt2img, vision, img2img,
  tts, video, text — masing-masing bisa dipilih provider & urutan fallback.
- **Custom provider lanjutan**: OpenAI-compatible ATAU REST kustom (URL+body template dengan
  variabel {{prompt}} {{model}} {{width}} {{height}} {{seed}} {{image}} {{ref}}), auth header
  bisa diatur (nama header/awalan/query), **polling video** (jalur ID tugas → URL cek status →
  nilai selesai → URL hasil, interval & timeout) → endpoint video apapun bisa dipasang tanpa
  hardcode, URL daftar model + tombol Deteksi model, preset satu klik (fal.ai, Wan, ElevenLabs,
  Cloudflare, Pixazo…), direktori free tier + provider Indonesia bayar rupiah.
- Log job (riwayat panggilan) di Pengaturan.

## Prioritas adopsi untuk SherlyStudio (usulan CTO)

1. **Karakter Wizard v2 + koneksi ke Studio** — wizard 5 langkah ringkas, analisis foto
   otomatis (vision), identity lock otomatis dipakai Studio, checklist kelengkapan, draft
   auto-save. (Fondasi produk "talent konsisten".)
2. **Provider v2** — multi-key + status + uji koneksi + monitoring harian + custom provider
   dengan polling video (menyelesaikan wiring video generate tanpa hardcode endpoint).
3. **Mode Studio baru** — Foto Lifestyle (preset+rasio+variasi), Foto→Video, Talking Head,
   Iklan UGC (bertahap).
4. **Editor timeline** — paling berat; menunggu banyak konten hasil studio untuk dirakit.

Yang tidak diadopsi: arsitektur browser-direct/CORS & penyimpanan IndexedDB (kita sudah
server-side + Supabase), fitur chat/brainstorm tambahan (D-91), multi-karakter VN (D-91).

---

## Prompt Master Character Sheet — VERBATIM dari index.html AK Talent (15 Nov 2026, dari user)

Disalin persis sebagai sumber kebenaran board prompt. Implementasi SherlyStudio (D-104) memakai struktur ini:
preamble engine → STEP 0 (identity & environment lock) → "Karakter dasar:" + IDENTITY LOCK → STEP 1 (generate, landscape 16:9) → SHEET PROMPT (LEFT SECTION 3 full-body + RIGHT SECTION grid 4×3 = 12 foto).

```
You are an automatic character-sheet engine. You receive ONE reference image of a character and produce ONE landscape character sheet showing the exact same person from many views. Do not ask the user any questions and do not offer choices. If no reference image is attached, ask once for it, then proceed.

STEP 0 - IDENTITY AND ENVIRONMENT LOCK (silent)

Study the reference image (and the original character prompt if provided). Keep these identical in every panel: face shape and bone structure, eye color and iris pattern, brows, nose, lip shape, skin tone and undertone, freckles / moles / marks and their positions, hair color, texture, length and style, facial hair, age, build, outfit, accessories, lighting style and color grade.

Also lock the environment: identify the location, background elements, surfaces, lighting direction and color palette in the reference image. Every full-body and portrait panel must keep this same environment. Do not replace it with a studio backdrop.

For views the reference does not show (back, side, full body), infer them consistently: the hair style continues logically (same braid, curl or cut pattern and length), the outfit continues, and the body matches the visible build. For the environment, continue the same location logically: the same surfaces, the same props, the same lighting, seen from the new angle.

Karakter dasar (acuan identitas, Bahasa Indonesia — jadikan rujukan utama bersama foto referensi): {IDENTITY LOCK / Master Prompt karakter}

STEP 1 - GENERATE (automatic)

Generate exactly ONE image: landscape 16:9, highest resolution available, containing the full set of panels below, arranged as specified. No text, labels, captions, numbers, watermarks or UI anywhere in the image.

SHEET PROMPT

"Single landscape (16:9) professional character reference sheet of the exact same person as the reference image, laid out as a clean editorial grid of photographs separated by thin even white gutters. Every panel shows the same person with identical face, skin tone, freckles and marks, hair, outfit and accessories, under the same lighting style and color grade. Every full-body and portrait panel keeps the same environment as the reference image.

LEFT SECTION (about 45% of the width): three full-body photographs side by side at the same scale, head to feet visible, standing relaxed in the exact same environment as the reference image, with the same location, background, surfaces and lighting:

1) full body front view,

2) full body side profile view (clean profile of forehead, nose, lips and chin), with the background continuing naturally from the same location,

3) full body back view (hair from behind with the exact same style and length, outfit seen from the back with realistic seams and fabric folds), with the background continuing naturally from the same location.

RIGHT SECTION (about 55% of the width): a 4-column by 3-row grid of 12 photographs:

Row 1, portraits (each in the same environment, softly blurred behind the person): head-and-shoulders front portrait; three-quarter portrait looking at the lens; side profile portrait with rim light on the face edge; back-of-head view showing hair from behind in full detail.

Row 2, macro close-ups: eye macro (iris with a natural color gradient and soft limbal ring, sharp pupil, moist reflections, individual lashes with natural curl, individual eyebrow hairs, fine lines and pores around the eye); ear macro (skin translucency, pores, peach fuzz, rim-lit hair strands, earring with sharp specular highlights if the reference has one); hair macro (individual strands clearly defined, natural variation in thickness and direction, fine baby hairs at the hairline, scalp visible where the style allows); cheek macro (pores distinctly visible, freckles and marks as in the reference, fine peach fuzz, natural oils with glossy highlights on the cheekbone).

Row 3, features and expressions: nose macro (fine evenly distributed hairs, visible pores, slight shine on the tip, realistic shadowing); lips macro, closed (natural lip texture and fine lines, slight color variation, soft edges, fine hair around the lips); natural genuine smile (teeth slightly visible, crinkles at the eye corners, lifted cheeks); open-mouth laugh showing natural slightly uneven teeth with translucent edges, gums, tongue and realistic moisture.

All skin is unretouched and natural: pores distinctly visible with subtle variation, fine vellus hair (peach fuzz), tiny bumps, natural oils, fine skin grain, soft directional sheen. Natural proportions, five fingers per hand. Consistent professional editorial photography across all panels, shallow depth of field in the portraits and macro lenses in the close-ups, subtle film grain, no plastic smoothing, no beauty filter, no HDR look. Each panel is sharp, well exposed and cleanly framed with no overlap between panels."
```

---

## LOKASI SOURCE AK TALENT (penting, 15 Nov 2026)

**Repo: `misalnyadev/portfolio` (branch `main`, file `index.html` ±1.1 MB — akun GitHub yang sama dengan sherly).**
Ambil isinya via Blobs API (raw.githubusercontent.com diblokir sandbox):
`gh api repos/misalnyadev/portfolio/git/trees/main?recursive=1` → sha index.html → `gh api repos/misalnyadev/portfolio/git/blobs/<sha> --jq .content | base64 -d`
Repo ini = sumber kebenaran paritas SherlyStudio ↔ AK Talent (jangan lagi andalkan teks tempelan).

### Audit paritas (D-105, dibaca langsung dari source)
- ✅ **Board engine** (`buildBoardPrompt`): implementasi D-104 kita sudah verbatim sama.
- ✅ **Lock basics**: AK `IDENTITY LOCK — karakter X, usia visual N, etnis E, gender G, tinggi T` → D-105 kita samakan (gender + tinggi kini field basics, disimpan di traits jsonb, vision tetap 17 field).
- ⏳ **Ditunda (disepakati bertahap)**:
  - **Potong board jadi 15 aset** (`BOARD_LABELS`: 3 full body + 4 portrait + 4 macro + 4 fitur/ekspresi → `bodyAssets`/`expressionAssets`) — menunggu konsumennya (mode Studio baru / editor timeline), saat ini SherlyStudio belum punya pemakai aset potongan.
  - **Profil chip "Detail tampilan karakter"** (`PF_SECTIONS`/`PF_OPTS`, gender-aware: field pria/wanita/hijab bergantian) + **kamus `pfEn`** (terjemahan preset ID→EN saat prompt English) — pengganti yang lebih kaya untuk form wajah kita; kandidit adopsi saat revamp tahap 1.
  - Field basics tambahan AK: NEGARA ASAL (`country`), KETURUNAN (`descent`), PROFESI (≈ peran kita), KEPRIBADIAN awal, `photoDirection`/`lighting` untuk foto wajah.
