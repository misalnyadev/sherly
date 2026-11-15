-- ===== D-98/D-99: Karakter Wizard (5 tahap: analisis foto, traits, master board, suara, bible) =====
-- Jalankan sekali di Supabase Dashboard -> SQL Editor. Aman dijalankan berulang (if not exists).
-- Menambahkan kolom wizard ke tabel characters:
--   traits     : detail fisik terstruktur hasil analisis/suntingan (17 kunci)
--   board_path : master board (sheet referensi 3 panel) di bucket character-references
--   bible      : Character Bible (dokumen referensi karakter)
--   voice      : profil suara terkunci { name, style, script }
--   voice_path : sampel suara (audio) di bucket character-references

alter table characters
  add column if not exists traits jsonb not null default '{}'::jsonb;

alter table characters
  add column if not exists board_path text;

alter table characters
  add column if not exists bible text;

alter table characters
  add column if not exists voice jsonb not null default '{}'::jsonb;

alter table characters
  add column if not exists voice_path text;

comment on column characters.traits is 'Detail fisik terstruktur wizard Karakter (kunci: faceShape, skin, eyes, eyeDetail, eyebrows, nose, lips, lipDetail, hair, hairDetail, hijab, bodyType, mark, outfit, style, accessories, skinTexture).';
comment on column characters.board_path is 'Path master board (sheet referensi 3 panel) di bucket character-references.';
comment on column characters.bible is 'Character Bible — dokumen referensi tunggal untuk konsistensi karakter.';
comment on column characters.voice is 'Profil suara karakter: { name: voice Gemini, style: gaya bicara, script: contoh naskah }.';
comment on column characters.voice_path is 'Path sampel suara karakter di bucket character-references.';

-- Tidak ada kebijakan RLS baru: kolom mengikuti kebijakan per-user yang sudah ada di tabel characters.
