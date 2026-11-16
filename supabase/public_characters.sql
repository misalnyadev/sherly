-- SherlyStudio: etalase karakter publik (D-129 / D-130)
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor.

-- 1) View dengan kolom AMAN saja untuk pembaca publik (anon).
--    security_invoker = false -> view dijalankan sebagai owner-nya (postgres),
--    sehingga RLS tabel characters tidak memblokir, tetapi HANYA kolom di bawah
--    ini yang terekspos (identity_prompt, bible, voice, dll tetap tertutup).
create or replace view public.characters_public_view
  with (security_invoker = false, security_barrier = true) as
  select c.id, c.name, c.role, c.origin, c.niche, c.is_master, c.reference_image_path
  from public.characters c
  where c.status = 'active';

grant select on public.characters_public_view to anon, authenticated;

-- 2) Foto referensi karakter dapat dibaca publik (untuk etalase) lewat signed URL.
drop policy if exists "character reference public read" on storage.objects;
create policy "character reference public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'character-references');
