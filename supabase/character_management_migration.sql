-- SherlyStudio Character Management v0.2
-- Run once in Supabase Dashboard > SQL Editor after the original schema.sql.

alter table public.characters
  add column if not exists age integer not null default 24,
  add column if not exists origin text not null default 'Indonesia',
  add column if not exists language text not null default 'Bahasa Indonesia',
  add column if not exists platforms text[] not null default array['Instagram','TikTok'],
  add column if not exists appearance text not null default '',
  add column if not exists personality text not null default '';

-- Private bucket: reference photos are only accessible to the authenticated owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('character-references', 'character-references', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "character reference owner read" on storage.objects;
create policy "character reference owner read" on storage.objects
for select to authenticated
using (bucket_id = 'character-references' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "character reference owner insert" on storage.objects;
create policy "character reference owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'character-references' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "character reference owner update" on storage.objects;
create policy "character reference owner update" on storage.objects
for update to authenticated
using (bucket_id = 'character-references' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'character-references' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "character reference owner delete" on storage.objects;
create policy "character reference owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'character-references' and (storage.foldername(name))[1] = (select auth.uid())::text);
