-- ===== D-98: Karakter Wizard v2 (analisis foto, traits, master board) =====
-- Jalankan sekali di Supabase Dashboard -> SQL Editor.
-- Menambahkan kolom traits (detail fisik terstruktur hasil analisis/wizard)
-- dan board_path (master board di bucket character-references) ke tabel characters.

alter table characters
  add column if not exists traits jsonb not null default '{}'::jsonb;

alter table characters
  add column if not exists board_path text;

comment on column characters.traits is 'Detail fisik terstruktur wizard Karakter (kunci: faceShape, skin, eyes, eyeDetail, eyebrows, nose, lips, lipDetail, hair, hairDetail, hijab, bodyType, mark, outfit, style, accessories, skinTexture).';
comment on column characters.board_path is 'Path master board (sheet referensi 3 panel) di bucket character-references.';

-- Tidak ada kebijakan RLS baru: kolom mengikuti kebijakan per-user yang sudah ada di tabel characters.
