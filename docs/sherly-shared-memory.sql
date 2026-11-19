-- D-194 · Memori Bersama Sherly (lintas tamu / klien / owner)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → paste → Run.
-- Tanpa tabel ini chat tetap jalan normal; fitur laporan & kunjungan dilewati diam-diam.

create table if not exists public.sherly_shared_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('visit', 'report')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default 'Tamu',
  actor_role text not null default 'guest',
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.sherly_shared_memory enable row level security;

-- Siapa pun yang login (tamu anonim / klien / owner) boleh MENULIS memori atas namanya sendiri.
drop policy if exists "sherly_shared_memory insert own" on public.sherly_shared_memory;
create policy "sherly_shared_memory insert own" on public.sherly_shared_memory
  for insert to authenticated
  with check (auth.uid() = actor_id);

-- HANYA owner (admin) yang boleh membaca / mengubah / menghapus memori bersama.
drop policy if exists "sherly_shared_memory admin read" on public.sherly_shared_memory;
create policy "sherly_shared_memory admin read" on public.sherly_shared_memory
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "sherly_shared_memory admin update" on public.sherly_shared_memory;
create policy "sherly_shared_memory admin update" on public.sherly_shared_memory
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "sherly_shared_memory admin delete" on public.sherly_shared_memory;
create policy "sherly_shared_memory admin delete" on public.sherly_shared_memory
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create index if not exists sherly_shared_memory_time_idx
  on public.sherly_shared_memory (created_at desc);
