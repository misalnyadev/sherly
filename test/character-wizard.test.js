import { test } from 'node:test';
import assert from 'node:assert/strict';

const { sanitizeTraits, parseVisionTraits, visionTraitsPrompt, boardPrompt, resolveBoardPrompt, biblePrompt, sanitizeVoiceProfile, TRAIT_FIELDS, TRAIT_LABELS } = await import('../server/character-wizard.js');

test('sanitizeTraits: whitelist kunci, buang kosong & non-string, kap panjang', () => {
  const out = sanitizeTraits({
    faceShape: '  oval dengan rahang lembut  ', eyes: 'dark brown besar', hack: 'x',
    hair: '', nose: 42, lips: 'x'.repeat(400),
  });
  assert.deepEqual(Object.keys(out).sort(), ['eyes', 'faceShape', 'lips']);
  assert.equal(out.faceShape, 'oval dengan rahang lembut');
  assert.equal(out.lips.length, 300);
});

test('sanitizeTraits: gender & tinggi (form basics, D-105) ikut tersimpan di traits', () => {
  const out = sanitizeTraits({ gender: 'Perempuan', height: '±165 cm', faceShape: 'oval', hack: 'x' });
  assert.equal(out.gender, 'Perempuan');
  assert.equal(out.height, '±165 cm');
  assert.equal(out.faceShape, 'oval');
  assert.ok(!('hack' in out));
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

test('resolveBoardPrompt: prompt sheet lengkap dari klien dipakai apa adanya', () => {
  const full = 'IDENTITY LOCK — karakter Rara.\n\nMASTER CHARACTER BOARD — buat satu lembar referensi karakter dengan tiga panel bergrid rapi.';
  assert.equal(resolveBoardPrompt(full), full);
});

test('resolveBoardPrompt: engine AK Talent (D-104) dipakai apa adanya', () => {
  const full = 'You are an automatic character-sheet engine. You receive ONE reference image…\nSHEET PROMPT\n"Single landscape (16:9) professional character reference sheet…"';
  assert.equal(resolveBoardPrompt(full), full);
});

test('resolveBoardPrompt: identitas polos dibungkus instruksi sheet', () => {
  const p = resolveBoardPrompt('Perempuan Indonesia, rambut hitam.');
  assert.ok(p.includes('Perempuan Indonesia, rambut hitam.'));
  assert.ok(p.includes('MASTER CHARACTER BOARD'));
  assert.ok(p.includes('tiga panel'));
});

test('resolveBoardPrompt: kosong tetap melempar error jelas', () => {
  assert.throws(() => resolveBoardPrompt('   '), /Master identity prompt/);
});

test('TRAIT_FIELDS & LABELS konsisten', () => {
  assert.equal(TRAIT_FIELDS.length, 17);
  for (const f of TRAIT_FIELDS) assert.ok(TRAIT_LABELS[f], 'label kurang untuk ' + f);
});

test('sanitizeVoiceProfile: whitelist + kap panjang', () => {
  const v = sanitizeVoiceProfile({ name: '  Kore ', style: 'hangat, ramah', script: 'Halo!', bogus: 'x', name2: 42 });
  assert.deepEqual(v, { name: 'Kore', style: 'hangat, ramah', script: 'Halo!' });
  assert.deepEqual(sanitizeVoiceProfile(null), {});
  const long = sanitizeVoiceProfile({ style: 'x'.repeat(500) });
  assert.equal(long.style.length, 180);
});

test('biblePrompt: memuat profil, traits, dan suara terkunci', () => {
  const p = biblePrompt({
    name: 'Sherly', role: 'Lifestyle Creator', age: '24', origin: 'Indonesia',
    appearance: 'Perempuan Indonesia, rambut hitam.', personality: 'Ceria.',
    identity_prompt: 'IDENTITY LOCK — wajah konsisten.',
    niche: ['Lifestyle', 'Beauty'], traits: { faceShape: 'oval', hijab: 'tidak ada' },
    voice: { name: 'Kore', style: 'hangat', script: 'Halo semua!' },
  });
  assert.ok(p.includes('Nama: Sherly'));
  assert.ok(p.includes('Bentuk wajah: oval'));
  assert.ok(p.includes('Hijab: tidak ada'));
  assert.ok(p.includes('voice Gemini "Kore"'));
  assert.ok(p.includes('## Kunci Konsistensi'));
  assert.ok(/maksimal ±600 kata/.test(p));
});

test('biblePrompt: data kacau tidak meledak', () => {
  const p = biblePrompt(null);
  assert.ok(p.includes('(tanpa nama)'));
});
