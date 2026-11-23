-- SherlyStudio D-276 · Izinkan provider 'ttsmaker' (cadangan TTS bahasa Indonesia).
--
-- Gejala: "✗ new row for relation \"ai_provider_keys\" violates check constraint
--          \"ai_provider_keys_provider_check\"" saat menyimpan API key TTSMaker.
-- Cause: constraint lama hanya menerima ('groq','gemini','openrouter','kie','custom'),
--         padahal server sudah mendukung TTSMaker sebagai cadangan TTS native
--         Indonesia + Sunda (dipakai otomatis saat kuota Gemini habis).
--
-- Catatan: 'ttsmaker' TIDAK masuk ai_conversations — dia bukan provider chat,
--          cuma Text-to-Speech. jadi check tabel percakapan tidak diubah.
--
-- Safe to re-run (idempotent). Jalankan di Supabase Dashboard > SQL Editor.
-- (Migrasi ini juga sudah dieksekusi lewat Supabase connector untuk project
--  gnsfuxaicogdoiprpeaz pada 2026-11-14.)

-- 1) Tabel kunci provider (vault admin + kunci pribadi)
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys add constraint ai_provider_keys_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','ttsmaker'));

-- 2) Tabel pengaturan model per provider (tombol "Simpan" di kartu provider)
alter table public.ai_provider_settings drop constraint if exists ai_provider_settings_provider_check;
alter table public.ai_provider_settings add constraint ai_provider_settings_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','ttsmaker'));

-- 3) Bank Suara — bucket private + MIME audio (TTSMaker mengembalikan MP3).
--    Bucket tetap PRIVATE (bukan publik) — akses lewat signed URL + RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-clips', 'tts-clips', false, 8388608,
        array['audio/wav','audio/mpeg','audio/x-wav','audio/mp3','audio/ogg'])
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = array['audio/wav','audio/mpeg','audio/x-wav','audio/mp3','audio/ogg'];
