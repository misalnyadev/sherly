// ===== D-198: Galeri Aset Studio + Engine Video =====
//
// Semua media Studio (hasil generate foto/video maupun hasil upload) disimpan
// sebagai ASET di bucket "studio-assets" + tabel public.assets.
// Galeri grid di atas komposer menampilkan daftar aset tersebut; aset bisa
// dipakai ulang sebagai referensi, diunduh, di-preview, atau dikirim ke Editor Video.
//
// Video generation berjalan sebagai TASK (tabel public.sherly_video_tasks)
// karena batas maxDuration server (60 dtk) lebih pendek dari durasi generate video.

export const STUDIO_BUCKET = 'studio-assets';

/** Batas ukuran upload aset (25 MB). */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/** MIME yang diizinkan untuk aset (foto + video). */
export const ASSET_MIME = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
];

/** Turunkan jenis media dari mime. */
export function mediaKind(mime) {
  return /^video\//i.test(String(mime || '')) ? 'video' : 'image';
}

/** Sanitasi nama file agar aman untuk path Storage. */
export function safeFileName(name) {
  const base = String(name || 'aset')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'aset';
  return base;
}

/** Ekstensi file untuk mime. */
export function extForMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  return 'bin';
}

/**
 * Simpan satu aset ke Storage + tabel public.assets.
 * file: { buffer, mimetype, originalname }
 */
export async function saveAsset(supabase, userId, file, opts = {}) {
  if (!file || !file.buffer || !file.buffer.length) {
    throw Object.assign(new Error('File aset kosong.'), { status: 400 });
  }
  const mime = String(file.mimetype || 'application/octet-stream').toLowerCase();
  if (!ASSET_MIME.includes(mime)) {
    throw Object.assign(new Error('Format aset harus JPG, PNG, WebP, GIF, MP4, WebM, atau MOV.'), { status: 400 });
  }
  if (file.buffer.length > MAX_ASSET_BYTES) {
    throw Object.assign(new Error('Ukuran aset melebihi 25 MB.'), { status: 400 });
  }
  const kind = mediaKind(mime);
  const ext = extForMime(mime);
  const name = safeFileName(file.originalname);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}.${ext}`;
  const { error: upErr } = await supabase.storage.from(STUDIO_BUCKET).upload(path, file.buffer, {
    contentType: mime, upsert: false,
  });
  if (upErr) throw Object.assign(new Error('Gagal menyimpan aset: ' + upErr.message), { status: 500 });
  const meta = opts.meta && typeof opts.meta === 'object' ? opts.meta : {};
  const row = {
    user_id: userId,
    file_path: path,
    file_name: String(file.originalname || name + '.' + ext).slice(0, 200),
    media_type: kind,
    alt_text: String(opts.altText || opts.prompt || '').slice(0, 400),
    kind: opts.kind === 'generate' ? 'generate' : 'upload',
    prompt: String(opts.prompt || '').slice(0, 2000),
    meta,
    width: Number.isFinite(opts.width) ? opts.width : null,
    height: Number.isFinite(opts.height) ? opts.height : null,
    duration_ms: Number.isFinite(opts.durationMs) ? Math.round(opts.durationMs) : null,
  };
  const { data, error } = await supabase.from('assets').insert(row).select('*').single();
  if (error) {
    await supabase.storage.from(STUDIO_BUCKET).remove([path]).catch(() => {});
    throw Object.assign(new Error('Gagal mencatat aset: ' + error.message), { status: 500 });
  }
  return data;
}

/**
 * Simpan aset hasil generate (bukan upload) — sumbernya base64 dari model.
 * data: base64 string, mime: string
 */
export async function saveGeneratedAsset(supabase, userId, { data, mime, prompt, meta, width, height, durationMs, fileName }) {
  if (typeof data !== 'string' || data.length < 8) {
    throw Object.assign(new Error('Data aset hasil generate kosong.'), { status: 400 });
  }
  const cleanMime = ASSET_MIME.includes(mime) ? mime : 'image/png';
  const buffer = Buffer.from(data, 'base64');
  return saveAsset(supabase, userId, {
    buffer,
    mimetype: cleanMime,
    originalname: fileName || ('studio-' + Date.now() + '.' + extForMime(cleanMime)),
  }, { kind: 'generate', prompt, meta, width, height, durationMs });
}

// ===== D-263: Upload langsung ke Supabase Storage (bypass batas Vercel) =====
//
// Vercel serverless punya batas request body 4,5 MB yang TIDAK bisa Dinaikkan
// (batas infrastruktur, bukan setting aplikasi). File yang lebih besar akan
// ditolak platform dengan 413 sebelum sampai ke route Express.
//
// Solusi: browser mengunggah file LANGSUNG ke Supabase Storage memakai
// "signed upload URL" (token sekali pakai yang dibuat server). Yang lewat
// server hanya metadata kecil (JSON) untuk membuat baris tabel `assets`.
//
// Bucket `studio-assets` sudah punya RLS "studio asset owner insert":
//   bucket_id = 'studio-assets' AND foldername(name)[1] = auth.uid()
// → path WAJIB diawali userId. Signed URL dibuat server memakai token user
//   yang sama, jadi RLS tetap berlaku.

/** Susun path Storage untuk aset (harus diawali userId demi RLS). */
export function assetPath(userId, fileName, mime) {
  const name = safeFileName(fileName);
  const ext = extForMime(mime);
  return `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}.${ext}`;
}

/**
 * Buat signed upload URL + token supaya browser bisa PUT file langsung ke
 * Supabase Storage tanpa melewati batas 4,5 MB Vercel.
 * @returns {{ path: string, token: string, signedUrl: string }}
 */
export async function createAssetUploadTicket(supabase, userId, { fileName, mime }) {
  const cleanMime = ASSET_MIME.includes(String(mime || '').toLowerCase())
    ? String(mime).toLowerCase()
    : null;
  if (!cleanMime) {
    throw Object.assign(new Error('Format aset harus JPG, PNG, WebP, GIF, MP4, WebM, atau MOV.'), { status: 400 });
  }
  const path = assetPath(userId, fileName, cleanMime);
  const { data, error } = await supabase.storage.from(STUDIO_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    throw Object.assign(new Error('Gagal menyiapkan upload: ' + (error?.message || 'token kosong')), { status: 500 });
  }
  return { path, token: data.token, signedUrl: data.signedUrl || null };
}

/**
 * Catat aset yang SUDAH terunggah langsung ke Storage (jalur D-263).
 * File tidak ikut lewat server — cukup path-nya.
 */
export async function registerUploadedAsset(supabase, userId, { path, fileName, mime, width, height, durationMs, prompt, meta, kind }) {
  const cleanMime = ASSET_MIME.includes(String(mime || '').toLowerCase())
    ? String(mime).toLowerCase()
    : 'application/octet-stream';
  // Path WAJIB di folder user (RLS "studio asset owner insert").
  if (!String(path || '').startsWith(userId + '/')) {
    throw Object.assign(new Error('Path aset tidak valid.'), { status: 400 });
  }
  const mediaType = mediaKind(cleanMime);
  const row = {
    user_id: userId,
    file_path: path,
    file_name: String(fileName || path.split('/').pop() || 'aset').slice(0, 200),
    media_type: mediaType,
    alt_text: String(prompt || '').slice(0, 400),
    kind: kind === 'generate' ? 'generate' : 'upload',
    prompt: String(prompt || '').slice(0, 2000),
    meta: meta && typeof meta === 'object' ? meta : {},
    width: Number.isFinite(Number(width)) && Number(width) > 0 ? Number(width) : null,
    height: Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : null,
    duration_ms: Number.isFinite(Number(durationMs)) ? Math.round(Number(durationMs)) : null,
  };
  const { data, error } = await supabase.from('assets').insert(row).select('*').single();
  if (error) {
    // File sudah ada di Storage tapi baris gagal -> jangan simpan file yatim.
    await supabase.storage.from(STUDIO_BUCKET).remove([path]).catch(() => {});
    throw Object.assign(new Error('Gagal mencatat aset: ' + error.message), { status: 500 });
  }
  return data;
}

/** Daftar aset milik user (terbaru dulu) + signed URL. */
export async function listAssets(supabase, userId) {  const { data, error } = await supabase
    .from('assets').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  const rows = Array.isArray(data) ? data : [];
  return Promise.all(rows.map((a) => signedAsset(a, supabase)));
}

/** Satu aset + signed URL (1 jam). */
export async function signedAsset(asset, supabase) {
  if (!asset) return null;
  const out = {
    id: asset.id,
    file_name: asset.file_name,
    media_type: asset.media_type,
    kind: asset.kind || 'upload',
    prompt: asset.prompt || '',
    meta: asset.meta || {},
    width: asset.width || null,
    height: asset.height || null,
    duration_ms: asset.duration_ms || null,
    created_at: asset.created_at,
    url: null,
  };
  if (asset.file_path) {
    try {
      const { data } = await supabase.storage.from(STUDIO_BUCKET).createSignedUrl(asset.file_path, 3600);
      out.url = data?.signedUrl || null;
    } catch { /* signed URL gagal -> aset tetap dikembalikan tanpa url */ }
  }
  return out;
}

/** Hapus aset milik user (baris + file Storage). */
export async function deleteAsset(supabase, userId, id) {
  const { data: row } = await supabase.from('assets').select('*').eq('id', id).maybeSingle();
  if (!row) throw Object.assign(new Error('Aset tidak ditemukan.'), { status: 404 });
  if (row.user_id !== userId) throw Object.assign(new Error('Aset tidak ditemukan.'), { status: 404 });
  await supabase.from('assets').delete().eq('id', id).eq('user_id', userId);
  if (row.file_path) await supabase.storage.from(STUDIO_BUCKET).remove([row.file_path]).catch(() => {});
  return { ok: true };
}

/** Ambil satu aset milik user (untuk dipakai ulang sebagai referensi). */
export async function getAsset(supabase, userId, id) {
  const { data: row } = await supabase.from('assets').select('*').eq('id', id).maybeSingle();
  if (!row || row.user_id !== userId) return null;
  return row;
}

// ===== Task video =====

/** Buat baris task video baru. */
export async function createVideoTask(supabase, userId, patch = {}) {
  const row = {
    user_id: userId,
    provider: String(patch.provider || 'kie'),
    model: String(patch.model || 'veo3_fast'),
    status: 'queued',
    progress: 0,
    prompt: String(patch.prompt || '').slice(0, 2000),
    task_id: patch.taskId ? String(patch.taskId) : null,
    meta: patch.meta && typeof patch.meta === 'object' ? patch.meta : {},
  };
  const { data, error } = await supabase.from('sherly_video_tasks').insert(row).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

/** Update status/progres task (pemilik saja). */
export async function updateVideoTask(supabase, userId, id, patch = {}) {
  const allowed = ['status', 'progress', 'task_id', 'asset_id', 'error'];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  clean.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('sherly_video_tasks')
    .update(clean).eq('id', id).eq('user_id', userId).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return data;
}

/** Ambil task milik user. */
export async function getVideoTask(supabase, userId, id) {
  const { data } = await supabase.from('sherly_video_tasks').select('*').eq('id', id).maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data;
}

/** Daftar task video milik user (terbaru dulu). */
/** D-286: task yang menggantung > 20 menit dianggap mati. */
export const STALE_VIDEO_TASK_MS = 20 * 60 * 1000;

export async function listVideoTasks(supabase, userId, limit = 10) {
  const { data } = await supabase.from('sherly_video_tasks')
    .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  const tasks = Array.isArray(data) ? data : [];
  // D-286: bersihkan task yang menggantung.
  //
  // Task yang tetap "running" lebih dari 20 menit hampir pasti sudah mati
  // (Kie gagal / URL hasil tidak pernah dibaca — bug yang diperbaiki di
  // pollKieVideoTask). Kalau tidak dibersihkan, user melihat spinner
  // selamanya tanpa tahu apa yang terjadi.
  await expireStaleVideoTasks(supabase, userId, tasks);
  return tasks;
}

/**
 * D-286: tandai task video/lipsync yang menggantung sebagai gagal.
 *
 * Batas: 20 menit (lipsync Kie biasanya selesai 1-3 menit; 20 menit sudah
 * jauh melewati batas wajar). Pesan errornya jelas supaya user tahu harus
 * mencoba lagi, bukan menunggu.
 */
export async function expireStaleVideoTasks(supabase, userId, tasks) {
  const now = Date.now();
  const stale = (Array.isArray(tasks) ? tasks : []).filter((t) => {
    if (!t || t.status !== 'running') return false;
    const started = Date.parse(t.created_at || t.updated_at || '');
    if (!Number.isFinite(started)) return false;
    return now - started > STALE_VIDEO_TASK_MS;
  });
  for (const t of stale) {
    await updateVideoTask(supabase, userId, t.id, {
      status: 'fail',
      error: 'Generator tidak selesai dalam 20 menit — task dibatalkan. '
        + 'Coba lagi dengan naskah lebih pendek atau resolusi 480p.',
    }).catch(() => {});
  }
  return stale.map((t) => t.id);
}
