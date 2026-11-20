// D-207: Bank Prompt — validasi entri, susun prompt, isi placeholder, seed bawaan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_KINDS, PROMPT_CATEGORIES, SEED_PROMPT_BANK,
  normalizePromptEntry, composePrompt, fillTemplate, extractSlots,
} from '../server/prompt-bank.js';

test('D-207: jenis entri hanya template & block', () => {
  assert.deepEqual(PROMPT_KINDS, ['template', 'block']);
});

test('D-207: kategori prompt punya label & urutan stabil', () => {
  const keys = PROMPT_CATEGORIES.map((c) => c.key);
  for (const k of ['kamera', 'cahaya', 'gaya', 'tekstur', 'color', 'kualitas', 'negative']) {
    assert.ok(keys.includes(k), 'kategori ' + k + ' hilang');
  }
  // Negative prompt selalu paling akhir.
  assert.equal(keys[keys.length - 2], 'negative', 'negative harus sebelum umum');
  assert.equal(keys[keys.length - 1], 'umum');
});

test('D-207: entri valid dinormalisasi', () => {
  const r = normalizePromptEntry({
    kind: 'block', label: '  Golden Hour  ', category: 'CAHAYA',
    content: '  warm golden hour sunlight  ', slots: 'Outfit',
  });
  assert.ok(r.ok);
  assert.equal(r.value.kind, 'block');
  assert.equal(r.value.label, 'Golden Hour');
  assert.equal(r.value.category, 'cahaya');
  assert.equal(r.value.content, 'warm golden hour sunlight');
  assert.deepEqual(r.value.slots, ['outfit']);
  assert.equal(r.value.is_active, true);
});

test('D-207: entri tanpa label / konten ditolak', () => {
  const a = normalizePromptEntry({ label: '', content: 'x' });
  assert.equal(a.ok, false);
  assert.match(a.error, /Label/);
  const b = normalizePromptEntry({ label: 'x', content: '   ' });
  assert.equal(b.ok, false);
  assert.match(b.error, /Isi prompt/);
});

test('D-207: kind & kategori tak dikenal jatuh ke default', () => {
  const r = normalizePromptEntry({ kind: 'ngawur', label: 'X', category: 'ngawur', content: 'abc' });
  assert.ok(r.ok);
  assert.equal(r.value.kind, 'block');
  assert.equal(r.value.category, 'umum');
});

test('D-207: placeholder di isi konten terdeteksi otomatis jadi slot', () => {
  const r = normalizePromptEntry({
    label: 'Try Outfit', kind: 'template',
    content: 'full-body shot, { outfit } on the model, { background }',
  });
  assert.ok(r.ok);
  assert.deepEqual(r.value.slots, ['outfit', 'background']);
});

test('D-207: panjang label & konten dibatasi', () => {
  const a = normalizePromptEntry({ label: 'x'.repeat(81), content: 'abc' });
  assert.equal(a.ok, false);
  const b = normalizePromptEntry({ label: 'ok', content: 'x'.repeat(2001) });
  assert.equal(b.ok, false);
});

test('D-207: composePrompt menyusun blok sesuai urutan kategori', () => {
  const out = composePrompt([
    { category: 'negative', content: 'no cartoon' },
    { category: 'cahaya', content: 'soft window light' },
    { category: 'kamera', content: 'low-angle shot' },
  ], 'a woman walking');
  const parts = out.split('\n\n');
  assert.equal(parts[0], 'a woman walking', 'prompt utama harus di depan');
  assert.equal(parts[1], 'low-angle shot', 'kamera sebelum cahaya');
  assert.equal(parts[2], 'soft window light', 'cahaya setelah kamera');
  assert.equal(parts[3], 'no cartoon', 'negative paling akhir');
});

test('D-207: composePrompt menggabungkan blok satu kategori', () => {
  const out = composePrompt([
    { category: 'kamera', content: 'drone view' },
    { category: 'kamera', content: 'wide angle' },
  ], 'base');
  assert.equal(out, 'base\n\ndrone view wide angle');
});

test('D-207: composePrompt mengabaikan blok kosong', () => {
  const out = composePrompt([{ category: 'kamera', content: '   ' }], 'base');
  assert.equal(out, 'base');
});

test('D-207: composePrompt tanpa prompt utama tetap merakit blok', () => {
  const out = composePrompt([{ category: 'cahaya', content: 'golden hour' }], '');
  assert.equal(out, 'golden hour');
});

test('D-207: fillTemplate mengisi placeholder yang ada', () => {
  const r = fillTemplate('try outfit { outfit } on model', { outfit: 'batik batik' });
  assert.equal(r.text, 'try outfit batik batik on model');
  assert.deepEqual(r.missing, []);
});

test('D-207: fillTemplate menandai placeholder yang belum diisi', () => {
  const r = fillTemplate('try outfit { outfit }', {});
  assert.equal(r.text, 'try outfit [outfit]');
  assert.deepEqual(r.missing, ['outfit']);
});

test('D-207: extractSlots menemukan semua placeholder', () => {
  assert.deepEqual(extractSlots('a {one} b {two} c {one}'), ['one', 'two', 'one']);
  assert.deepEqual(extractSlots('no placeholder'), []);
});

test('D-207: seed bawaan punya template & blok yang lengkap', () => {
  assert.ok(SEED_PROMPT_BANK.template.length >= 8, 'template seed terlalu sedikit');
  assert.ok(SEED_PROMPT_BANK.block.length >= 20, 'blok seed terlalu sedikit');
  for (const t of SEED_PROMPT_BANK.template) {
    const r = normalizePromptEntry({ ...t, kind: 'template' });
    assert.ok(r.ok, 'template seed invalid: ' + t.label + ' -> ' + r.error);
  }
  for (const b of SEED_PROMPT_BANK.block) {
    const r = normalizePromptEntry({ ...b, kind: 'block' });
    assert.ok(r.ok, 'blok seed invalid: ' + b.label + ' -> ' + r.error);
  }
});

test('D-207: seed memuat sudut kamera & pencahayaan kunci', () => {
  const labels = SEED_PROMPT_BANK.block.map((b) => b.label.toLowerCase());
  for (const need of ['drone view', 'worm\'s eye', 'low angle', 'golden hour', 'soft window light', 'studio softbox', 'rembrandt', 'visible skin pores', 'photorealistic', 'no cartoon']) {
    assert.ok(labels.includes(need), 'blok seed wajib ada: ' + need);
  }
});

test('D-207: template Try Outfit punya placeholder outfit', () => {
  const t = SEED_PROMPT_BANK.template.find((x) => x.label === 'Try Outfit');
  assert.ok(t, 'template Try Outfit hilang');
  assert.deepEqual(extractSlots(t.content), ['outfit']);
});

test('D-207: setiap kategori seed punya minimal satu blok', () => {
  const cats = new Set(SEED_PROMPT_BANK.block.map((b) => b.category));
  for (const { key } of PROMPT_CATEGORIES) {
    if (key === 'umum') continue;
    assert.ok(cats.has(key), 'kategori seed tanpa blok: ' + key);
  }
});
