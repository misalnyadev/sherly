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
