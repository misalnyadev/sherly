-- SherlyStudio D-271 · Izinkan provider 'kie' (Kie AI) & 'custom' di semua tabel AI.
--
-- Gejala: "✗ new row for relation \"ai_provider_keys\" violates check constraint
--          \"ai_provider_keys_provider_check\"" saat menyimpan API key Kie AI.
-- Cause: constraint lama hanya menerima ('groq','gemini','openrouter','custom'),
--         padahal server sudah mendukung Kie AI (gambar & video).
--
-- Safe to re-run (idempotent). Jalankan di Supabase Dashboard > SQL Editor.
-- (Migrasi ini juga sudah dieksekusi lewat Supabase connector untuk project
--  gnsfuxaicogdoiprpeaz pada 2026-11-23.)

-- 1) Tabel kunci provider (vault admin + kunci pribadi)
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys add constraint ai_provider_keys_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom'));

-- 2) Tabel pengaturan model per provider (tombol "Simpan" di kartu provider)
alter table public.ai_provider_settings drop constraint if exists ai_provider_settings_provider_check;
alter table public.ai_provider_settings add constraint ai_provider_settings_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom'));

-- 3) Tabel percakapan
alter table public.ai_conversations drop constraint if exists ai_conversations_provider_check;
alter table public.ai_conversations add constraint ai_conversations_provider_check
  check (provider in ('gemini','groq','openrouter','kie','custom'));
