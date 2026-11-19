// D-158: Editor Video — helper murni (public/video-editor-core.js via globalThis).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/video-editor-core.js';

const VE = globalThis.VE_CORE;

test('fmtTime: detik → m:ss.d, aman untuk input aneh', () => {
  assert.equal(VE.fmtTime(0), '0:00.0');
  assert.equal(VE.fmtTime(7.34), '0:07.3');
  assert.equal(VE.fmtTime(73.4), '1:13.4');
  assert.equal(VE.fmtTime(61), '1:01.0');
  assert.equal(VE.fmtTime(-5), '0:00.0');
  assert.equal(VE.fmtTime(null), '0:00.0');
  assert.equal(VE.fmtTime('abc'), '0:00.0');
  // float noise: double 4.8 = 4.7999…, 7.8 = 7.7999…
  assert.equal(VE.fmtTime(4.8), '0:04.8');
  assert.equal(VE.fmtTime(7.8), '0:07.8');
  assert.equal(VE.fmtTime(4.799999999999999), '0:04.8');
  // carry: 59.999… → 1:00.0
  assert.equal(VE.fmtTime(59.999), '1:00.0');
});

test('timelineDuration & clipAt: matematika timeline multi-klip', () => {
  const clips = [
    { start: 1, end: 4 },   // 3 dtk
    { start: 0, end: 2.5 }, // 2.5 dtk
    { start: 2, end: 2.6 }, // 0.6 dtk
  ];
  assert.equal(VE.timelineDuration(clips), 6.1);
  assert.equal(VE.timelineDuration([]), 0);
  assert.equal(VE.timelineDuration(null), 0);
  let at = VE.clipAt(clips, 1.5);
  assert.equal(at.index, 0); assert.equal(at.clip, clips[0]); assert.equal(at.localT, 1.5);
  at = VE.clipAt(clips, 4); // 1 dtk masuk klip 2
  assert.equal(at.index, 1); assert.equal(at.localT, 1);
  at = VE.clipAt(clips, 99); // di luar rentang → klip terakhir, di ujung
  assert.equal(at.index, 2); assert.equal(at.localT, 0.6);
  assert.equal(VE.clipAt([], 1), null);
});

test('clampTrim: batas aman (0 ≤ start < end ≤ dur, min 0.5 dtk)', () => {
  assert.deepEqual(VE.clampTrim(10, 2, 8), { start: 2, end: 8 });
  assert.deepEqual(VE.clampTrim(10, -1, 99), { start: 0, end: 10 });
  assert.deepEqual(VE.clampTrim(10, 5, 5.2), { start: 5, end: 5.5 });
  assert.deepEqual(VE.clampTrim(10, 9.8, 10), { start: 9.5, end: 10 });
  assert.deepEqual(VE.clampTrim(0.3, 0, 0.3), { start: 0, end: 0.3 }); // video pendek: min seg mengikuti durasi
  assert.deepEqual(VE.clampTrim(null, null, null), { start: 0, end: 0.5 });
});

test('splitAt: bagi klip di tengah — dua segmen berbagi sumber yang sama', () => {
  const c = { id: 'c1', url: 'blob:x', start: 2, end: 12, muted: true, thumb: 't', ready: true };
  const p = VE.splitAt(c, 6);
  assert.equal(p.left.start, 2); assert.equal(p.left.end, 6);
  assert.equal(p.right.start, 6); assert.equal(p.right.end, 12);
  assert.equal(p.left.url, 'blob:x'); assert.equal(p.right.url, 'blob:x');
  assert.equal(p.left.muted, true); assert.equal(p.right.thumb, 't');
  assert.notEqual(p.right.id, undefined); // id ikut tersalin (pemanggil mengganti dgn id baru)
  // terlalu mepet ke ujung / input aneh -> null
  assert.equal(VE.splitAt(c, 2.4), null);   // sisi kiri < 0.5 dtk
  assert.equal(VE.splitAt(c, 11.8), null);  // sisi kanan < 0.5 dtk
  assert.equal(VE.splitAt(c, 2), null);
  assert.equal(VE.splitAt(c, 12), null);
  assert.equal(VE.splitAt(c, NaN), null);
  assert.equal(VE.splitAt(null, 5), null);
  // klip 0,8 dtk tidak bisa dibagi dua (tiap sisi harus ≥ 0,5 dtk)
  assert.equal(VE.splitAt({ start: 0, end: 0.8 }, 0.4), null);
});

test('coverFit: seluruh kanvas terisi (mirip object-fit:cover)', () => {
  // video 16:9 ke kanvas 9:16 → diskalakan pakai tinggi
  let f = VE.coverFit(1920, 1080, 1080, 1920);
  assert.ok(Math.abs(f.dh - 1920) < 1e-9); assert.equal(f.dy, 0);
  assert.ok(Math.abs(f.dw - 3413.3333) < 0.01);
  assert.ok(Math.abs(f.dx + (f.dw - 1080) / 2) < 1e-9);
  // video 9:16 ke kanvas 1:1 → diskalakan pakai lebar
  f = VE.coverFit(1080, 1920, 1000, 1000);
  assert.ok(Math.abs(f.dw - 1000) < 1e-9); assert.equal(f.dx, 0);
  assert.ok(Math.abs(f.dh - 1777.7778) < 0.01);
  assert.ok(Math.abs(f.dy + (f.dh - 1000) / 2) < 1e-9);
});

test('pickMime: urutan preferensi mp4 dulu, lalu webm; null kalau tak ada', () => {
  assert.deepEqual(VE.pickMime(() => true), { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' });
  assert.deepEqual(VE.pickMime((m) => m === 'video/webm;codecs=vp9,opus'), { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' });
  assert.deepEqual(VE.pickMime((m) => m === 'video/webm'), { mime: 'video/webm', ext: 'webm' });
  assert.equal(VE.pickMime(() => false), null);
  assert.equal(VE.pickMime(() => { throw new Error('x'); }), null); // supports melempar → lanjut kandidat lain
});

test('exportName & konstanta: rasio, filter, font', () => {
  const n = VE.exportName('mp4', new Date('2026-11-20T00:00:00Z'));
  assert.ok(/^sherly-video-2026-11-20-[a-z0-9]{6}\.mp4$/.test(n));
  assert.equal(VE.exportName('').includes('.webm'), true);
  assert.deepEqual(VE.VE_RATIOS['9:16'], [1080, 1920]);
  assert.deepEqual(VE.VE_RATIOS['16:9'], [1920, 1080]);
  assert.equal(VE.VE_FILTERS.length, 8);
  assert.equal(VE.VE_FILTERS[0][0], 'normal');
  assert.equal(VE.VFONTS.list.length, 6);
  assert.equal(VE.VFONTS.weight.Inter, 700);
  assert.equal(VE.VFONTS.family['Bebas Neue'], "'Bebas Neue', sans-serif");
});
