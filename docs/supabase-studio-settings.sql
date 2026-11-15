-- D-95 · Setelan studio publik (nomor WhatsApp untuk brief klien, dsb.)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → paste → Run.
-- Tanpa tabel ini: profil tetap tersimpan, tapi nomor WA tidak tersinkron
-- ke halaman Kolaborasi (yang dipakai = fallback di collab-data.js).

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Semua orang (termasuk tamu tanpa login) boleh MEMBACA setelan publik.
drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read" on public.app_settings
  for select to anon, authenticated
  using (true);

-- Hanya admin yang boleh menulis/mengubah setelan.
drop policy if exists "app_settings admin write" on public.app_settings;
create policy "app_settings admin write" on public.app_settings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
