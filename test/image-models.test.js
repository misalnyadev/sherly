import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  IMAGE_MODELS, DEFAULT_IMAGE_MODEL, IMAGE_RESOLUTIONS,
  findImageModel, normalizeImageParams, buildImageInput, imageCatalog,
} = await import('../server/image-models.js');

test('katalog gambar: model default ada & punya kapabilitas', () => {
  const m = findImageModel(DEFAULT_IMAGE_MODEL);
  assert.ok(m, 'model default harus ditemukan');
  assert.ok(m.resolutions.length > 0);
  assert.ok(m.aspects.length > 0);
  assert.ok(m.maxReferences > 0);
});

test('katalog gambar: semua model punya id, provider, maker, label, schema', () => {
  for (const m of IMAGE_MODELS) {
    assert.ok(m.id, 'id wajib');
    assert.ok(m.provider, 'provider wajib');
    assert.ok(m.maker, 'maker wajib');
    assert.ok(m.label, 'label wajib');
    assert.ok(['nano-banana', 'gpt-image', 'seedream', 'flux'].includes(m.schema), 'schema tak dikenal: ' + m.schema);
    assert.ok(m.resolutions.every((r) => IMAGE_RESOLUTIONS.includes(r)), 'resolusi di luar daftar: ' + m.id);
    assert.ok(m.aspects.includes('4:5'), 'rasio 4:5 harus didukung: ' + m.id);
    assert.ok(m.aspects.includes('9:16'), 'rasio 9:16 harus didukung: ' + m.id);
  }
});

test('katalog gambar: ada model Banana, GPT, Seedream & FLUX', () => {
  const ids = IMAGE_MODELS.map((m) => m.id);
  assert.ok(ids.some((i) => i.includes('nano-banana')), 'model Banana tidak ada');
  assert.ok(ids.some((i) => i.includes('gpt-image')), 'model GPT Image tidak ada');
  assert.ok(ids.some((i) => i.includes('seedream')), 'model Seedream tidak ada');
  assert.ok(ids.some((i) => i.includes('flux')), 'model FLUX tidak ada');
});

test('findImageModel: id tak dikenal -> null', () => {
  assert.equal(findImageModel('model-hantu'), null);
  assert.equal(findImageModel(undefined), null);
});

test('normalizeImageParams: parameter valid diterima', () => {
  const out = normalizeImageParams({ model: 'nano-banana-2', resolution: '2K', aspect: '4:5' });
  assert.equal(out.ok, true);
  assert.equal(out.resolution, '2K');
  assert.equal(out.aspect, '4:5');
  assert.equal(out.model.id, 'nano-banana-2');
});

test('normalizeImageParams: model tak dikenal ditolak', () => {
  const out = normalizeImageParams({ model: 'ngawur' });
  assert.equal(out.ok, false);
  assert.match(out.error, /tidak dikenal/);
});

test('normalizeImageParams: resolusi di luar kapabilities ditolak', () => {
  const out = normalizeImageParams({ model: 'nano-banana-2', resolution: '8K', aspect: '4:5' });
  assert.equal(out.ok, false);
  assert.match(out.error, /Resolusi/);
  assert.match(out.error, /Nano Banana 2/);
});

test('normalizeImageParams: rasio aspek di luar kapabilities ditolak', () => {
  const out = normalizeImageParams({ model: 'nano-banana-2', resolution: '1K', aspect: '7:3' });
  assert.equal(out.ok, false);
  assert.match(out.error, /Rasio aspek/);
});

test('normalizeImageParams: nilai kosong memakai default model', () => {
  const out = normalizeImageParams({ model: 'nano-banana-2' });
  assert.equal(out.ok, true);
  assert.equal(out.resolution, '2K');
  assert.equal(out.aspect, '4:5');
});

test('buildImageInput — nano-banana: tanpa gambar tidak ada image_input', () => {
  const input = buildImageInput('nano-banana', { prompt: 'kucing di Bogor', aspect: '4:5', resolution: '2K' }, []);
  assert.equal(input.prompt, 'kucing di Bogor');
  assert.equal(input.aspect_ratio, '4:5');
  assert.equal(input.resolution, '2K');
  assert.equal(input.output_format, 'png');
  assert.equal(input.image_input, undefined);
});

test('buildImageInput — nano-banana: gambar referensi pakai image_input', () => {
  const input = buildImageInput('nano-banana', { prompt: 'p', aspect: '4:5', resolution: '2K' }, ['u1', 'u2']);
  assert.deepEqual(input.image_input, ['u1', 'u2']);
});

test('buildImageInput — gpt-image: referensi pakai input_urls + nsfw_checker', () => {
  const input = buildImageInput('gpt-image', { prompt: 'p', aspect: '16:9', resolution: '4K' }, ['u1']);
  assert.deepEqual(input.input_urls, ['u1']);
  assert.equal(input.nsfw_checker, false);
  assert.equal(input.background, 'opaque');
  assert.equal(input.aspect_ratio, '16:9');
});

test('buildImageInput — seedream: referensi pakai image_input', () => {
  const input = buildImageInput('seedream', { prompt: 'p', aspect: '1:1', resolution: '1K' }, ['u1']);
  assert.deepEqual(input.image_input, ['u1']);
  assert.equal(input.output_format, 'png');
});

test('buildImageInput — flux: referensi dibatasi 4 & ada enable_translation', () => {
  const input = buildImageInput('flux', { prompt: 'p', aspect: '16:9', resolution: '2K' }, ['u1', 'u2', 'u3', 'u4', 'u5']);
  assert.equal(input.image_input.length, 4, 'FLUX max 4 referensi');
  assert.equal(input.enable_translation, true);
});

test('buildImageInput: prompt dipotong max 20000 karakter', () => {
  const input = buildImageInput('nano-banana', { prompt: 'x'.repeat(25000), aspect: '1:1', resolution: '1K' }, []);
  assert.equal(input.prompt.length, 20000);
});

test('imageCatalog: bentuk untuk frontend (tanpa field internal)', () => {
  const cat = imageCatalog();
  assert.ok(cat.models.length >= 4);
  assert.equal(cat.defaultModel, DEFAULT_IMAGE_MODEL);
  const m = cat.models[0];
  assert.ok(m.id && m.label && m.maker && m.provider);
  assert.ok(Array.isArray(m.resolutions) && Array.isArray(m.aspects));
  assert.ok(typeof m.maxReferences === 'number');
  assert.ok(!('schema' in m), 'schema internal tidak dikirim ke frontend');
});
