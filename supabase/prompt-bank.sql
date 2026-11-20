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
  -- D-208: mode = jenis konten yang cocok (foto|video) -> prompt tidak salah pilih.
  mode text not null default 'foto' check (mode in ('foto','video')),
  -- D-208: kelompok entri (umum|style|fotovideo|produk) untuk pengelompokan UI.
  "group" text not null default 'umum',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompt_bank_user_kind
  on public.prompt_bank(user_id, kind, sort_order);

-- D-208: filter per mode + anti-duplikat label (per user + mode + jenis).
create index if not exists prompt_bank_user_mode
  on public.prompt_bank(user_id, mode, kind, sort_order);

create unique index if not exists prompt_bank_unique_label
  on public.prompt_bank(user_id, mode, kind, lower(label));

alter table public.prompt_bank enable row level security;

drop policy if exists "prompt bank owner access" on public.prompt_bank;
create policy "prompt bank owner access" on public.prompt_bank
for all to authenticated
using (user_id = (select auth.uid())::uuid)
with check (user_id = (select auth.uid())::uuid);

-- D-208: label unik per user+mode+kinds, mode & group kolom baru.
comment on column public.prompt_bank.mode is 'Jenis konten yang cocok untuk prompt ini: foto atau video.';
comment on column public.prompt_bank."group" is 'Kelompok entri: style, fotovideo, produk, atau umum.';
