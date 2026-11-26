-- ===== D-293: Showcase — aset Studio yang dipilih user untuk tampil di Beranda =====
-- Jalankan sekali di Supabase (aman berulang). Dieksekusi via connector Supabase.
--
-- 1) Kolom penanda pada public.assets:
--      is_portfolio -> aset ini "dipindahkan ke Portfolio" (section Portfolio Beranda)
--      is_public    -> aset ini "dipilih sebagai konten publik" (section Konten Terbaru)
-- 2) Tabel public.showcase_items: catatan aset yang dipilih + slot-nya.
-- 3) View public.showcase_items_public: hanya slot 'public' (baca anon / tanpa login).
-- 4) Bucket publik 'showcase': file aset terpilih disalin ke sini supaya URL-nya
--    stabil & bisa dibaca tamu di halaman Beranda.
--
-- Bucket 'studio-assets' tetap PRIVATE (hanya owner). Yang dipublikasikan hanya
-- aset yang memang user pilih sendiri.

-- ===== 1) Kolom penanda pada public.assets =====
alter table public.assets
  add column if not exists is_portfolio boolean not null default false,
  add column if not exists is_public boolean not null default false;

comment on column public.assets.is_portfolio is 'Aset ini dipindahkan ke Portfolio (tampil di section Portfolio Beranda).';
comment on column public.assets.is_public is 'Aset ini dipilih sebagai konten publik (tampil di section Konten Terbaru Beranda).';

create index if not exists assets_showcase_flags
  on public.assets (user_id, is_portfolio, is_public, created_at desc);

-- ===== 2) Tabel catatan showcase =====
create table if not exists public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  slot text not null check (slot in ('portfolio','public')),
  title text not null default '',
  caption text not null default '',
  storage_path text not null,
  media_type text not null default 'image',
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, slot)
);

create index if not exists showcase_items_user_slot_idx
  on public.showcase_items (user_id, slot, created_at desc);

alter table public.showcase_items enable row level security;
alter table public.showcase_items force row level security;

drop policy if exists "showcase items owner crud" on public.showcase_items;
create policy "showcase items owner crud" on public.showcase_items
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ===== 3) View PUBLIK — hanya konten publik (slot 'public') =====
create or replace view public.showcase_items_public
  with (security_invoker = false, security_barrier = true) as
  select s.id, s.title, s.caption, s.storage_path, s.media_type, s.width, s.height, s.created_at
  from public.showcase_items s
  where s.slot = 'public';

grant select on public.showcase_items_public to anon, authenticated;

-- ===== 4) Bucket publik 'showcase' =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showcase', 'showcase', true, 26214400,
  array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 26214400,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];

drop policy if exists "showcase public read" on storage.objects;
create policy "showcase public read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'showcase');

drop policy if exists "showcase owner insert" on storage.objects;
create policy "showcase owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'showcase' and auth.uid() = owner);

drop policy if exists "showcase owner update" on storage.objects;
create policy "showcase owner update" on storage.objects
for update to authenticated
using (bucket_id = 'showcase' and auth.uid() = owner);

drop policy if exists "showcase owner delete" on storage.objects;
create policy "showcase owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'showcase' and auth.uid() = owner);
