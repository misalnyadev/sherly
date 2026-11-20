-- ===== D-207: Bank Prompt (Hybrid: template utuh + blok modular) =====
-- Jalankan sekali di Supabase (aman berulang). Dieksekusi via connector Supabase.
--
-- Tabel public.prompt_bank menyimpan dua jenis entri:
--   kind = 'template' -> satu prompt lengkap siap pakai (mis. "Try Outfit", "Drone View")
--   kind = 'block'    -> satu blok susunan prompt (cahaya / kamera / tekstur / ...)
--                        yang bisa dipilih user dan ditumpuk sendiri di komposer.
--
-- Kolom slots menyimpan daftar placeholder (mis. ["outfit"]) untuk template
-- yang butuh diisi user (mis. "try outfit { outfit }").
--
-- Semua entri milik satu user (owner-only, RLS).

create table if not exists public.prompt_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'block' check (kind in ('template','block')),
  label text not null,
  category text not null default 'umum',
  content text not null default '',
  slots jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompt_bank_user_kind
  on public.prompt_bank(user_id, kind, sort_order);

alter table public.prompt_bank enable row level security;

drop policy if exists "prompt bank owner access" on public.prompt_bank;
create policy "prompt bank owner access" on public.prompt_bank
for all to authenticated
using (user_id = (select auth.uid())::uuid)
with check (user_id = (select auth.uid())::uuid);
