-- SherlyStudio AI Key Vault v1.2 — key groups (1 label, many keys) + per-user provider model settings
-- Safe to re-run (idempotent). Run AFTER ai_key_vault_migration.sql.

-- 1) Allow multiple keys under the same label: drop the old unique constraint
alter table public.ai_provider_keys drop constraint if exists ai_provider_keys_user_provider_name;
create index if not exists ai_provider_keys_group
  on public.ai_provider_keys(user_id, provider, key_name);

-- 2) Per-user, per-provider model selection for chat (falls back to env defaults when unset)
create table if not exists public.ai_provider_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('groq','gemini','openrouter','kie','custom')),
  model text not null check (char_length(model) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.ai_provider_settings enable row level security;

drop policy if exists "ai provider settings owner access" on public.ai_provider_settings;
create policy "ai provider settings owner access" on public.ai_provider_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop trigger if exists ai_provider_settings_set_updated_at on public.ai_provider_settings;
create trigger ai_provider_settings_set_updated_at before update on public.ai_provider_settings
  for each row execute function public.set_updated_at();
