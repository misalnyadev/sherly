import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import {
  MG_TEMPLATES, MG_ASPECTS, MOTION_GRAPHICS_PROVIDER,
  normalizeRenderRequest, getTemplate, licenseConfig,
} from '../server/motion-graphics.js';

const html = readFileSync('public/index.html', 'utf8');
const studioJs = readFileSync('public/studio.js', 'utf8');
const appJs = readFileSync('server/app.js', 'utf8');

const MG_SRC = path.resolve('motion-graphics/src');

/**
 * D-249: Mode "Motion Graphics" — render video programatik (Remotion).
 * Render lokal di server sendiri -> biaya $0 (bukan AWS Lambda).
 */

// ===== Server: template & normalisasi =====

test('D-249: ada 3 template Motion Graphics (intro, caption, stat card)', () => {
  const ids = MG_TEMPLATES.map((t) => t.id);
  assert.deepEqual(ids, ['branded-intro', 'captioned-clip', 'stat-card']);
});

test('D-249: setiap template punya label, durasi, rasio, dan field', () => {
  for (const t of MG_TEMPLATES) {
    assert.ok(t.label, 'template harus punya label');
    assert.ok(Array.isArray(t.durations) && t.durations.length, 'template harus punya durasi');
    assert.ok(Array.isArray(t.aspects) && t.aspects.length, 'template harus punya rasio');
    assert.ok(Array.isArray(t.fields) && t.fields.length, 'template harus punya field isian');
    for (const f of t.fields) {
      assert.ok(f.key && f.label, 'field harus punya key + label');
    }
  }
});

test('D-249: rasio Motion Graphics hanya 9:16 / 16:9 / 1:1', () => {
  assert.deepEqual(Object.keys(MG_ASPECTS).sort(), ['16:9', '1:1', '9:16']);
  assert.deepEqual(MG_ASPECTS['9:16'], { width: 1080, height: 1920 });
  assert.deepEqual(MG_ASPECTS['16:9'], { width: 1920, height: 1080 });
});

test('D-249: template tidak dikenal -> error 400', () => {
  assert.throws(() => normalizeRenderRequest({ template: 'nope' }), (e) => e.status === 400);
});

test('D-249: kolom wajib kosong -> error 400', () => {
  assert.throws(
    () => normalizeRenderRequest({ template: 'branded-intro', props: {} }),
    (e) => e.status === 400,
  );
});

test('D-249: request valid -> composition id + durasi + rasio ternormalisasi', () => {
  const req = normalizeRenderRequest({
    template: 'branded-intro',
    aspect: '16:9',
    duration: 8,
    props: { title: 'Halo', subtitle: 'Dunia' },
  });
  assert.equal(req.compositionId, 'BrandedIntroWide');
  assert.equal(req.aspect, '16:9');
  assert.equal(req.durationInSeconds, 8);
  assert.equal(req.width, 1920);
  assert.equal(req.height, 1080);
  assert.equal(req.inputProps.title, 'Halo');
  assert.equal(req.inputProps.durationInSeconds, 8);
});

test('D-249: rasio di luar daftar template -> fallback ke rasio pertama', () => {
  const req = normalizeRenderRequest({
    template: 'captioned-clip',
    aspect: '1:1',           // tidak didukung template caption
    props: { captionsText: 'halo' },
  });
  assert.equal(req.aspect, '9:16');
  assert.equal(req.compositionId, 'CaptionedClipVertical');
});

test('D-249: durasi di luar daftar template -> fallback ke default', () => {
  const req = normalizeRenderRequest({
    template: 'stat-card',
    duration: 99,
    props: { value: '3.2x', label: 'cepat' },
  });
  assert.equal(req.durationInSeconds, getTemplate('stat-card').defaultDuration);
});

test('D-249: provider task = remotion', () => {
  assert.equal(MOTION_GRAPHICS_PROVIDER, 'remotion');
});

// ===== Server: lisensi =====

test('D-249: tanpa REMOTION_LICENSE_KEY -> licenseKey null (string kosong invalid)', () => {
  const prev = process.env.REMOTION_LICENSE_KEY;
  delete process.env.REMOTION_LICENSE_KEY;
  try {
    const cfg = licenseConfig();
    assert.equal(cfg.licenseKey, null);
    assert.equal(cfg.isProduction, false);
  } finally {
    if (prev !== undefined) process.env.REMOTION_LICENSE_KEY = prev;
  }
});

test('D-249: dengan REMOTION_LICENSE_KEY -> dipakai + isProduction true', () => {
  const prev = process.env.REMOTION_LICENSE_KEY;
  process.env.REMOTION_LICENSE_KEY = 'test-key-123';
  try {
    const cfg = licenseConfig();
    assert.equal(cfg.licenseKey, 'test-key-123');
    assert.equal(cfg.isProduction, true);
  } finally {
    if (prev === undefined) delete process.env.REMOTION_LICENSE_KEY;
    else process.env.REMOTION_LICENSE_KEY = prev;
  }
});

// ===== Route =====

test('D-249: route Motion Graphics ada di server', () => {
  assert.match(appJs, /app\.get\('\/api\/studio\/motion-graphics\/templates'/);
  assert.match(appJs, /app\.post\('\/api\/studio\/motion-graphics'/);
  assert.match(appJs, /app\.get\('\/api\/studio\/motion-graphics\/:id'/);
});

test('D-249: render dijalankan sebagai task (provider remotion), bukan request blocking', () => {
  assert.match(appJs, /provider:\s*MOTION_GRAPHICS_PROVIDER/);
  // Render di background: tidak di-await di dalam handler POST.
  assert.match(appJs, /runMotionGraphicsRender\(req, task, spec\)\.catch\(\(\) => \{\}\)/);
});

test('D-249: hasil render disimpan sebagai aset (bucket studio-assets)', () => {
  assert.match(appJs, /saveAsset\(supabase, userId, \{[\s\S]*?mimetype:\s*'video\/mp4'/);
});

// ===== Project Remotion =====

test('D-249: project motion-graphics punya entry + Root', () => {
  assert.ok(existsSync(path.join(MG_SRC, 'index.ts')), 'entry point Remotion harus ada');
  assert.ok(existsSync(path.join(MG_SRC, 'Root.tsx')), 'Root.tsx harus ada');
  assert.match(readFileSync(path.join(MG_SRC, 'index.ts'), 'utf8'), /registerRoot\(RemotionRoot\)/);
});

test('D-249: Root mendaftarkan 3 komposisi (intro, caption, stat card)', () => {
  const root = readFileSync(path.join(MG_SRC, 'Root.tsx'), 'utf8');
  assert.match(root, /id="BrandedIntro"/);
  assert.match(root, /id="CaptionedClipVertical"/);
  assert.match(root, /id="StatCardVertical"/);
});

test('D-249: tiap komposisi punya durasi & fps eksplisit', () => {
  const root = readFileSync(path.join(MG_SRC, 'Root.tsx'), 'utf8');
  const fps = (root.match(/fps=\{FPS\}/g) || []).length;
  const dur = (root.match(/durationInFrames=\{[^}]+\}/g) || []).length;
  assert.ok(fps >= 8, 'setiap Composition harus punya fps');
  assert.ok(dur >= 8, 'setiap Composition harus punya durationInFrames');
});

// ===== Aturan animasi Remotion =====

test('D-249: komposisi wajib pakai useCurrentFrame (bukan CSS animation)', () => {
  const files = [
    'compositions/BrandedIntro.tsx',
    'compositions/CaptionedClip.tsx',
    'compositions/StatCard.tsx',
  ];
  for (const f of files) {
    const src = readFileSync(path.join(MG_SRC, f), 'utf8');
    assert.match(src, /useCurrentFrame\(\)/, `${f} harus memakai useCurrentFrame()`);
    assert.match(src, /useVideoConfig\(\)/, `${f} harus memakai useVideoConfig()`);
    // CSS transition/animation TIDAK akan ter-render di Remotion.
    assert.doesNotMatch(src, /animation\s*:\s*['"]/, `${f} tidak boleh pakai CSS animation`);
    assert.doesNotMatch(src, /transition\s*:\s*['"]/, `${f} tidak boleh pakai CSS transition`);
  }
});

test('D-249: fps diambil dari useVideoConfig (bukan konstanta global)', () => {
  for (const f of ['compositions/BrandedIntro.tsx', 'compositions/CaptionedClip.tsx', 'compositions/StatCard.tsx']) {
    const src = readFileSync(path.join(MG_SRC, f), 'utf8');
    assert.match(src, /const\s*\{[^}]*fps[^}]*\}\s*=\s*useVideoConfig\(\)/, `${f} harus ambil fps dari useVideoConfig`);
  }
});

test('D-249: komposisi pakai palet Sherly (tidak ada warna asing)', () => {
  const theme = readFileSync(path.join(MG_SRC, 'theme.ts'), 'utf8');
  for (const token of ['#070b14', '#24142a', '#f044a8', '#f4f5fb']) {
    assert.ok(theme.includes(token), `palet harus punya ${token}`);
  }
});

// ===== UI Studio =====

test('D-249: mode Motion Graphics ada di CONTENT_TYPES', () => {
  assert.match(studioJs, /\['motion',\s*'Motion Graphics',\s*'film'\]/);
});

test('D-249: mode Motion Graphics disembunyikan kalau renderer tidak siap', () => {
  assert.match(studioJs, /function availableContentTypes\(\)/);
  assert.match(studioJs, /CONTENT_TYPES\.filter\(\(\[v\]\) => v !== 'motion' \|\| motionAvailable\)/);
});

test('D-249: UI punya tombol Render + bar template + bar progres', () => {
  assert.match(studioJs, /id="stMotionBtn"/);
  assert.match(studioJs, /id="stMotionBar"/);
  assert.match(studioJs, /id="stMotionProgress"/);
  assert.match(html, /\.st-motion-bar\{/);
  assert.match(html, /\.st-motion-field input/);
});

test('D-249: template Motion Graphics diambil dari server', () => {
  assert.match(studioJs, /fetch\('\/api\/studio\/motion-graphics\/templates'/);
  assert.match(studioJs, /fetch\('\/api\/studio\/motion-graphics', \{\s*method: 'POST'/);
  assert.match(studioJs, /fetch\('\/api\/studio\/motion-graphics\/' \+ motionTask\.id/);
});

test('D-249: template punya setting sendiri (template + durasi), tanpa provider', () => {
  assert.match(studioJs, /key: 'mgtpl', label: 'Template'/);
  assert.match(studioJs, /key: 'mgdur', label: 'Durasi'/);
  // Mode Motion Graphics tidak punya Provider/Model/Tier/Resolusi.
  assert.match(studioJs, /isMotion\) \{[\s\S]*?list\.length = 0;/);
});
