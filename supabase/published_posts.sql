-- SherlyStudio: Cloud Publish — galeri karya & jadwal tayang (D-155, PR 1)
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor.
-- Tabel per-akun (RLS owner) + bucket PUBlik 'published' + view aman untuk
-- halaman publik (PR 2: feed karya live + share link).

-- 1) Tabel post
create table if not exists public.published_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  caption text not null default '' check (char_length(caption) <= 600),
  category text not null default 'foto' check (category in ('foto', 'reels', 'artikel')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'archived')),
  publish_at timestamptz,
  storage_path text,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists published_posts_user_updated_idx
  on public.published_posts (user_id, updated_at desc);
create index if not exists published_posts_public_live_idx
  on public.published_posts (status, publish_at);

alter table public.published_posts enable row level security;
alter table public.published_posts force row level security;

drop policy if exists "published posts owner crud" on public.published_posts;
create policy "published posts owner crud" on public.published_posts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) View PUBLIK (kolom aman saja; security_invoker=false supaya RLS owner tidak memblokir):
--    hanya karya Live, atau Terjadwal yang waktunya sudah tiba.
create or replace view public.published_posts_public
  with (security_invoker = false, security_barrier = true) as
  select p.id, p.title, p.caption, p.category, p.publish_at, p.storage_path, p.created_at
  from public.published_posts p
  where p.status = 'live'
     or (p.status = 'scheduled' and p.publish_at is not null and p.publish_at <= now());

grant select on public.published_posts_public to anon, authenticated;

-- 3) Bucket publik untuk gambar karya (publik bisa membaca via URL; hanya owner menulis)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('published', 'published', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "published public read" on storage.objects;
create policy "published public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'published');

drop policy if exists "published owner insert" on storage.objects;
create policy "published owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'published' and auth.uid() = owner);

drop policy if exists "published owner update" on storage.objects;
create policy "published owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'published' and auth.uid() = owner);

drop policy if exists "published owner delete" on storage.objects;
create policy "published owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'published' and auth.uid() = owner);
