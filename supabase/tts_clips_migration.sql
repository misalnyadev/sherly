-- SherlyStudio Bank Suara (TTS cache) v1
-- Menyimpan hasil generate TTS per akun agar pengucapan yang sama tidak digenerate ulang.
-- Safe to re-run (idempotent). Run AFTER schema.sql.

-- 1) Indeks klip suara per akun (hash dari provider+voice+model+teks)
create table if not exists public.sherly_tts_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_hash text not null,
  storage_path text not null,
  provider text not null, -- 'gemini'
  voice text not null,
  model text not null,
  text text not null,
  mime_type text not null default 'audio/wav',
  bytes integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists sherly_tts_clips_user_hash
  on public.sherly_tts_clips(user_id, clip_hash);
create index if not exists sherly_tts_clips_user_created
  on public.sherly_tts_clips(user_id, created_at desc);

alter table public.sherly_tts_clips enable row level security;

drop policy if exists "tts clips owner access" on public.sherly_tts_clips;
create policy "tts clips owner access" on public.sherly_tts_clips for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2) Private bucket untuk file audio (pola sama dengan character-references)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-clips', 'tts-clips', false, 8388608, array['audio/wav','audio/mpeg','audio/x-wav'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['audio/wav','audio/mpeg','audio/x-wav'];

drop policy if exists "tts clips owner read" on storage.objects;
create policy "tts clips owner read" on storage.objects
for select to authenticated
using (bucket_id = 'tts-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "tts clips owner insert" on storage.objects;
create policy "tts clips owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'tts-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "tts clips owner update" on storage.objects;
create policy "tts clips owner update" on storage.objects
for update to authenticated
using (bucket_id = 'tts-clips' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'tts-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "tts clips owner delete" on storage.objects;
create policy "tts clips owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'tts-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
