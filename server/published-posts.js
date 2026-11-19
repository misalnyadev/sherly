// Cloud Publish — validasi post & parse gambar (D-155).
// Dipakai rute /api/publish/posts di server/app.js; murni fungsi agar mudah dites.
export const PUBLISH_CATEGORIES = ['foto', 'reels', 'artikel'];
export const PUBLISH_STATUSES = ['draft', 'scheduled', 'live', 'archived'];
export const PUBLISH_TITLE_MAX = 120;
export const PUBLISH_CAPTION_MAX = 600;
export const PUBLISH_BODY_MAX = 20000;
export const PUBLISH_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function sanitizePostInput(input) {
  const title = String(input?.title ?? '').trim();
  if (!title) return { error: 'Judul karya wajib diisi.' };
  if (title.length > PUBLISH_TITLE_MAX) return { error: 'Judul maksimal ' + PUBLISH_TITLE_MAX + ' karakter.' };
  const caption = String(input?.caption ?? '').trim();
  if (caption.length > PUBLISH_CAPTION_MAX) return { error: 'Keterangan maksimal ' + PUBLISH_CAPTION_MAX + ' karakter.' };
  const categoryRaw = String(input?.category ?? '').trim() || 'foto';
  const category = PUBLISH_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'foto';
  const statusRaw = String(input?.status ?? '').trim() || 'draft';
  const status = PUBLISH_STATUSES.includes(statusRaw) ? statusRaw : 'draft';
  let publish_at = null;
  if (status === 'scheduled') {
    const d = new Date(String(input?.publish_at ?? ''));
    if (!input?.publish_at || isNaN(d.getTime())) return { error: 'Pilih tanggal & jam tayang dulu untuk status Terjadwal.' };
    if (d.getTime() > Date.now() + 1000 * 60 * 60 * 24 * 730) return { error: 'Jadwal tayang maksimal 2 tahun ke depan.' };
    publish_at = d.toISOString();
  }
  const body = input?.body === undefined || input?.body === null ? null : String(input.body).slice(0, PUBLISH_BODY_MAX);
  return { value: { title, caption, category, status, publish_at, body } };
}

// ID karya publik harus uuid Supabase (dipakai share link /galeri.html?id=…).
export function isValidPostId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Baris feed publik (dari view published_posts_public) → bentuk aman untuk anon.
// Body hanya diteruskan untuk kategori artikel; publicUrl = URL publik bucket 'published'.
export function publicFeedRow(r, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  let publicUrl = '';
  if (r.storage_path && base) publicUrl = base + '/storage/v1/object/public/published/' + r.storage_path;
  return {
    id: r.id,
    title: r.title,
    caption: r.caption || '',
    category: r.category,
    publish_at: r.publish_at || null,
    created_at: r.created_at,
    viewCount: Number(r.view_count) || 0,
    body: r.category === 'artikel' ? (r.body || null) : null,
    publicUrl,
  };
}

export function parseImageDataUrl(dataUrl) {
  const s = String(dataUrl || '');
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) return { error: 'Gambar tidak valid — gunakan JPG, PNG, atau WebP.' };
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes < 64) return { error: 'Gambar tidak valid — filenya terlalu kecil.' };
  if (bytes > PUBLISH_IMAGE_MAX_BYTES) return { error: 'Gambar terlalu besar (maks 5 MB).' };
  return { buffer: Buffer.from(m[2], 'base64'), mime: 'image/' + m[1], ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}
