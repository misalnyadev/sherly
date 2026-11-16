-- SherlyStudio v1.4 — Jenis kelamin di Profil Pengguna (D-118)
-- Safe to re-run (idempotent). Jalankan SETELAH user_profiles_migration.sql.
-- Supaya Sherly tahu sapaan yang tepat untuk akun yang dibuat langsung di Supabase
-- (metadata akunnya kosong — contoh: akun admin/pemilik).

alter table public.user_profiles add column if not exists gender text not null default '' check (gender in ('', 'pria', 'wanita'));
