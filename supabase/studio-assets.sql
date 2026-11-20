-- ===== D-198: Galeri Aset Studio + Engine Video =====
-- Jalankan sekali di Supabase (aman berulang). Dieksekusi via connector Supabase.
--
-- 1) Bucket baru "studio-assets" (private) untuk foto & video aset Studio.
-- 2) Kolom tambahan di public.assets (aset hasil generate maupun upload).
-- 3) Tabel public.sherly_video_tasks untuk proses generate video (task Kie + progres).

-- ===== 1) Bucket studio-assets =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-assets', 'studio-assets', false, 26214400,
  array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 26214400,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];

drop policy if exists "studio asset owner read" on storage.objects;
create policy "studio asset owner read" on storage.objects
for select to authenticated
using (bucket_id = 'studio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "studio asset owner insert" on storage.objects;
create policy "studio asset owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'studio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "studio asset owner update" on storage.objects;
create policy "studio asset owner update" on storage.objects
for update to authenticated
using (bucket_id = 'studio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'studio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "studio asset owner delete" on storage.objects;
create policy "studio asset owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'studio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== 2) Kolom tambahan public.assets =====
alter table public.assets
  add column if not exists kind text not null default 'upload',
  add column if not exists prompt text not null default '',
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_ms integer;

comment on column public.assets.kind is 'Asal aset: upload (dari user) atau generate (hasil Studio).';
comment on column public.assets.prompt is 'Prompt asal bila aset hasil generate.';
comment on column public.assets.meta is 'Metadata tambahan (aspect, style, characters, scene, model, durasi).';
comment on column public.assets.duration_ms is 'Durasi video dalam milidetik (NULL untuk gambar).';

-- ===== 3) Tabel task video =====
create table if not exists public.sherly_video_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'kie',
  model text not null default 'veo3_fast',
  status text not null default 'queued',
  progress integer not null default 0,
  prompt text not null default '',
  task_id text,
  asset_id uuid references public.assets(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sherly_video_tasks_user_created
  on public.sherly_video_tasks(user_id, created_at desc);

alter table public.sherly_video_tasks enable row level security;

drop policy if exists "sherly video tasks owner access" on public.sherly_video_tasks;
create policy "sherly video tasks owner access" on public.sherly_video_tasks
for all to authenticated
using (user_id = (select auth.uid())::uuid)
with check (user_id = (select auth.uid())::uuid);
