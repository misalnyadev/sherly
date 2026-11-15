// D-107: deteksi error Supabase Storage saat bucket membatasi tipe file
// (pengaturan "Allowed MIME types" di dashboard), supaya user dapet pesan jelas
// beserta langkah perbaikannya — bukan error mentah "mime type audio/wav is not supported".
// Modul pure (tanpa import) agar mudah diuji unit.

/** True bila error berasal dari bucket yang membatasi allowed_mime_types. */
export function isMimeBlockedError(error) {
  const message = String(error?.message || error || '');
  return /mime type .+ is not supported/i.test(message) || String(error?.statusCode || '') === '415';
}

/** Pesan ramah + langkah perbaikan; null bila error bukan mime diblokir. */
export function storageUploadHint(error, docFile = 'docs/supabase-audio-mime.sql') {
  if (!isMimeBlockedError(error)) return null;
  return `Bucket Supabase masih membatasi tipe file yang boleh diunggah (Allowed MIME types) — tipe file ini belum diizinkan. Jalankan ${docFile} sekali di Supabase Dashboard → SQL Editor, lalu coba simpan kembali.`;
}
