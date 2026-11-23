-- SherlyStudio AI Key Vault v1.0
-- Run once in Supabase Dashboard > SQL Editor AFTER schema.sql.
-- Stores AES-256-GCM encrypted AI provider keys. Decryption happens ONLY in the backend.
-- RLS scopes every row to the owning admin; ciphertext is never needed by the frontend.

create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('groq','gemini','openrouter','kie','custom')),
  key_name text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  last4 text not null,
  priority integer not null default 100 check (priority between 1 and 1000),
  is_active boolean not null default true,
  health_status text not null default 'unknown' check (health_status in ('ok','failing','disabled','unknown')),
  consecutive_failures integer not null default 0,
  last_used_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_provider_keys_user_provider_name unique (user_id, provider, key_name)
);

create index if not exists ai_provider_keys_active_priority
  on public.ai_provider_keys(user_id, provider, priority) where is_active = true;

alter table public.ai_provider_keys enable row level security;

drop policy if exists "ai provider keys owner access" on public.ai_provider_keys;
create policy "ai provider keys owner access" on public.ai_provider_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop trigger if exists ai_provider_keys_set_updated_at on public.ai_provider_keys;
create trigger ai_provider_keys_set_updated_at before update on public.ai_provider_keys
  for each row execute function public.set_updated_at();
