-- SherlyStudio initial schema (Supabase / PostgreSQL)
-- Run this in Supabase Dashboard > SQL Editor.
-- Every owner-data table is protected by RLS. This first schema is designed
-- for authenticated owner access; public portfolio publishing is a later phase.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'Virtual Influencer',
  niche text[] not null default array['Lifestyle','Beauty','Fashion','Travel'],
  identity_prompt text not null default '',
  reference_image_path text,
  is_master boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists characters_one_master_per_owner
  on public.characters(user_id) where is_master = true;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  platform text not null default 'instagram' check (platform in ('instagram','tiktok','other')),
  format text not null default 'reels' check (format in ('reels','carousel','story','photo','video','other')),
  content_pillar text not null default 'lifestyle',
  caption text not null default '',
  hashtags text[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  status text not null default 'idea' check (status in ('idea','draft','review','approved','scheduled','published','archived')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  file_path text not null,
  file_name text not null,
  media_type text not null check (media_type in ('image','video','audio','document','other')),
  alt_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Percakapan Sherly AI',
  provider text not null default 'groq' check (provider in ('gemini','groq','openrouter','kie','custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  provider text,
  model text,
  token_usage jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_partnerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_name text not null,
  contact_name text,
  contact_email text,
  campaign_name text,
  deal_value numeric(14,2),
  currency text not null default 'IDR',
  status text not null default 'lead' check (status in ('lead','contacted','negotiating','confirmed','completed','declined')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for all private tables
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.content_items enable row level security;
alter table public.assets enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.brand_partnerships enable row level security;

-- Owner can access only rows attached to their authenticated user ID.
drop policy if exists "profile owner access" on public.profiles;
create policy "profile owner access" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "characters owner access" on public.characters;
create policy "characters owner access" on public.characters for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "content owner access" on public.content_items;
create policy "content owner access" on public.content_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "assets owner access" on public.assets;
create policy "assets owner access" on public.assets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "ai conversations owner access" on public.ai_conversations;
create policy "ai conversations owner access" on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "ai messages owner access" on public.ai_messages;
create policy "ai messages owner access" on public.ai_messages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "brand partnerships owner access" on public.brand_partnerships;
create policy "brand partnerships owner access" on public.brand_partnerships for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Updated-at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','characters','content_items','ai_conversations','brand_partnerships'] LOOP
    EXECUTE format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    EXECUTE format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  END LOOP;
END $$;
