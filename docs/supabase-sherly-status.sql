-- D-268 · Status harian Sherly — dibuat otomatis oleh AI, berlaku 24 jam,
-- lalu dihapus otomatis dari DB (tidak pernah menampilkan status basi).
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → paste → Run.
-- (Sudah dijalankan lewat Supabase connector — file inikept sebagai acuan.)

create table if not exists public.sherly_status (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 160),
  created_at timestamptz not null default now(),
  -- Status berlaku 24 jam sejak dibuat, lalu otomatis dianggap habis.
  expires_at timestamptz not null default now() + interval '24 hours'
);

alter table public.sherly_status enable row level security;
alter table public.sherly_status force row level security;

-- Semua orang (termasuk tamu tanpa login) boleh membaca status yang MASIH valid.
drop policy if exists "sherly status public read" on public.sherly_status;
create policy "sherly status public read" on public.sherly_status
  for select to anon, authenticated
  using (expires_at > now());

-- Hanya admin yang boleh menulis status (server memakai JWT admin; project
-- ini sengaja TIDAK memakai service_role key).
drop policy if exists "sherly status admin write" on public.sherly_status;
create policy "sherly status admin write" on public.sherly_status
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create index if not exists sherly_status_expires_idx
  on public.sherly_status (expires_at desc);

-- Bersihkan status kedaluwarsa (dipanggil server sebelum generate status baru).
create or replace function public.cleanup_sherly_status() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.sherly_status where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
