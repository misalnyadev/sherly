// D-207: Bank Prompt — validasi entri, susun prompt, isi placeholder, seed bawaan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_KINDS, PROMPT_CATEGORIES, PROMPT_MODES, PROMPT_GROUPS, SEED_PROMPT_BANK,
  normalizePromptEntry, composePrompt, fillTemplate, extractSlots,
  optimizePrompt, detectCategory, splitPhrases,
} from '../server/prompt-bank.js';
import { SEED_FOTO_STYLES, SEED_CODES_FOTOVIDEO, SEED_CODES_PRODUK } from '../server/prompt-seed.js';

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


// ===== D-208: mode per jenis konten, kode video dari PDF, optimasi, anti-duplikat =====

test('D-208: mode prompt hanya foto & video', () => {
  assert.deepEqual(PROMPT_MODES, ['foto', 'video']);
});

test('D-208: entri dinormalisasi menyimpan mode & group', () => {
  const r = normalizePromptEntry({ label: 'X', content: 'abc', mode: 'VIDEO', group: 'PRODUK' });
  assert.ok(r.ok);
  assert.equal(r.value.mode, 'video');
  assert.equal(r.value.group, 'produk');
  const bad = normalizePromptEntry({ label: 'X', content: 'abc', mode: 'ngawur', group: 'ngawur' });
  assert.equal(bad.value.mode, 'foto', 'mode tak dikenal -> default foto');
  assert.equal(bad.value.group, 'umum', 'group tak dikenal -> default umum');
});

test('D-208: seed gaya foto = 4 gaya lama sebagai template transparan', () => {
  assert.equal(SEED_FOTO_STYLES.length, 4);
  const labels = SEED_FOTO_STYLES.map((s) => s.label);
  for (const l of ['Lifestyle', 'Beauty & Skincare', 'Timeless Style', 'Inspire & Grow']) {
    assert.ok(labels.includes(l), 'gaya hilang: ' + l);
  }
  // Isinya harus deskripsi utuh (transparan), bukan kode/label singkat.
  for (const s of SEED_FOTO_STYLES) {
    assert.ok(s.content.length > 40, 'isi gaya terlalu pendek (tidak transparan): ' + s.label);
  }
});

test('D-208: seed kode video = 50 foto-ke-video + 109 produk', () => {
  assert.equal(SEED_CODES_FOTOVIDEO.length, 50, 'kode foto-ke-video harus 50');
  assert.equal(SEED_CODES_PRODUK.length, 109, 'kode produk harus 109');
});

test('D-208: semua 159 kode unik (anti-duplikat)', () => {
  const all = [...SEED_CODES_FOTOVIDEO, ...SEED_CODES_PRODUK];
  assert.equal(all.length, 159);
  const codes = new Set(all.map((c) => c.code));
  const labels = new Set(all.map((c) => c.label.toLowerCase()));
  assert.equal(codes.size, 159, 'ada kode duplikat');
  assert.equal(labels.size, 159, 'ada label duplikat');
});

test('D-208: isi kode memuat kode + deskripsi dari PDF', () => {
  const s = SEED_CODES_FOTOVIDEO.find((x) => x.code === '/craneup');
  assert.ok(s, 'kode /craneup hilang');
  assert.ok(s.content.startsWith('/craneup'), 'kode tidak ada di isi: ' + s.content);
  assert.ok(/kamera bergerak naik perlahan/i.test(s.content), 'deskripsi hilang: ' + s.content);
  const p = SEED_CODES_PRODUK.find((x) => x.code === '/SmokeReveal');
  assert.ok(p, 'kode /SmokeReveal hilang');
  assert.ok(/asap/i.test(p.content), 'deskripsi hilang: ' + p.content);
});

test('D-208: setiap kode punya label & group', () => {
  for (const c of [...SEED_CODES_FOTOVIDEO, ...SEED_CODES_PRODUK]) {
    assert.ok(c.label && c.label.length > 1, 'label kosong: ' + c.code);
    assert.ok(c.group === 'fotovideo' || c.group === 'produk', 'group salah: ' + c.code);
    assert.deepEqual(c.slots, []);
  }
});

test('D-208: detectCategory mengenali kategori kunci', () => {
  assert.equal(detectCategory('low-angle shot, 85mm lens'), 'kamera');
  assert.equal(detectCategory('golden hour sunlight from camera-left'), 'cahaya');
  assert.equal(detectCategory('visible skin pores, natural texture'), 'tekstur');
  assert.equal(detectCategory('muted natural tones, warm palette'), 'color');
  assert.equal(detectCategory('photorealistic, 8K hyper-detailed'), 'kualitas');
  assert.equal(detectCategory('no cartoon, no watermark'), 'negative');
  assert.equal(detectCategory('a woman wearing batik'), 'umum');
});

test('D-208: splitPhrases memotong prompt jadi frasa', () => {
  const r = splitPhrases('a woman in batik. golden hour light, 85mm lens! low angle?');
  assert.ok(r.length >= 3, 'frasa tidak terpecah: ' + JSON.stringify(r));
  assert.ok(r.includes('a woman in batik'), 'frasa subject hilang');
});

test('D-208: optimizePrompt menyusun ulang sesuai alur fokus', () => {
  const raw = 'woman wearing batik. golden hour sunlight. low-angle shot 85mm lens. shallow depth of field. natural skin texture. muted tones. photorealistic 8K. no cartoon';
  const r = optimizePrompt(raw);
  const iSub = r.prompt.indexOf('woman wearing batik');
  const iCam = r.prompt.indexOf('low-angle shot');
  const iLit = r.prompt.indexOf('golden hour sunlight');
  const iNeg = r.prompt.indexOf('no cartoon');
  assert.ok(iSub > -1 && iCam > -1 && iLit > -1 && iNeg > -1, 'bagian hilang: ' + r.prompt);
  assert.ok(iSub < iCam, 'subject harus sebelum kamera');
  assert.ok(iCam < iLit, 'kamera harus sebelum cahaya');
  assert.ok(iLit < iNeg, 'cahaya harus sebelum negative');
});

test('D-208: optimizePrompt anti-duplikat (frasa sama tidak diulang)', () => {
  const r = optimizePrompt('a girl. golden hour light. golden hour light. no text');
  const occurrences = r.prompt.toLowerCase().split('golden hour light').length - 1;
  assert.equal(occurrences, 1, 'frasa duplikat masih ada: ' + r.prompt);
});

test('D-208: optimizePrompt menggabungkan blok terpilih', () => {
  const r = optimizePrompt('a woman', [
    { category: 'negative', content: 'no cartoon' },
    { category: 'kamera', content: 'drone view' },
  ]);
  assert.ok(r.prompt.includes('a woman'), 'subject hilang');
  assert.ok(r.prompt.includes('drone view'), 'blok kamera hilang');
  assert.ok(r.prompt.includes('no cartoon'), 'blok negative hilang');
  assert.ok(r.prompt.indexOf('drone view') < r.prompt.indexOf('no cartoon'), 'negative harus di akhir');
});

test('D-208: optimizePrompt tidak merusak isi komposer yang kosong', () => {
  const r = optimizePrompt('', [{ category: 'cahaya', content: 'soft window light' }]);
  assert.equal(r.prompt, 'soft window light');
});
