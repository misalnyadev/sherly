import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  LIPSYNC_MODELS, DEFAULT_LIPSYNC_MODEL, findLipsyncModel, normalizeLipsyncParams,
  buildLipsyncInput, lipsyncCatalog, LIPSYNC_MAX_SECONDS,
} = await import('../server/lipsync-models.js');

test('D-242: katalog lipsync punya InfiniteTalk dengan kapabilitas Kie yang benar', () => {
  const m = findLipsyncModel(DEFAULT_LIPSYNC_MODEL);
  assert.ok(m, 'model default lipsync harus ditemukan');
  assert.equal(m.id, 'infinitalk/from-audio');
  assert.equal(m.label, 'InfiniteTalk');
  assert.equal(m.maker, 'MeiGen-AI');
  assert.equal(m.schema, 'infinitalk');
  assert.deepEqual(m.resolutions, ['480p', '720p']);
  assert.ok(m.aspects.includes('9:16'));
  assert.ok(m.aspects.includes('16:9'));
  assert.equal(m.maxSeconds, 15);
  assert.equal(LIPSYNC_MAX_SECONDS, 15);
});

test('D-242: semua model lipsync punya field wajib', () => {
  for (const m of LIPSYNC_MODELS) {
    assert.ok(m.id, 'id wajib');
    assert.ok(m.provider, 'provider wajib');
    assert.ok(m.label, 'label wajib');
    assert.ok(m.maker, 'maker wajib');
    assert.ok(m.resolutions.length > 0);
    assert.ok(m.aspects.length > 0);
    assert.ok(m.maxSeconds > 0);
  }
});

test('D-242: findLipsyncModel id tak dikenal -> null', () => {
  assert.equal(findLipsyncModel('model-hantu'), null);
  assert.equal(findLipsyncModel(undefined), null);
});

test('D-242: normalizeLipsyncParams menerima parameter valid', () => {
  const out = normalizeLipsyncParams({ model: 'infinitalk/from-audio', resolution: '720p', aspect: '9:16' });
  assert.equal(out.ok, true, out.error);
  assert.equal(out.resolution, '720p');
  assert.equal(out.aspect, '9:16');
  assert.equal(out.model.id, 'infinitalk/from-audio');
});

test('D-242: normalizeLipsyncParams menolak resolusi & aspect di luar kapabilitas', () => {
  const badRes = normalizeLipsyncParams({ model: 'infinitalk/from-audio', resolution: '4k', aspect: '9:16' });
  assert.equal(badRes.ok, false);
  assert.match(badRes.error, /Resolusi/);
  const badAsp = normalizeLipsyncParams({ model: 'infinitalk/from-audio', resolution: '720p', aspect: '21:9' });
  assert.equal(badAsp.ok, false);
  assert.match(badAsp.error, /Rasio aspek/);
});

test('D-242: normalizeLipsyncParams pakai default bila kosong', () => {
  const out = normalizeLipsyncParams({});
  assert.equal(out.ok, true);
  assert.equal(out.resolution, '720p');
  assert.equal(out.aspect, '9:16');
});

test('D-242: buildLipsyncInput — field Kie InfiniteTalk', () => {
  const params = { prompt: 'bicara natural', resolution: '720p', aspect: '9:16', seed: 12345 };
  const input = buildLipsyncInput('infinitalk', params, 'https://img/potret.jpg', 'https://audio/suara.wav');
  assert.equal(input.image_url, 'https://img/potret.jpg');
  assert.equal(input.audio_url, 'https://audio/suara.wav');
  assert.equal(input.prompt, 'bicara natural');
  assert.equal(input.resolution, '720p');
  assert.equal(input.seed, 12345);
  // Field yang TIDAK boleh dikirim.
  assert.equal(input.duration, undefined, 'InfiniteTalk tak punya field duration');
  assert.equal(input.aspect_ratio, undefined, 'tak ada aspect_ratio (potret di-crop otomatis)');
  assert.equal(input.model, undefined, 'tak ada field model');
});

test('D-242: buildLipsyncInput — seed di luar rentang dibuang', () => {
  const params = { prompt: 'p', resolution: '480p', seed: 5 };
  const input = buildLipsyncInput('infinitalk', params, 'i', 'a');
  assert.equal(input.seed, undefined, 'seed < 10000 harus dibuang');
  const inRange = buildLipsyncInput('infinitalk', { ...params, seed: 10000 }, 'i', 'a');
  assert.equal(inRange.seed, 10000);
});

test('D-242: buildLipsyncInput — prompt dipotong maksimal 5.000 karakter', () => {
  const long = 'x'.repeat(9000);
  const input = buildLipsyncInput('infinitalk', { prompt: long, resolution: '720p' }, 'i', 'a');
  assert.equal(input.prompt.length, 5000);
});

test('D-242: lipsyncCatalog mengirim data untuk frontend', () => {
  const cat = lipsyncCatalog();
  assert.equal(cat.defaultModel, DEFAULT_LIPSYNC_MODEL);
  assert.equal(cat.maxSeconds, 15);
  assert.ok(cat.models.length >= 1);
  const m = cat.models[0];
  assert.ok(m.id && m.label && m.maker);
  assert.ok(Array.isArray(m.resolutions) && Array.isArray(m.aspects));
  assert.equal(m.maxSeconds, 15);
  assert.ok(!('schema' in m), 'schema internal tidak dikirim ke frontend');
});

// ===== D-244: arahan adegan & gambar referensi (karakter di lokasi tertentu) =====

test('D-244: buildLipsyncInput menerima prompt arahan adegan (lokasi/kamera/aksi)', () => {
  const input = buildLipsyncInput('infinitalk',
    { prompt: 'di studio podcast, kamera close-up, dia tersenyum dan gestur tangan', resolution: '720p' },
    'https://img/karakter-di-studio.jpg', 'https://audio/suara.wav');
  assert.equal(input.prompt, 'di studio podcast, kamera close-up, dia tersenyum dan gestur tangan');
  assert.equal(input.image_url, 'https://img/karakter-di-studio.jpg');
  assert.equal(input.audio_url, 'https://audio/suara.wav');
});

test('D-244: hanya SATU image_url yang dikirim (model InfiniteTalk)', () => {
  const input = buildLipsyncInput('infinitalk', { prompt: 'x', resolution: '720p' },
    'https://img/utama.jpg', 'https://audio/a.wav');
  const imageKeys = Object.keys(input).filter((k) => k.includes('image'));
  assert.deepEqual(imageKeys, ['image_url'], 'hanya boleh ada satu field gambar');
  assert.equal(input.image_urls, undefined, 'tidak boleh ada image_urls (array)');
  assert.equal(input.reference_image_urls, undefined, 'tidak boleh ada reference_image_urls');
});

test('D-244: prompt arahan adegan dipotong 5.000 karakter (batas Kie)', () => {
  const input = buildLipsyncInput('infinitalk', { prompt: 'a'.repeat(9000), resolution: '720p' }, 'i', 'a');
  assert.equal(input.prompt.length, 5000);
});

// ===== D-245: provider lipsync + model LTX 2.5 Fast A2V =====

test('D-245: katalog punya 2 model lipsync (InfiniteTalk + LTX 2.5 Fast A2V)', () => {
  assert.equal(LIPSYNC_MODELS.length, 2);
  const ltx = findLipsyncModel('ltx/2-5-fast-audio-to-video');
  assert.ok(ltx, 'LTX 2.5 A2V harus ada di katalog');
  assert.equal(ltx.label, 'LTX 2.5 Fast A2V');
  assert.equal(ltx.maker, 'Lightricks');
  assert.equal(ltx.provider, 'kie');
  assert.deepEqual(ltx.resolutions, ['720p', '1080p', '1440p']);
  assert.equal(ltx.maxSeconds, 20, 'LTX A2V durasi mengikuti audio s/d 20 detik');
  assert.equal(ltx.defaultResolution, '1080p');
});

test('D-245: katalog kirim provider untuk frontend', () => {
  const cat = lipsyncCatalog();
  assert.ok(Array.isArray(cat.providers) && cat.providers.length >= 1);
  assert.equal(cat.providers[0].id, 'kie');
  assert.equal(cat.providers[0].label, 'Kie AI');
  // Model LTX harus membawa info tambahan untuk UI.
  const ltx = cat.models.find((m) => m.id === 'ltx/2-5-fast-audio-to-video');
  assert.deepEqual(ltx.fps, [24, 25, 48, 50]);
  assert.equal(ltx.supportsDuration, true);
  assert.equal(ltx.aspectFromImage, true);
});

test('D-245: buildLipsyncInput schema LTX — fps, duration & aspect_ratio', () => {
  const input = buildLipsyncInput('ltx25a2v',
    { prompt: 'podcast host', resolution: '1080p', fps: 30, duration: 12 },
    'https://img/potret.jpg', 'https://audio/a.wav');
  // fps 30 TIDAK didukung (hanya 24/25/48/50).
  assert.equal(input.fps, undefined, 'fps di luar daftar harus dibuang');
  assert.equal(input.duration, 12);
  // Dengan gambar -> aspect_ratio TIDAK dikirim (output mengikuti gambar).
  assert.equal(input.aspect_ratio, undefined, 'aspect_ratio tak boleh dikirim bila ada gambar');
  assert.equal(input.image_url, 'https://img/potret.jpg');
  assert.equal(input.audio_url, 'https://audio/a.wav');
});

test('D-245: buildLipsyncInput schema LTX tanpa gambar -> aspect_ratio ikut', () => {
  const input = buildLipsyncInput('ltx25a2v',
    { prompt: 'x', resolution: '1080p', fps: 24, aspect: '9:16' },
    '', 'https://audio/a.wav');
  assert.equal(input.aspect_ratio, '9:16');
  assert.equal(input.fps, 24);
  assert.equal(input.image_url, undefined);
});

test('D-245: seed LTX boleh 0, InfiniteTalk tidak', () => {
  const ltx = buildLipsyncInput('ltx25a2v', { prompt: 'x', resolution: '1080p', seed: 0 }, 'i', 'a');
  assert.equal(ltx.seed, 0, 'LTX seed 0 valid');
  const inf = buildLipsyncInput('infinitalk', { prompt: 'x', resolution: '720p', seed: 0 }, 'i', 'a');
  assert.equal(inf.seed, undefined, 'InfiniteTalk seed 0 di luar rentang');
});

test('D-245: normalizeLipsyncParams menolak resolusi di luar kapabilitas model', () => {
  const bad = normalizeLipsyncParams({ model: 'ltx/2-5-fast-audio-to-video', resolution: '480p', aspect: '9:16' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Resolusi/);
  const ok = normalizeLipsyncParams({ model: 'ltx/2-5-fast-audio-to-video', resolution: '1440p', aspect: '9:16' });
  assert.equal(ok.ok, true);
});

test('D-245: normalizeLipsyncParams menerima fps & duration untuk LTX saja', () => {
  const ltx = normalizeLipsyncParams({ model: 'ltx/2-5-fast-audio-to-video', resolution: '1080p', fps: 48, duration: 10 });
  assert.equal(ltx.fps, 48);
  assert.equal(ltx.duration, 10);
  // InfiniteTalk tidak punya fps/duration.
  const inf = normalizeLipsyncParams({ model: 'infinitalk/from-audio', resolution: '720p', fps: 48, duration: 10 });
  assert.equal(inf.fps, undefined);
  assert.equal(inf.duration, undefined);
});
