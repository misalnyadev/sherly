// D-152: Editor — validasi dokumen (server/editor-docs.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDocInput, docToMeta, EDITOR_DOC_TYPES, EDITOR_STATUSES } from '../server/editor-docs.js';

test('sanitizeDocInput: judul wajib, dipangkas spasi, maks 120', () => {
  assert.equal(sanitizeDocInput({}).error, 'Judul dokumen wajib diisi.');
  assert.equal(sanitizeDocInput({ title: '   ' }).error, 'Judul dokumen wajib diisi.');
  assert.equal(sanitizeDocInput({ title: 'x'.repeat(121) }).error, 'Judul maksimal 120 karakter.');
  const v = sanitizeDocInput({ title: '  Reels skincare  ' });
  assert.equal(v.value.title, 'Reels skincare');
});

test('sanitizeDocInput: jenis & status tak dikenal jatuh ke default aman', () => {
  const v = sanitizeDocInput({ title: 'T', doc_type: 'Jenis Ngawur', status: 'publik' });
  assert.equal(v.value.doc_type, 'Catatan Bebas');
  assert.equal(v.value.status, 'draft');
  const ok = sanitizeDocInput({ title: 'T', doc_type: 'Caption IG', status: 'final' });
  assert.equal(ok.value.doc_type, 'Caption IG');
  assert.equal(ok.value.status, 'final');
});

test('sanitizeDocInput: isi maksimal 20.000 karakter, bukan string tetap aman', () => {
  assert.equal(sanitizeDocInput({ title: 'T', body: 'x'.repeat(20001) }).error, 'Isi dokumen maksimal 20.000 karakter.');
  const v = sanitizeDocInput({ title: 'T', body: null });
  assert.equal(v.value.body, '');
  const num = sanitizeDocInput({ title: 'T', body: 123 });
  assert.equal(num.value.body, '123');
});

test('EDITOR whitelist lengkap & konsisten', () => {
  assert.deepEqual(EDITOR_STATUSES, ['draft', 'review', 'final']);
  assert.ok(EDITOR_DOC_TYPES.includes('Caption IG'));
  assert.ok(EDITOR_DOC_TYPES.includes('Catatan Bebas'));
  assert.equal(EDITOR_DOC_TYPES.length, 6);
});

test('docToMeta: hitung kata & teruskan field meta', () => {
  const m = docToMeta({ id: 'd1', title: 'Judul', doc_type: 'Artikel', status: 'review', body: 'satu dua  tiga\nempat', created_at: 'c', updated_at: 'u' });
  assert.equal(m.words, 4);
  assert.equal(m.id, 'd1');
  assert.equal(m.status, 'review');
  assert.equal(docToMeta({ id: 'd2', body: '   ' }).words, 0);
});
