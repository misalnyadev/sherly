// D-263 — Upload aset LANGSUNG ke Supabase Storage (bypass batas 4,5 MB Vercel)
// + HP horizontal 3 grid.
//
// Latar belakang: Vercel serverless membatasi request body 4,5 MB (batas
// infrastruktur — tidak bisa dinaikkan lewat vercel.json). File yang lebih
// besar selalu ditolak 413 sebelum sampai ke route Express. Solusinya:
// browser mengunggah file LANGSUNG ke Supabase Storage memakai signed upload
// URL; yang lewat server hanya metadata kecil.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STUDIO_BUCKET, MAX_ASSET_BYTES, ASSET_MIME,
  assetPath, createAssetUploadTicket, registerUploadedAsset,
  safeFileName, extForMime, mediaKind,
} from '../server/studio-assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ===== Server: assetPath =====

test('D-263: assetPath diawali userId (syarat RLS studio-assets)', () => {
  const p = assetPath('user-123', 'foto besar.png', 'image/png');
  assert.ok(p.startsWith('user-123/'), 'path harus diawali userId demi RLS');
  assert.ok(p.endsWith('.png'), 'ekstensi harus sesuai mime');
  assert.ok(!p.includes(' '), 'nama file harus disanitasi');
});

test('D-263: assetPath memberi nama unik tiap panggilan', () => {
  const a = assetPath('u1', 'a.png', 'image/png');
  const b = assetPath('u1', 'a.png', 'image/png');
  assert.notEqual(a, b, 'path harus unik (tidak menimpa aset lama)');
});

test('D-263: assetPath memakai ekstensi benar untuk tiap mime', () => {
  assert.ok(assetPath('u', 'a.mp4', 'video/mp4').endsWith('.mp4'));
  assert.ok(assetPath('u', 'a.webm', 'video/webm').endsWith('.webm'));
  assert.ok(assetPath('u', 'a.mov', 'video/quicktime').endsWith('.mov'));
  assert.ok(assetPath('u', 'a.webp', 'image/webp').endsWith('.webp'));
});

// ===== Server: createAssetUploadTicket =====

test('D-263: createAssetUploadTicket menolak mime di luar daftar', async () => {
  const sb = { storage: { from: () => ({ createSignedUploadUrl: async () => ({ data: null, error: null }) }) } };
  await assert.rejects(
    () => createAssetUploadTicket(sb, 'u1', { fileName: 'x.exe', mime: 'application/x-msdownload' }),
    /Format aset harus/,
    'mime terlarang harus ditolak',
  );
  await assert.rejects(
    () => createAssetUploadTicket(sb, 'u1', { fileName: 'x.pdf', mime: 'application/pdf' }),
    /Format aset harus/,
    'pdf harus ditolak',
  );
});

test('D-263: createAssetUploadTicket memakai token user & path berawalan uid', async () => {
  const seen = {};
  const sb = {
    storage: {
      from: (bucket) => ({
        createSignedUploadUrl: async (p) => {
          seen.bucket = bucket; seen.path = p;
          return { data: { token: 'tok-123', signedUrl: 'https://x/upload/sign?token=tok-123' }, error: null };
        },
      }),
    },
  };
  const t = await createAssetUploadTicket(sb, 'user-9', { fileName: 'vid.mp4', mime: 'video/mp4' });
  assert.equal(seen.bucket, STUDIO_BUCKET, 'harus pakai bucket studio-assets');
  assert.ok(t.path.startsWith('user-9/'), 'path harus diawali uid');
  assert.equal(t.token, 'tok-123', 'token harus diteruskan ke klien');
  assert.ok(t.signedUrl, 'signedUrl harus dikembalikan');
});

test('D-263: createAssetUploadTicket melaporkan error Supabase', async () => {
  const sb = {
    storage: {
      from: () => ({ createSignedUploadUrl: async () => ({ data: null, error: { message: 'bucket tidak ada' } }) }),
    },
  };
  await assert.rejects(
    () => createAssetUploadTicket(sb, 'u1', { fileName: 'a.png', mime: 'image/png' }),
    /bucket tidak ada/,
    'error Supabase harus diteruskan',
  );
});

// ===== Server: registerUploadedAsset =====

test('D-263: registerUploadedAsset menolak path di luar folder user', async () => {
  const sb = { from: () => ({ insert: async () => ({ data: null, error: { message: 'x' } }) }) };
  await assert.rejects(
    () => registerUploadedAsset(sb, 'user-9', { path: 'orang-lain/a.png', fileName: 'a.png', mime: 'image/png' }),
    /Path aset tidak valid/,
    'path harus milik user (RLS)',
  );
});

test('D-263: registerUploadedAsset menyimpan baris assets yang benar', async () => {
  let inserted = null;
  // supabase-js chain: insert(row).select('*').single()
  const sb = {
    from: (table) => ({
      insert: (row) => {
        inserted = { table, row };
        return { select: () => ({ single: async () => ({ data: { id: 'a1', ...row }, error: null }) }) };
      },
    }),
    storage: { from: () => ({ remove: async () => ({}) }) },
  };
  const row = await registerUploadedAsset(sb, 'user-9', {
    path: 'user-9/123-foto.png',
    fileName: 'foto.png',
    mime: 'image/png',
    width: 1080, height: 1920,
  });
  assert.equal(inserted.table, 'assets', 'harus insert ke tabel assets');
  assert.equal(inserted.row.user_id, 'user-9');
  assert.equal(inserted.row.file_path, 'user-9/123-foto.png');
  assert.equal(inserted.row.media_type, 'image');
  assert.equal(inserted.row.kind, 'upload');
  assert.equal(inserted.row.width, 1080);
  assert.equal(inserted.row.height, 1920);
  assert.equal(row.id, 'a1');
});

test('D-263: registerUploadedAsset menghapus file Storage bila insert gagal', async () => {
  const removed = [];
  const sb = {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'kena RLS' } }) }) }),
    }),
    storage: { from: () => ({ remove: async (paths) => { removed.push(...paths); return {}; } }) },
  };
  await assert.rejects(
    () => registerUploadedAsset(sb, 'user-9', { path: 'user-9/a.png', fileName: 'a.png', mime: 'image/png' }),
    /Gagal mencatat aset/,
  );
  assert.deepEqual(removed, ['user-9/a.png'], 'file yatim harus dibersihkan');
});

test('D-263: registerUploadedAsset menolak dimensi tidak valid (null)', async () => {
  let inserted = null;
  const sb = {
    from: () => ({
      insert: (row) => {
        inserted = row;
        return { select: () => ({ single: async () => ({ data: { id: 'x', ...row }, error: null }) }) };
      },
    }),
    storage: { from: () => ({ remove: async () => ({}) }) },
  };
  await registerUploadedAsset(sb, 'u', { path: 'u/a.png', fileName: 'a.png', mime: 'image/png', width: 'abc', height: -5 });
  assert.equal(inserted.width, null);
  assert.equal(inserted.height, null);
});

// ===== Batas ukuran =====

test('D-263: batas aset 25 MB (bucket storage.file_size_limit)', () => {
  assert.equal(MAX_ASSET_BYTES, 25 * 1024 * 1024, 'batas harus 25 MB');
  assert.ok(MAX_ASSET_BYTES > 8 * 1024 * 1024, 'harus bisa menerima file > 8 MB');
});

test('D-263: daftar mime aset mencakup foto & video', () => {
  for (const m of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']) {
    assert.ok(ASSET_MIME.includes(m), `mime ${m} harus diizinkan`);
  }
  assert.equal(mediaKind('video/mp4'), 'video');
  assert.equal(mediaKind('image/png'), 'image');
});

// ===== Client: jalur upload langsung =====

test('D-263: klien memakai jalur langsung untuk file besar (> 4 MB)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');
  const fn = js.slice(js.indexOf('async function uploadAsset('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('DIRECT_UPLOAD_MIN'), 'harus ada ambang jalur langsung');
  assert.ok(body.includes('file.size >= DIRECT_UPLOAD_MIN'), 'file besar harus pakai jalur langsung');
  assert.ok(body.includes('uploadAssetDirect(file)'), 'file besar memanggil uploadAssetDirect');
  // Ambang harus di bawah batas Vercel 4,5 MB -> file 5-25 MB aman.
  assert.ok(body.includes('4 * 1024 * 1024'), 'ambang 4 MB (di bawah batas Vercel 4,5 MB)');
});

test('D-263: uploadBlobDirect memakai protokol signed upload Supabase', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');
  const fn = js.slice(js.indexOf('async function uploadBlobDirect('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  // 1) Ticket dari server (JSON kecil).
  assert.ok(body.includes('/api/studio/assets/upload-ticket'), 'harus minta upload ticket');
  assert.ok(body.includes("'Content-Type': 'application/json'"), 'ticket dikirim sebagai JSON');
  // 2) PUT ke Supabase Storage, BUKAN lewat /api.
  assert.ok(body.includes('/storage/v1/object/upload/sign/'), 'harus PUT ke signed upload URL');
  assert.ok(body.includes("method: 'PUT'"), 'method harus PUT');
  assert.ok(body.includes('?token='), 'token signed harus ikut di query');
  assert.ok(body.includes("up.append('cacheControl'"), 'FormData harus punya cacheControl');
  assert.ok(body.includes("up.append('', blob"), 'file di-append dengan nama field kosong (protokol SDK)');
  assert.ok(body.includes("'x-upsert': 'false'"), 'header x-upsert wajib');
  // 3) Catat metadata (JSON kecil).
  assert.ok(body.includes('/api/studio/assets/direct'), 'harus catat metadata ke server');
  // Pesan error harus informatif.
  assert.ok(body.includes('Gagal mengunggah file ke penyimpanan'), 'error upload harus punya pesan');
  // Batas 25 MB (bucket) harus dihormati sebelum upload.
  assert.ok(body.includes('maxBytes'), 'harus cek batas ukuran dari server');
});

test('D-263: Motion Graphics besar ikut jalur langsung (bypass batas Vercel)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');
  const fn = js.slice(js.indexOf('async function renderMotionGraphicsClient('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes('uploadBlobDirect(result.blob'), 'MG besar harus pakai jalur langsung');
  assert.ok(body.includes("result.blob.size >= 4 * 1024 * 1024"), 'ambang 4 MB harus dipakai');
  assert.ok(body.includes("kind: 'generate'"), 'MG harus tercatat sebagai generate');
  // Jalur multipart lama tetap ada untuk file kecil.
  assert.ok(body.includes('/api/studio/motion-graphics/asset'), 'jalur MG lama tetap ada');
});

test('D-263: registerUploadedAsset menghormati kind (generate/upload)', async () => {
  let inserted = null;
  const mk = () => ({
    from: () => ({
      insert: (row) => {
        inserted = row;
        return { select: () => ({ single: async () => ({ data: { id: 'x', ...row }, error: null }) }) };
      },
    }),
    storage: { from: () => ({ remove: async () => ({}) }) },
  });
  await registerUploadedAsset(mk(), 'u', { path: 'u/a.mp4', fileName: 'a.mp4', mime: 'video/mp4', kind: 'generate' });
  assert.equal(inserted.kind, 'generate', 'MG harus kind generate');
  await registerUploadedAsset(mk(), 'u', { path: 'u/b.png', fileName: 'b.png', mime: 'image/png' });
  assert.equal(inserted.kind, 'upload', 'default harus upload');
});

test('D-263: file kecil tetap lewat multipart (jalur lama tetap hidup)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');
  const fn = js.slice(js.indexOf('async function uploadAsset('));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(body.includes("fetch('/api/studio/assets', { method: 'POST'"), 'multipart lama tetap ada');
  assert.ok(body.includes('fd.append(\'file\', file)'), 'file tetap dikirim sebagai multipart');
});

// ===== Server: route =====

test('D-263: server punya route upload-ticket & direct', () => {
  const app = fs.readFileSync(path.join(ROOT, 'server/app.js'), 'utf8');
  assert.ok(app.includes("app.post('/api/studio/assets/upload-ticket'"), 'route upload-ticket harus ada');
  assert.ok(app.includes("app.post('/api/studio/assets/direct'"), 'route direct harus ada');
  // Route harus pakai requireUser + requireAdmin (data privat).
  const tIdx = app.indexOf("app.post('/api/studio/assets/upload-ticket'");
  assert.ok(app.slice(tIdx, tIdx + 200).includes('requireUser'), 'upload-ticket wajib requireUser');
  assert.ok(app.slice(tIdx, tIdx + 200).includes('requireAdmin'), 'upload-ticket wajib requireAdmin');
  const dIdx = app.indexOf("app.post('/api/studio/assets/direct'");
  assert.ok(app.slice(dIdx, dIdx + 200).includes('requireUser'), 'direct wajib requireUser');
  // Ticket mengembalikan maxBytes & storageUrl supaya klien bisa upload.
  const tBody = app.slice(tIdx, tIdx + 900);
  assert.ok(tBody.includes('maxBytes: MAX_ASSET_BYTES'), 'ticket harus kirim maxBytes');
  assert.ok(tBody.includes('storageUrl'), 'ticket harus kirim storageUrl');
  assert.ok(tBody.includes('bucket: STUDIO_BUCKET'), 'ticket harus kirim nama bucket');
});

// ===== D-263: HP horizontal 3 grid =====

test('D-263: HP horizontal 3 grid (mincol 115px)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  assert.ok(
    /@media\(max-width:560px\)\{\.st-gallery\{--st-gal-gap:9px\}/.test(css),
    'blok HP harus ada',
  );
  // mincol 115px -> floor((364+9)/(115+9)) = 3 kolom.
  assert.ok(css.includes('.st-gal-row--horizontal{--st-gal-mincol:115px;--st-gal-maxcol:260px}'),
    'HP horizontal harus mincol 115px (3 grid)');
  assert.ok(!css.includes('.st-gal-row--horizontal{--st-gal-mincol:132px;--st-gal-maxcol:260px}'),
    'mincol lama 132px (2 grid) harus diganti');
  // HP vertikal tetap 3 grid (D-256) — tidak ikut berubah.
  assert.ok(css.includes('.st-gal-row--vertical{--st-gal-mincol:96px;--st-gal-maxcol:180px}'),
    'HP vertikal tetap 3 grid');
  // PC tidak berubah (D-262: horizontal 4 grid, vertikal 7 grid).
  assert.ok(css.includes('.st-gal-row--horizontal{--st-gal-mincol:220px;--st-gal-maxcol:260px}'),
    'PC horizontal tetap 4 grid');
});

// ===== Sanitasi nama file =====

test('D-263: nama file disanitasi untuk path Storage', () => {
  assert.equal(safeFileName('../../etc/passwd'), 'etc-passwd');
  assert.equal(safeFileName('foto saya.png'), 'foto-saya');
  assert.equal(extForMime('image/jpeg'), 'jpg');
  assert.equal(extForMime('video/quicktime'), 'mov');
});
