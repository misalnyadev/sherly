/**
 * D-275: buka durasi Motion Graphics (maks 10 detik -> 30 detik).
 *
 * Cakupan test:
 *  - Whitelist durasi server & client SINKRON (tidak boleh berbeda).
 *  - Durasi baru (12/15/20/25/30 detik) diterima normalisasi server.
 *  - Durasi di luar whitelist ditolak (fallback ke default).
 *  - Render server benar-benar memakai durasi yang diminta (regresi bug:
 *    `durationInFrames` dihitung tapi tidak pernah dipakai -> render selalu
 *    menghasilkan durasi default komposisi).
 *  - Root.tsx punya `calculateMetadata` supaya durasi dinamis dipakai
 *    Remotion saat selectComposition().
 *  - Bitrate client tidak anjlok di lantai 800 kbps untuk durasi panjang.
 *  - Intro/stat-card "menahan" (hold) untuk durasi panjang, bukan layar diam.
 *  - Video sumber di-loop kalau lebih pendek dari durasi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  MG_TEMPLATES, MG_MAX_DURATION, MG_DURATIONS, normalizeRenderRequest,
} from '../server/motion-graphics.js';
import {
  MG_CLIENT_TEMPLATES, bitrateForDuration, parseCaptions, drawCompositionFrame,
} from '../public/motion-graphics.js';

const rootTsx = readFileSync(
  path.resolve('motion-graphics/src/Root.tsx'),
  'utf8',
);
const serverMg = readFileSync(path.resolve('server/motion-graphics.js'), 'utf8');
const clientMg = readFileSync(path.resolve('public/motion-graphics.js'), 'utf8');

// ===== Whitelist durasi =====

test('D-275: batas durasi Motion Graphics = 30 detik', () => {
  assert.equal(MG_MAX_DURATION, 30);
  assert.equal(MG_DURATIONS.length, 9);
  assert.deepEqual(MG_DURATIONS, [5, 6, 8, 10, 12, 15, 20, 25, 30]);
});

test('D-275: durasi server & client SINKRON (satu sumber kebenaran)', () => {
  assert.equal(MG_CLIENT_TEMPLATES.length, MG_TEMPLATES.length);
  for (let i = 0; i < MG_TEMPLATES.length; i++) {
    const s = MG_TEMPLATES[i];
    const c = MG_CLIENT_TEMPLATES[i];
    assert.equal(c.id, s.id, `template urutan ${i} harus sama`);
    assert.deepEqual(
      c.durations, s.durations,
      `durasi template ${s.id} harus sama di server & client`,
    );
    assert.equal(c.defaultDuration, s.defaultDuration);
  }
});

test('D-275: captioned-clip bisa sampai 30 detik', () => {
  const clip = MG_TEMPLATES.find((t) => t.id === 'captioned-clip');
  assert.ok(clip, 'template captioned-clip harus ada');
  assert.ok(clip.durations.includes(30), 'harus bisa pilih 30 detik');
  assert.ok(clip.durations.includes(20), 'harus bisa pilih 20 detik');
  assert.ok(clip.durations.includes(25), 'harus bisa pilih 25 detik');
});

test('D-275: semua durasi template <= batas 30 detik', () => {
  for (const t of MG_TEMPLATES) {
    for (const d of t.durations) {
      assert.ok(d <= MG_MAX_DURATION, `${t.id}: durasi ${d} melebihi batas`);
      assert.ok(d > 0, `${t.id}: durasi ${d} tidak valid`);
    }
    assert.ok(
      t.durations.includes(t.defaultDuration),
      `${t.id}: defaultDuration harus ada di daftar durasi`,
    );
  }
});

// ===== Normalisasi request =====

test('D-275: durasi 30 detik diterima normalisasi server', () => {
  const req = normalizeRenderRequest({
    template: 'captioned-clip',
    aspect: '9:16',
    duration: 30,
    props: {},
  });
  assert.equal(req.durationInSeconds, 30);
  assert.equal(req.inputProps.durationInSeconds, 30);
});

test('D-275: durasi 20 detik diterima normalisasi server', () => {
  const req = normalizeRenderRequest({
    template: 'captioned-clip',
    aspect: '9:16',
    duration: 20,
    props: {},
  });
  assert.equal(req.durationInSeconds, 20);
});

test('D-275: durasi di luar whitelist -> fallback ke default', () => {
  const req = normalizeRenderRequest({
    template: 'captioned-clip',
    aspect: '9:16',
    duration: 45,
    props: {},
  });
  assert.equal(req.durationInSeconds, 8, 'harus fallback ke defaultDuration');
});

test('D-275: durasi 31 detik ditolak (melewati batas)', () => {
  const req = normalizeRenderRequest({
    template: 'captioned-clip',
    aspect: '9:16',
    duration: 31,
    props: {},
  });
  assert.equal(req.durationInSeconds, 8, '31 detik tidak boleh dipakai');
});

// ===== Regresi: render server harus memakai durasi yang diminta =====

test('D-275: render server memakai durationInFrames hasil hitungan', () => {
  // Regresi: `durationInFrames` pernah dihitung lalu dibuang, sehingga
  // renderMedia() memakai durasiInFrames statis dari Root.tsx.
  assert.ok(
    /durationInFrames\s*=\s*Math\.max/.test(serverMg),
    'server harus menghitung durationInFrames',
  );
  assert.ok(
    /compositionWithDuration/.test(serverMg),
    'server harus memakai komposisi dengan durasi yang diminta',
  );
  assert.ok(
    /composition:\s*compositionWithDuration/.test(serverMg),
    'renderMedia harus memakai compositionWithDuration',
  );
  // Tidak boleh ada renderMedia yang memakai `composition` mentah.
  assert.ok(
    !/composition,\s*\n\s*serveUrl/.test(serverMg),
    'renderMedia tidak boleh memakai composition statis',
  );
});

test('D-275: Root.tsx punya calculateMetadata untuk semua komposisi', () => {
  const compositions = rootTsx.match(/<Composition\b/g) || [];
  const calcMeta = rootTsx.match(/calculateMetadata=\{calculateMetadata\d*\}/g) || [];
  assert.equal(
    calcMeta.length, compositions.length,
    'setiap komposisi harus punya calculateMetadata',
  );
  assert.ok(
    /MG_MAX_DURATION\s*=\s*30/.test(rootTsx),
    'batas durasi di Root.tsx harus 30 detik',
  );
});

test('D-275: calculateMetadata membatasi durasi ke 30 detik', () => {
  // durationFromProps() harus clamp ke [1, MG_MAX_DURATION].
  assert.ok(
    /Math\.min\(Math\.max\(seconds,\s*1\),\s*MG_MAX_DURATION\)/.test(rootTsx),
    'durasi harus di-clamp ke batas 30 detik',
  );
});

// ===== Bitrate & ukuran =====

test('D-275: bitrate durasi panjang tidak anjlok di lantai lama (800 kbps)', () => {
  for (const d of [15, 20, 25, 30]) {
    const br = bitrateForDuration(d);
    assert.ok(
      br >= 1_400_000,
      `durasi ${d} detik: bitrate ${br} terlalu kecil, video jadi pecil`,
    );
    assert.ok(br <= 2_500_000, `durasi ${d} detik: bitrate ${br} terlalu besar`);
  }
});

test('D-275: durasi pendek tetap ukurannya di bawah 4 MB', () => {
  for (const d of [5, 6, 8, 10, 12]) {
    const br = bitrateForDuration(d);
    const bytes = (br * d) / 8;
    assert.ok(
      bytes <= 4 * 1024 * 1024,
      `durasi ${d} detik: ~${(bytes / 1024 / 1024).toFixed(2)} MB melebihi 4 MB`,
    );
  }
});

test('D-275: client punya batas keras 24 MB (signed-upload tanpa batas body)', () => {
  assert.ok(
    /HARD_MAX_BYTES\s*=\s*24\s*\*\s*1024\s*\*\s*1024/.test(clientMg),
    'batas keras client harus 24 MB',
  );
  assert.ok(
    !/if\s*\(finalBlob\.size\s*>\s*MG_UPLOAD_MAX_BYTES\)\s*\{\s*throw/.test(clientMg),
    'tidak boleh lempar error kalau file > 4 MB (durasi panjang)',
  );
});

// ===== Subtitle & komposisi =====

test('D-275: subtitle ikut memenuhi durasi baru', () => {
  const cues = parseCaptions('Baris satu\nBaris dua\nBaris tiga', 30000);
  assert.equal(cues.length, 3);
  const last = cues[cues.length - 1];
  assert.ok(last.endMs <= 30000, 'cue terakhir tidak boleh melewati durasi');
  assert.ok(
    last.endMs > 20000,
    `cue terakhir harus mendekati durasi (endMs=${last.endMs})`,
  );
});

test('D-275: komposisi digambar pada durasi panjang tanpa error', () => {
  // Pakai stub canvas 2D supaya tidak butuh browser.
  const calls = [];
  const ctx = new Proxy(
    {
      canvas: {width: 1080, height: 1920},
      measureText: (t) => ({width: String(t).length * 10}),
      createLinearGradient: () => ({addColorStop() {}}),
      createRadialGradient: () => ({addColorStop() {}}),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'save' || prop === 'restore') return () => {};
        return (...args) => {
          calls.push(prop);
        };
      },
      set() {
        return true;
      },
    },
  );
  for (const id of ['branded-intro', 'captioned-clip', 'stat-card']) {
    for (const t of [0, 1.5, 10, 29.9]) {
      assert.doesNotThrow(() => {
        drawCompositionFrame(ctx, id, 1080, 1920, t, {title: 'X', value: '1'}, 30);
      }, `${id} @ ${t} detik harus bisa digambar`);
    }
  }
});

test('D-275: intro & stat-card menahan (hold) + bernapas untuk durasi panjang', () => {
  assert.ok(
    /isHolding/.test(clientMg),
    'client harus punya konsep "menahan" untuk durasi panjang',
  );
  assert.ok(
    /breath/.test(clientMg),
    'client harus punya napas pelan supaya layar tidak diam total',
  );
  const rootFiles = [
    readFileSync(path.resolve('motion-graphics/src/compositions/BrandedIntro.tsx'), 'utf8'),
    readFileSync(path.resolve('motion-graphics/src/compositions/StatCard.tsx'), 'utf8'),
  ];
  for (const src of rootFiles) {
    assert.ok(/isHolding/.test(src), 'komposisi server harus punya "hold"');
    assert.ok(/breathScale/.test(src), 'komposisi server harus punya napas pelan');
  }
});

test('D-275: video sumber di-loop kalau lebih pendek dari durasi', () => {
  assert.ok(
    /t\s*%\s*vDur/.test(clientMg),
    'client harus looping video sumber (t % vDur)',
  );
  const captioned = readFileSync(
    path.resolve('motion-graphics/src/compositions/CaptionedClip.tsx'),
    'utf8',
  );
  assert.ok(
    /<video[\s\S]{0,200}loop/.test(captioned),
    'komposisi server harus set loop pada <video>',
  );
});

// ===== Regresi: draft panel Pengaturan =====

test('D-275: daftar durasi ikut template DRAFT (bukan template tersimpan)', () => {
  // Regresi: `settingChoices('mgdur')` memakai `motionTemplate()` yang
  // membaca `state.motionTemplateId`. Padahal di panel Pengaturan, template
  // yang dipilih ada di `settingsDraft`. Akibatnya user memilih "Klip
  // Bersubtitle" (30 detik) tapi daftar durasi masih milik template lama
  // (intro, 15 detik) — opsi 20/25/30 detik ikut tersembunyi.
  const studioJs = readFileSync(path.resolve('public/studio.js'), 'utf8');
  const mgDurBlock = studioJs.match(
    /if \(which === 'mgdur'\) \{[\s\S]{0,600}?\n    \}/,
  );
  assert.ok(mgDurBlock, 'blok mgdur harus ada di studio.js');
  assert.ok(
    /ctx\.motionTemplateId/.test(mgDurBlock[0]),
    'daftar durasi harus memakai template dari draft (ctx.motionTemplateId)',
  );
});
