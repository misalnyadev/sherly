# D-198 — Rencana: Engine Video + Galeri Aset di Studio (ala Google Flow)

Status: **RENCANA** · Branch: `arena/160c4f9b-sherly` · Base: `b5e04fd` (D-197)

## 1. Permintaan user (D-198)

> "sebenarnya alurnya hasil foto/video masuk aset dan bisa di unduh/editor, kalau di flow hasil akan nampil grid di atas komposer membentuk galeri grid tanpa kotak tempat hasil itu jadi tampilan bersih hanya komposer dan ketika di generate hasil langsung nambah di grid galeri aset di atas komposer dan dapat di preview untuk kemudian bisa di download atau edit dan akan tetap nampil|score sana sebagai tempat galeri dan dia tampil di sana sebagai aset yang bisa dipakai ulang langsung ke komposer jika ingin dijadikan referensi, jadi di sana foto dan video nampil di studionya di atas komposer, baik itu hasil generate maupun aset dari upload jadi ringkas dan mudah untuk pemakaian aset berulang jika butuh referensi"

Inti:
1. **Semua media = ASET** — hasil generate (foto/video) **dan** hasil upload → satu galeri.
2. **Galeri grid di atas komposer**, tanpa kotak "hasil" terpisah → tampilan bersih, hanya komposer.
3. **Grid = galeri aset**: preview, download, edit.
4. **Aset bisa dipakai ulang** → klik aset → langsung jadi referensi di komposer.
5. Foto & video sama-sama di grid.

## 2. Investigasi (sudah dilakukan)

### 2.1 Kie AI — API video tersedia
Pola `createTask` + poll `recordInfo` — **sama persis** dengan img2img Kie yang sudah jalan (D-106).
Docs: `https://docs.kie.ai/veo3-api/generate-veo-3-video`

**Veo 3.1** (`model: "veo-3-1"`):
| Field | Nilai |
|---|---|
| `input.model` | `veo3_fast` (default) / `veo3_lite` / `veo3` (Quality) |
| `input.generation_type` | `TEXT_2_VIDEO` / `FIRST_AND_LAST_FRAMES_2_VIDEO` / `REFERENCE_2_VIDEO` |
| `input.image_urls` | 1-3 URL (untuk REFERENCE_2_VIDEO maks 3) |
| `input.aspect_ratio` | `16:9` / `9:16` / `Auto` |
| `input.resolution` | `720p` (default) / `1080p` / `4k` |
| `input.duration` | `4` / `6` / `8` (detik) |
| `input.enable_translation` | boolean — terjemah prompt ke Inggris |

Model lain yang tersedia di Kie: Kling 3.0 (`kling-3.0/video`), Sora 2 (`sora-2-image-to-video`), LTX 2.5, Vidu Q4, Wan, Seedance, MiniMax H3, OmniHuman 2.0, Higgsfield.

### 2.2 Constraint penting: maxDuration 60 detik
`api/index.js` & `vercel.json` → `maxDuration: 60`.
Generasi video butuh **60-180 detik** → **tidak bisa polling sinkron dalam satu request**.
Solusi: **tabel task** + polling dari client (progress bar), persis seperti Kie sendiri.

### 2.3 Storage & DB
- Tabel `public.assets` **sudah ada** (8 kolom: id, user_id, content_item_id, file_path, file_name, media_type, alt_text, created_at) + RLS owner-only. TAPI belum ada route/API & belum ada bucket.
- Bucket existing: `character-references` (private), `published` (public, gambar saja), `tts-clips` (private).
- → Perlu bucket baru `studio-assets` (private) + policy storage owner.

### 2.4 Editor Video
`public/video-editor.js` → `window.sherlyVeAddFiles(files)` menerima `File[]`. Bisa di-bridge dari blob (fetch signed URL → Blob → File).

## 3. Keputusan yang diambil (dari user)

| # | Keputusan | Implementasi |
|---|---|---|
| A | Semua media = **aset** | Route `/api/studio/assets` (GET list, POST upload, DELETE) |
| B | **Galeri grid di atas komposer** | `#stGallery` (flat grid, tanpa kartu "hasil") |
| C | Aset bisa **dipakai ulang** sebagai referensi | Klik aset → chip referensi gambar di header komposer |
| D | Preview / **download** / **edit** | Lightbox preview + tombol download + kirim ke Editor Video |
| E | Foto & video **sama-sama** di grid | `media_type` di tabel assets |

## 4. Arsitektur

### 4.1 Database (migrasi via connector Supabase)

**Bucket baru** `studio-assets` (private, 25MB, mime: png/jpg/webp/gif/mp4/webm/mov):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-assets','studio-assets', false, 26214400,
  array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=false, file_size_limit=26214400,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];

-- policy storage: owner read/write/delete (folder pertama = user_id)
drop policy if exists "studio asset owner read" on storage.objects;
create policy "studio asset owner read" on storage.objects for select to authenticated
  using (bucket_id='studio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- (insert/update/delete Serupa)
```

**Kolom tambahan** di `public.assets`:
```sql
alter table public.assets
  add column if not exists kind text not null default 'upload',      -- upload | generate
  add column if not exists prompt text not null default '',           -- prompt asal (untuk generate)
  add column if not exists meta jsonb not null default '{}'::jsonb,   -- {aspect, style, characters, scene, model}
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_ms integer;
```

**Tabel task video** `public.sherly_video_tasks`:
```sql
create table if not exists public.sherly_video_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'kie',
  model text not null,
  status text not null default 'queued',   -- queued|running|success|fail
  progress integer not null default 0,
  prompt text not null default '',
  task_id text,                            -- id task sisi Kie
  asset_id uuid references public.assets(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sherly_video_tasks enable row level security;
-- policy: owner all (insert/select/update/delete by user_id = auth.uid())
```

### 4.2 Backend — `server/studio-assets.js` (BARU)

| Fungsi | Isi |
|---|---|
| `assetBucket()` | `'studio-assets'` |
| `mediaKind(mime)` | `image` / `video` |
| `signedAsset(asset, client)` | buat signed URL (1 jam) + metadata turunan |
| `saveAsset({ supabase, userId, file, kind, prompt, meta, width, height, durationMs })` | upload ke Storage + insert baris `assets` |
| `saveGeneratedAsset(...)` | sama, untuk hasil generate (kind='generate') |
| `listAssets(supabase, userId)` | daftar aset milik user (terbaru dulu) |
| `deleteAsset(supabase, userId, id)` | hapus baris + file Storage |
| `buildVideoTask({...})` | insert task |
| `updateVideoTask(supabase, userId, id, patch)` | update status/progress |
| `getVideoTask(supabase, userId, id)` | ambil task +(sign URL bila sukses) |

### 4.3 Backend — `server/ai.js`

**`generateVideoWithKie(prompt, opts, auth)`** (BARU):
```
opts: { model, aspect, duration, resolution, images: [{mime,data}] }
1. attempts = kieAttempts(auth)  (vault → env)
2. upload tiap gambar → kieUploadReference() → URL publik
3. POST {base}/api/v1/jobs/createTask
     { model: 'veo-3-1', input: { prompt, model: tier, image_urls, generation_type, aspect_ratio, duration, resolution, enable_translation } }
4. return { taskId, model }   ← TIDAK poll di sini (batas 60 dtk Vercel)
```
**`pollKieVideoTask(apiKey, base, taskId)`** (BARU): poll `recordInfo` → `{ state, progress, resultUrls }`.

### 4.4 Backend — `server/app.js`

| Route | Fungsi |
|---|---|
| `GET /api/studio/assets` | list aset (signed URL) |
| `POST /api/studio/assets` | upload (multipart, field `file`) → simpan ke assets |
| `DELETE /api/studio/assets/:id` | hapus aset + file |
| `POST /api/ai/video` | buat task video → `{ taskId, id }` (LANGSUNG return, tidak poll) |
| `GET /api/ai/video/:id` | status task + progres; kalau sukses → url video + asset_id |

`POST /api/ai/video` payload:
```json
{
  "prompt": "@sherly dan @novi jalan di GBK",
  "model": "veo3_fast",
  "aspect": "9:16",
  "duration": 8,
  "resolution": "720p",
  "sceneRef": { "mime": "image/png", "data": "..." },
  "characterMentions": [{ "id": "...", "name": "Sherly" }]
}
```
→ Server: parse mention (reuse `parseMentions`), susun prompt (reuse `buildCharacterPromptBlock`), resolve gambar (reuse `resolveCharacterReferences` → potret+sheet karakter + sceneRef) → upload ke Kie → createTask → simpan task row → return.

### 4.5 Frontend — `public/studio.js` (rewrite grid → galeri aset)

**Struktur baru:**
```
#stGallery   ← galeri aset (flat grid, di atas komposer)
#stComposer
  #stAssetHeader   ← header aset (chip karakter + chip referensi gambar)
  #stPrompt
  #stChain
  #stControls
```

**Galeri aset:**
- Card kecil (thumbnail) — foto pakai `<img>`, video pakai `<video preload="metadata">` + badge durasi.
- **Tanpa** heading "Hasil" / kotak kosong besar → kalau kosong, grid disembunyikan (biar bersih).
- Klik aset → **lightbox preview** (besar, foto/video player) dengan tombol: Download, Edit (video → Editor Video), Jadikan Referensi, Hapus.
- Tombol "Jadikan Referensi" → aset jadi chip gambar referensi di header komposer (untuk foto) — dan untuk video, jadi frame terakhir (extract thumbnail ke canvas → base64).
- Hover/always-visible tombol kecil: `+ Referensi`, `Download`, `Hapus`.
- Upload: tombol "+ Unggah" di header galeri → input file → POST /api/studio/assets → langsung masuk grid.

**Mode video:**
- Tab Video aktif → pill durasi (4/6/8 detik), pill resolusi, tombol "Buat Video" (ganti "Buat Gambar").
- Progress bar + polling status tiap 3 dtk sampai selesai → video otomatis masuk galeri sebagai aset.

**Header aset (D-196) dipertahankan:** chip karakter (dari @mention) + chip referensi gambar (dari aset yang dipilih).

### 4.6 Integrasi Editor Video
```js
// dari lightbox aset video → "Edit"
const res = await fetch(asset.url); const blob = await res.blob();
const file = new File([blob], asset.file_name, { type: blob.type });
window.go?.('Editor Video');
setTimeout(() => window.sherlyVeAddFiles?.([file]), 400);
```

## 5. File yang akan diubah

| File | Perubahan |
|---|---|
| `server/studio-assets.js` | **BARU** — helper aset + task video |
| `server/ai.js` | `generateVideoWithKie` + `pollKieVideoTask` |
| `server/app.js` | route `/api/studio/assets` + `/api/ai/video` |
| `public/studio.js` | **rewrite besar** — galeri aset, lightbox, upload, mode video + polling |
| `public/index.html` | CSS galeri + lightbox + progress; ICONS baru |
| `docs/PRD.md` | baris D-198 |
| `supabase/studio-assets.sql` | **BARU** — arsip SQL (dieksekusi via connector) |
| `test/studio-assets.test.js` | **BARU** — unit test |

## 6. Out of scope
- Video generation via provider selain Kie (Vault key Kie sudah dipakai).
- Edit video di browser (pakai Editor Video yang sudah ada).
- Lip-sync / voice cloning video (TTS terpisah sudah ada).

## 7. Urutan eksekusi
1. SQL migrasi (bucket + kolom assets + tabel task) → eksekusi via **connector Supabase**.
2. `server/studio-assets.js` + unit test.
3. `server/ai.js` (generateVideoWithKie + poll).
4. `server/app.js` routes.
5. `public/studio.js` rewrite galeri + lightbox + video mode.
6. CSS + ICONS.
7. Smoke jsdom + test + check.
8. PRD + commit + PR (merge hanya atas perintah eksplisit user).
