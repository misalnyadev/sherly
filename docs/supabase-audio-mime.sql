-- ===== D-107: Buka batasan tipe file (Allowed MIME types) bucket storage =====
-- Gejala: simpan karakter tahap 5 gagal dengan error
--   "mime type audio/wav is not supported"
-- Penyebab: bucket character-references dibuat dengan Allowed MIME types terbatas
--   (gambar saja) — upload sampel suara (WAV/MP3/OGG/M4A/WebM) ditolak Supabase.
-- Jalankan sekali di Supabase Dashboard -> SQL Editor. Aman dijalankan berulang.

-- Null = semua tipe file diizinkan. Validasi tipe file TETAP dilakukan server
-- SherlyStudio sebelum upload (gambar: JPG/PNG/WebP; audio: WAV/MP3/OGG/M4A/WebM).
update storage.buckets
   set allowed_mime_types = null
 where id in ('character-references', 'tts-clips');

-- Alternatif: kalau ingin tetap membatasi bucket, ganti "set allowed_mime_types = null"
-- dengan daftar eksplisit di bawah ini (persis daftar yang divalidasi server):
-- update storage.buckets
--    set allowed_mime_types = array[
--      'image/jpeg','image/png','image/webp',
--      'audio/wav','audio/x-wav','audio/mpeg','audio/mp3','audio/ogg','audio/mp4','audio/x-m4a','audio/webm','application/ogg'
--    ]
--   where id in ('character-references', 'tts-clips');
