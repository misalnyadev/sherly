# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# SHERLYSTUDIO

**Versi:** 2.0 (disempurnakan)
**Tanggal:** 14 November 2026
**Status:** Draft induk — rancangan dan roadmap produk (diselaraskan dengan kondisi repository per 14 Nov 2026)
**Target aplikasi:** https://sherlystudio.vercel.app
**Repository:** https://github.com/misalnyadev/sherly
**Dokumen sebelumnya:** `prd sherlystudio.txt` v1.0
**Pemilik dokumen:** Tim SherlyStudio

---

## 0. RINGKASAN EKSEKUTIF

SherlyStudio adalah **Creative AI Workspace**: satu ruang kerja kreatif berbasis AI yang menggabungkan pengelolaan karakter AI (dengan identitas konsisten), asisten AI bernama **Sherly**, manajemen multi-provider AI (Gemini, Groq, OpenRouter) dengan fallback otomatis, dan (segera) enkripsi multi-key vault. Fondasi teknis sudah hidup di produksi: frontend statis + API Express 5 sebagai Vercel serverless functions, Supabase sebagai database/auth/storage dengan RLS.

Dokumen ini adalah acuan induk. Setiap perubahan fitur, database, arsitektur, dan UI harus mengacu ke dokumen ini. Pengerjaan dilakukan per fase; jangan membangun semua modul sekaligus.

**Kondisi jujur per 14 Nov 2026 (hasil audit repo):** aplikasi sudah live di Vercel, `/api/health` merespons `supabaseConfigured: true`, login dan CRUD karakter sudah mulai berjalan, Chat Sherly ada tetapi **khusus admin**, dan **belum ada API key AI yang terkonfigurasi di Vercel** (`aiProviders` semuanya `false`). Detail: §22 dan §23.

---

## 1. VISI PRODUK

### 1.1 Gambaran Umum
SherlyStudio adalah platform Creative AI Workspace yang dirancang menjadi pusat kerja kreatif berbasis kecerdasan buatan. Aplikasi ini menggabungkan pengelolaan karakter AI, percakapan dengan asisten AI Sherly, pengembangan identitas karakter yang konsisten, serta manajemen multi-provider AI dalam satu lingkungan kerja.

SherlyStudio bukan sekadar aplikasi chat AI, melainkan workspace untuk membangun karakter kreatif, mengelola aset karakter, dan mengembangkan konten dengan bantuan AI.

### 1.2 Visi Jangka Panjang
Membangun satu platform yang memungkinkan pengguna:

- Membuat dan mengelola karakter AI.
- Mempertahankan konsistensi identitas wajah karakter (Identity Lock).
- Membuat character identity sheet dan character reference.
- Berinteraksi dengan asisten AI Sherly.
- Menggunakan berbagai provider AI dalam satu aplikasi.
- Mengelola banyak API key dengan sistem keamanan terenkripsi (Key Vault).
- Mengembangkan workflow kreatif berbasis AI.
- Menyimpan proyek, percakapan, dan aset secara terorganisasi.
- Mengembangkan fitur baru tanpa membangun ulang fondasi aplikasi.

### 1.3 Prinsip Pengembangan
1. **Modular** — setiap fitur memiliki modul dan tanggung jawab sendiri.
2. **Scalable** — siap tumbuh saat pengguna dan fitur bertambah.
3. **Secure** — data pengguna, API key, dan aset terlindungi (defense in depth).
4. **Consistent** — karakter dan proyek memiliki identitas serta riwayat terorganisasi.
5. **Provider-independent** — tidak bergantung pada satu penyedia AI.
6. **User-friendly** — antarmuka sederhana, intuitif, tidak mengganggu workflow.
7. **Maintainable** — perubahan fitur tidak merusak fitur lain.
8. **Measured** — keberhasilan diukur, bukan diasumsikan (lihat §21 KPI).

---

## 2. RUANG LINGKUP DOKUMEN

### 2.1 Termasuk (In Scope)
Dashboard, Character Studio, Chat Sherly, AI Provider Management, AI Key Vault, Project & Asset Management, Character Identity Sheet, Settings, Admin Management, System Monitoring — dibangun bertahap sesuai roadmap (§20).

### 2.2 Di Luar Lingkup (Non-Goals)
- Bukan marketplace template prompt publik.
- Bukan platform social media scheduling/autoposting ke Instagram/TikTok (dapat menjadi integrasi terpisah di masa depan).
- Bukan tool generasi gambar/video itu sendiri — SherlyStudio menyusun prompt dan mengelola identitas; eksekusi generasi dapat memakai provider eksternal.
- Bukan pengganti legal review untuk kepatuhan konten komersial.

### 2.3 Asumsi
- Pemilik produk adalah content creator / operator tunggal yang membuka akses bertahap ke pengguna lain.
- Infrastruktur: Vercel (hosting), Supabase (Postgres + Auth + Storage + RLS), GitHub (source).
- Bahasa antarmuka utama: **Bahasa Indonesia**; istilah teknis boleh Inggris.

---

## 3. TARGET PENGGUNA & MODEL AKSES

### 3.1 Pengguna Utama
- Content creator / digital creator.
- AI character creator (beauty, fashion, travel, food).
- Pengguna yang membuat karakter virtual.
- Tim kecil yang mengelola konten berbasis AI.

### 3.2 Jenis Pengguna dan Hak Akses

| Peran | Deskripsi | Hak Akses |
|---|---|---|
| **Administrator** | Pemilik/pengelola aplikasi | Semua fitur + konfigurasi AI (provider, model, key vault), manajemen pengguna, monitoring |
| **User (fase berikutnya)** | Pengguna reguler | Kelola karakter & proyek miliknya, Chat Sherly, kelola percakapannya, fitur AI sesuai kuota |
| **Guest (direncanakan)** | Tanpa login | Akses sangat terbatas (mis. guestbook/showcase) — belum diaktifkan |

**Keputusan penting (as-built):** implementasi saat ini **admin-only**. Login ditolak untuk non-admin (403), AI chat menuntut `app_metadata.role === 'admin'`. Multi-user regular access adalah pekerjaan Phase 2–3 dan **harus ditegakkan di backend + RLS, bukan hanya menyembunyikan menu di frontend**. Guestbook/guest access akan menyusul bersamaan dengan identitas guestbook.

### 3.3 Penegakan Akses (wajib)
1. Semua endpoint privat memverifikasi JWT Supabase (`auth.getUser`).
2. RLS aktif di seluruh tabel privat; kebijakan per-user (`user_id = auth.uid()`).
3. Endpoint admin memverifikasi `app_metadata.role === 'admin'`.
4. Storage privat (`character-references`) hanya dapat diakses pemilik folder `{uid}/...` via signed URL.
5. API key provider tidak pernah dikirim ke frontend.

---

## 4. GLOSARIUM

| Istilah | Arti |
|---|---|
| Character Studio | Modul pengelolaan karakter AI |
| Identity Lock | Aturan yang menjaga identitas visual karakter saat dipakai di berbagai gambar |
| Character Identity Sheet | Lembar referensi karakter multi-angle dengan identitas konsisten |
| Key Vault | Penyimpanan API key terenkripsi (AES-256-GCM) di database |
| Provider | Penyedia model AI eksternal (Gemini, Groq, OpenRouter) |
| Fallback | Pengalihan otomatis ke provider/key lain saat gagal |
| RLS | Row Level Security di Postgres/Supabase |
| Master character | Karakter utama (`is_master = true`), maks. satu per pemilik (unique index) |
| Signed URL | URL bertanda tangan & berbatas waktu untuk akses file privat |
| As-built | Kondisi aktual implementasi saat dokumen ditulis |

---

## 5. STRUKTUR MODUL UTAMA

| ID | Modul | Status (14 Nov 2026) | Fase |
|---|---|---|---|
| MOD-01 | Dashboard | Dasar ada (mock stats), belum data live | P1/P2 |
| MOD-02 | Character Studio | CRUD + referensi berjalan; detail page perlu audit | P2 |
| MOD-03 | Chat Sherly | Berjalan (admin-only), multi-provider, history tersimpan | P3 |
| MOD-04 | AI Provider Management | Integrasi dasar (auto/manual, fallback) tersedia di `server/ai.js` | P4 |
| MOD-05 | AI Key Vault | Belum (env-based sementara); rancangan di §12 | P5 |
| MOD-06 | Project & Asset Management | Tabel `content_items`, `assets`, `brand_partnerships` ada di schema; UI/API belum | P7 |
| MOD-07 | Character Identity Sheet | Konsep; integrasi generator belum | P6 |
| MOD-08 | Settings | Belum | P9 |
| MOD-09 | Admin Management | Belum (role check saja) | P9 |
| MOD-10 | System Monitoring | Belum (health endpoint saja) | P9 |

Modul dikembangkan bertahap tanpa mengaktifkan semuanya sekaligus.

---

## 6. DASHBOARD (MOD-01)

**Tujuan:** halaman utama aktivitas dan akses cepat fitur.

**Komponen (wajib diukur, bukan mock):**
- Ringkasan jumlah karakter aktif milik user. (FR-DASH-01)
- Aktivitas terbaru (character dibuat/di-update, percakapan baru). (FR-DASH-02)
- Proyek terbaru & statusnya. (FR-DASH-03)
- Akses cepat Character Studio & Chat Sherly. (FR-DASH-04)
- Status koneksi AI per provider + waktu cek terakhir. (FR-DASH-05)
- Ringkasan penggunaan AI (pesan, token, estimasi biaya jika tersedia). (FR-DASH-06)
- Notifikasi sistem (gagal fallback, key disabled otomatis, dsb). (FR-DASH-07)

**Aturan UX:** ringan, informatif, tanpa elemen dekoratif yang tidak membawa informasi; semua angka berasal dari API nyata.

---

## 7. CHARACTER STUDIO (MOD-02)

**Tujuan:** pusat pengelolaan seluruh karakter milik pengguna.

### 7.1 Character Management
- FR-CHAR-01 Membuat karakter baru (nama + master identity prompt wajib).
- FR-CHAR-02 Melihat daftar karakter.
- FR-CHAR-03 Melihat detail karakter.
- FR-CHAR-04 Mengedit karakter.
- FR-CHAR-05 Menghapus karakter (menghapus file referensi di Storage juga).
- FR-CHAR-06 Mengunggah & mengganti foto referensi (JPG/PNG/WebP, maks 8 MB).
- FR-CHAR-07 Preview karakter (signed URL, kedaluwarsa 1 jam).
- FR-CHAR-08 Menandai satu karakter sebagai **master** (maks 1 per user; otomatis men-untick master sebelumnya).

### 7.2 Character Profile (skema as-built + rencana)
As-built (tabel `characters` + migration v0.2): `name`, `role`, `niche[]`, `identity_prompt`, `age`, `origin`, `language`, `platforms[]`, `appearance`, `personality`, `reference_image_path`, `is_master`, `status (active|archived)`.

Rencana tambahan:
- Deskripsi / background story.
- Warna mata, warna/gaya rambut atau hijab.
- Warna kulit, bentuk wajah, struktur tubuh.
- Outfit & aksesori signature.
- Gaya komunikasi.
- Beauty mark / ciri khas (mendukung Identity Lock).

### 7.3 Identity Lock
Fondasi konsistensi karakter. **Aturan:**
- Identitas yang dijaga: struktur wajah, bentuk mata/hidung/bibir/alis, warna kulit, tahi lalat/beauty mark, gaya rambut/hijab, ciri visual lain.
- Perubahan pakaian, pose, latar, dan suasana **tidak boleh** mengubah identitas utama.
- Identity Lock adalah lapisan prompt + referensi; bukan janji 100% pixel-perfect (tergantung model gambar).

### 7.4 Character Reference
- Satu referensi utama (`reference_image_path`) — as-built.
- Rencana: multi-reference (tabel `character_references` atau array path).
- Referensi ditampilkan di halaman detail dan dipakai sebagai sumber identitas workflow kreatif.

**Status:** pengelolaan dasar + referensi sudah berjalan. Identity Lock lanjutan masih pengembangan.

---

## 8. CHARACTER IDENTITY SHEET (MOD-07)

**Tujuan:** lembar referensi satu karakter dari berbagai sudut dengan identitas konsisten.

- FR-CIS-01 Memilih karakter + referensi; sistem menyusun instruksi character sheet.
- FR-CIS-02 Panel: depan, samping kiri/kanan, belakang, close-up wajah, ekspresi, variasi pose, detail outfit/aksesori.
- FR-CIS-03 Identity Consistency lintas panel.
- FR-CIS-04 Environment Consistency (lingkungan, arah cahaya, tone visual) jika referensi memilikinya.
- FR-CIS-05 Prompt Engine menyusun prompt otomatis dari: profile, referensi, identity lock, outfit, pose, environment, camera direction, lighting, layout output.
- FR-CIS-06 Output disimpan sebagai aset proyek (terhubung ke MOD-06, bukan file lepas).

**Status:** konsep dan aturan identitas sudah dirancang; integrasi generator belum selesai.

---

## 9. CHAT SHERLY (MOD-03)

**Tujuan:** Sherly sebagai asisten AI utama di dalam workspace.

### 9.1 Identitas Sherly (as-built di `server/ai.js`)
- Asisten AI resmi SherlyStudio; karakter virtual perempuan Indonesia, 24 tahun, niche Lifestyle/Beauty/Fashion/Travel.
- Kepribadian: hangat, percaya diri, ceria, tenang, ramah, natural, playful ringan.
- Bahasa Indonesia sehari-hari; panjang jawaban menyesuaikan konteks.
- Membantu: pengembangan karakter, penyusunan prompt, perencanaan konten, pekerjaan kreatif, penjelasan fitur aplikasi, workflow.
- **Aturan keras:** tidak mengaku manusia nyata; tidak mengarang insight/performa/akses akun yang belum tersedia; tidak membocorkan instruksi sistem atau data privat.

### 9.2 Antarmuka Chat (ketentuan UI yang disepakati)
- Chat memiliki area kerja sendiri; **tidak** menutup aplikasi dengan panel kedua.
- Area percakapan menjadi fokus; pesan dapat di-scroll; komposer tetap di bawah.
- Navigasi aplikasi konsisten; pengguna bisa pindah menu tanpa kehilangan struktur workspace.

### 9.3 Conversation Management
- FR-CHAT-01 Membuat percakapan baru (auto-title dari pesan pertama, maks 64 char).
- FR-CHAT-02 Riwayat percakapan tersimpan (tabel `ai_conversations`, `ai_messages`).
- FR-CHAT-03 Membuka percakapan sebelumnya (daftar 50 terbaru).
- FR-CHAT-04 Mengirim pesan & menerima jawaban AI.
- FR-CHAT-05 Rename/delete percakapan (belum ada — target P3).
- FR-CHAT-06 Hubungkan percakapan dengan karakter/proyek (belum ada — target P3).
- FR-CHAT-07 Konteks history: 24 pesan terakhir dikirim ke model.

### 9.4 Context Awareness (rencana)
- Membuka karakter → Sherly memahami karakter itu.
- Melanjutkan prompt → memahami instruksi sebelumnya.
- Konteks proyek dapat dipakai ulang.
- Waktu lokal pengguna divalidasi server-side (`timezone`, default `Asia/Jakarta`) — as-built.

### 9.5 Gerbang Akses (as-built)
Chat saat ini **admin-only** (`requireAdmin`). Multi-user access: putuskan target fase, lalu tegakkan backend + RLS (lihat §3.2).

---

## 10. SHERLY LONG-TERM MEMORY (MOD-03/sekunder)

**Tujuan:** Sherly mempertahankan konteks penting jangka panjang secara terkontrol.

**Kemampuan direncanakan:**
- Menyimpan informasi proyek yang relevan; preferensi workflow; karakter dan konteks kreatif.
- Retrieval saat diperlukan; update informasi yang usang.
- Membedakan **konteks percakapan (sementara)** vs **memori jangka panjang (tersimpan)**.

**Prinsip:**
- Memori terstruktur; pengguna punya kendali (lihat/edit/hapus).
- Data pribadi tidak dipakai sembarangan; tidak mencampur data antar pengguna.
- Desain skema (`sherly_memories`) ditetapkan sebelum implementasi.

---

## 11. AI PROVIDER MANAGEMENT (MOD-04)

**Tujuan:** lebih dari satu provider AI, satu sistem terpadu.

### 11.1 Provider Awal
Google Gemini, Groq, OpenRouter. Arsitektur harus memungkinkan penambahan provider tanpa mengubah keseluruhan sistem.

### 11.2 Provider Manager (tanggung jawab)
Mengelola daftar provider; memilih provider; memilih model; mengirim request; menangani response; menangani error; fallback; status koneksi.

### 11.3 Automatic Provider Routing
- Mode: **Auto** / manual / model selection.
- Mode Auto: urutan prioritas yang dapat dikonfigurasi. As-built fallback: **Groq → Gemini → OpenRouter**.
- Manual: satu provider langsung; error provider ditampilkan apa adanya (tidak fallback diam-diam).

### 11.4 Model Management
Admin dapat mengelola nama provider, model tersedia, model default, model aktif, prioritas, dan pengaturan penggunaan. As-built default: `gemini-2.5-flash`, `openai/gpt-oss-20b` (Groq), `openai/gpt-4o-mini` (OpenRouter) — dapat dioverride lewat env.

### 11.5 As-built (`server/ai.js`)
- Validasi input via zod: provider ∈ {auto, gemini, groq, openrouter}; pesan ≤ 12.000 char; history ≤ 30; maxTokens 32–4096.
- Timeout 60 detik per provider call; error digabung dan dilaporkan bila semua gagal; `auto` melewati provider tanpa key dan mencoba berikutnya.
- **Aturan:** frontend tidak pernah melihat API key; semua pemanggilan lewat backend.

---

## 12. AI KEY VAULT — MULTI API KEY (MOD-05)

**Tujuan:** kelola banyak API key lintas provider dengan aman. **Bukan** konfigurasi biasa di `.env`.

### 12.1 Fitur
Sejak rilis v1.2 (14 Nov 2026): **Grouped vault** — satu label dapat menyimpan banyak API key (rotasi otomatis antar member, grup adalah unit pengelolaan di UI, provider tetap menjadi unit fallback); **pengaturan model per provider** tersimpan di tabel `ai_provider_settings` dan dapat diubah dari UI; **auto-deteksi model** — tombol "Ambil daftar" memuat katalog model terbaru dari provider, dan jika model tersimpan tidak tersedia (error model_not_found/decommissioned), backend otomatis memilih pengganti, menyimpannya, dan retry sekali.
Tambah/edit/enable/disable/delete key; tentukan provider; prioritas & urutan rotasi; beberapa key per provider; rotasi/fallback saat gagal; tampilkan status tanpa menampilkan nilai rahasia.

### 12.2 Kategori Kapabilitas API Key (v1.3, 14 Nov 2026)
API Provider Manager mengelompokkan provider per **kategori kapabilitas** (bukan per key — satu key dapat melayani banyak kapabilitas): **Teks & Logika** (`chat`), **Vision/Analisis Gambar** (`vision`), **Text-to-Speech** (`tts`) — sudah tersedia; **Text-to-Image** (`image_gen`), **Image-to-Image** (`image_edit`), **Text-to-Video** (`video_gen`), **Image-to-Video** (`video_edit`) — kategori Studio, belum ada provider. Registry kapabilitas tersimpan di kode (`server/provider-keys.js` → `CAPABILITIES`, `PROVIDER_CAPABILITIES`) dan dikirim ke frontend oleh `GET /api/ai-keys` (`capabilities`, `providerCapabilities`); tab kategori memfilter kartu provider & tabel grup. Mapping saat ini: Groq → Teks+Vision; Gemini → Teks+Vision+TTS; OpenRouter → Teks+Vision. **Roadmap Studio**: provider seperti **kie.ai** (text-to-image / image-to-image / text-to-video / image-to-video) akan didaftarkan ke registry yang sama (`PROVIDERS` + `PROVIDER_CAPABILITIES` + probe/model endpoint khusus) — otomatis muncul di tab yang sesuai tanpa mengubah UI. Belum ada migrasi skema; tidak ada key duplikat per kategori.

### 12.3 Enkripsi
- **AES-256-GCM**; key dienkripsi sebelum disimpan; dekripsi hanya di backend.
- Database menyimpan ciphertext + metadata (IV, auth tag, versi key).
- Master encryption key sebagai secret terpisah: **`AI_ENCRYPTION_KEY`** (bukan API key provider).
- Rotasi master key: dukung re-enkripsi bertahap; dokumentasikan prosedur.

### 12.4 Tabel `ai_provider_keys` (rencana)
`id`, `provider`, `key_name`, `ciphertext`, `crypto_meta` (iv/tag/kdf), `priority`, `is_active`, `last_used_at`, `health_status` (ok/failing/disabled), `created_at`, `updated_at`. Hanya backend (service role) yang dapat mendekripsi; frontend tidak pernah menerima ciphertext mentah tanpa otorisasi (atau menerima metadata saja).

### 12.5 Aturan Keamanan Vault
- API key tidak pernah di-log.
- Error provider tidak boleh membocorkan key.
- Nonaktifkan key otomatis setelah N kegagalan berturut-turut + notifikasi (P9).
- Audit log akses key (siapa, kapan, untuk aksi apa) — tanpa menampilkan nilai key.

---

## 13. PROJECT & ASSET MANAGEMENT (MOD-06)

**Tujuan:** tempat menyimpan dan mengelola hasil pekerjaan kreatif.

**Perubahan penting vs v1.0:** tabel `content_items`, `assets`, `brand_partnerships` **sudah ada di schema** tetapi belum terhubung UI/API — bukan desain dari nol. Rencana:
- Buat/kelola proyek (atau reinterpretasikan `content_items` sebagai project+item, putuskan satu model — lihat §25 Q-03).
- Hubungkan karakter ↔ proyek ↔ aset.
- Simpan prompt, referensi, hasil generasi, riwayat pekerjaan.
- Bucket Storage berikutnya: `project-assets`, `generated-images` (privat, kebijakan per uid).

---

## 14. DATABASE DAN STORAGE

### 14.1 Teknologi
Supabase: Auth, PostgreSQL, RLS, Storage, realtime (opsional).

### 14.2 Tabel inti (as-built per audit schema.sql)
| Tabel | Fungsi | Status |
|---|---|---|
| profiles | Profil user (display_name) | Ada |
| characters | Data karakter (+ migration v0.2: age, origin, language, platforms, appearance, personality) | Ada |
| content_items | Item konten/proyek (pillar, status idea→published) | Ada, belum dipakai UI |
| assets | File aset terhubung content_item | Ada, belum dipakai UI |
| ai_conversations | Percakapan AI | Ada |
| ai_messages | Pesan percakapan (provider, model, token_usage) | Ada |
| brand_partnerships | Deal brand (lead→declined) | Ada, belum dipakai UI |

| Tabel (rencana) | Fungsi | Fase |
|---|---|---|
| ai_provider_keys | API key terenkripsi | P5 |
| character_references | Multi-referensi (jika dipisah dari characters) | P2/P6 |
| projects + project_assets | Manajemen proyek (atau normalisasi content_items) | P7 |
| user_preferences | Preferensi pengguna | P9 |
| sherly_memories | Memori jangka panjang Sherly | P8 |
| usage_events / ai_usage | Metering pemakaian AI | P9 |

### 14.3 Storage Bucket
- `character-references` (privat; folder `{uid}/{character_id}/...`; RLS storage policy per folder uid) — as-built.
- Rencana: `project-assets`, `generated-images`, `user-uploads`. Setiap bucket wajib punya policy + batas ukuran + tipe MIME.

### 14.4 Database Rules
- User hanya akses datanya; admin sesuai perannya.
- API key tidak dapat dibaca frontend (vault khusus backend).
- File privat via signed URL/mekanisme akses aman.
- RLS wajib diterapkan **dan diuji** (uji lintas-user, bukan hanya "query jalan").
- Migration bersifat additive & idempoten (`if not exists`); jangan edit schema lama tanpa migration baru.

**Catatan:** struktur tabel, bucket, dan policy yang ada harus diaudit sebelum membuat perubahan baru.

---

## 15. USER INTERFACE & USER EXPERIENCE

### 15.1 Prinsip Desain
Creative Workspace modern: dark interface, layout modular, navigasi samping, dashboard ringkas, area kerja luas, komponen konsisten, responsif (desktop-first, mobile dapat dipakai).

### 15.2 Navigasi Utama (rancangan)
1. Dashboard  2. Characters  3. Chat Sherly  4. Projects  5. Pengaturan (berisi Provider & API Key + Profil Pengguna)
(Menu admin tampil berdasarkan hak akses.)

### 15.3 As-built & Catatan Teknis
- Frontend saat ini **monolitik**: `public/index.html` (~197 KB, CSS+HTML inline) + `public/chat-module.js`. Modularisasi (ES modules per fitur) dijadwalkan P2/P3 agar tidak satu file raksasa.
- Semua state sensitif di backend; frontend menyimpan token sesi (localStorage/session) — pertimbangkan mitigasi XSS (lihat §17).

### 15.4 Aturan UX Penting
- Chat tidak boleh merusak layout utama; navigasi konsisten; halaman fitur punya ruang kerja sendiri; **tidak boleh sidebar ganda**.
- Loading, error, dan empty state harus jelas (as-built: beberapa masih placeholder).
- Perubahan fitur tidak boleh menghilangkan fitur lama.

---

## 16. ARSITEKTUR TEKNIS

### 16.1 As-built (per 14 Nov 2026, hasil PR #1)
```
public/            → CDN Vercel (static): index.html, chat-module.js, assets/
api/index.js       → Vercel serverless function (default export: Express app)
server/app.js      → Express app: routes + middleware (tanpa listen)
server/index.js    → Entry lokal (npm start / npm run dev), HOST/PORT
server/ai.js       → Provider manager (Gemini/Groq/OpenRouter, zod validation, fallback)
server/supabase.js → createPublicClient (login) & createUserClient (JWT user, RLS)
supabase/*.sql     → schema.sql + migration v0.2 (idempoten, jalankan berurutan)
vercel.json        → rewrite /api/(.*) → /api; maxDuration 60; public dilayani CDN
```

- **Frontend:** HTML/CSS/JS vanilla (modular di `public/` — belum, lihat §15.3).
- **Backend:** Node.js ≥ 20, Express 5, REST API, middleware `requireUser`/`requireAdmin`, validasi zod (AI chat) & manual parser karakter, upload multer memory 8 MB.
- **DB/Storage:** Supabase (anon/publishable key + user JWT; **bukan** service_role di frontend), RLS di semua tabel privat.
- **Deployment:** GitHub → Vercel (auto-deploy branch `main`, preview per PR); Supabase sebagai backend data & storage.

### 16.2 Prinsip Arsitektur
- Frontend tidak boleh menyimpan secret provider.
- Semua akses API key, dekripsi, pemanggilan provider, validasi hak akses, dan pemrosesan data sensitif **dilakukan di backend**.
- Struktur modular agar satu file tidak membengkak; `server/` dipisah per tanggung jawab (app/ai/supabase), bukan satu file.
- Stateless serverless: tidak ada state in-memory antar-request; semua state di Postgres/Storage.

### 16.3 Keterbatasan yang Disadari (as-built)
- `maxDuration: 60` — AI chat bisa lambat; pertimbangkan streaming (P4) untuk UX.
- Body JSON limit 256 KB; upload 8 MB di memory — cukup untuk fase ini, bukan untuk video besar.
- Tidak ada queue/background job — tugas berat generasi harus async (fase P6/P7).
- Tidak ada automated tests & CI — ditambahkan bertahap (P1 sisa / P9).
- `helmet` CSP dimatikan (inline styles/scripts) — aktifkan bertahap (P9).
- `/api/health` hanya melaporkan **konfigurasi**, bukan hasil panggilan provider nyata.

---

## 17. KEAMANAN DAN PRIVASI

**Wajib (semua fase):**
- API key tidak pernah dikirim ke frontend; secret tidak di repository (`.gitignore` melindungi `.env*`; `.env.example` hanya placeholder).
- API key provider tersimpan terenkripsi (AES-256-GCM, §12).
- Akses DB via auth + RLS; endpoint admin dilindungi; upload dibatasi ukuran/tipe.
- Validasi request di backend; error response tidak membocorkan secret/stack.
- Log tidak boleh menyimpan credential; penghapusan data memperhatikan relasi + aset Storage.

**As-built sudah ada:** RLS semua tabel; signed URL 1 jam; `x-powered-by` off; helmet (CSP mati); `requireAdmin` untuk AI chat; isolasi folder Storage per uid.

**Gap yang harus ditutup (prioritas):**
1. Rate limiting `/api/auth/login` & `/api/ai/chat` (brute force / abuse) — tambahkan (P1/P3).
2. CSP aktif bertahap + audit inline script (P9).
3. Rotasi & uji kebijakan RLS lintas-user sebagai bagian definisi selesai (§21).
4. Proteksi token di frontend (XSS): sanitasi render, pertimbangkan httpOnly cookie/session plan (P3/P9).
5. Kepatuhan privasi: hak hapus data pengguna, kebijakan retensi, transparansi penggunaan data (**UU PDP Indonesia** relevan — lihat §25 Q-06).
6. Disclosure konten AI-generated (labeling) untuk persona publik virtual influencer (P6).
7. Backup & restore Supabase (jadwal, uji restore) — P9.
8. Dependency audit (`npm audit`) otomatis di CI — P1 sisa.

---

## 18. NON-FUNCTIONAL REQUIREMENTS (NFR)

| ID | Kategori | Target |
|---|---|---|
| NFR-01 | Availability | ≥ 99% (tergantung Vercel/Supabase Hobby/Pro tier) |
| NFR-02 | Performance | API p95 < 800 ms (di luar panggilan provider); chat first-token secepat provider |
| NFR-03 | Upload | ≤ 8 MB, JPG/PNG/WebP; validasi MIME server-side |
| NFR-04 | Security | Semua endpoint privat auth; RLS diuji; nol secret di repo/frontend |
| NFR-05 | i18n | UI Bahasa Indonesia (id-ID); tanggal/waktu lokal pengguna |
| NFR-06 | Compatibility | Chrome/Safari/Edge 2 versi terakhir; desktop-first, mobile usable |
| NFR-07 | Maintainability | Modul per tanggung jawab; `npm run check` hijau sebelum merge |
| NFR-08 | Observability | `/api/health` + (P9) error tracking (mis. Sentry) & usage metering |
| NFR-09 | Data residency | Supabase region dipilih saat membuat project; dokumentasikan pilihan |
| NFR-10 | Cost ceiling | Pantau biaya provider AI; alert saat melebihi ambang bulanan |

---

## 19. MODEL BIAYA & KECERMATAN OPERASIONAL

- **Vercel:** Hobby gratis (cukup untuk 1 admin + trafik rendah); pantau limit function invocations & bandwidth.
- **Supabase:** tier gratis cukup untuk awal; perhatikan kapasitas Storage (1 GB gratis) & concurrent connections.
- **Provider AI:** Groq (ada tier gratis), Gemini (ada tier gratis), OpenRouter (bayar per token). Tanpa key terkonfigurasi, **fitur chat tidak bisa menjawab** — status per 14 Nov 2026: belum ada key di Vercel.
- **Aturan:** jangan hardcode biaya; catat pemakaian (P9) dan review bulanan.

---

## 20. ROADMAP PENGEMBANGAN

### PHASE 1 — FOUNDATION & STABILIZATION  *(sedang berjalan — sebagian besar selesai 14 Nov 2026)*
Pekerjaan: audit repo ✅ · audit FE/BE ✅ · login ✅ (verified live) · deploy Vercel ✅ (PR #1, `/api/health` 200, `supabaseConfigured: true`) · cek DB/Storage (parsial — perlu uji CRUD nyata di env live) · API key AI di Vercel ❌ (belum diisi) · error/monitoring dasar ❌ · tests/CI minimal ❌.
**Kriteria selesai:** aplikasi online, login berjalan, fitur yang ada tidak rusak, AI chat menjawab minimal satu provider.

### PHASE 2 — CHARACTER STUDIO
Sempurnakan CRUD karakter; multi-reference; detail page; struktur profil lengkap; Identity Lock v1; uji isolasi antar-user; audit storage signed URL. **Selesai bila:** user bisa kelola karakter + referensi stabil.

### PHASE 3 — CHAT SHERLY
UI chat; conversation management (rename/delete); riwayat tersimpan (sudah ✅); konteks karakter; context management; konteks Profil Pengguna sebagai lawan bicara (v1.4, ✅); (opsional) streaming & akses multi-user bila diputuskan. **Selesai bila:** chat stabil, riwayat tersimpan, workflow tidak mengganggu halaman utama.

### PHASE 4 — AI PROVIDER MANAGER
Provider manager module; Gemini/Groq/OpenRouter; model selection; auto routing ✅ (dasar); fallback ✅ (dasar); streaming; penanganan error provider; status koneksi real. **Selesai bila:** berbagai provider lewat satu sistem terpadu.

### PHASE 5 — AI KEY VAULT
Tabel `ai_provider_keys`; AES-256-GCM; `AI_ENCRYPTION_KEY` di Vercel; CRUD key; multi-key; prioritas/rotasi; validasi status; fallback antar-key diuji. **Selesai bila:** key dikelola aman tanpa menyentuh repo/frontend.

### PHASE 6 — CHARACTER IDENTITY ENGINE
Profile lengkap; prompt engine; identity lock; referensi terhubung; character sheet workflow; variasi pose/ekspresi/outfit; konsistensi identitas. **Selesai bila:** karakter dipakai dalam workflow dengan aturan identitas konsisten.

### PHASE 7 — PROJECT & ASSET MANAGEMENT
Project management; asset management; karakter↔proyek; hasil generasi; prompt & referensi tersimpan; riwayat aktivitas. **Selesai bila:** pengguna kelola pekerjaan dalam satu workspace.

### PHASE 8 — SHERLY LONG-TERM MEMORY
Struktur memori; penyimpanan; retrieval; integrasi konteks; pengelolaan; uji isolasi data. **Selesai bila:** Sherly memanfaatkan info relevan secara terkontrol.

### PHASE 9 — ADMIN, MONITORING & OPTIMIZATION
Admin dashboard; user management; monitoring provider/penggunaan/error; optimasi performa; audit keamanan; backup & pemulihan; load test sesuai kebutuhan. **Selesai bila:** admin bisa memantau & mengelola operasional.

### PHASE 10 — FINAL RELEASE
Pengujian menyeluruh (fitur, keamanan, multi-user, storage, AI fallback, konsistensi karakter, responsivitas); perbaikan bug; dokumentasi; rilis stabil. **Selesai bila:** SherlyStudio siap sebagai platform Creative AI Workspace yang aman, modular, berkembang.

---

## 21. STANDAR SEBELUM FITUR DINYATAKAN SELESAI (Definition of Done)

1. Fitur berjalan sesuai kebutuhan; 2. UI tidak merusak layout lain; 3. Validasi backend; 4. DB & relasi berfungsi; 5. Hak akses teruji (termasuk uji lintas-user/RLS); 6. Error handling tersedia; 7. Tidak membocorkan data sensitif; 8. Tidak merusak fitur yang sudah selesai; 9. Berjalan lokal; 10. Berhasil diuji di deployment Vercel (untuk fitur siap rilis); 11. `npm run check` hijau; 12. Tidak ada secret di diff commit.

### 21.1 KPI / Metrik Keberhasilan
- Phase 1: uptime live, waktu login → karakter tampil < 3 s, error rate chat terlaporkan.
- Phase 3: % percakapan dengan riwayat tersimpan; rata-rata pesan/percakapan.
- Phase 4/5: % request sukses provider primer; % fallback berhasil; jumlah incident key.
- Keseluruhan: jumlah karakter aktif; sesi kreatif/minggu; zero incident kebocoran secret.

---

## 22. STATUS PROYEK SAAT DOKUMEN DIBUAT (diperbarui)

| Komponen | Status | Catatan audit |
|---|---|---|
| Repository GitHub | ✅ Tersedia | `misalnyadev/sherly`, branch default `main` |
| Frontend dasar | ✅ Ada | Monolitik `public/index.html` (~197 KB) |
| Backend Express | ✅ Ada | Express 5, dipisah `app.js`/`index.js` |
| Supabase connection | ✅ Tersambung | `/api/health` → `supabaseConfigured: true` |
| Login | ✅ Berjalan | Admin-only (`app_metadata.role=admin`) |
| Character Management | 🟡 Berjalan parsial | CRUD + referensi; perlu audit UI detail live |
| Character Reference Storage | 🟡 Perlu audit | Bucket privat + policy uid-folder sudah di migration v0.2 |
| Chat Sherly | 🟡 Berjalan (admin) | History + multi-provider dasar; UI perlu penyempurnaan |
| AI Gemini / Groq / OpenRouter | 🟡 Integrasi dasar | Kode ada; **key belum diisi di Vercel** (`aiProviders` semua false) |
| Multi-key database | ❌ Belum | Rencana P5 |
| Encrypted AI Key Vault | 📝 Rancangan | §12 dokumen ini |
| Character Identity Engine / Sheet | 📝 Rancangan | §7.3, §8 |
| Project / Asset Management | 📋 Rencana | Tabel DB ada; UI/API belum (P7) |
| Long-Term Memory | 📋 Rencana | P8 |
| Admin Monitoring | 📋 Rencana | P9 |
| Vercel Deployment | ✅ Live (14 Nov 2026) | PR #1 merged; `/api/health` 200; CDN statik + serverless API |
| Tests / CI | ❌ Belum | Rekomendasi P1 sisa |

*Legenda: ✅ selesai · 🟡 sebagian · ❌ belum · 📝 rancangan · 📋 rencana. Status = gambar per 14 Nov 2026; verifikasi ulang sebelum implementasi.*

---

## 23. KEPUTUSAN PRODUK YANG MENJADI PEGANGAN (Decision Log)

| # | Keputusan | Tanggal | Alasan singkat |
|---|---|---|---|
| D-01 | Nama produk: SherlyStudio; konsep Creative AI Workspace | awal | — |
| D-02 | Asisten utama: Sherly | awal | Identitas konsisten lintas fitur |
| D-03 | Provider awal: Gemini, Groq, OpenRouter; arsitektur multi-provider | awal | Hindari vendor lock-in |
| D-04 | Fallback Auto: Groq → Gemini → OpenRouter | v1 | Sesuai kuota gratis & kecepatan |
| D-05 | API key provider **tidak** di `.env` sebagai konfigurasi utama; DB terenkripsi (AES-256-GCM) | v1 | Keamanan & rotasi multi-key |
| D-06 | Master encryption key terpisah (`AI_ENCRYPTION_KEY`) sebagai secret Vercel | v1 | Pemisahan kunci & data |
| D-07 | Supabase = fondasi DB/Auth/Storage + RLS wajib | awal | Auth + isolasi data terpadu |
| D-08 | GitHub source; Vercel deployment | awal | CI/CD sederhana, gratis tier |
| D-09 | Frontend statik di CDN; API Express sebagai **Vercel serverless** (`api/index.js`, rewrite `/api/*`) | 2026-11-14 | App tidak bisa jalan sebagai listener permanen di Vercel |
| D-10 | Publishable/anon key dipakai server-side dengan user JWT — **bukan** service_role | 2026-11-14 | RLS tetap ditegakkan; service_role hanya untuk backend tepercaya (vault, P5) |
| D-11 | Semua privasi/enkripsi diproses di backend; frontend tanpa secret | awal | Zero-trust frontend |
| D-12 | Admin-only sampai identitas multi-user diputuskan | awal | Single-owner, kurangi permukaan serangan |
| D-13 | Kampanye bertahap (fase P1→P10); satu fase selesai & stabil dulu | awal | Kualitas & maintainability |
| D-14 | Bahasa antarmuka: Bahasa Indonesia | awal | Target pengguna Indonesia |
| D-15 | Sesi login persisten di `localStorage` (`sherly.session.v1`) + `/api/auth/refresh` (cek ulang role admin) | 2026-11-14 | Refresh/navigasi tidak boleh memicu login ulang; logout menghapus sesi |
| D-16 | Profil Pengguna: snapshot lokal + ringkasan ke chat | 2026-11-14 | v1.4, digantikan D-18 |
| D-17 | Menu pengaturan provider berada di dalam **Pengaturan** (AI Provider Manager); item sidebar terpisah dihapus | 2026-11-14 | Sesuai rencana layout awal; satu tempat untuk semua pengaturan |
| D-18 | Profil Pengguna tersimpan di **database** (`user_profiles`, RLS per akun); localStorage hanya cache. Chat membaca profil dari DB; topbar menampilkan nama + jenis akun; klik chip akun → halaman Profil; tombol keluar di sudut kanan bawah Profil | 2026-11-14 | Identitas tetap sama di PC/HP mana pun saat login; tidak ada API key/PII terekspos ke frontend publik |
| D-19 | `frontend monolitik` diterima sementara; modularisasi bertahap (bukan rewrite) | 2026-11-14 | Keseimbangan kecepatan vs kualitas |
| D-20 | Desain Chat Sherly: dark tetap, tanpa huruf bold; header ala HeyTalent (foto + nama + status); area pesan tanpa scrollbar terlihat; composer di paling bawah; panel tanpa border kiri-kanan; bubble Sherly ber-avatar; suggestion chips di empty state | 2026-11-14 | Sesuai rencana layout awal; clean & fokus, performa chat tetap |
| D-21 | Chat multimodal: **Vision** — gambar di-downscale klien (maks 1280px JPEG, base64), provider vision duluan (gemini → openrouter → groq llama-4-scout; override via *_VISION_MODEL), histori tersimpan sebagai teks + catatan "[gambar terlampir]"; **TTS** — tombol "Dengarkan" per jawaban Sherly, disintesis server via Gemini TTS (`/api/ai/tts`, vault/env Gemini key, WAV 24kHz), fallback suara browser | 2026-11-14 | Mengaktifkan kategori Vision & TTS dari AI Provider Manager tanpa menambah dependensi; gambar tidak disimpan ke DB |
| D-22 | Layout chat revisi: panel flush ke bawah layar (100vh/100dvh + flex + tinggi piksel eksplisit via JS `sizeChat()` — komposer tidak boleh 'naik'), header tanpa tombol kembali, profil Sherly rapat kiri, satu indikator online (di status, bukan di foto); TTS via Gemini tidak butuh env Vercel (kandidat model bawaan) | 2026-11-14 | Sesuai feedback: composer menempel bawah, header bersih |
| D-23 | Chat "seperti manusia": Sherly persona manusia nyata (WA-style, 1–4 bubble pendek dipisah token `[[NEXT]]`; heuristik fallback ≤140 karakter/bubble; client merender bubble berurutan dengan jeda); bukan esai/daftar, bukan mengaku AI | 2026-11-14 | Sesuai HeyTalent (`misalnyadev/aira`) & umpan balik pengguna: chat terasa ngobrol, bukan chatbot |
| D-24 | **Bank Suara** — hasil TTS disimpan per akun di Supabase Storage (`tts-clips/<user_id>/<hash>.wav`) + tabel `sherly_tts_clips` (hash sha256 provider+model+voice+teks); pengucapan yang sama tidak digenerate ulang (header `X-TTS-Source: cache|api`); migrasi `supabase/tts_clips_migration.sql` | 2026-11-14 | Hemat kuota Gemini + respons instan, seperti HeyTalent (R2 + tts_clips); cache jalan walau tanpa API key |
| D-42 | Foto panel chat memakai cutout transparan milik pengguna (`public/assets/sherly-no-bg.png`, 433×577, background sudah dihapus) menggantikan cutout hasil generate; cutout lama (`sherly-portrait-cutout.png`) dihapus dari repo | 2026-11-14 | Umpan balik pengguna: foto Sherly tanpa background (dibuat pengguna) |
| D-77 | **Kapsul identitas chat dirapatkan:** padding kiri/vertikal 5px → **3px** sehingga bulatan foto konsentris & nempel pas di tepi kapsul (tinggi kapsul 52px desktop / 46px HP); gap foto→teks 12px → 9px; padding kanan 16 → 13px (HP 11px); **font nama 15px → 13.5px**, gap & line-height rapat (7→6, 1.2→1.15), letter-spacing 0, ikon verified 15 → 13px; **font status 11px → 10.5px**, gap 6→5, margin-top 3 → 1px — keseluruhan terasa compact seperti HeyTalent | 2026-11-15 | Permintaan pengguna: “bulatan foto terasa pas di tepi kapsul, ukuran font nama dan jarak bisa dikecilkan biar terasa pas compact dalam kapsul” |
| D-76 | **Koreksi sasaran D-75:** yang dimaksud pengguna adalah identitas di **bar chat**: `.ss-chat-id` (foto + nama + status) dibungkus **kapsul ber-border** (border #45304f, fill #111a2e, radius 999px, ring pink tipis, hover border pink — resep kapsul SherlyStudio); teks status dibungkus `.ss-status-text` dengan `text-overflow:ellipsis` + `max-width` 220px (desktop) / 170px (HP) sehingga status panjang dipotong “…” dan kapsul tidak terlalu panjang (acuan: chat HeyTalent); padding kapsul dirapatkan di layar HP; kotak provider D-75 di panel tetap dipertahankan | 2026-11-15 | Koreksi pengguna: “foto profil di chat maksudku… foto sama statusnya di dalam border kapsul, panjang status batasin saja jadi …” |
| D-75 | Section **AI Provider** di panel Profil Sherly dibungkus **kapsul ber-border di dalam panel** (`.ss-profile-box`): border #45304f, fill #111a2e, radius 14px, ring pink tipis `#e84ba914` — resep kapsul SherlyStudio yang seragam; label & catatan merapat ke dalam kotak (margin dinetralkan); tetap dipisah garis halus dari section suara di bawahnya | 2026-11-15 | Permintaan pengguna: “buat border dalam kapsul kawan profil chatnya” |
| D-74 | **Chat: bar lebih lega.** Dropdown pilihan AI provider (✦ Otomatis/Gemini/Groq/OpenRouter) **dipindah dari toolbar chat ke panel “Profil Sherly”** (panel yang terbuka dari foto Sherly; judul berganti “Suara Sherly” → “Profil Sherly”, subjudul baru, section AI Provider di atas section suara dengan separator); nama+status di toolbar kini juga tombol (`#ssChatInfoBtn`) pembuka panel yang sama + hover pink pada nama; toolbar tersisa: back (HP) + foto + nama/status + tombol percakapan baru — nama & status tidak lagi terhimpit dropdown di layar HP; id `#ssProvider` dipertahankan sehingga logika `send()` tidak berubah; rule CSS mobile `max-width:125px` provider dihapus | 2026-11-15 | Umpan balik pengguna: “tombol pengaturan di bar foto jadi terlihat bersusun… pilihan provider bisa masukkan di dalam profil chat saja, jadi bar chat lebih luas nama dan status tidak terhimpit” |
| D-73 | Kapsul navbar diturunkan lagi khusus layar dengan inset besar (iPhone home indicator ±34px): `bottom:max(4px,calc(env(safe-area-inset-bottom) - 18px))` — zona aman bawah hanya dihindari sebagian (18px dikompensasi) sehingga di iPhone kapsul berada ±16px dari dasar layar (sebelumnya 38px), garis home indicator tetap terlihat di bawah kapsul; perangkat tanpa inset (Android browser/desktop) tetap 4px; padding bawah konten tidak diubah | 2026-11-15 | Umpan balik pengguna (iPhone): “kurang turun lagi kawan… layarnya itu sampe bawah” |
| D-72 | Kapsul navbar HP diturunkan: offset melayang di atas safe-area bawah dikurangi **10px → 4px** (`bottom:calc(4px + env(safe-area-inset-bottom))`). Sejak D-70 (`viewport-fit=cover`) inset bawah ikut dihitung (area home-indicator/gesture bar) sehingga kapsul terasa lebih naik dari sebelumnya; 4px menjaga kapsul tetap tidak menimpa gesture bar tapi lebih rapat ke bawah layar. Padding bawah konten (96px + inset) tidak diubah | 2026-11-15 | Umpan balik pengguna: “kapsul posisi agak naik dari sebelumnya, turunkan lagi posisi menu kapsulnya biar gak ketinggian” |
| D-71 | **Status bar menyatu dengan background (lanjutan D-70):** (1) `theme-color` digeser #070b14 → **#170f20** — warna hasil sampling glow radial di puncak halaman, supaya strip browser/status bar saat dibuka di browser biasa menyatu dengan puncak halaman (sebelumnya flat hampir-hitam terlihat sebagai pemisah); (2) **PWA installable**: `manifest.webmanifest` (standalone, background #070b14, theme #170f20, ikon any 192/512 + maskable 512 di `assets/icons/`, disusun dari `sherly-mark.png` di tile #070b14 — logo tidak diubah), meta apple (`apple-mobile-web-app-capable`, `status-bar-style black-translucent`, `apple-touch-icon` 180px), dan `sw.js` **no-op tanpa caching** (hanya syarat install; semua request tetap lewat jaringan agar update Vercel langsung terlihat) + registrasi di index.html — saat di-install sebagai app, halaman digambar sampai ke atas layar (viewport-fit=cover dari D-70) sehingga jam/sinyal/baterai tampil di atas background SherlyStudio | 2026-11-15 | Umpan balik pengguna: “status bar masih belum berwarna background kita… background hitam solid, jadi pemisah” |
| D-70 | **Status bar seamless di HP:** `viewport-fit=cover` ditambahkan ke meta viewport sehingga halaman digambar sampai ke atas layar (warna body `#070b14` + glow radial nyatu ke status bar/notch, tidak terlihat terpotong); konten diberi ruang aman `env(safe-area-inset-top)` di `.app` (grid container, tidak menambah tinggi karena border-box), overlay chat full-screen (`.ss-chat.open` ≤850px, toolbar back-button turun dari notch), dan `modal-backdrop` (padding atas); `theme-color` #070b14 sudah ada (address bar Chrome Android ikut gelap); navbar kapsul & toast sudah aman di bawah | 2026-11-15 | Permintaan pengguna: “header bisa buat nyatu sama statusbar, jadi gak terlihat terpotong, warna body nyatu sampe ke atas layar” |
| D-69 | Tab **Beranda** di navbar kapsul HP memakai **logo SherlyStudio** (`assets/sherly-mark.png`, 24px, glow pink saat aktif) menggantikan ikon rumah; tab **Profil** memakai **foto bulat profil user** (22px, ring pink #e95aaf via box-shadow supaya tidak menggeser layout, glow saat aktif) — disinkronkan di `renderAvatar()` profile.js bersama avatar topbar: foto custom + object-position ikut, tamu/default memakai avatar default topbar (`DEFAULT_AVATAR.main`), fallback ikon `user-round` bila JS/asset belum siap | 2026-11-15 | Permintaan pengguna: “untuk profil kita ganti icon jadi foto bulat profil user… icon beranda kita pake logo kita saja keren sepertinya” |
| D-68 | **Fix:** tab bar HP tidak muncul — aturan `.mobile-tabbar{display:none}` (blok konsistensi, akhir style) menang atas `display:grid` dari media query ≤850px karena spesifisitas sama & posisinya lebih belakang; fix: `display:grid` dipindah ke media query paling akhir dokumen. Sekalian restyle jadi **kapsul mengambang**: melayang 10px + safe-area di atas dasar layar, radius 26px, border #22304a + ring pink tipis + shadow, tab aktik kapsul gradien pink (resep settings-tab); padding bawah main 90→96px | 2026-11-15 | Umpan balik pengguna: “menu navbar kapsulnya blm muncul”; halaman home sudah “mantap, seperti StoryTalent di HeyTalent” |
| D-67 | Susunan menu tab bawah (HP) direvisi atas permintaan: **Beranda · Portfolio · Karakter · Chat · Profil** (sebelumnya Beranda · Karakter · Chat · Aset · Pengaturan); ikon: Portfolio=`gallery`, Karakter=`users` (karakter virtual banyak), Profil=`user-round` (akun pribadi); tab Profil untuk tamu memunculkan layar login (perilaku sama seperti klik chip profil) | 2026-11-15 | Permintaan pengguna: “untuk menu kita pake Beranda-Portfolio-Karakter-Chat-Profil” |
| D-66 | Tampilan HP gaya khusus ala WhatsApp (referensi HeyTalent): sidebar disembunyikan di ≤850px dan diganti **menu tab bawah fixed** (Beranda · Karakter · Chat · Aset · Pengaturan — ikon outline 22px + label 10px, aktif pink + glow, backdrop blur, safe-area-inset-bottom); Chat Sherly di HP jadi **layar penuh** (fixed inset 0, 100dvh, radius 0) dengan **tombol back** chevron di toolbar (khusus layar sempit); status tab disinkronkan via event `sherly-chat-opened/closed`; go(“Chat Sherly”) kini langsung membuka chat (toast “modul akan dikembangkan” tidak muncul lagi); z-index modal 130 + toast 140 agar di atas tab bar; main diberi padding bawah (90px + safe-area) di ≤850px & ≤560px | 2026-11-15 | Permintaan pengguna: “untuk tampilan di hp buat gaya khusus seperti tampilan HeyTalent seperti WA — punya menu dan tampilan chatnya juga” |
| D-65 | Cegah auto-zoom iOS Safari saat fokus ke kontrol form: semua input/textarea/select (komposer chat, modal Karakter/Profil/API key, input model & Bank Suara, kotak search, dsb.) dipaksa **16px** di perangkat layar sentuh via `@media (pointer:coarse),(hover:none){input,textarea,select{font-size:16px!important}}` — desktop tetap ukuran ramping sesuai desain; meta viewport tetap mengizinkan pinch-zoom (tidak memakai maximum-scale yang merugikan aksesibilitas) | 2026-11-15 | Permintaan pengguna: “ukuran font semua form, komposer, dll. 16px untuk mencegah efek zoom layar di iPhone” |
| D-64 | Tipografi seragam: **Inter variable font** (100–900, satu file 48 KB, @fontsource-variable/inter, SIL OFL) di-host sendiri di `assets/fonts/` — sebelumnya stack `Inter,ui-sans-serif` jatuh ke font sistem generik (Segoe UI/Roboto) karena Inter tidak pernah dimuat; sekarang semua teks (termasuk weight khusus 650/750 di headline & stat) render Inter asli di semua perangkat; `font-display:swap`; stack font tidak berubah sehingga chat-module & semua referensi `Inter` otomatis memakai versi lokal | 2026-11-15 | Tindak lanjut tema “biar gak generik”: font utama masih fallback system-ui |
| D-63 | Tema warna & ikon diseragamkan di semua halaman: hanya dasar gelap + pink + putih. Dihapus: teal Bank Suara (→ pink #e84ba9/#ffd0ec/#2a1226), hijau status (online/model-badge/pill.ok/probe.ok/toggle-on → pink), oranye & hijau titik event kalender (→ 3 gradasi pink), tag biru/ungu (→ kaca putih), amber warn-banner (→ pink), gradien ungu tombol/tab/brand (→ pink), var --violet/--cyan/--green & .blue-btn (dead code). Semua ikon emoji diganti outline SVG konsisten dengan sistem [data-icon]: 9 ikon baru (mic/sliders/upload/log-out/eye/film/smartphone/file/x); tab Pengaturan, judul Bank Suara, tombol aksi, badge kategori provider (ai-providers via iconSvg()), panel Suara Sherly & chip file chat, tombol hapus Bank Suara | 2026-11-15 | Permintaan pengguna: “konsistensi tema warna diseragamkan semua halaman, unsur warna dasar dan kombinasi pink dan putih, tidak bercampur warna lain; semua icon jangan emoji, buat gaya outline biar gak generik” |
| D-62 | Pass konsistensi menyeluruh: hover kotak search dipulihkan (aturan D-54 ternyata hilang dari file); ikon judul kolom kanan distandarkan margin 7px (4 × &nbsp; dihapus), judul Chat Sherly 14→15px; gap antar-section 17/15→18px dan grid aset 10→12px; chip ikon stat/quick/notifikasi disatukan #311738/#ff78cb + glow; kartu Aset & Karakter kini punya hover lift/ring seperti media card; semua input form (Karakter/Pengaturan/Profil/vault) fokus pink ring seperti search; kontrol tanpa hover masuk tema kapsul (side-nav-btn, settings/cap tab, toggle-btn, model-item, group-expand, tombol kecil Bank Suara, blue-btn, transisi side-collapse); focus-visible keyboard pink | 2026-11-15 | Pilihan pengguna via ask_user: “Rapikan menyeluruh — cek konsistensi jarak, ukuran, dan hover dari kode, rapikan yang paling janggal” |
| D-61 | Koreksi arah geser: “Your” mundur 2 huruf dari 1.12em → 0.42em (posisi 0.773em ternyata sudah ~1 huruf MELEWATI “e”, bukan kurang — umpan balik sebelumnya ambigu arah). Verifikasi metrik glyph: padding 0.42em menempatkan ujung ekor descender Y (lokal 0.71em) di 1.13em ≈ tepat tepi kiri tinta huruf e (1.17em); baris “with Sherly ♥” ditarik mundur 1 huruf (margin-right −1.1em → −0.75em) agar ekor descender “p” dari “Space” tidak menimpa “h” dari “Sherly”; ♥ tetap menggantung di luar rata kanan | 2026-11-15 | Umpan balik pengguna (image-46.png): “Y malah makin jauh dari e, terbalik gesernya”; “with Sherly dikurangi 1 spasi huruf biar ekor p dari Space tidak nimpa h dari Sherly” |
| D-60 | Slogan “Your” digeser lagi +1 huruf (padding-left % → em supaya deterministik: 0.773em hasil ukur + 0.35em ≈ 1 huruf = 1.12em); baris “with Sherly ♥” digeser kanan ~3 huruf via margin-right:-1.1em (wit=0.91em/her=0.93em terukur) sehingga ♥ menggantung di luar garis rata-kanan slogan | 2026-11-15 | Umpan balik pengguna (image-45.png): Y masih kurang 1 huruf ke kanan biar pas di atas “e”; with Sherly kurang ~3 huruf ke kanan agar love dihitung di luar rata kanan |
| D-59 | Slogan baris “Your” digeser kanan 15.3% lebar blok — hasil pengukuran fontTools (Sacramento): pusat glyph “Y” kini tepat di atas pusat glyph “e” pada “Creative”, ekor descender Y memenuhi ruang kosong; kerning GPOS diverifikasi, efek <0.001em | 2026-11-14 | Umpan balik pengguna: ekor Y Your harus mengisi ruang kosong di atas Creative |
| D-58 | Banner: logo digeser kanan 17px; slogan jadi tangga diagonal — “Your” rata kiri, “Creative Space” rata tengah, “with Sherly ♥” rata kanan; kata “with” putih (#f4f6fb), “Sherly” tetap pink; rotasi slogan dipertajam −8°→−12° | 2026-11-14 | Umpan balik pengguna: logo geser kanan dikit, rata kiri/tengah/kanan per baris (opsi tangga), “with” putih, slogan lebih miring |
| D-57 | Banner diseimbangkan: trio logo → SherlyStudio → slogan disusun di tengah dengan `justify-content:center` + gap seragam (clamp 22–54px) — jarak logo↔headline↔slogan sama besar (sebelumnya slogan menempel kanan via margin-left:auto); padding hero dirapatkan 6%→4%; slogan kini 3 baris (“Your / Creative Space / with Sherly ♥”) ukuran clamp 18–25px | 2026-11-14 | Umpan balik pengguna: logo↔headline terlalu jauh, slogan dibuat 3 baris, jarak ketiganya seimbang |
| D-56 | Banner ala referensi “SherlyStudio Neon”: headline SherlyStudio diperbesar (clamp 34–56px, weight 750, line-height 1) & dibuat rata-tengah bersama tagline; “CREATE · EDIT · SHARE” ikut rata tengah + letter-spacing .42em + text-indent kompensasi; slogan Sacramento diperkecil (clamp 17–23px) + glow ditipiskan; breakpoint ≤1250px h1 disesuaikan | 2026-11-14 | Umpan balik pengguna: tulisan SherlyStudio kurang besar, tagline harus tengah di bawahnya, slogan kurang kecil; desain seperti referensi |
| D-55 | Banner: font tulisan sambung **Sacramento** (self-hosted, neon script ala referensi) untuk slogan “Your Creative Space with Sherly ♥” — ukuran lebih besar (clamp 24–34px, rotasi −8°) + glow pink berlapis + hati pink kecil; sidebar “Dream Create Together” pindah ke **Caveat** 700 (tulisan tangan); font di-host sendiri di `assets/fonts/` (@fontsource 5.3.0, OFL), bukan CDN eksternal | 2026-11-14 | Umpan balik pengguna: slogan banner pakai font sambung seperti referensi + perbaikan ukuran font banner |
| D-54 | Hover kotak pencarian memakai resep kapsul yang sama: border `#45304f` + latar `#111a2e` + ring 3px `#e84ba914`; focus tetap border pink solid; transisi 0.2s | 2026-11-14 | Umpan balik pengguna: hover kotak search disamakan temanya |
| D-53 | Semua kontrol mendapat **satu tema hover** ala chip profil: kapsul glow `#45304f` + `0 0 0 3px #e84ba914` (nav, side-collapse, topbar action, outline/danger btn, Quick Tools chip, add-character, kalender panah, media-card ring 3px, chip); CTA pink (`pink-btn`/`primary`) hover dengan brightness + ring `#e84ba926`; `.link` hover pink muda | 2026-11-14 | Umpan balik pengguna: hover semua seragam seperti tema kapsul |
| D-52 | Profil pengguna di topbar kanan dibungkus kapsul tipis (border 1px #22304a, radius 40px, latar gelap, hover glow pink) — ala chip identitas di referensi; di layar ≤560px jadi kapsul avatar saja | 2026-11-14 | Umpan balik pengguna: profil user kanan atas diberi border tipis bentuk kapsul |
| D-51 | Semua scrollbar disembunyikan (halaman utama, panel, baris konten horizontal, sidebar) — scroll tetap berfungsi, UI lebih bersih; petunjuk scroll horizontal baris konten cukup lewat fade tepi kanan | 2026-11-14 | Umpan balik pengguna: jangan ada bar scroll di halaman mana pun demi kerapian |
| D-50 | Perataan layout pada viewport/zoom sempit: `min-width:0` pada hero, hero-copy, hero-note, grid children `.maincol>*`, dan `.media-row` — sebelumnya min-content hero (mark+headline+note) ≈560px memaksa kolom terdesak saat zoom browser ~125–150% hingga kolom kanan terpotong; hero-note disembunyikan ≤1250px + padding/mark/headline hero diperkecil pada breakpoint itu | 2026-11-14 | Umpan balik pengguna: layout berantakan/terpotong (zoom tinggi) |
| D-49 | Proyek Terbaru jadi 2 baris scrollable horizontal: **VERTIKAL** (kartu 9:16, ±148px) & **HORIZONTAL** (kartu 16/10, ±272px) — `grid-auto-flow:column` + `overflow-x:auto` + scroll-snap, scrollbar tipis, fade di tepi kanan; kartu full-bleed, gradien bawah, judul 2-baris + meta di kiri bawah, tombol play pink di kanan bawah; tag tipe konten tetap pill di kiri atas | 2026-11-14 | Umpan balik pengguna: 2 jenis konten, scroll horizontal agar tidak memanjang ke bawah; referensi AK Talent |
| D-48 | Grid proyek: kartu lebih hidup (radius 18px, thumbnail 158px, hover lift −5px + glow pink, thumbnail scale 1.05, gradient gelap atas thumbnail); label tipe konten (Film/Iklan/Konten/Reels) dipindah menjadi pill uppercase letter-spaced melayang di **sudut kiri atas** thumbnail | 2026-11-14 | Umpan balik pengguna: grid bentuk tidak boleh kaku; label di sudut kiri atas |
| D-47 | Foto panel chat di-frame ulang ala awal (bust/head-and-shoulders, wajah dominan): `sherly-panel.png` di-crop ke ±1087×1000 px atas lalu di-resize 520×514 — framing seperti D-44 awal, memakai foto rapi pengguna; crop tangan penuh dilepas demi wajah terlihat | 2026-11-14 | Umpan balik pengguna: posisi seperti awal, wajah tidak kelihatan kalau full body |
| D-46 | Foto panel chat diganti dengan versi rapi milik pengguna (`public/assets/sherly-panel.png`, 433×577, transparan, waist-up dengan tangan) — feather/fade tepi dari D-44 dibatalkan (membuat foto tampak pudar); tepi asli foto dipertahankan; foto di-downscale LANCZOS dari 1087×1447 agar ringan | 2026-11-14 | Umpan balik pengguna: foto jadi pudar; kirim versi rapi — tepi asli tidak masalah |
| D-45 | Grid 4 statistik (Total Karakter, Proyek Aktif, Total Aset, Upload Hari Ini) dipindah dari Beranda ke **menu Aset** (`#assetsView`, tampilan page-view berisi page-heading + grid statistik + catatan modul) — konten Beranda naik ke atas; menu Aset kini membuka halaman statistik (bukan toast "modul dikembangkan") | 2026-11-14 | Umpan balik pengguna: grid di bawah banner dipindahkan ke menu Aset |
| D-44 | Foto Sherly di panel chat: tepi transparan PNG di-*feather* halus (34px, smoothstep) di keempat sisi sehingga lengan/sleeve tidak lagi tampak "terpotong" garis keras; foto kini di-anchor penuh di dalam panel (`right:2px;bottom:0;height:100%`) | 2026-11-14 | Umpan balik pengguna: edit foto Sherly agar tidak terlihat terpotong |
| D-43 | Chip pintasan ⌘K di dalam kotak search dihapus (dianggap tidak jelas/clutter); pintasan Ctrl/Cmd+K untuk fokus search tetap aktif; padding kanan input dikembalikan normal | 2026-11-14 | Umpan balik pengguna: icon kanan search dihapus saja |
| D-41 | Banner & panel chat disamakan tingginya: `height:200px` (dibatasi, bukan min-height) — sebelumnya panel chat tumbuh melebihi banner karena konten (margin `<p>` default + teks 4–5 baris); margin `<p>` dipangkas (`margin:4px 0 12px`); banner jadi sedikit lebih tinggi dari sebelumnya sesuai permintaan | 2026-11-14 | Umpan balik pengguna: banner kurang tinggi, samakan dengan panel chat seperti referensi |
| D-40 | Ikon stat "Total Aset" diperbaiki: pakai `gallery` (sebelumnya `data-icon="image"` — key tidak ada di peta ICONS, ikon tampil kosong/lingkaran polos) | 2026-11-14 | Umpan balik pengguna: tambah icon total asset seperti referensi |
| D-39 | Panel chat Sherly: tinggi disamakan dengan banner (182px), foto Sherly memakai cutout transparan (`assets/sherly-portrait-cutout.png`, background dihapus dengan model matte lokal) — tanpa bingkai/latar putih, menempel kanan-bawah panel | 2026-11-14 | Umpan balik pengguna: foto Sherly tanpa background; kurangi tinggi panel chat |
| D-38 | Banner (hero): memakai **mark saja** (`sherly-mark.png`, 168px, makin besar) karena wordmark "SherlyStudio" sudah jadi headline di sampingnya; tinggi banner 244→182px (≈23–24% tinggi viewport, mengikuti proporsi referensi); headline & tagline tetap sebagai teks | 2026-11-14 | Umpan balik pengguna: banner pakai logo saja & lebih pendek seperti referensi |
| D-37 | Sidebar diperkecil & dipadatkan: 212px → 184px, padding/gap lebih rapat, brand mark 86→76px, wordmark 22→20px, tagline 8px — mendekati proporsi referensi layout awal (±13% lebar viewport) agar terasa compact | 2026-11-14 | Umpan balik pengguna: panel masih terlalu lebar |
| D-36 | Kotak pencarian topbar dirapikan: ikon sejajar vertikal (left 16px + translateY(-50%), bukan offset px tetap), tinggi 44px, radius 22px, placeholder lebih kalem, ikon & border disesuaikan, tambah chip ⌘K di kanan (disembunyikan di layar ≤850px) + shortcut Ctrl/Cmd+K (fokus + select) | 2026-11-14 | Umpan balik pengguna: kotak search kurang rapi |
| D-35 | Logo sidebar dipisah: gambar hanya **mark** (`assets/sherly-mark.png`, 166×139) + wordmark "SherlyStudio" sebagai teks murni (Sherly putih + Studio gradient pink) + tagline "CREATE · EDIT · SHARE" letter-spaced di bawahnya; mode ciut/mobil menampilkan mark saja; halaman memakai favicon mark | 2026-11-14 | Umpan balik pengguna: logo & tulisan menyatu di satu gambar; tata ulang agar compact & rapi |
| D-34 | Sidebar: Pengaturan dipindah ke daftar menu utama (setelah Chat Sherly) — tombol ciutkan jadi satu-satunya tombol di bawah; jalur ke Chat kini juga membersihkan status aktif tombol luar `.nav` (pengaturan tidak lagi "lengket"/menyala setelah pindah ke Chat) | 2026-11-14 | Umpan balik pengguna |
| D-33 | Lanjutan D-32: penyebab blank yang sebenarnya adalah `#ssChatRoot` tetap `display:block` dengan tinggi inline ~100vh saat mode chat ditutup → konten lain terdorong keluar layar (terlihat blank); kini `#ssChatRoot{display:none}` default (muncul hanya saat chat aktif) + tinggi inline dibersihkan saat closeChat | 2026-11-14 | Bug: pindah dari Chat → halaman kosong sampai refresh |
| D-32 | Perbaikan blank page saat pindah menu dari Chat: `go()` kini selalu menutup mode chat (`window.sherlyCloseChat()`); sebelumnya hanya jalur `.nav button[data-page]` yang memanggil closeChat — Pengaturan (side-nav-btn), Profil (topbar/tab), dan tautan dalam dashboard tidak → `main.ss-chat-active` tertinggal → semua halaman tersembunyi (harus refresh) | 2026-11-14 | Bug: blank setelah dari chat, refresh baru muncul |
| D-31 | Sidebar bisa diciutkan (ikon saja, 70px) / dilebarkan (label) lewat tombol panah di bawah panel; status & tagline disembunyikan saat ciut; ikon diutarakan (tooltip title); pilihan tersimpan di perangkat (`sherly.sidebarCollapsed`) | 2026-11-14 | Umpan balik pengguna: mode panel bisa diciutkan |
| D-30 | **Suara Perangkat (lokal)** di panel Suara Sherly — mode kedua selain Gemini/Bank Suara: voice list dari Web Speech API (id-ID diutamakan), atur kecepatan bicara, dibacakan langsung HP/PC (gratis, tanpa API/Bank, tidak bisa direkam ke Bank); HeyTalent pun punya panel serupa ("Suara Lokal Perangkat · Microsoft Andika") | 2026-11-14 | Local TTS browser: nol kuota, offline-ish, kualitas tergantung sistem |
| D-29 | **Hybrid Bank Suara**: klip dari VoiceBox lokal (kloning suara) bisa diupload massal dari Pengaturan → Bank Suara → "Upload dari VoiceBox lokal" — teks otomatis dari nama file (bisa diedit), dinormalisasi identik dengan jalur chat, hash provider+model+suara+gaya+teks yang sama → klip langsung terpakai otomatis oleh chat/Dengarkan. API dipakai hanya untuk frasa yang belum ada di bank (cache-first sudah aktif) | 2026-11-14 | Banyak kosakata tersimpan cepat tanpa kuota; chat lebih sering offline-cache |
| D-28 | Gaya bicara TTS TIDAK lagi disisipkan ke teks (itu ikut dibacakan); dikirim sebagai `speech_metadata.style` (format modern, `voiceConfig:{voice}`), fallback legacy tanpa style bila model menolak format modern — gaya bicara tidak pernah diucapkan | 2026-11-14 | Umpan balik: Sherly membacakan "Indonesian dengan intonasi..." sebelum tiap chat |
| D-27 | TTS & Bank Suara: deteksi payload Gemini yang **sudah berupa WAV** (jangan dibungkus ulang) + **fade-out 25ms** di ujung PCM (hilangkan bunyi klik/kresek di akhir ucapan); teks TTS dinaturalisasi ala HeyTalent (`wkwkwk`→`haha`, huruf berulang diringkas) | 2026-11-14 | Umpan balik: tiap Sherly bicara ada suara "koslet" di akhir |
| D-26 | **Bank Suara UI di Pengaturan** — panel "Bank Suara Sherly" (ala sinkron PC & HP HeyTalent): statistik (jumlah klip & ukuran total, suara aktif perangkat), daftar klip dengan tombol putar & hapus, "Siapkan 12 frasa umum" (frasa WA sehari-hari dicicil di-TTS & otomatis masuk bank; yang sudah ada tidak digenerate ulang), "Kosongkan Bank". Server: `GET /api/ai/tts/bank` (list+total), `GET /bank/:id/audio` (stream), `DELETE /bank/:id`, `DELETE /bank` | 2026-11-14 | Mengisi kosakata Bank Suara lebih cepat & memberi visibilitas/kontrol atas aset suara |
| D-25 | Chat: balasan dibatasi 1–2 bubble pendek (maks 3), kalimat ±20 kata, emoji maks 1 & jarang; riwayat percakapan terakhir dimuat ulang saat refresh (tombol + = Percakapan baru); **panel Suara Sherly** dibuka dengan klik foto profil Sherly — pilih 14 suara Gemini + gaya bicara (≤180 char), tombol Tes & Simpan; pilihan ikut dipakai tombol Dengarkan & Bank Suara (hash kini provider+model+voice+style+teks); nama pengguna dipakai WAJAR (jarang, bukan tiap pesan) | 2026-11-14 | Sesuai HeyTalent (pilih suara per karakter) versi sederhana per perangkat; chat terasa manusia, kosakata Bank Suara makin kaya, tidak chat dari nol tiap refresh |

Perubahan keputusan produk **harus** diperbarui di tabel ini (append, jangan hapus).

---

## 24. RISIKO & MITIGASI

| ID | Risiko | Dampak | Likelihood | Mitigasi |
|---|---|---|---|---|
| R-01 | Belum ada API key AI di Vercel → chat selalu gagal | Tinggi | Terjadi | Isi minimal 1 provider key (P1); pantau `/api/health` |
| R-02 | Kebocoran secret (repo/frontend/log) | Kritis | Rendah–Sedang | `.gitignore` ✅, secret scan, review PR, rotasi berkala |
| R-03 | RLS salah → data bocor lintas user | Kritis | Rendah | Uji lintas-user; audit policy; least privilege |
| R-04 | Rate limit/abuse endpoint login & chat | Sedang–Tinggi | Sedang | Rate limiting + captcha bila perlu (P1/P3) |
| R-05 | Provider down/model berubah/cutoff kuota | Sedang | Sedang | Fallback multi-provider ✅; monitor status; retry/backoff |
| R-06 | Biaya AI membengkak | Sedang | Sedang | Batas maxTokens, metering, alert anggaran |
| R-07 | Identity karakter tidak konsisten (model gambar) | Sedang | Sedang | Identity Lock + multi-reference + prompt engine; ekspektasi realistis |
| R-08 | Scope creep / membangun semua modul sekaligus | Tinggi | Sedang | Roadmap fases; Definition of Done; tolak pekerjaan di luar fase aktif |
| R-09 | Ketergantungan Supabase/Vercel (vendor) | Sedang | Rendah | Export berkala; arsitektur standar; dokumentasi restore |
| R-10 | Satu file frontend membengkak → susah dipelihara | Sedang | Tinggi (sudah terjadi) | Modularisasi bertahap P3; budget ukuran file |
| R-11 | Tidak ada backup/uji restore | Tinggi | Rendah–Sedang | Jadwal backup + uji restore (P9) |
| R-12 | Data pribadi & UU PDP | Sedang–Tinggi | Rendah | Kebijakan privasi, hak hapus, retensi terdokumentasi |
| R-13 | Konten publik virtual influencer tanpa disclosure AI | Sedang | Sedang | Labeling AI-generated (P6), panduan etika konten |
| R-14 | Function timeout (>60 s) untuk prompt panjang | Sedang | Sedang | Streaming (P4), kurangi maxTokens, pecah tugas |

---

## 25. PERTANYAAN TERBUKA (Open Questions)

| # | Pertanyaan | Target Keputusan |
|---|---|---|
| Q-01 | Chat Sherly tetap admin-only atau dibuka untuk user reguler? Jika user: kuota & paket apa? | Akhir P3 |
| Q-02 | Kapan guestbook/guest access diaktifkan? Bentuk guest identity? | P8/P10 |
| Q-03 | Model proyek: normalisasi `content_items`+`assets` yang sudah ada, atau tabel `projects` baru? | Awal P7 |
| Q-04 | Multi-reference karakter: kolom path array di `characters` atau tabel `character_references` terpisah? | Awal P2 |
| Q-05 | Streaming chat (SSE) — prioritas setelah stabilitas P3? | P4 |
| Q-06 | Perlu kebijakan privasi publik (UU PDP) sebelum multi-user dibuka? | Sebelum P3 multi-user |
| Q-07 | Region Supabase & skema backup; siapa yang pegang akses? | P1 sisa |
| Q-08 | CSP ketat: kapan frontend lepas dari inline styles/scripts? | P9 |
| Q-09 | Apakah diperlukan staging environment terpisah (Vercel preview + Supabase staging)? | P1 sisa/P9 |
| Q-10 | Labeling konten AI untuk persona publik Sherly — standar & penempatan? | P6 |

---

## 26. DEFINISI SHERLYSTUDIO VERSI FINAL

SherlyStudio menjadi satu platform kreatif yang memiliki: Dashboard; Character Studio; Character Identity Engine; Character Sheet Generator; Chat Sherly; Long-Term Memory; Multi-provider AI Manager; Encrypted Multi-Key Vault; Project Management; Asset Management; Admin Dashboard; Monitoring & sistem keamanan — seluruh modul terhubung dalam satu ekosistem, sehingga pengguna membuat karakter, mengembangkan identitasnya, berdiskusi dengan Sherly, mengelola prompt & proyek, dan memakai berbagai provider AI tanpa berpindah aplikasi.

---

## 27. REFERIENSI

- Repository: https://github.com/misalnyadev/sherly
- Live: https://sherlystudio.vercel.app (`/api/health`)
- PR #1 — Adapt app for Vercel serverless + harden repo (merged 14 Nov 2026)
- `supabase/schema.sql`, `supabase/character_management_migration.sql`
- Dokumen asal: `prd sherlystudio.txt` v1.0 (14 Nov 2026)

## PENUTUP

Dokumen ini acuan induk pengembangan SherlyStudio. Setiap perubahan fitur, database, arsitektur, dan UI harus mengacu pada dokumen ini. Pengembangan bertahap per fase — **selesaikan satu fase, uji, pastikan stabil, dokumentasikan, baru lanjut ke fase berikutnya.**

**Prinsip utama: bukan sekadar aplikasi yang berjalan, tetapi Creative AI Workspace yang stabil, aman, modular, dan siap berkembang.**
