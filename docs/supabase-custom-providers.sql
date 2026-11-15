-- D-96 · Provider Kustom (generator Studio)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → paste → Run.
-- Untuk menambah provider generator gambar apa pun (kompatibel OpenAI /images/generations)
-- langsung dari halaman Pengaturan tanpa menunggu update aplikasi.

create table if not exists public.custom_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_url text not null,
  model text not null default '',
  encrypted_key text not null,          -- JSON { ciphertext, iv, auth_tag } AES-256-GCM (vault server)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.custom_providers enable row level security;

drop policy if exists "custom_providers owner" on public.custom_providers;
create policy "custom_providers owner" on public.custom_providers
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists custom_providers_user_idx
  on public.custom_providers (user_id, created_at);
