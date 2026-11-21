import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  VIDEO_MODELS, DEFAULT_VIDEO_MODEL, findVideoModel, normalizeVideoParams,
  buildVideoInput, videoCatalog,
} = await import('../server/video-models.js');

test('katalog: model default ada & punya kapabilitas', () => {
  const m = findVideoModel(DEFAULT_VIDEO_MODEL);
  assert.ok(m, 'model default harus ditemukan');
  assert.ok(m.durations.length > 0);
  assert.ok(m.resolutions.length > 0);
  assert.ok(m.aspects.length > 0);
  assert.ok(m.tiers.length > 0);
});

test('katalog: semua model punya id, provider, label, maker, tier default valid', () => {
  for (const m of VIDEO_MODELS) {
    assert.ok(m.id, 'id wajib');
    assert.ok(m.provider, 'provider wajib');
    assert.ok(m.label, 'label wajib');
    assert.ok(m.maker, 'maker wajib');
    assert.ok(m.tiers.some((t) => t.id === m.defaultTier), 'defaultTier harus ada di tiers: ' + m.id);
    assert.ok(m.durations.every((d) => Number.isInteger(d) && d > 0), 'durasi harus integer positif');
    assert.ok(m.durations.includes(Math.max(...m.durations)), 'durasi max harus termasuk');
  }
});

test('findVideoModel: id tak dikenal -> null', () => {
  assert.equal(findVideoModel('model-hantu'), null);
  assert.equal(findVideoModel(undefined), null);
});

test('normalizeVideoParams:Veo 3.1 parameter valid diterima', () => {
  const out = normalizeVideoParams({ model: 'veo-3-1', tier: 'veo3_fast', duration: 8, resolution: '720p', aspect: '9:16' });
  assert.equal(out.ok, true);
  assert.equal(out.duration, 8);
  assert.equal(out.aspect, '9:16');
  assert.equal(out.resolution, '720p');
  assert.equal(out.tier, 'veo3_fast');
  assert.equal(out.audio, true);
});

test('normalizeVideoParams: durasi di luar kapabilities model ditolak', () => {
  const out = normalizeVideoParams({ model: 'veo-3-1', tier: 'veo3_fast', duration: 15, resolution: '720p', aspect: '16:9' });
  assert.equal(out.ok, false);
  assert.match(out.error, /tidak tersedia/);
  assert.match(out.error, /Veo 3\.1/);
});

test('normalizeVideoParams: model berbeda punya rentang durasi berbeda', () => {
  // Kling 3.0 mendukung 3-15 detik, Veo hanya 4/6/8.
  const kling = normalizeVideoParams({ model: 'kling-3.0/video', tier: 'std', duration: 15, resolution: '720p', aspect: '16:9' });
  assert.equal(kling.ok, true);
  assert.equal(kling.duration, 15);
  const veo = normalizeVideoParams({ model: 'veo-3-1', tier: 'veo3_fast', duration: 15, resolution: '720p', aspect: '16:9' });
  assert.equal(veo.ok, false);
});

test('normalizeVideoParams: resolusi & aspect di luar kapabilities ditolak', () => {
  const bad = normalizeVideoParams({ model: 'veo-3-1', tier: 'veo3_fast', duration: 4, resolution: '8k', aspect: '16:9' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Resolusi/);
  const bad2 = normalizeVideoParams({ model: 'veo-3-1', tier: 'veo3_fast', duration: 4, resolution: '720p', aspect: '1:1' });
  assert.equal(bad2.ok, false);
  assert.match(bad2.error, /Rasio aspek/);
});

test('normalizeVideoParams: tier tak dikenal untuk model ditolak', () => {
  const out = normalizeVideoParams({ model: 'veo-3-1', tier: 'kling-mode', duration: 4, resolution: '720p', aspect: '16:9' });
  assert.equal(out.ok, false);
  assert.match(out.error, /Tier/);
});

test('normalizeVideoParams: model tak dikenal ditolak', () => {
  const out = normalizeVideoParams({ model: 'ngawur', duration: 4 });
  assert.equal(out.ok, false);
  assert.match(out.error, /tidak dikenal/);
});

test('normalizeVideoParams: tier & durasi default dipakai bila kosong', () => {
  const out = normalizeVideoParams({ model: 'veo-3-1' });
  assert.equal(out.ok, true);
  assert.equal(out.tier, 'veo3_fast');
  assert.ok(out.duration > 0);
  assert.ok(out.resolution);
  assert.ok(out.aspect);
});

test('buildVideoInput — veo: text-to-video tanpa gambar', () => {
  const params = { prompt: 'jalan di GBK', tier: 'veo3_fast', duration: 8, resolution: '720p', aspect: '9:16', audio: true };
  const input = buildVideoInput('veo', params, []);
  assert.equal(input.prompt, 'jalan di GBK');
  assert.equal(input.model, 'veo3_fast');
  assert.equal(input.aspect_ratio, '9:16');
  assert.equal(input.duration, 8);
  assert.equal(input.resolution, '720p');
  assert.equal(input.generation_type, 'TEXT_2_VIDEO');
  assert.equal(input.enable_translation, true);
  assert.equal(input.image_urls, undefined);
});

test('buildVideoInput — veo: first & last frame saat ada gambar', () => {
  const params = { prompt: 'p', tier: 'veo3', duration: 6, resolution: '1080p', aspect: '16:9', audio: false };
  const input = buildVideoInput('veo', params, ['u1', 'u2']);
  assert.equal(input.generation_type, 'FIRST_AND_LAST_FRAMES_2_VIDEO');
  assert.deepEqual(input.image_urls, ['u1', 'u2']);
  assert.equal(input.model, 'veo3');
});

test('buildVideoInput — kling: field duration string & mode', () => {
  const params = { prompt: 'p', tier: 'pro', duration: 10, resolution: '1080p', aspect: '9:16', audio: true };
  const input = buildVideoInput('kling', params, ['u1']);
  assert.equal(input.duration, '10', 'kling pakai string');
  assert.equal(input.mode, 'pro');
  assert.equal(input.sound, true);
  assert.equal(input.multi_shots, false);
  assert.deepEqual(input.image_urls, ['u1']);
});

test('buildVideoInput — kling: tier 4K -> mode 4K', () => {
  const params = { prompt: 'p', tier: '4K', duration: 5, resolution: '1080p', aspect: '16:9', audio: false };
  const input = buildVideoInput('kling', params, []);
  assert.equal(input.mode, '4K');
  assert.equal(input.sound, false);
});

test('buildVideoInput — seedance: first_frame_url + reference_image_urls', () => {
  const params = { prompt: 'p', tier: 'standard', duration: 12, resolution: '1080p', aspect: '9:16', audio: true };
  const input = buildVideoInput('seedance', params, ['frameA', 'potret1', 'potret2']);
  assert.equal(input.first_frame_url, 'frameA');
  assert.deepEqual(input.reference_image_urls, ['potret1', 'potret2']);
  assert.equal(input.generate_audio, true);
  assert.equal(input.web_search, false);
  assert.equal(input.nsfw_checker, true);
  assert.equal(input.duration, 12, 'seedance durasi integer');
});

test('buildVideoInput — seedance: tanpa gambar tidak ada field frame', () => {
  const params = { prompt: 'p', tier: 'standard', duration: 8, resolution: '720p', aspect: '16:9', audio: false };
  const input = buildVideoInput('seedance', params, []);
  assert.equal(input.first_frame_url, undefined);
  assert.equal(input.reference_image_urls, undefined);
});

test('videoCatalog: bentuk untuk frontend (tanpa field internal)', () => {
  const cat = videoCatalog();
  assert.ok(cat.models.length >= 3);
  assert.equal(cat.defaultModel, DEFAULT_VIDEO_MODEL);
  const m = cat.models[0];
  assert.ok(m.id && m.label && m.maker && m.provider);
  assert.ok(Array.isArray(m.durations) && Array.isArray(m.resolutions) && Array.isArray(m.aspects));
  assert.ok(Array.isArray(m.tiers));
  assert.ok(!('schema' in m), 'schema internal tidak dikirim ke frontend');
});

// ===== D-239: Google Gemini Omni 1.2 Flash (Kie) =====

test('D-239: katalog punya model Omni 1.2 Flash dengan kapabilitas Kie yang benar', () => {
  const m = findVideoModel('google/gemini-omni-flash-1-2');
  assert.ok(m, 'model Omni 1.2 Flash harus ada di katalog');
  assert.equal(m.provider, 'kie');
  assert.equal(m.label, 'Omni 1.2 Flash');
  assert.equal(m.maker, 'Google');
  assert.equal(m.schema, 'omni');
  assert.equal(m.audio, true, 'Omni punya audio native');
  assert.equal(m.firstLastFrame, true);
  assert.equal(m.firstLastFrameExclusive, true, 'first/last frame tidak boleh digabung image_urls');
  assert.equal(m.maxReferences, 6);
  // Durasi 3-15 detik (Kie: 3..15, satu detik).
  assert.deepEqual(m.durations, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(m.resolutions, ['360p', '720p', '1080p', '4k']);
  assert.deepEqual(m.aspects, ['16:9', '9:16', 'auto']);
  assert.ok(m.tiers.some((t) => t.id === m.defaultTier));
});

test('D-239: normalizeVideoParams menerima Omni 1.2 Flash (durasi 15 & aspect auto)', () => {
  const out = normalizeVideoParams({
    model: 'google/gemini-omni-flash-1-2', tier: 'standard',
    duration: 15, resolution: '1080p', aspect: 'auto',
  });
  assert.equal(out.ok, true, out.error);
  assert.equal(out.duration, 15);
  assert.equal(out.resolution, '1080p');
  assert.equal(out.aspect, 'auto');
  assert.equal(out.audio, true);
});

test('D-239: normalizeVideoParams menolak kapabilitas di luar Omni (durasi 16, 8k, 1:1)', () => {
  const badDur = normalizeVideoParams({ model: 'google/gemini-omni-flash-1-2', tier: 'standard', duration: 16, resolution: '720p', aspect: '16:9' });
  assert.equal(badDur.ok, false);
  assert.match(badDur.error, /Durasi/);
  const badRes = normalizeVideoParams({ model: 'google/gemini-omni-flash-1-2', tier: 'standard', duration: 8, resolution: '8k', aspect: '16:9' });
  assert.equal(badRes.ok, false);
  assert.match(badRes.error, /Resolusi/);
  const badAsp = normalizeVideoParams({ model: 'google/gemini-omni-flash-1-2', tier: 'standard', duration: 8, resolution: '720p', aspect: '1:1' });
  assert.equal(badAsp.ok, false);
  assert.match(badAsp.error, /Rasio aspek/);
});

test('D-239: buildVideoInput schema omni -> field Kie yang benar', () => {
  const params = { prompt: 'kota neon', tier: 'standard', duration: 10, resolution: '720p', aspect: '16:9', audio: true };
  const input = buildVideoInput('omni', params, []);
  assert.equal(input.prompt, 'kota neon');
  assert.equal(input.duration, 10, 'durasi integer');
  assert.equal(input.resolution, '720p');
  assert.equal(input.aspect_ratio, '16:9');
  assert.equal(input.image_urls, undefined, 'tanpa gambar tidak ada image_urls');
  // Field yang TIDAK boleh dikirim ke Kie untuk model ini.
  assert.equal(input.model, undefined, 'Omni tidak pakai field model (tier)');
  assert.equal(input.first_frame_url, undefined);
  assert.equal(input.last_frame_url, undefined);
  assert.equal(input.video_list, undefined);
});

test('D-239: buildVideoInput schema omni -> image_urls (maks 6) untuk referensi karakter', () => {
  const params = { prompt: 'p', tier: 'standard', duration: 8, resolution: '1080p', aspect: '9:16', audio: true };
  const input = buildVideoInput('omni', params, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.deepEqual(input.image_urls, ['a', 'b', 'c', 'd', 'e', 'f'], 'maks 6 referensi');
  assert.equal(input.first_frame_url, undefined, 'first frame eksklusif -> tidak digabung');
});

test('D-239: videoCatalog mengirim field Omni ke frontend', () => {
  const cat = videoCatalog();
  const m = cat.models.find((x) => x.id === 'google/gemini-omni-flash-1-2');
  assert.ok(m, 'Omni harus ada di katalog frontend');
  assert.equal(m.maxReferences, 6);
  assert.equal(m.firstLastFrameExclusive, true);
  assert.equal(m.firstLastFrame, true);
  assert.ok(!('schema' in m), 'schema tetap internal');
});

test('D-239: fallback katalog frontend (public/studio.js) sinkron dengan server', async () => {
  const { readFileSync } = await import('node:fs');
  const studio = readFileSync('public/studio.js', 'utf8');
  assert.ok(studio.includes("id: 'google/gemini-omni-flash-1-2'"), 'fallback frontend harus punya Omni');
  assert.ok(studio.includes("label: 'Omni 1.2 Flash'"), 'label fallback harus sama dgn server');
  assert.ok(studio.includes("maker: 'Google'"));
  assert.ok(studio.includes("firstLastFrameExclusive: true"));
  assert.ok(studio.includes('maxReferences: 6'));
});

// ===== D-241: model video panjang (30 detik) & multimodal =====

test('D-241: Seedance 2.5 — 30 detik, 4K, 30 referensi, mode draft', () => {
  const m = findVideoModel('bytedance/seedance-2-5');
  assert.ok(m, 'Seedance 2.5 harus ada di katalog');
  assert.equal(m.label, 'Seedance 2.5');
  assert.equal(m.maker, 'ByteDance');
  assert.equal(m.schema, 'seedance25');
  assert.equal(Math.max(...m.durations), 30, 'harus sampai 30 detik');
  assert.equal(m.durations.length, 27, 'durasi 4-30 (integer)');
  assert.ok(m.resolutions.includes('4k'), 'harus support native 4K');
  assert.equal(m.maxReferences, 30);
  assert.ok(m.tiers.some((t) => t.id === 'draft'), 'harus punya tier draft (preview 480p)');
});

test('D-241: Wan 3.0 — 2-30 detik, multimodal, termurah', () => {
  const m = findVideoModel('wan/3-0-video');
  assert.ok(m, 'Wan 3.0 harus ada di katalog');
  assert.equal(m.label, 'Wan 3.0');
  assert.equal(m.maker, 'Alibaba');
  assert.equal(m.schema, 'wan3');
  assert.equal(m.durations[0], 2);
  assert.equal(Math.max(...m.durations), 30);
  assert.ok(m.aspects.includes('adaptive'), 'harus punya rasio adaptive');
  assert.ok(m.audio, 'Wan 3.0 punya audio');
});

test('D-241: Kling 4.0 — 30 detik, 4K HDR, 15 referensi', () => {
  const m = findVideoModel('kling-4-0/reference-to-video');
  assert.ok(m, 'Kling 4.0 harus ada di katalog');
  assert.equal(m.label, 'Kling 4.0');
  assert.equal(m.maker, 'Kuaishou');
  assert.equal(m.schema, 'kling4');
  assert.equal(Math.max(...m.durations), 30);
  assert.ok(m.resolutions.includes('4k'));
  assert.ok(m.tiers.some((t) => t.id === 'hdr'), 'harus punya tier HDR');
  assert.equal(m.maxReferences, 15);
});

test('D-241: buildVideoInput schema seedance25 — field Kie 2.5', () => {
  const params = { prompt: 'p', tier: 'standard', duration: 25, resolution: '1080p', aspect: '9:16', audio: true };
  const input = buildVideoInput('seedance25', params, ['a', 'b']);
  assert.equal(input.duration, 25);
  assert.equal(input.resolution, '1080p');
  assert.equal(input.aspect_ratio, '9:16');
  assert.equal(input.generate_audio, true);
  assert.deepEqual(input.reference_image_urls, ['a', 'b']);
  assert.equal(input.draft, undefined, 'tier standard bukan draft');
});

test('D-241: buildVideoInput schema seedance25 — tier draft = preview 480p', () => {
  const params = { prompt: 'p', tier: 'draft', duration: 10, resolution: '1080p', aspect: '16:9', audio: false };
  const input = buildVideoInput('seedance25', params, []);
  assert.equal(input.draft, true, 'draft harus true');
  assert.equal(input.resolution, '480p', 'draft dipaksa ke 480p');
  assert.equal(input.generate_audio, false);
});

test('D-241: buildVideoInput schema wan3 — field Wan 3.0', () => {
  const params = { prompt: 'p', tier: 'standard', duration: 20, resolution: '720p', aspect: 'adaptive', audio: true };
  const input = buildVideoInput('wan3', params, ['x']);
  assert.equal(input.duration, 20);
  assert.equal(input.aspect_ratio, 'adaptive');
  assert.equal(input.audio, true, 'wan3 pakai field "audio" (bool)');
  assert.deepEqual(input.reference_image_urls, ['x']);
  assert.equal(input.generate_audio, undefined, 'wan3 tidak pakai generate_audio');
});

test('D-241: buildVideoInput schema kling4 — field Kling 4.0', () => {
  const params = { prompt: 'p', tier: 'std', duration: 30, resolution: '4k', aspect: '21:9', audio: true };
  const input = buildVideoInput('kling4', params, ['u1']);
  assert.equal(input.duration, 30);
  assert.equal(input.resolution, '4k');
  assert.equal(input.aspect_ratio, '21:9');
  assert.deepEqual(input.image_urls, ['u1'], 'kling4 pakai image_urls');
  assert.equal(input.mode, undefined, 'kling4 tak punya field mode');
});

test('D-241: videoCatalog menandai model longForm (durasi > 15 detik)', () => {
  const cat = videoCatalog();
  const seed25 = cat.models.find((m) => m.id === 'bytedance/seedance-2-5');
  const wan = cat.models.find((m) => m.id === 'wan/3-0-video');
  const kling4 = cat.models.find((m) => m.id === 'kling-4-0/reference-to-video');
  assert.equal(seed25.longForm, true);
  assert.equal(wan.longForm, true);
  assert.equal(kling4.longForm, true);
  // Model lama tetap false.
  assert.equal(cat.models.find((m) => m.id === 'veo-3-1').longForm, false);
});

test('D-241: fallback frontend sinkron dengan server (3 model baru)', async () => {
  const { readFileSync } = await import('node:fs');
  const studio = readFileSync('public/studio.js', 'utf8');
  for (const [id, label] of [
    ['bytedance/seedance-2-5', 'Seedance 2.5'],
    ['wan/3-0-video', 'Wan 3.0'],
    ['kling-4-0/reference-to-video', 'Kling 4.0'],
  ]) {
    assert.ok(studio.includes(`id: '${id}'`), 'fallback frontend harus punya ' + id);
    assert.ok(studio.includes(`label: '${label}'`), 'label fallback harus ' + label);
  }
  assert.ok(studio.includes("id: 'bytedance/seedream-5-5'"), 'fallback frontend harus punya Seedream 5.5');
  assert.ok(studio.includes("id: 'gpt-image-2-6/flare-text-to-image'"), 'fallback frontend harus punya GPT Image 2.6');
});
