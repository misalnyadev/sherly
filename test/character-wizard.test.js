import { test } from 'node:test';
import assert from 'node:assert/strict';

const { sanitizeTraits, parseVisionTraits, visionTraitsPrompt, boardPrompt, TRAIT_FIELDS, TRAIT_LABELS } = await import('../server/character-wizard.js');

test('sanitizeTraits: whitelist kunci, buang kosong & non-string, kap panjang', () => {
  const out = sanitizeTraits({
    faceShape: '  oval dengan rahang lembut  ', eyes: 'dark brown besar', hack: 'x',
    hair: '', nose: 42, lips: 'x'.repeat(400),
  });
  assert.deepEqual(Object.keys(out).sort(), ['eyes', 'faceShape', 'lips']);
  assert.equal(out.faceShape, 'oval dengan rahang lembut');
  assert.equal(out.lips.length, 300);
});

test('sanitizeTraits: input bukan objek -> objek kosong', () => {
  assert.deepEqual(sanitizeTraits(null), {});
  assert.deepEqual(sanitizeTraits('abc'), {});
  assert.deepEqual(sanitizeTraits(['a']), {});
});

test('parseVisionTraits: JSON bersih', () => {
  const t = parseVisionTraits('{"faceShape":"oval","skin":"sawo matang netral"}');
  assert.deepEqual(t, { faceShape: 'oval', skin: 'sawo matang netral' });
});

test('parseVisionTraits: JSON dalam fence + teks di sekelilingnya', () => {
  const t = parseVisionTraits('Berikut hasilnya:\n```json\n{"hair":"hitam berlayer panjang","eyes":"cokelat gelap"}\n```\nSemoga membantu!');
  assert.deepEqual(t, { hair: 'hitam berlayer panjang', eyes: 'cokelat gelap' });
});

test('parseVisionTraits: kunci asing dibuang, JSON pertama dipakai', () => {
  const t = parseVisionTraits('{"hijab":"tidak ada","bogus":"hapus aku","mark":"tahi lalat kecil di pipi kiri"}');
  assert.deepEqual(t, { hijab: 'tidak ada', mark: 'tahi lalat kecil di pipi kiri' });
});

test('parseVisionTraits: teks bukan JSON -> error 502', () => {
  assert.throws(() => parseVisionTraits('Maaf, saya tidak bisa melihat fotonya.'), /tidak bisa dibaca/);
  assert.throws(() => parseVisionTraits(''), /kosong/);
});

test('visionTraitsPrompt menyebut semua field traits dan minta JSON saja', () => {
  const p = visionTraitsPrompt();
  for (const f of TRAIT_FIELDS) assert.ok(p.includes('"' + f + '"'), 'kurang field ' + f);
  assert.ok(/HANYA satu objek JSON/.test(p));
});

test('boardPrompt: identitas + instruksi 3 panel, error saat kosong', () => {
  const b = boardPrompt('Perempuan Indonesia, rambut hitam berlayer.');
  assert.ok(b.includes('Perempuan Indonesia'));
  assert.ok(/full body/.test(b) && /close-up macro/.test(b));
  assert.throws(() => boardPrompt('   '), /Master identity prompt/);
});

test('TRAIT_FIELDS & LABELS konsisten', () => {
  assert.equal(TRAIT_FIELDS.length, 17);
  for (const f of TRAIT_FIELDS) assert.ok(TRAIT_LABELS[f], 'label kurang untuk ' + f);
});
