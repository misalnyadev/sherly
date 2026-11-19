// Editor — validasi & bentuk dokumen (D-152).
// Dipakai rute /api/editor/docs di server/app.js; murni fungsi agar mudah dites.
export const EDITOR_DOC_TYPES = ['Caption IG', 'Caption TikTok', 'Artikel', 'Script Video', 'Naskah Iklan', 'Catatan Bebas'];
export const EDITOR_STATUSES = ['draft', 'review', 'final'];
export const EDITOR_TITLE_MAX = 120;
export const EDITOR_BODY_MAX = 20000;

export function sanitizeDocInput(input) {
  const title = String(input?.title ?? '').trim();
  if (!title) return { error: 'Judul dokumen wajib diisi.' };
  if (title.length > EDITOR_TITLE_MAX) return { error: 'Judul maksimal ' + EDITOR_TITLE_MAX + ' karakter.' };
  const docTypeRaw = String(input?.doc_type ?? '').trim() || 'Catatan Bebas';
  const doc_type = EDITOR_DOC_TYPES.includes(docTypeRaw) ? docTypeRaw : 'Catatan Bebas';
  const statusRaw = String(input?.status ?? '').trim() || 'draft';
  const status = EDITOR_STATUSES.includes(statusRaw) ? statusRaw : 'draft';
  const body = String(input?.body ?? '');
  if (body.length > EDITOR_BODY_MAX) return { error: 'Isi dokumen maksimal ' + EDITOR_BODY_MAX.toLocaleString('id-ID') + ' karakter.' };
  return { value: { title, doc_type, status, body } };
}

export function docToMeta(r) {
  return {
    id: r.id, title: r.title, doc_type: r.doc_type, status: r.status,
    words: String(r.body || '').trim() ? String(r.body).trim().split(/\s+/).length : 0,
    updated_at: r.updated_at, created_at: r.created_at,
  };
}
