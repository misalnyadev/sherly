import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fs from 'node:fs';
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

test('D-249: ada 4 template Motion Graphics (intro, caption, stat card, beat sequence)', () => {
  const ids = MG_TEMPLATES.map((t) => t.id);
  // D-276: template ke-4 = "Rangkaian Beat" (video multi-bloc + CTA).
  assert.deepEqual(ids, ['branded-intro', 'captioned-clip', 'stat-card', 'beat-sequence']);
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

test('D-251: mode Motion Graphics SELALU tampil (pilihan, bukan hilang)', () => {
  // D-251: render utama di browser, jadi mode tidak lagi bergantung status
  // renderer server. Mode yang hilang diam-diam bikin user bingung.
  assert.match(studioJs, /function availableContentTypes\(\)/);
  assert.match(studioJs, /return CONTENT_TYPES\.slice\(\);/);
  assert.doesNotMatch(studioJs, /CONTENT_TYPES\.filter\(\(\[v\]\) => v !== 'motion'/);
  // Status 'installing' -> polling ulang tiap 3 detik (fallback server).
  assert.match(studioJs, /motionStatus === 'installing'[\s\S]*?setTimeout\(\(\) => \{ loadMotionTemplates\(\); \}, 3000\)/);
  // Bar isian TIDAK lagi menampilkan spinner "Menyiapkan…" (bikin beku di Vercel).
  assert.doesNotMatch(studioJs, /st-motion-status/);
  // Tapi tetap ada catatan renderer (jelas-jelas, bukan diam).
  assert.match(studioJs, /st-motion-note/);
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

test('D-249: health endpoint melaporkan status renderer Motion Graphics', () => {
  // Kalau renderer belum terpasang, health endpoint jadi cara cepet cek
  // tanpa buka UI.
  assert.match(appJs, /app\.get\('\/api\/health', async/);
  assert.match(appJs, /motionGraphics: \{ available: motionGraphics\.ok/);
});

test('D-249: server auto-install dependency Remotion kalau belum ada', () => {
  // User tidak perlu ingat `npm run setup` — server pasang sendiri sekali
  // di background (hanya di server non-serverless).
  assert.match(appJs, /ensureMotionGraphicsInstalled\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(appJs, /availability\.status === 'serverless' \? 'serverless'/);
  const mg = readFileSync('server/motion-graphics.js', 'utf8');
  assert.match(mg, /export function ensureMotionGraphicsInstalled\(\)/);
  assert.match(mg, /spawn\('npm', \['install', '--no-audit', '--no-fund'\]/);
  // Cache renderer harus di-reset setelah install supaya modul baru terbaca.
  assert.match(mg, /rendererPromise = null;\s*\n\s*serveUrlPromise = null;/);
});

test('D-249: composer di mode Motion Graphics tidak mengulang placeholder kolom template', () => {
  // Kolom pertama template sudah punya input sendiri di bar Motion Graphics.
  // Kalau composer pakai placeholder yang sama, teksnya dobel di layar.
  assert.match(studioJs, /: isMotion \? 'Isi tambahan… \(opsional\)'/);
  assert.doesNotMatch(studioJs, /: isMotion \? \(motionTemplate\(\)\?\.fields\?\.\[0\]\?\.placeholder/);
});

test('D-249: ada script setup yang PASANG kedua node_modules (root + motion-graphics)', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts.setup, 'package.json harus punya script "setup"');
  assert.match(pkg.scripts.setup, /npm install --prefix motion-graphics/);
  // Server motion-graphics wajib ikut dicek syntax-nya.
  assert.match(pkg.scripts.check, /node --check server\/motion-graphics\.js/);
});

// ===== D-251: render di browser (Canvas 2D + WebCodecs) =====
//
// Jalur utama Motion Graphics pindah ke browser supaya deployment Vercel
// serverless (filesystem read-only, fungsi <= 60 detik) tetap bisa render
// tanpa server render terpisah dan tanpa biaya bulanan.

test('D-251: ada route POST untuk menyimpan hasil render client-side', () => {
  assert.match(appJs, /app\.post\('\/api\/studio\/motion-graphics\/asset', requireUser, requireAdmin, assetUpload/);
  // Route harus disimpan sebagai aset 'generate' dengan meta motion-graphics.
  assert.match(appJs, /kind: 'motion-graphics'/);
  assert.match(appJs, /renderer: 'client'/);
});

test('D-251: server认出 lingkungan serverless dan tidak auto-install Remotion', () => {
  const mg = readFileSync('server/motion-graphics.js', 'utf8');
  assert.match(mg, /export function isServerlessRuntime\(\)/);
  assert.match(mg, /process\.env\.VERCEL/);
  assert.match(mg, /process\.env\.AWS_LAMBDA_FUNCTION_NAME/);
  // Auto-install harus dilewati di serverless (fs read-only).
  assert.match(mg, /if \(isServerlessRuntime\(\)\) \{[\s\S]{0,400}installState\.status = 'serverless'/);
  // Probe availability juga harus melaporkan status 'serverless'.
  assert.match(mg, /status: 'serverless'/);
});

test('D-251: template Motion Graphics selalu dikirim walau renderer server tak ada', () => {
  // Render client-side butuh katalog template + field.
  assert.match(appJs, /templates: MG_TEMPLATES,/);
});

test('D-251: UI memakai render client-side lalu upload hasil ke route aset', () => {
  assert.match(studioJs, /import\('\.\/motion-graphics\.js'\)/);
  assert.match(studioJs, /fetch\('\/api\/studio\/motion-graphics\/asset', \{method: 'POST'/);
  // Tidak boleh lagi menampilkan status "Menyiapkan renderer video…" yang
  // membeku di Vercel.
  assert.doesNotMatch(studioJs, /Menyiapkan renderer video/);
});

test('D-251: bundle mediabunny tersedia sebagai vendor ESM', () => {
  assert.ok(fs.existsSync('public/vendor/mediabunny.min.mjs'), 'vendor mediabunny harus ada');
  const src = readFileSync('public/vendor/mediabunny.min.mjs', 'utf8');
  assert.ok(src.length > 100_000, 'bundle harus berisi kode mediabunny');
  assert.match(src, /export\s*\{/);
});

test('D-251: package.json punya dependency mediabunny', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.ok(pkg.dependencies?.mediabunny, 'mediabunny harus jadi dependency root');
});

// ===== D-252: batas ukuran upload (Vercel serverless 4,5 MB) =====
//
// Hasil render client-side dikirim sebagai multipart ke server. Platform
// Vercel membatasi request body function serverless di 4,5 MB (hard limit)
// -> file yang lebih besar ditolak 413 sebelum sampai ke route.

test('D-252: server punya batas upload khusus Motion Graphics', () => {
  assert.match(appJs, /MG_UPLOAD_MAX_BYTES/);
  assert.match(appJs, /isServerlessRuntime\(\) \? MG_UPLOAD_MAX_BYTES : MAX_ASSET_BYTES/);
  // Route harus balas 413 (bukan 500 generik) kalau file kelewat besar.
  assert.match(appJs, /res\.status\(413\)\.json\(/);
});

test('D-252: modul server mengekspor batas upload 4 MB', async () => {
  const mg = await import('../server/motion-graphics.js');
  assert.equal(mg.MG_UPLOAD_MAX_BYTES, 4 * 1024 * 1024);
  assert.ok(mg.MG_UPLOAD_MAX_BYTES <= 4.5 * 1024 * 1024,
    'harus di bawah batas platform Vercel 4,5 MB');
});

test('D-252: bitrate client-side dinamis per durasi', () => {
  const src = readFileSync('public/motion-graphics.js', 'utf8');
  assert.match(src, /export function bitrateForDuration/);
  // CanvasSource harus memakai bitrate dinamis, bukan angka tetap.
  assert.match(src, /bitrate: bitrateForDuration\(durationInSeconds\)/);
  assert.doesNotMatch(src, /bitrate: 8_000_000/);
});

test('D-252: ada jaring pengaman kompres ulang + pesan jelas', () => {
  const src = readFileSync('public/motion-graphics.js', 'utf8');
  assert.match(src, /reencodeSmaller/);
  assert.match(src, /phase: 'compressing'/);
  assert.match(src, /Pilih durasi lebih shorter|Pilih durasi lebih pendek/);
  // UI harus memberi pesan khusus untuk 413.
  assert.match(studioJs, /up\.status === 413/);
  assert.match(studioJs, /terlalu besar untuk dikirim ke server/);
});

test('D-252: gagal kirim -> video tetap diunduh ke perangkat user', () => {
  // Render-nya jangan hilang hanya karena upload gagal.
  assert.match(studioJs, /Gagal kirim ke galeri — videonya sudah diunduh ke perangkat kamu\./);
  assert.match(studioJs, /URL\.createObjectURL\(result\.blob\)/);
  assert.match(studioJs, /a\.download = 'motion-graphics-'/);
});

// ===== D-253: multipart Motion Graphics =====
//
// Bug: `authHeaders()` memaksa `Content-Type: application/json` lalu dipakai
// untuk request multipart (FormData). Akibatnya Express tidak mem-parse
// multipart -> req.file undefined -> 400 "File video wajib diunggah" -> video
// tidak pernah masuk galeri (hanya terunduh fallback).
//
// Pola benar (sudah dipakai public/bank-suara.js): header auth TANPA
// Content-Type untuk multipart; Content-Type JSON hanya untuk body JSON.

test('D-253: upload Motion Graphics pakai header multipart (tanpa Content-Type)', () => {
  assert.match(studioJs, /const authHeadersMultipart = async \(\)/);
  assert.match(studioJs, /'Authorization': 'Bearer ' \+ t/);
  // Fetch upload WAJIB pakai authHeadersMultipart (bukan authHeaders).
  assert.match(studioJs, /motion-graphics\/asset', \{method: 'POST', headers: await authHeadersMultipart\(\), body: fd\}/);
  // authHeaders (JSON) tidak boleh dipakai untuk FormData.
  assert.doesNotMatch(studioJs, /motion-graphics\/asset'[^\n]*headers: await authHeaders\(\)/);
});

test('D-253: authHeaders JSON tetap pakai Content-Type application/json', () => {
  assert.match(studioJs, /const authHeaders = async \(\) => \(\{\s*'Content-Type': 'application\/json',/);
  // Helper multipart tidak boleh menyertakan Content-Type sama sekali.
  const m = studioJs.match(/const authHeadersMultipart = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(m, 'helper authHeadersMultipart harus ada');
  assert.doesNotMatch(m[0], /Content-Type/, 'header multipart tidak boleh memaksa Content-Type');
});

test('D-253: tidak ada fetch FormData yang salah pakai header JSON', () => {
  // Semua fetch dengan body FormData tidak boleh pakai authHeaders() (JSON).
  const lines = studioJs.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/body:\s*fd\b/.test(line)) continue;
    assert.doesNotMatch(line, /headers:\s*await authHeaders\(\)/,
      'baris ' + (i + 1) + ' kirim FormData tapi pakai header JSON');
  }
});
