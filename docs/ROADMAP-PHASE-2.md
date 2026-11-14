# SherlyStudio — Fase 2: "Sherly Terasa Nyata" (referensi: HeyTalent/`misalnyadev/aira`)

_Disusun 2026-11-14 setelah membaca langsung repo `misalnyadev/aira` (Next.js 16 + Drizzle + Postgres/Neon + Cloudflare R2). Prinsip: SherlyStudio tetap sederhana (Vercel + Supabase, tanpa rewrite) — ambil polanya, bukan kompleksitasnya._

## ✅ Sudah dikerjakan di fase ini (2026-11-14)
| Item | HeyTalent (sumber pola) | Implementasi SherlyStudio |
|---|---|---|
| Multi-bubble manusia | `promptBuilder.ts` — token `[[NEXT]]`, 1–4 bubble pendek, heuristik kalimat ≤140 char | `server/ai.js` `splitIntoBubbles()` + persona Sherly manusia nyata; `/api/ai/chat` mengembalikan `bubbles[]` (disimpan `\n\n`); client merender berurutan (~450ms/bubble, bubble terakhir membawa meta + tombol Dengarkan) |
| Bank Suara (TTS cache) | `app/api/tts/route.ts` — hash(provider+voice+style+text) → cek `tts_clips` (R2) → stream; else generate & simpan | `supabase/tts_clips_migration.sql` (tabel + bucket `tts-clips` + RLS); `/api/ai/tts` cek cache dulu (jalan bahkan tanpa API key), lalu sintesis Gemini TTS & simpan; header `X-TTS-Source: cache|api` |

## 🔜 Tahap berikutnya (berurutan, diusulkan)

### Fase 2a — Telepon Suara (telp) MVP  ← prioritas terdekat
Target: tombol panggilan di header chat — ngomong langsung dengan Sherly.
- **Mic**: Web Speech API (`SpeechRecognition`, `id-ID`) di browser (seperti dictation HeyTalent `lib/dictation.ts`) — gratis, tanpa upload audio mentah.
- **Alur**: mic → transkrip → `/api/ai/chat` (teks, multi-bubble) → TTS per bubble via Bank Suara (kata umum ter-cache → instan) → putar berurutan. Interupsi/berhenti bicara ala `CallOverlay` (hening 1,35 dtk → kirim otomatis; cooldown 4,2 dtk setelah Sherly selesai bicara).
- **UI**: overlay panggilan (latar gradient, foto Sherly, timer, status "Terhubung…/Mendengarkan…/Sherly bicara…", tombol mute/end/speaker) — adaptasi Ringkas dari `CallOverlay.tsx` (bagian mic-dictation + status machine-nya; TANPA klip video).
- **Emosi**: awalnya heuristik sederhana dari teks (…!→excited, …?→tanya, dll); tanpa klasifikasi emosi dulu.
- **Estimasi**: 1–2 PR berurutan. Risiko utama: izin mic + keandalan Web Speech di Android Chrome (fallback: tombol teks).

### Fase 2b — Video Call (butuh aset: belum ada!)
Mekanik HeyTalent: panggilan 2 arah; tahapan klip (greeting → listening → thinking → talking → emosi: smile/laugh/shy/pout/confused/angry/sad/surprised), klip diputar sesuai emosi balasan TTS; klip disimpan di R2 (kita: Supabase Storage), slot tersimpan per karakter di DB.
- **Prasyarat**: pembuatan aset video Sherly (12 slot × ±4–8 dtk) — bisa di-generate dari tool luar (mis. kie.ai!) lalu diupload; DB tabel `sherly_call_clips (character_id, slot, storage_path)` + kolom `poster`.
- **Client**: `CallVideoStage` setara — 1 elemen `<video>` + pergantian src 0ms; fallback "silent expressing" bila klip slot tidak ada.
- **Prasyarat non-teknis**: aset video Sherly harus DIBUAT dulu (sekarang belum ada). Tanpa aset, video call hanya foto statis (bisa tetap dikerjakan sebagai 2a.5: "video" = foto berdenyut + audio).
- **Estimasi**: 2–3 PR + pekerjaan aset.

### Fase 2c — Story Sherly (StoryTalent ala IG)
HeyTalent: tabel `character_statuses` (24 jam), `statuses` API (like/comment/follow/bookmark/view), post otomatis terjadwal (`cron/post-character-stories`), tampilan ala IG (ring gradient di avatar).
- **SherlyStudio**: reuse pola itu apa adanya; media ke Supabase Storage bucket `stories` (public read) + tabel `stories` RLS owner; menu "Story Sherly" sidebar (ring gradient) ; upload via UI Studio; auto-post 1×/hari (Vercel Cron → endpoint).
- **Estimasi**: 2–3 PR.

### Fase 2d — Chat terasa WA di HP
HeyTalent HP = WhatsApp (daftar percakapan + gelembung + bottom tab Story/Panggilan/Chat/Profil).
- **SherlyStudio**: bottom navigation bar khusus mobile (Beranda/Chat Sherly/Studio/Profil), header chat ala WA (tap → menu), bubble user hijau-WA? (tetap brand pink — cukup layout), 3–4 percakapan demo? (tidak; tetap 1 karakter: Sherly).
- **Percakapan banyak**: fondasi sudah ada (`ai_conversations` per akun) — perlu halaman "Riwayat" + tombol percakapan baru.

### Fase 2e — Sherly proaktif & memori jangka panjang
HeyTalent punya `proactiveCheckIn` (DM duluan saat kamu lama absen), `continuityMemory` (buku ingatan), jadwal harian karakter.
- **SherlyStudio**: (1) nudge harian: Vercel Cron cek terakhir chat >24j → toast "Sherly kangen…" / gelembung sambutan saat chat dibuka; (2) "Buku Ingatan": ringkasan fakta penting tiap N pesan ke `user_profiles`/tabel `sherly_memories(user_id, fact, created_at)`; (3) kerangka persona & relasi (sudah ada sebagian di profil).

## Catatan teknis penting dari aira yang diadopsi sebagian
- **Key pool/rotasi untuk TTS & chat** — sudah ada di SherlyStudio (`provider-keys.js`, auto-disable 5 kegagalan) ✓ setara `providerPool.ts`.
- **IndexedDB cache TTS di klien** (500 entri/80MB, 0ms play) — belum diadopsi; kandidat fase berikutnya (dengan Bank Suara server, ini bonus tambahan).
- **ProviderElevenLabs** — tidak diadopsi (Gemini-only sesuai keputusan produk).
- **R2 → Supabase Storage** — padanan langsung; path per akun mendukung RLS identik dengan pola `character-references`.
- **`personas live in blobs`** — tetap pakai Supabase Storage, bukan menambah layanan.
