-- SherlyStudio D-277 · Izinkan provider 'soniox' & 'voicemaker' (cadangan TTS
-- bahasa Indonesia) dan perbarui bucket Bank Suara untuk format audio baru.
--
-- Latar belakang:
--   TTSMaker (D-276) ternyata API resminya HANYA tersedia untuk akun
--   ber-subscription Pro/Studio — tanpa subscribe tidak ada API key sama
--   sekali, jadi tidak bisa dipakai sebagai fallback utama.
--   Soniox  → native `id` (Indonesia) + `su` (Sunda), REST sederhana,
--             pay-as-you-go TANPA langganan wajib  → fallback #1.
--   Voicemaker → native `id-ID` + Javanese, VoxFX + voice cloning → fallback #2.
--   TTSMaker tetap didukung (fallback #3, opsional).
--
-- Catatan: 'soniox' & 'voicemaker' TIDAK masuk ai_conversations — keduanya
--          bukan provider chat, cuma Text-to-Speech. Check tabel percakapan
--          tidak diubah.
--
-- Safe to re-run (idempotent).

-- 1) Tabel kunci provider (vault admin + kunci pribadi)
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys add constraint ai_provider_keys_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','soniox','voicemaker','ttsmaker'));

-- 2) Tabel pengaturan model per provider (tombol "Simpan" di kartu provider)
alter table public.ai_provider_settings drop constraint if exists ai_provider_settings_provider_check;
alter table public.ai_provider_settings add constraint ai_provider_settings_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','soniox','voicemaker','ttsmaker'));

-- 3) Bank Suara — bucket tetap PRIVATE, tambah MIME audio baru.
--    Soniox bisa kirim mp3/wav/aac/opus/flac/pcm; TTSMaker mp3/wav/ogg/aac/opus.
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
