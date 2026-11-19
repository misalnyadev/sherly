-- SherlyStudio: dokumen Editor — naskah, caption, artikel (D-152)
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor.
-- Tabel per-akun (RLS owner): dokumen hanya terlihat & bisa diubah pemiliknya.

create table if not exists public.editor_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  doc_type text not null default 'Catatan Bebas',
  status text not null default 'draft' check (status in ('draft', 'review', 'final')),
  body text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.editor_documents enable row level security;
alter table public.editor_documents force row level security;

drop policy if exists "editor documents owner crud" on public.editor_documents;
create policy "editor documents owner crud" on public.editor_documents
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists editor_documents_user_updated_idx
  on public.editor_documents (user_id, updated_at desc);
