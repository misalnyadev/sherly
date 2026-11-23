-- SherlyStudio D-278 · Ganti provider cadangan TTS ke yang free tier tanpa
-- subscription: 'azure' + 'elevenlabs'. Hapus 'soniox', 'voicemaker',
-- 'ttsmaker' (semuanya mewajibkan bayar/subscribe di awal).
--
-- Latar belakang:
--   Aturan D-278 — fallback TTS harus bisa dipakai TANPA subscribe:
--     - TTSMaker   → API resmi hanya untuk paket Pro/Studio (tanpa subscribe
--                    tidak ada API key sama sekali) → dibuang.
--     - Soniox     → free credit signup baru dihentikan (Okt 2025), praktis
--                    pay-as-you-go → dibuang.
--     - Voicemaker → developer API pay-as-you-go, free plan web tidak membawa
--                    API → dibuang.
--   Yang dipakai (dua-duanya punya free tier bulanan, tanpa info pembayaran):
--     - Azure Speech (F0) → 500.000 karakter/bulan, reset tiap bulan.
--     - ElevenLabs (Free) → 10.000 kredit/bulan (~10 menit audio), API key
--       tanpa kartu kredit. ⚠️ free plan tanpa hak komersial.
--
-- Catatan: 'azure' & 'elevenlabs' TIDAK masuk ai_conversations — keduanya
--          bukan provider chat, cuma Text-to-Speech. Check tabel percakapan
--          tidak diubah.
--
-- Safe to re-run (idempotent).

-- 1) Tabel kunci provider (vault admin + kunci pribadi)
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys add constraint ai_provider_keys_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','azure','elevenlabs'));

-- 2) Tabel pengaturan model per provider (tombol "Simpan" di kartu provider)
alter table public.ai_provider_settings drop constraint if exists ai_provider_settings_provider_check;
alter table public.ai_provider_settings add constraint ai_provider_settings_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','azure','elevenlabs'));

-- 3) Bersihkan key lama provider yang sudah dibuang (biar tidak nyangkut).
--    Key dienkripsi (vault) dan tidak dipakai lagi — hapus agar rapi.
delete from public.ai_provider_keys where provider in ('soniox','voicemaker','ttsmaker');
delete from public.ai_provider_settings where provider in ('soniox','voicemaker','ttsmaker');

-- 4) Bank Suara — bucket tetap PRIVATE, tambah MIME audio baru.
--    Azure Speech: mp3/wav/ogg-opus. ElevenLabs: mp3/pcm.
--    Akses tetap lewat signed URL + RLS (tidak ada policy publik).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-clips', 'tts-clips', false, 8388608,
        array['audio/wav','audio/mpeg','audio/x-wav','audio/mp3','audio/ogg',
              'audio/aac','audio/opus','audio/flac','audio/pcm','audio/x-pcm'])
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = array['audio/wav','audio/mpeg','audio/x-wav','audio/mp3','audio/ogg',
                                'audio/aac','audio/opus','audio/flac','audio/pcm','audio/x-pcm'];
