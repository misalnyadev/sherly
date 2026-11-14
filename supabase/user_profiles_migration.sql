-- SherlyStudio v1.4 — Profil Pengguna (persisten lintas perangkat/login)
-- Safe to re-run (idempotent). Run AFTER schema.sql (butuh public.set_updated_at).

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  display_name text not null default '' check (char_length(display_name) <= 80),
  account_type text not null default 'Kreator' check (char_length(account_type) <= 40),
  role text not null default '' check (char_length(role) <= 120),
  company text not null default '' check (char_length(company) <= 120),
  bio text not null default '' check (char_length(bio) <= 600),
  email text not null default '' check (char_length(email) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  location text not null default '' check (char_length(location) <= 120),
  website text not null default '' check (char_length(website) <= 160),
  primary_contact text not null default 'WhatsApp' check (char_length(primary_contact) <= 40),
  photo text not null default '' check (char_length(photo) <= 400000),
  photo_position text not null default '50% 12%' check (char_length(photo_position) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "user profiles owner access" on public.user_profiles;
create policy "user profiles owner access" on public.user_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();
