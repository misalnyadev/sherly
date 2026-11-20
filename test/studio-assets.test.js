import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  mediaKind, safeFileName, extForMime, saveAsset, saveGeneratedAsset, listAssets,
  signedAsset, deleteAsset, getAsset, createVideoTask, updateVideoTask, getVideoTask,
  listVideoTasks, ASSET_MIME, MAX_ASSET_BYTES, STUDIO_BUCKET,
} = await import('../server/studio-assets.js');
const {
  sanitizeVideoTier, sanitizeVideoDuration, sanitizeVideoResolution, sanitizeVideoAspect,
  KIE_VIDEO_TIERS, KIE_VIDEO_DURATIONS, KIE_VIDEO_RESOLUTIONS,
} = await import('../server/ai.js');

// --- Supabase tiruan:-chainable builder sederhana ---
function fakeDb(seed = {}) {
  const calls = { storage: [], insert: [], update: [], delete: [], from: [] };
  function makeTable(name) {
    const rows = Array.isArray(seed[name]) ? [...seed[name]] : [];
    const q = {
      _rows: rows,
      select() { return q; },
      eq(col, val) { q._rows = q._rows.filter((r) => r[col] === val); return q; },
      single() { return q._rows[0] ? Promise.resolve({ data: q._rows[0], error: null }) : Promise.resolve({ data: null, error: { message: 'no rows' } }); },
      maybeSingle() { return q._rows[0] ? Promise.resolve({ data: q._rows[0], error: null }) : Promise.resolve({ data: null, error: null }); },
      then(resolve, reject) {
        return Promise.resolve({ data: q._rows, error: null }).then(resolve, reject);
      },
      order() { return q; },
      limit() { return q; },
      insert(row) {
        const rec = { id: 'gen-' + (rows.length + 1), ...row };
        rows.unshift(rec);
        calls.insert.push({ name, row: rec });
        q._rows = [rec];
        return q;
      },
      update(patch) {
        q._rows = q._rows.map((r) => ({ ...r, ...patch }));
        calls.update.push({ name, patch });
        return q;
      },
      delete() {
        calls.delete.push({ name });
        q._rows = [];
        return q;
      },
    };
    return q;
  }
  const supabase = {
    from(name) { calls.from.push(name); const t = makeTable(name); t.__name = name; return t; },
    storage: {
      from(bucket) {
        calls.storage.push({ bucket, op: 'from' });
        return {
          upload: async (path, buffer, opts) => { calls.storage.push({ bucket, op: 'upload', path, len: buffer.length, opts }); return { error: null }; },
          remove: async (paths) => { calls.storage.push({ bucket, op: 'remove', paths }); return { error: null }; },
          createSignedUrl: async (path, ttl) => { calls.storage.push({ bucket, op: 'sign', path, ttl }); return { data: { signedUrl: 'https://signed/' + path }, error: null }; },
        };
      },
    },
  };
  return { supabase, calls };
}

test('mediaKind: image vs video dari mime', () => {
  assert.equal(mediaKind('image/png'), 'image');
  assert.equal(mediaKind('video/mp4'), 'video');
  assert.equal(mediaKind('VIDEO/WEBM'), 'video');
  assert.equal(mediaKind(''), 'image');
});

test('safeFileName: bersihkan nama file berbahaya', () => {
  assert.equal(safeFileName('foto saya.png'), 'foto-saya');
  assert.equal(safeFileName('../../etc/passwd'), 'etc-passwd');
  assert.equal(safeFileName(''), 'aset');
  assert.ok(safeFileName('a'.repeat(200)).length <= 60);
});

test('extForMime: pemetaan mime ke ekstensi', () => {
  assert.equal(extForMime('image/png'), 'png');
  assert.equal(extForMime('image/jpeg'), 'jpg');
  assert.equal(extForMime('image/webp'), 'webp');
  assert.equal(extForMime('video/mp4'), 'mp4');
  assert.equal(extForMime('video/quicktime'), 'mov');
  assert.equal(extForMime('application/x'), 'bin');
});

test('saveAsset: simpan foto ke bucket studio-assets + catat di tabel assets', async () => {
  const { supabase, calls } = fakeDb();
  const file = { buffer: Buffer.from('DATAFOTO'), mimetype: 'image/png', originalname: 'foto.png' };
  const asset = await saveAsset(supabase, 'u1', file, { kind: 'upload', prompt: 'uji' });
  assert.ok(asset.id);
  assert.equal(asset.user_id, 'u1');
  assert.equal(asset.media_type, 'image');
  assert.equal(asset.kind, 'upload');
  assert.equal(asset.prompt, 'uji');
  assert.ok(calls.from.includes('assets'));
  const up = calls.storage.find((c) => c.op === 'upload');
  assert.ok(up, 'harus upload ke storage');
  assert.equal(up.bucket, STUDIO_BUCKET);
  assert.ok(up.path.startsWith('u1/'), 'path diawali user id: ' + up.path);
});

test('saveAsset: tolak mime di luar daftar & file kosong', async () => {
  const { supabase } = fakeDb();
  await assert.rejects(
    () => saveAsset(supabase, 'u1', { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'a.pdf' }),
    /Format aset/,
  );
  await assert.rejects(
    () => saveAsset(supabase, 'u1', { buffer: Buffer.alloc(0), mimetype: 'image/png', originalname: 'a.png' }),
    /kosong/,
  );
});

test('saveAsset: tolak file melebihi 25 MB', async () => {
  const { supabase } = fakeDb();
  const big = { buffer: Buffer.alloc(MAX_ASSET_BYTES + 10), mimetype: 'image/png', originalname: 'besar.png' };
  await assert.rejects(() => saveAsset(supabase, 'u1', big), /25 MB/);
});

test('saveAsset: file tepat 25 MB diterima', async () => {
  const { supabase, calls } = fakeDb();
  const ok = { buffer: Buffer.alloc(MAX_ASSET_BYTES), mimetype: 'image/png', originalname: 'pas.png' };
  const asset = await saveAsset(supabase, 'u1', ok);
  assert.ok(asset.id);
  assert.ok(calls.storage.some((c) => c.op === 'upload'));
});

test('saveGeneratedAsset: hasil generate dicatat dengan kind=generate & prompt', async () => {
  const { supabase } = fakeDb();
  const asset = await saveGeneratedAsset(supabase, 'u1', {
    data: Buffer.from('VIDEOBYTES').toString('base64'),
    mime: 'video/mp4', prompt: 'jalan di GBK',
    meta: { model: 'veo3_fast' }, durationMs: 8000,
  });
  assert.equal(asset.kind, 'generate');
  assert.equal(asset.media_type, 'video');
  assert.equal(asset.prompt, 'jalan di GBK');
  assert.equal(asset.duration_ms, 8000);
  assert.deepEqual(asset.meta, { model: 'veo3_fast' });
});

test('saveGeneratedAsset: data kosong ditolak', async () => {
  const { supabase } = fakeDb();
  await assert.rejects(() => saveGeneratedAsset(supabase, 'u1', { data: '', mime: 'image/png' }), /kosong/);
});

test('signedAsset: buat signed URL 1 jam', async () => {
  const { supabase, calls } = fakeDb();
  const out = await signedAsset({
    id: 'a1', file_name: 'f.png', media_type: 'image', file_path: 'u1/f.png',
    kind: 'generate', prompt: 'p', meta: {}, created_at: '2026-01-01',
  }, supabase);
  assert.equal(out.url, 'https://signed/u1/f.png');
  assert.equal(out.kind, 'generate');
  assert.equal(out.media_type, 'image');
  const sign = calls.storage.find((c) => c.op === 'sign');
  assert.equal(sign.ttl, 3600);
});

test('signedAsset: tanpa file_path -> url null, tidak error', async () => {
  const { supabase } = fakeDb();
  const out = await signedAsset({ id: 'a1', file_name: 'x', media_type: 'image' }, supabase);
  assert.equal(out.url, null);
});

test('deleteAsset: hanya bisa hapus aset milik sendiri', async () => {
  const { supabase } = fakeDb({ assets: [{ id: 'a1', user_id: 'u1', file_path: 'u1/a.png' }] });
  const out = await deleteAsset(supabase, 'u1', 'a1');
  assert.deepEqual(out, { ok: true });
  const { supabase: s2 } = fakeDb({ assets: [{ id: 'a2', user_id: 'u2', file_path: 'u2/a.png' }] });
  await assert.rejects(() => deleteAsset(s2, 'u1', 'a2'), /tidak ditemukan/);
});

test('getAsset: aset milik orang lain -> null', async () => {
  const { supabase } = fakeDb({ assets: [{ id: 'a1', user_id: 'u2' }] });
  assert.equal(await getAsset(supabase, 'u1', 'a1'), null);
  const { supabase: s2 } = fakeDb({ assets: [{ id: 'a1', user_id: 'u1' }] });
  assert.ok(await getAsset(s2, 'u1', 'a1'));
});

test('listAssets: ambil aset milik user saja', async () => {
  const { supabase } = fakeDb({ assets: [{ id: 'a1', user_id: 'u1', file_path: 'u1/a.png', media_type: 'image' }] });
  const out = await listAssets(supabase, 'u1');
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://signed/u1/a.png');
});

// ===== Parameter video =====
test('sanitizeVideoTier: hanya tier yang didukung', () => {
  assert.equal(sanitizeVideoTier('veo3'), 'veo3');
  assert.equal(sanitizeVideoTier('veo3_lite'), 'veo3_lite');
  assert.equal(sanitizeVideoTier('veo3_fast'), 'veo3_fast');
  assert.equal(sanitizeVideoTier('ngawur'), 'veo3_fast');
  assert.equal(sanitizeVideoTier(undefined), 'veo3_fast');
  assert.deepEqual(KIE_VIDEO_TIERS, ['veo3_fast', 'veo3_lite', 'veo3']);
});

test('sanitizeVideoDuration: hanya 4/6/8 detik', () => {
  assert.equal(sanitizeVideoDuration(6), 6);
  assert.equal(sanitizeVideoDuration('8'), 8);
  assert.equal(sanitizeVideoDuration(5), 8);
  assert.equal(sanitizeVideoDuration('abc'), 8);
  assert.deepEqual(KIE_VIDEO_DURATIONS, [4, 6, 8]);
});

test('sanitizeVideoResolution: 720p/1080p/4k', () => {
  assert.equal(sanitizeVideoResolution('1080p'), '1080p');
  assert.equal(sanitizeVideoResolution('4k'), '4k');
  assert.equal(sanitizeVideoResolution('nope'), '720p');
  assert.deepEqual(KIE_VIDEO_RESOLUTIONS, ['720p', '1080p', '4k']);
});

test('sanitizeVideoAspect: hanya 16:9 & 9:16', () => {
  assert.equal(sanitizeVideoAspect('9:16'), '9:16');
  assert.equal(sanitizeVideoAspect('16:9'), '16:9');
  assert.equal(sanitizeVideoAspect('Auto'), '16:9');
  assert.equal(sanitizeVideoAspect('4:5'), '16:9');
});

test('ASSET_MIME: mencakup foto & video', () => {
  assert.ok(ASSET_MIME.includes('image/png'));
  assert.ok(ASSET_MIME.includes('video/mp4'));
  assert.ok(ASSET_MIME.includes('video/webm'));
  assert.ok(!ASSET_MIME.includes('application/pdf'));
});

// ===== Task video =====
test('createVideoTask: simpan task dengan status queued & meta', async () => {
  const { supabase } = fakeDb();
  const task = await createVideoTask(supabase, 'u1', {
    provider: 'kie', model: 'veo3_fast', taskId: 'task_1', prompt: 'jalan di GBK',
    meta: { aspect: '9:16', duration: 8 },
  });
  assert.equal(task.user_id, 'u1');
  assert.equal(task.status, 'queued');
  assert.equal(task.task_id, 'task_1');
  assert.deepEqual(task.meta, { aspect: '9:16', duration: 8 });
});

test('updateVideoTask: hanya kolom yang diizinkan yang ditulis', async () => {
  const { supabase } = fakeDb({ sherly_video_tasks: [{ id: 't1', user_id: 'u1', status: 'queued', progress: 0 }] });
  const out = await updateVideoTask(supabase, 'u1', 't1', { status: 'success', progress: 100, hacker: 'x' });
  assert.equal(out.status, 'success');
  assert.equal(out.progress, 100);
  assert.ok(!('hacker' in out), 'kolom tak diizinkan tidak boleh ikut');
});

test('getVideoTask / listVideoTasks: hanya milik sendiri', async () => {
  const { supabase } = fakeDb({ sherly_video_tasks: [{ id: 't1', user_id: 'u1', status: 'running' }] });
  assert.equal(await getVideoTask(supabase, 'u1', 't1').then((t) => t.id), 't1');
  assert.equal(await getVideoTask(supabase, 'u2', 't1'), null);
  const list = await listVideoTasks(supabase, 'u1');
  assert.equal(list.length, 1);
});
