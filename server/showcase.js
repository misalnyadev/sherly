// ===== D-293: Showcase — aset Studio yang dipilih user untuk tampil di Beranda =====
//
// Dua SLOT:
//   'portfolio' -> aset yang user "pindahkan ke Portfolio"  -> section "Portfolio" Beranda
//   'public'    -> aset yang user "pilih jadi konten publik" -> section "Konten Terbaru" Beranda
//
// File aset disalin dari bucket 'studio-assets' (private) ke bucket 'showcase'
// (public) saat aset dipilih, supaya URL-nya stabil & bisa dibaca tamu.
// Bucket 'studio-assets' sendiri tetap private — hanya aset yangdipilih user
// sendiri yang dipublikasikan.
//
// Modul ini berisi fungsi MURNI (tanpa I/O) supaya mudah diuji unit.

export const SHOWCASE_BUCKET = 'showcase';
export const SHOWCASE_SLOTS = ['portfolio', 'public'];
export const SHOWCASE_SLOT_LABELS = {
  portfolio: 'Portfolio',
  public: 'Konten Publik',
};

/**
 * Normalisasi slot. Slot tak dikenal -> null (penolakan dipanggil route).
 */
export function normalizeSlot(value) {
  const v = String(value || '').trim().toLowerCase();
  return SHOWCASE_SLOTS.includes(v) ? v : null;
}

/**
 * Sanitasi field bebas (judul/keterangan) yang dipakai di Beranda.
 */
export function sanitizeShowcaseText(value, max = 120) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Normalisasi patch dari client:
 *   { is_portfolio: bool, is_public: bool, title, caption }
 * Hanya kunci yang ADA yang dikembalikan (partial update).
 */
export function sanitizeShowcasePatch(input) {
  const src = input && typeof input === 'object' ? input : {};
  const patch = {};
  if ('is_portfolio' in src) patch.is_portfolio = src.is_portfolio === true || src.is_portfolio === 'true';
  if ('is_public' in src) patch.is_public = src.is_public === true || src.is_public === 'true';
  if ('title' in src) patch.title = sanitizeShowcaseText(src.title, 120);
  if ('caption' in src) patch.caption = sanitizeShowcaseText(src.caption, 400);
  return patch;
}

/**
 * Path file di bucket showcase. WAJIB diawali userId (RLS "showcase owner insert").
 */
export function showcasePath(userId, assetId, ext) {
  const safeExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5) || 'bin';
  return `${userId}/${assetId}.${safeExt}`;
}

/**
 * Baris showcase -> bentuk untuk klien.
 * `publicUrl` hanya diisi untuk file yang sudah ada di bucket showcase.
 */
export function showcaseRow(r, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  let publicUrl = '';
  if (r.storage_path && base) {
    publicUrl = base + '/storage/v1/object/public/' + SHOWCASE_BUCKET + '/' + r.storage_path;
  }
  return {
    id: r.id,
    assetId: r.asset_id || null,
    slot: r.slot || 'public',
    title: r.title || '',
    caption: r.caption || '',
    mediaType: r.media_type || 'image',
    width: r.width || null,
    height: r.height || null,
    createdAt: r.created_at,
    publicUrl,
    // Signed URL (dipakai halaman owner: Portfolio & Studio).
    signedUrl: r.signedUrl || '',
  };
}

/**
 * Bentapkan daftar aset showcase milik user (dipakai halaman Portfolio & Studio).
 * assets: array baris `assets` (sudah signed) + map showcase per asset.
 */
export function collectShowcaseItems(assets, showcaseRows) {
  const byAsset = new Map();
  for (const r of showcaseRows || []) {
    if (!byAsset.has(r.asset_id)) byAsset.set(r.asset_id, {});
    byAsset.get(r.asset_id)[r.slot] = r;
  }
  const out = [];
  for (const a of assets || []) {
    const slots = byAsset.get(a.id);
    if (!slots) continue;
    for (const slot of SHOWCASE_SLOTS) {
      const row = slots[slot];
      if (!row) continue;
      out.push({
        assetId: a.id,
        slot,
        title: row.title || a.file_name || 'Aset',
        caption: row.caption || '',
        mediaType: a.media_type,
        width: a.width || null,
        height: a.height || null,
        createdAt: row.created_at,
        // Untuk owner: pakai signed URL dari bucket showcase kalau ada,
        // kalau tidak fallback ke signed URL aset aslinya.
        url: row.signedUrl || a.url || '',
      });
    }
  }
  return out;
}
