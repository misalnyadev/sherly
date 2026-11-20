import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  parseMentions, buildCharacterPromptBlock, resolveCharacterReferences,
  sanitizeInlineImage, slugifyName, voiceDescriptor,
  MAX_MENTION_CHARACTERS, MAX_REFERENCE_IMAGES,
} = await import('../server/studio-characters.js');

const CHARS = [
  { id: 'c1', name: 'Sherly', identity_prompt: 'Wajah oval, rambut panjang', voice: { name: 'Puck', style: 'ceria' }, reference_image_path: 'u/p1.png', board_path: 'u/b1.png' },
  { id: 'c2', name: 'Novi', identity_prompt: 'Pendek, kulit sawo matang', voice: { name: 'Kore', style: 'tenang' }, reference_image_path: 'u/p2.png', board_path: null },
  { id: 'c3', name: 'Maya', identity_prompt: 'Rambut pendek', voice: {}, reference_image_path: 'u/p3.png', board_path: 'u/b3.png' },
  { id: 'c4', name: 'Raka', identity_prompt: 'Ojak', voice: {}, reference_image_path: null, board_path: null },
];

test('slugifyName: normalisasi nama Indonesia + tanda baca', () => {
  assert.equal(slugifyName('Sherly'), 'sherly');
  assert.equal(slugifyName('Nadia Safira'), 'nadia-safira');
  assert.equal(slugifyName('Novi\'s Blog'), 'novi-s-blog');
  assert.equal(slugifyName('Éclair'), 'eclair');
  assert.equal(slugifyName('  '), '');
});

test('parseMentions: "@nama" di prompt -> karakter yang benar', () => {
  const out = parseMentions('@sherly dan @novi sedang berjalan di GBK', CHARS);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'Sherly');
  assert.equal(out[0].token, '@sherly');
  assert.equal(out[1].name, 'Novi');
});

test('parseMentions: mention tak dikenal diabaikan (tidak error)', () => {
  const out = parseMentions('@sherly dan @orang-hantu', CHARS);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Sherly');
});

test('parseMentions: karakter sama disebut dua kali -> satu kali', () => {
  const out = parseMentions('@sherly jalan, lalu @sherly melambaikan tangan', CHARS);
  assert.equal(out.length, 1);
});

test('parseMentions: batas keras 3 karakter', () => {
  const out = parseMentions('@sherly @novi @maya @raka', CHARS);
  assert.equal(out.length, MAX_MENTION_CHARACTERS);
  assert.equal(out[2].name, 'Maya');
});

test('parseMentions: tanpa "@" atau tanpa karakter -> kosong', () => {
  assert.deepEqual(parseMentions('prompt biasa', CHARS), []);
  assert.deepEqual(parseMentions('@sherly', []), []);
});

test('voiceDescriptor: nama + gaya, salah satu, atau kosong', () => {
  assert.equal(voiceDescriptor({ voice: { name: 'Puck', style: 'ceria' } }), 'Suara: voice Gemini "Puck", gaya bicara: ceria');
  assert.equal(voiceDescriptor({ voice: { name: 'Kore' } }), 'Suara: voice Gemini "Kore"');
  assert.equal(voiceDescriptor({ voice: { style: 'lembut' } }), 'Gaya bicara: lembut');
  assert.equal(voiceDescriptor({ voice: {} }), '');
  assert.equal(voiceDescriptor({}), '');
});

test('buildCharacterPromptBlock: isi identity + suara + label gambar', () => {
  const mentions = parseMentions('@sherly', CHARS);
  const block = buildCharacterPromptBlock(mentions, CHARS);
  assert.match(block, /### Sherly — potret \+ master sheet/);
  assert.match(block, /Wajah oval, rambut panjang/);
  assert.match(block, /Suara: voice Gemini "Puck"/);
  assert.match(block, /master sheet referensi untuk Sherly/);
  assert.match(block, /foto potret resmi Sherly/);
});

test('buildCharacterPromptBlock: karakter tanpa sheet -> hanya potret', () => {
  const mentions = parseMentions('@novi', CHARS);
  const block = buildCharacterPromptBlock(mentions, CHARS);
  assert.match(block, /### Novi — potret/);
  assert.ok(!/master sheet/.test(block));
});

test('buildCharacterPromptBlock: tanpa mention -> string kosong', () => {
  assert.equal(buildCharacterPromptBlock([], CHARS), '');
});

test('sanitizeInlineImage: hanya JPG/PNG/WebP, ukuran dibatasi', () => {
  assert.equal(sanitizeInlineImage(null), null);
  assert.equal(sanitizeInlineImage({ data: 'pendek' }), null);
  assert.equal(sanitizeInlineImage({ mime: 'image/gif', data: 'x'.repeat(50) }), null);
  assert.equal(sanitizeInlineImage({ mime: 'image/png', data: 'x'.repeat(5_000_000) }), null);
  const ok = sanitizeInlineImage({ mime: 'image/png', data: 'x'.repeat(50) });
  assert.deepEqual(ok, { mime: 'image/png', data: 'x'.repeat(50) });
});

// --- resolveCharacterReferences dengan Storage tiruan ---
function fakeStorage(files) {
  return {
    storage: {
      from: () => ({
        download: async (path) => {
          if (!files[path]) return { data: null, error: { message: 'not found' } };
          return { data: files[path], error: null };
        },
      }),
    },
  };
}
const blob = (text) => ({ arrayBuffer: async () => Buffer.from(text, 'utf8') });

test('resolveCharacterReferences: potret + sheet karakter 1, potret karakter 2', async () => {
  const storage = fakeStorage({
    'u/p1.png': blob('P1'), 'u/b1.png': blob('B1'), 'u/p2.png': blob('P2'),
  });
  const mentions = parseMentions('@sherly @novi', CHARS);
  const { images, labels } = await resolveCharacterReferences(storage, 'character-references', CHARS, mentions);
  assert.equal(images.length, 3);
  assert.deepEqual(labels.map((l) => l.kind), ['potret', 'master sheet', 'potret']);
  assert.equal(images[0].mime, 'image/png');
  assert.equal(Buffer.from(images[0].data, 'base64').toString('utf8'), 'P1');
});

test('resolveCharacterReferences: karakter tanpa potret dilewati, tidak error', async () => {
  const storage = fakeStorage({ 'u/p2.png': blob('P2') });
  const mentions = parseMentions('@raka @novi', CHARS);
  const { images } = await resolveCharacterReferences(storage, 'character-references', CHARS, mentions);
  assert.equal(images.length, 1);
});

test('resolveCharacterReferences: total gambar tidak melebihi batas', async () => {
  const files = {};
  for (const c of CHARS) { files[c.reference_image_path] = blob('P'); files[c.board_path] = blob('B'); }
  const { storage } = fakeStorage(files);
  const mentions = parseMentions('@sherly @novi @maya', CHARS);
  const { images } = await resolveCharacterReferences(storage, 'character-references', CHARS, mentions);
  assert.ok(images.length <= MAX_REFERENCE_IMAGES - 1, 'sisa 1 slot untuk frame adegan');
});

test('resolveCharacterReferences: file hilang di Storage -> dilewati diam-diam', async () => {
  const storage = fakeStorage({});
  const mentions = parseMentions('@sherly', CHARS);
  const { images, labels } = await resolveCharacterReferences(storage, 'character-references', CHARS, mentions);
  assert.equal(images.length, 0);
  assert.equal(labels.length, 0);
});
