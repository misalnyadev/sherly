-- SherlyStudio: Cloud Publish PR 2 — feed publik + view counter (D-155).
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor SETELAH published_posts.sql (PR 1).
-- Isi: kolom view_count, view publik diperluas (view_count + isi artikel),
-- dan fungsi security-definer untuk menambah penayangan dari halaman publik (anon).

-- 1) Kolom view_count
alter table public.published_posts
  add column if not exists view_count bigint not null default 0;

-- 2) View publik diperluas: + view_count, + isi artikel (body HANYA untuk kategori artikel;
--    foto/reels tidak membocorkan catatan internal). Kolom lama dipertahankan urutannya.
create or replace view public.published_posts_public
  with (security_invoker = false, security_barrier = true) as
  select p.id, p.title, p.caption, p.category, p.publish_at, p.storage_path, p.created_at,
         p.view_count,
         case when p.category = 'artikel' then p.body else null end as body
  from public.published_posts p
  where p.status = 'live'
     or (p.status = 'scheduled' and p.publish_at is not null and p.publish_at <= now());

grant select on public.published_posts_public to anon, authenticated;

-- 3) Tambah penayangan (dipanggil halaman publik; hanya karya yang memang tayang)
create or replace function public.increment_post_view(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.published_posts p
  set view_count = p.view_count + 1
  where p.id = p_id
    and (p.status = 'live'
         or (p.status = 'scheduled' and p.publish_at is not null and p.publish_at <= now()));
end;
$$;

revoke all on function public.increment_post_view(uuid) from public;
grant execute on function public.increment_post_view(uuid) to anon, authenticated;
