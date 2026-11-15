-- D-90 · Catatan Pribadi Sherly (memori jangka panjang per akun)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → paste → Run.
-- Tanpa tabel ini chat tetap jalan normal; fitur catatan otomatis dilewati diam-diam.

create table if not exists public.ai_memory_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_memory_notes enable row level security;

drop policy if exists "ai_memory_notes owner all" on public.ai_memory_notes;
create policy "ai_memory_notes owner all" on public.ai_memory_notes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists ai_memory_notes_user_idx
  on public.ai_memory_notes (user_id, created_at desc);
