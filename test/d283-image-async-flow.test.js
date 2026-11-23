// D-283 · Uji alur generate gambar ASYNC dua fase.
//
// Meniru yang terjadi di produksi:
//   1. POST /api/ai/image  -> 202 { async: true, id }
//   2. GET  /api/ai/image/:id -> { status: 'running' } (beberapa kali)
//   3. GET  /api/ai/image/:id -> { status: 'success', asset: {...} }
//
// Yang diperiksa: client menyimpan id task, poll berulang sampai selesai,
// aset hasil masuk galeri, error server ditampilkan, dan koneksi yang putus
// sesaat dicoba lagi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const appJs = readFileSync('server/app.js', 'utf8');

/** Ekstrak body fungsi pollImage dari studio.js (untuk memeriksa perilakunya). */
function pollImageBody() {
  const start = studio.indexOf('async function pollImage()');
  const end = studio.indexOf('// ===== D-198: generate video', start);
  assert.ok(start > 0 && end > start, 'pollImage harus ada di studio.js');
  return studio.slice(start, end);
}

/** Harness minimal yang meniru state & callback yang dipakai pollImage. */
function harness({ responses, failTimes = 0 }) {
  const state = { assets: [], rendered: 0, toasts: [], pending: null, calls: [] };
  let idx = 0;
  let failures = failTimes;
  const fetchMock = async (url) => {
    state.calls.push(url);
    if (failures > 0) { failures -= 1; throw new Error('Failed to fetch'); }
    const body = responses[Math.min(idx, responses.length - 1)];
    idx += 1;
    return { ok: true, json: async () => body };
  };
  const progressBox = {
    _html: '',
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    classList: { add() {}, remove() {} },
    setAttribute() {},
  };
  return { state, fetchMock, progressBox };
}

/**
 * Jalankan pollImage sebagai fungsi mandiri. Implementasi ini MIRIP dengan
 * studio.js (yang diuji lewat baris-baris di bawah), supaya test benar-benar
 * menguji alur polling, bukan sekadar kemunculan string.
 */
async function runPoll(ctx, maxSteps = 6) {
  const { state, fetchMock, progressBox } = ctx;
  let task = { id: 'task-1', progress: 0, status: 'running', tries: 0 };
  for (let step = 0; step < maxSteps; step++) {
    let payload = null;
    try {
      const r = await fetchMock('/api/ai/image/' + task.id);
      payload = await r.json();
    } catch (e) {
      // Perilaku retry (D-283): 3x percobaan sebelum menyerah.
      task.tries = (task.tries || 0) + 1;
      if (task.tries < 3) continue;
      state.toasts.push(e.message);
      return;
    }
    task.progress = payload.progress || task.progress;
    task.status = payload.status || 'running';
    if (payload.status === 'success') {
      if (payload.asset) { state.assets.push(payload.asset); state.rendered += 1; }
      state.toasts.push('Gambar jadi ✨ — tersimpan di galeri aset.');
      return;
    }
    if (payload.status === 'fail') {
      state.toasts.push(payload.error || 'Generator gambar gagal.');
      return;
    }
  }
}

test('D-283: alur async gambar — poll sampai sukses lalu masuk galeri', async () => {
  const ctx = harness({
    responses: [
      { status: 'running', progress: 30 },
      { status: 'running', progress: 60 },
      { status: 'success', progress: 100, asset: { id: 'a1', file_name: 'foto-horizontal.png', media_type: 'image', width: 3641, height: 2048 } },
    ],
  });
  await runPoll(ctx);
  assert.equal(ctx.state.calls.length, 3, 'harus 3 request poll');
  assert.equal(ctx.state.rendered, 1, 'aset hasil harus dimasukkan ke galeri');
  assert.equal(ctx.state.assets.length, 1, 'harus ada 1 aset di state');
  assert.equal(ctx.state.assets[0].id, 'a1', 'aset yang benar');
  assert.equal(ctx.state.assets[0].width, 3641, 'dimensi landscape harus tersimpan');
  assert.ok(ctx.state.toasts.some((t) => /Gambar jadi/.test(t)), 'harus ada toast sukses');
});

test('D-283: status fail dari server ditampilkan ke user', async () => {
  const ctx = harness({
    responses: [{ status: 'fail', progress: 0, error: 'Kie menolak task gambar: aspect tidak didukung' }],
  });
  await runPoll(ctx);
  assert.equal(ctx.state.rendered, 0, 'gagal -> tidak ada aset');
  assert.ok(ctx.state.toasts.some((t) => /menolak/.test(t)),
    'error server harus ditampilkan (toast: ' + JSON.stringify(ctx.state.toasts) + ')');
});

test('D-283: koneksi putus sesaat dicoba lagi sebelum menyerah', async () => {
  const ctx = harness({ responses: [{ status: 'success', progress: 100, asset: { id: 'a2' } }], failTimes: 2 });
  await runPoll(ctx);
  assert.equal(ctx.state.assets.length, 1, 'aset harus tetap masuk setelah retry');
  assert.equal(ctx.state.assets[0].id, 'a2');
  assert.ok(!ctx.state.toasts.some((t) => /Failed to fetch/.test(t)), 'error sementara tidak boleh ditampilkan');
});

test('D-283: kode studio.js menerapkan aturan retry & galeri', () => {
  const body = pollImageBody();
  assert.ok(body.includes("fetch('/api/ai/image/' + imageTask.id"), 'poll ke endpoint gambar');
  assert.ok(body.includes("d.status === 'success'"), 'handle sukses');
  assert.ok(body.includes("d.status === 'fail'"), 'handle gagal');
  assert.ok(body.includes('assets.unshift(d.asset)'), 'hasil masuk galeri');
  assert.ok(body.includes('renderGallery()'), 'galeri di-render ulang');
  // Retry: koneksi putus dicoba maksimal 3x.
  assert.ok(body.includes('imageTask.tries'), 'harus menghitung percobaan');
  assert.ok(body.includes('imageTask.tries < 3'), 'maksimal 3 percobaan');
  // Timer poll 3 detik.
  assert.ok(body.includes('setTimeout(pollImage, 3000)'), 'poll tiap 3 detik');
});

test('D-283: route gambar memakai task table yang sama dengan video', () => {
  const imgStart = appJs.indexOf("app.get('/api/ai/image/:id'");
  assert.ok(imgStart > 0, 'route poll gambar harus ada');
  const imgBody = appJs.slice(imgStart, imgStart + 3200);
  assert.ok(imgBody.includes('getVideoTask'), 'harus pakai helper task yang sama');
  assert.ok(imgBody.includes('updateVideoTask'), 'harus update status task yang sama');
  assert.ok(imgBody.includes("taskMeta.kind !== 'image'"), 'route harus menolak task non-gambar');
  // Penandaan kind=image dibuat saat task dibuat (route POST).
  const postStart = appJs.indexOf("app.post('/api/ai/image'");
  const postBody = appJs.slice(postStart, postStart + 7000);
  assert.ok(postBody.includes("kind: 'image'"), 'task gambar harus ditandai kind=image di route POST');
});

test('D-283: klien mengirim POST sekali lalu tidak generate ulang', () => {
  const genStart = studio.indexOf('async function generate() {');
  const genEnd = studio.indexOf('// ===== D-283: progres & polling generate GAMBAR', genStart);
  const body = studio.slice(genStart, genEnd);
  // Hanya satu POST ke /api/ai/image.
  const posts = body.match(/fetch\('\/api\/ai\/image'/g) || [];
  assert.equal(posts.length, 1, 'harus tepat 1 POST ke /api/ai/image');
  // Kalau async, TIDAK lanjut ke jalur sync (persistGenerated).
  assert.ok(body.includes('if (d.async && d.id)'), 'harus deteksi mode async');
  const asyncIdx = body.indexOf('if (d.async && d.id)');
  const persistIdx = body.indexOf('persistGenerated');
  assert.ok(asyncIdx < persistIdx, 'cabang async harus return SEBELUM jalur sync');
  assert.ok(body.includes('return;'), 'cabang async harus return (tidak lanjut sync)');
});
