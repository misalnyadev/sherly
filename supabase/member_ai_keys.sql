-- SherlyStudio: kunci AI pribadi (BYOK) untuk tamu & klien (D-142)
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor.
-- Table ai_provider_keys sudah per-user (RLS owner) - migration ini hanya
-- mengizinkan provider 'custom' + kolom untuk endpoint OpenAI-compatible.

-- 1) Izinkan provider kustom + Kie AI (D-271)
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_provider_check;
alter table public.ai_provider_keys add constraint ai_provider_keys_provider_check
  check (provider in ('groq','gemini','openrouter','kie','custom','azure','elevenlabs'));  -- D-278: +azure +elevenlabs (cadangan TTS free tier, tanpa subscribe)

-- 2) Kolom khusus provider kustom (base URL + model; NULL untuk provider standar)
alter table public.ai_provider_keys add column if not exists base_url text;
alter table public.ai_provider_keys add column if not exists model text;

-- 3) Percakapan dengan provider kustom + Kie AI (check lama hanya 3 provider)
alter table public.ai_conversations drop constraint if exists ai_conversations_provider_check;
alter table public.ai_conversations add constraint ai_conversations_provider_check
  check (provider in ('gemini','groq','openrouter','kie','custom'));
