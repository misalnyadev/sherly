// D-155: Cloud Publish — validasi post & parse gambar (server/published-posts.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePostInput, parseImageDataUrl, publicFeedRow, isValidPostId, PUBLISH_CATEGORIES, PUBLISH_STATUSES } from '../server/published-posts.js';

test('sanitizePostInput: judul wajib & maks 120, keterangan maks 600', () => {
  assert.equal(sanitizePostInput({}).error, 'Judul karya wajib diisi.');
  assert.equal(sanitizePostInput({ title: '  ' }).error, 'Judul karya wajib diisi.');
  assert.equal(sanitizePostInput({ title: 'x'.repeat(121) }).error, 'Judul maksimal 120 karakter.');
  assert.equal(sanitizePostInput({ title: 'T', caption: 'y'.repeat(601) }).error, 'Keterangan maksimal 600 karakter.');
  const v = sanitizePostInput({ title: '  Reels skincare  ', caption: ' hi ' });
  assert.equal(v.value.title, 'Reels skincare');
  assert.equal(v.value.caption, 'hi');
});

test('sanitizePostInput: kategori & status tak dikenal jatuh ke default aman', () => {
  const v = sanitizePostInput({ title: 'T', category: 'viral', status: 'publik' });
  assert.equal(v.value.category, 'foto');
  assert.equal(v.value.status, 'draft');
  const ok = sanitizePostInput({ title: 'T', category: 'reels', status: 'live' });
  assert.equal(ok.value.category, 'reels');
  assert.equal(ok.value.status, 'live');
});

test('sanitizePostInput: terjadwal wajib tanggal valid, dinormalisasi ISO; status lain publish_at null', () => {
  assert.equal(sanitizePostInput({ title: 'T', status: 'scheduled' }).error, 'Pilih tanggal & jam tayang dulu untuk status Terjadwal.');
  assert.equal(sanitizePostInput({ title: 'T', status: 'scheduled', publish_at: 'bukan-tanggal' }).error, 'Pilih tanggal & jam tayang dulu untuk status Terjadwal.');
  const v = sanitizePostInput({ title: 'T', status: 'scheduled', publish_at: '2026-12-01T10:00' });
  assert.equal(v.value.publish_at, new Date('2026-12-01T10:00').toISOString());
  const live = sanitizePostInput({ title: 'T', status: 'live', publish_at: '2026-12-01T10:00' });
  assert.equal(live.value.publish_at, null);
  const jauh = sanitizePostInput({ title: 'T', status: 'scheduled', publish_at: '2099-01-01T00:00' });
  assert.equal(jauh.error, 'Jadwal tayang maksimal 2 tahun ke depan.');
});

test('parseImageDataUrl: format, ukuran, dan hasil buffer', () => {
  assert.equal(parseImageDataUrl('').error, 'Gambar tidak valid — gunakan JPG, PNG, atau WebP.');
  assert.equal(parseImageDataUrl('data:image/gif;base64,AAAA').error, 'Gambar tidak valid — gunakan JPG, PNG, atau WebP.');
  assert.equal(parseImageDataUrl('data:image/png;base64,AAAA').error.includes('terlalu kecil'), true);
  const png = 'data:image/png;base64,' + 'A'.repeat(200);
  const ok = parseImageDataUrl(png);
  assert.equal(ok.error, undefined);
  assert.equal(ok.mime, 'image/png');
  assert.equal(ok.ext, 'png');
  assert.ok(Buffer.isBuffer(ok.buffer) && ok.buffer.length > 0);
  const jpg = parseImageDataUrl('data:image/jpeg;base64,' + 'A'.repeat(100));
  assert.equal(jpg.ext, 'jpg');
  assert.equal(parseImageDataUrl('data:image/png;base64,' + 'A'.repeat(7 * 1024 * 1024)).error, 'Gambar terlalu besar (maks 5 MB).');
});

test('PUBLISH whitelist kategori & status lengkap', () => {
  assert.deepEqual(PUBLISH_CATEGORIES, ['foto', 'reels', 'artikel']);
  assert.deepEqual(PUBLISH_STATUSES, ['draft', 'scheduled', 'live', 'archived']);
});

test('isValidPostId: hanya uuid Supabase yang lolos', () => {
  assert.equal(isValidPostId('0b6c2b1e-5c3a-4d8e-9f2a-3c4d5e6f7a89'), true);
  assert.equal(isValidPostId('0B6C2B1E-5C3A-4D8E-9F2A-3C4D5E6F7A89'), true);
  assert.equal(isValidPostId('bukan-uuid'), false);
  assert.equal(isValidPostId('../api/../x'), false);
  assert.equal(isValidPostId(''), false);
  assert.equal(isValidPostId(null), false);
  assert.equal(isValidPostId(42), false);
});

test('publicFeedRow: bentuk aman utk anon — body hanya utk artikel, publicUrl dari baseUrl', () => {
  const artikel = publicFeedRow({ id: 'i1', title: 'Naskah Final', caption: 'cap', category: 'artikel', publish_at: '2026-11-01T00:00:00Z', created_at: '2026-10-30T00:00:00Z', storage_path: 'u1/a.jpg', view_count: 12, body: 'isi artikel' }, 'https://x.supabase.co/');
  assert.equal(artikel.body, 'isi artikel');
  assert.equal(artikel.viewCount, 12);
  assert.equal(artikel.publicUrl, 'https://x.supabase.co/storage/v1/object/public/published/u1/a.jpg');
  assert.equal(artikel.publish_at, '2026-11-01T00:00:00Z');
  // foto/reels: body disembunyikan walau ada isinya
  const foto = publicFeedRow({ id: 'i2', title: 'Kopi', caption: '', category: 'foto', publish_at: null, created_at: 'c', storage_path: null, view_count: '0', body: 'catatan pribadi' }, 'https://x.supabase.co');
  assert.equal(foto.body, null);
  assert.equal(foto.publicUrl, '');
  assert.equal(foto.viewCount, 0);
  assert.equal(foto.caption, '');
  // baseUrl kotor (trailing slash) tetap dibersihkan; tanpa baseUrl tidak crash
  assert.equal(publicFeedRow({ id: 'i3', category: 'reels', storage_path: 'u/b.png' }, 'https://x.supabase.co///').publicUrl, 'https://x.supabase.co/storage/v1/object/public/published/u/b.png');
  assert.equal(publicFeedRow({ id: 'i4', category: 'reels', storage_path: 'u/b.png' }, '').publicUrl, '');
});

test('sanitizePostInput: body dipotong di batas PUBLISH_BODY_MAX', () => {
  const v = sanitizePostInput({ title: 'T', status: 'live', body: 'x'.repeat(21000) });
  assert.equal(v.value.body.length, 20000);
  assert.equal(sanitizePostInput({ title: 'T' }).value.body, null);
});
