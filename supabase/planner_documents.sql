-- SherlyStudio: naskah Planner — dokumen caption/artikel/script (D-153)
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor.
-- Tabel per-akun (RLS owner): naskah hanya terlihat & bisa diubah pemiliknya.

create table if not exists public.planner_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  doc_type text not null default 'Catatan Bebas',
  status text not null default 'draft' check (status in ('draft', 'review', 'final')),
  body text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planner_documents enable row level security;
alter table public.planner_documents force row level security;

drop policy if exists "planner documents owner crud" on public.planner_documents;
create policy "planner documents owner crud" on public.planner_documents
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists planner_documents_user_updated_idx
  on public.planner_documents (user_id, updated_at desc);
