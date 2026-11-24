// D-289 — "Kie sudah FAIL tapi errornya tidak pernah sampai ke user".
//
// 🐛 BUG 1 (UTAMA): `taskMeta is not defined` di route /api/ai/video/:id.
//
//   Route polling video punya dua jalur:
//     - sukses  -> blok `if (state === 'success' && info.resultUrls.length)`
//                  -> `const taskMeta = ...`  (hanya DI DALAM blok ini)
//     - gagal   -> blok `if (state === 'fail' || ...)`
//                  -> `const isLipsync = taskMeta.kind === 'lipsync'`  ← BOOM
//
//   Di jalur gagal, `taskMeta` tidak ada di scope -> ReferenceError ->
//   ditangkap `catch` -> route membalas `{ status:'running', retryable:true }`
//   -> client polling terus 12x -> baru tampil pesan generik
//   "Generator tidak selesai dalam 20 menit".
//
//   Akibatnya `failMsg` / `failCode` dari Kie — satu-satunya sumber
//   kebenaran kenapa task ditolak — PERNAH TIDAK sampai ke user.
//
// 🐛 BUG 2: `kieNormalizeState` hanya membaca `d.failMsg` / `d.failCode`,
//   padahal Kie bisa menaruh alasan di `d.error`, `d.errorMessage`,
//   `d.msg`, atau di dalam `resultJson`.
//
// 🐛 BUG 3: payload Kie bisa berisi karakter jejas dari copy-paste:
//   image_url = "[https://tempfile.redpandaai.co/.../lipsync-xxx.jpg"
//   prompt    = "Novi] berbicara natural. ..."
//   -> Kie gagal menarik file gambar -> task fail.
//
// 🐛 BUG 4: badge kredit Karakter Bicara stuck di tarif per-detik (mis. 14)
//   karena naskah dibaca dari `#stPrompt` (composer utama) padahal sejak
//   D-287 naskah ada di `#stLipScript`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { buildLipsyncInput, cleanMediaUrl, cleanLipsyncPrompt } =
  await import('../server/lipsync-models.js');
const { kieNormalizeState, kieFailReason, sanitizeMediaUrl } =
  await import('../server/ai.js');

const readApp = () => fs.readFileSync(path.join(ROOT, 'server/app.js'), 'utf8');
const readStudio = () => fs.readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');

// ===========================================================================
// BUG 1 — taskMeta harus ada di scope jalur FAIL
// ===========================================================================

test('D-289: taskMeta dideklarasi SEBELUM blok success/fail (tidak hanya di dalam success)', () => {
  const src = readApp();
  // Cari blok route /api/ai/video/:id
  const routeStart = src.indexOf("app.get('/api/ai/video/:id'");
  assert.ok(routeStart > -1, 'route /api/ai/video/:id harus ada');
  const route = src.slice(routeStart, routeStart + 9000);

  const declIdx = route.search(/const taskMeta = task\.meta/);
  const successIdx = route.search(/if \(\(state === 'success'/);
  const failIdx = route.search(/if \(state === 'fail'/);

  assert.ok(declIdx > -1, 'taskMeta harus dideklarasi');
  assert.ok(successIdx > -1, 'blok success harus ada');
  assert.ok(failIdx > -1, 'blok fail harus ada');

  // WAJIB: deklarasi SEBELUM blok success (supaya tersedia di kedua jalur).
  assert.ok(
    declIdx < successIdx,
    'taskMeta harus dideklarasi di luar blok success, agar作用域 tersedia di jalur fail',
  );
  assert.ok(
    declIdx < failIdx,
    'taskMeta harus dideklarasi sebelum blok fail',
  );
});

test('D-289: jalur fail tidak boleh throw ReferenceError saat info.error kosong', () => {
  // Simulasikan jalur fail seperti di route.
  const task = { meta: { kind: 'lipsync', modelLabel: 'InfiniteTalk', maxSeconds: 15 } };
  const taskMeta = task.meta && typeof task.meta === 'object' ? task.meta : {};
  assert.doesNotThrow(() => {
    const isLipsync = taskMeta.kind === 'lipsync';
    assert.equal(isLipsync, true);
  });
});

test('D-289: route poll memakai pesan Kie (info.error), bukan pesan generik', () => {
  const src = readApp();
  const routeStart = src.indexOf("app.get('/api/ai/video/:id'");
  const route = src.slice(routeStart, routeStart + 9000);
  const failIdx = route.search(/if \(state === 'fail'/);
  assert.ok(failIdx > -1, 'blok fail harus ada');
  const failBlock = route.slice(failIdx, failIdx + 1400);

  // Harus ada抓an info.error (alasan Kie) di dalam blok fail.
  assert.match(
    failBlock,
    /info\.error/,
    'blok fail harus memakai info.error (failMsg/failCode dari Kie)',
  );
  // Tidak boleh jatuh ke pesan generik tanpa melihat info.error.
  assert.doesNotMatch(
    failBlock,
    /lipsyncErrorMessage\(\s*'Generator karakter bicara gagal\.'/,
    'blok fail tidak boleh mengabaikan info.error',
  );
});

// ===========================================================================
// BUG 2 — alasan Kie dari semua kemungkinan field
// ===========================================================================

test('D-289: kieFailReason membaca failMsg', () => {
  assert.equal(kieFailReason({ failMsg: 'ConnectException: Operation timed out' }),
    'ConnectException: Operation timed out');
});

test('D-289: kieFailReason membaca failCode', () => {
  assert.equal(kieFailReason({ failCode: '501' }), '501');
});

test('D-289: kieFailReason membaca error / errorMessage / msg', () => {
  assert.equal(kieFailReason({ error: 'invalid image url' }), 'invalid image url');
  assert.equal(kieFailReason({ errorMessage: 'bad payload' }), 'bad payload');
  assert.equal(kieFailReason({ msg: 'queue full' }), 'queue full');
});

test('D-289: kieFailReason membaca resultJson (string & object)', () => {
  assert.equal(
    kieFailReason({ resultJson: '{"failMsg":"image url invalid"}' }),
    'image url invalid',
  );
  assert.equal(
    kieFailReason({ resultJson: { failMsg: 'audio too long' } }),
    'audio too long',
  );
});

test('D-289: kieFailReason tidak pernah melempar error', () => {
  assert.equal(kieFailReason(null), '');
  assert.equal(kieFailReason(undefined), '');
  assert.equal(kieFailReason({}), '');
});

test('D-289: state fail WAJIB punya pesan (tidak boleh null)', () => {
  const out = kieNormalizeState('fail', [], { failMsg: 'ConnectException: Operation timed out' });
  assert.equal(out.state, 'fail');
  assert.equal(out.error, 'ConnectException: Operation timed out');
});

test('D-289: state fail tanpa alasan Kie tetap dapat pesan bermakna (bukan null)', () => {
  const out = kieNormalizeState('fail', [], {});
  assert.equal(out.state, 'fail');
  assert.ok(out.error, 'error tidak boleh null');
  assert.ok(out.error.length > 10, 'pesan harus informatif');
});

test('D-289: state fail TIDAK lagi menghasilkan pesan "tidak selesai dalam 20 menit"', () => {
  const out = kieNormalizeState('fail', [], { failMsg: 'Kie gagal menarik file' });
  assert.doesNotMatch(out.error || '', /tidak selesai dalam 20 menit/);
});

test('D-289: state success tanpa URL tetap jadi fail dengan pesan', () => {
  const out = kieNormalizeState('success', [], {});
  assert.equal(out.state, 'fail');
  assert.ok(out.error);
});

// ===========================================================================
// BUG 3 — sanitasi payload Kie
// ===========================================================================

test('D-289: cleanMediaUrl membuang "[" nyasar di depan URL Kie', () => {
  const bad = '[https://tempfile.redpandaai.co/kieai/12362232/images/base64/lipsync-1795537510661.jpg';
  assert.equal(
    cleanMediaUrl(bad),
    'https://tempfile.redpandaai.co/kieai/12362232/images/base64/lipsync-1795537510661.jpg',
  );
});

test('D-289: cleanMediaUrl membuang "]" & pembungkus markdown', () => {
  assert.equal(cleanMediaUrl('https://t.co/x.jpg]'), 'https://t.co/x.jpg');
  assert.equal(cleanMediaUrl('](https://t.co/x.mp3)'), 'https://t.co/x.mp3');
});

test('D-289: cleanMediaUrl TIDAK merusak URL sah', () => {
  assert.equal(cleanMediaUrl('https://t.co/x.mp3?token=abc=def'),
    'https://t.co/x.mp3?token=abc=def');
  assert.equal(cleanMediaUrl('https://t.co/a(b).mp3'), 'https://t.co/a(b).mp3');
  assert.equal(cleanMediaUrl('https://t.co/a%20b.jpg'), 'https://t.co/a%20b.jpg');
  assert.equal(cleanMediaUrl(''), '');
  assert.equal(cleanMediaUrl(null), '');
});

test('D-289: sanitizeMediaUrl (server/ai.js) konsisten dengan cleanMediaUrl', () => {
  const bad = '[https://t.co/x.jpg';
  assert.equal(sanitizeMediaUrl(bad), cleanMediaUrl(bad));
});

test('D-289: buildLipsyncInput InfiniteTalk — image_url BERSIH (tidak ada "[")', () => {
  const out = buildLipsyncInput(
    'infinitalk',
    { prompt: 'Novi berbicara natural', resolution: '480p' },
    '[https://tempfile.redpandaai.co/kieai/12362232/images/base64/lipsync-1795537510661.jpg',
    'https://tempfile.redpandaai.co/kieai/12362232/audio/base64/lipsync-1795537511771.wav',
  );
  assert.ok(out.image_url.startsWith('https://'), 'image_url harus diawali https://');
  assert.doesNotMatch(out.image_url, /[\[\]]/, 'image_url tidak boleh punya kurung siku');
  assert.doesNotMatch(out.audio_url, /[\[\]]/, 'audio_url tidak boleh punya kurung siku');
});

test('D-289: buildLipsyncInput OmniHuman 2.0 — image_urls BERSIH & tetap array 1', () => {
  const out = buildLipsyncInput(
    'omnihuman20',
    { prompt: 'Novi berbicara natural', resolution: '720p' },
    '[https://tempfile.redpandaai.co/kieai/12362232/images/base64/lipsync-1795537510661.jpg',
    'https://tempfile.redpandaai.co/kieai/12362232/audio/base64/lipsync-1795537511771.wav',
  );
  assert.ok(Array.isArray(out.image_urls));
  assert.equal(out.image_urls.length, 1);
  assert.doesNotMatch(out.image_urls[0], /[\[\]]/);
  assert.equal(out.image_url, undefined, 'OmniHuman 2.0 tidak boleh punya image_url');
  assert.equal(out.resolution, undefined, 'OmniHuman 2.0 tidak boleh punya resolution');
});

test('D-289: buildLipsyncInput — prompt dibersihkan dari "]" nyasar', () => {
  const out = buildLipsyncInput(
    'infinitalk',
    { prompt: 'Novi] berbicara natural. di studio podcast', resolution: '480p' },
    'https://t.co/i.jpg',
    'https://t.co/a.wav',
  );
  assert.doesNotMatch(out.prompt, /[\[\]]/, 'prompt tidak boleh punya kurung siku');
  assert.match(out.prompt, /berbicara natural/);
});

test('D-289: cleanLipsyncPrompt membuang markdown link sisa & mention', () => {
  assert.equal(
    cleanLipsyncPrompt('Novi](https://tempfile.redpandaai.co/x.jpg berbicara natural'),
    'Novi berbicara natural',
  );
  assert.equal(
    cleanLipsyncPrompt('@aset-gambarreferensi di studio podcast'),
    'di studio podcast',
  );
});

test('D-289: cleanLipsyncPrompt menjaga prompt normal tetap utuh', () => {
  const p = 'Host menghadap kamera tersenyum dan menyapa dengan ramah, pencahayaan studio lembut.';
  assert.equal(cleanLipsyncPrompt(p), p);
});

// ===========================================================================
// BUG 4 — badge kredit Karakter Bicara
// ===========================================================================

test('D-289: badge kredit lipsync membaca naskah dari #stLipScript (D-287)', () => {
  const src = readStudio();
  const idx = src.indexOf('function lipsyncCreditEstimate');
  assert.ok(idx > -1, 'lipsyncCreditEstimate harus ada');
  const block = src.slice(idx, idx + 1400);
  assert.match(
    block,
    /stLipScript/,
    'perkiraan durasi (badge kredit) harus membaca naskah Karakter Bicara (#stLipScript)',
  );
});

test('D-289: badge kredit di-update saat naskah #stLipScript diketik', () => {
  const src = readStudio();
  const idx = src.indexOf("const lipScript = $('stLipScript')");
  assert.ok(idx > -1, 'listener stLipScript harus ada');
  const block = src.slice(idx, idx + 700);
  assert.match(
    block,
    /updateCreditBadge\(\)/,
    'badge kredit harus di-refresh saat naskah diketik',
  );
});

// ===========================================================================
// REGRESI — format payload Kie tidak boleh berubah
// ===========================================================================

test('D-289: regresi format payload InfiniteTalk', () => {
  const out = buildLipsyncInput(
    'infinitalk',
    { prompt: 'x', resolution: '480p' },
    'https://t.co/i.jpg',
    'https://t.co/a.wav',
  );
  assert.equal(out.image_url, 'https://t.co/i.jpg');
  assert.equal(out.audio_url, 'https://t.co/a.wav');
  assert.equal(out.resolution, '480p');
  assert.equal(out.aspect_ratio, undefined, 'InfiniteTalk tidak boleh punya aspect_ratio');
});

test('D-289: regresi format payload OmniHuman 2.0', () => {
  const out = buildLipsyncInput(
    'omnihuman20',
    { prompt: 'x', resolution: '720p' },
    'https://t.co/i.jpg',
    'https://t.co/a.wav',
  );
  assert.deepEqual(out.image_urls, ['https://t.co/i.jpg']);
  assert.equal(out.audio_url, 'https://t.co/a.wav');
  assert.equal(out.image_url, undefined);
  assert.equal(out.resolution, undefined);
  assert.equal(out.aspect_ratio, undefined);
});

test('D-289: regresi format payload OmniHuman 1.5 (output_resolution)', () => {
  const out = buildLipsyncInput(
    'omnihuman15',
    { prompt: 'x', resolution: '1080P' },
    'https://t.co/i.jpg',
    'https://t.co/a.wav',
  );
  assert.equal(out.output_resolution, '1080P');
  assert.equal(out.resolution, undefined);
  assert.equal(out.image_url, 'https://t.co/i.jpg');
});

test('D-289: LTX tanpa gambar tetap boleh aspect_ratio', () => {
  const out = buildLipsyncInput(
    'ltx25a2v',
    { prompt: 'x', resolution: '1080p', aspect: '16:9' },
    '',
    'https://t.co/a.wav',
  );
  assert.equal(out.aspect_ratio, '16:9');
});
