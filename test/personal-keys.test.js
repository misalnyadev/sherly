// D-142: tes regresi kunci AI pribadi (BYOK tamu & klien).
// Validasi savePersonalKey + mapping listPersonalKeys — tanpa jaringan
// (provider standar di-skip; hanya jalur error & custom yang dites di sini).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_ENCRYPTION_KEY = 'b'.repeat(64); // 32-byte hex for tests
const { savePersonalKey, listPersonalKeys, PERSONAL_PROVIDERS, assertSafeBaseUrl, fetchProviderModels, setDefaultPersonalKey, deleteGroup, probeProviderKey, testKey } = await import('../server/provider-keys.js');
const { encryptSecret } = await import('../server/vault.js');

// Stub fetch untuk tes yang menyentuh jaringan (tes koneksi kustom / deteksi model).
function withFetchStub(stub, fn) { const real = globalThis.fetch; globalThis.fetch = stub; return Promise.resolve(fn()).finally(() => { globalThis.fetch = real; }); }

const fakeSupabase = (rows = []) => ({
  from() { return this; },
  select() { return this; },
  order() { return this; },
  delete() { return this; },
  eq() { return this; },
  insert() { return this; },
  then(resolve) { resolve({ data: rows.shift() ?? null, error: null }); },
});

test('PERSONAL_PROVIDERS = gemini, groq, openrouter, custom', () => {
  assert.deepEqual(PERSONAL_PROVIDERS, ['gemini', 'groq', 'openrouter', 'custom']);
});

test('savePersonalKey menolak provider asing', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'kie', api_key: 'x'.repeat(40), user_id: 'u1' }),
    /Provider harus gemini, groq, openrouter, atau custom/
  );
});

test('savePersonalKey menolak key pendek/panjang', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'short', base_url: 'https://a.io/v1', model: 'm1', user_id: 'u1' }),
    /API key tidak valid/
  );
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'k'.repeat(401), base_url: 'https://a.io/v1', model: 'm1', user_id: 'u1' }),
    /API key tidak valid/
  );
});

test('savePersonalKey custom: base URL wajib http(s) & model wajib', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'k'.repeat(40), base_url: '', model: 'm1', user_id: 'u1' }),
    /Base URL kustom wajib/
  );
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'k'.repeat(40), base_url: 'ftp://a.io/v1', model: 'm1', user_id: 'u1' }),
    /Base URL kustom wajib/
  );
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'k'.repeat(40), base_url: 'https://a.io/v1', model: '', user_id: 'u1' }),
    /Model wajib diisi/
  );
});

test('savePersonalKey custom: simpan sukses, trailing slash dipangkas, tes koneksi via /models', async () => {
  const inserted = [];
  const calls = [];
  const sb = {
    from() { return this; },
    delete() { return this; },
    eq() { return this; },
    insert(row) { inserted.push(row); return this; },
    select() { return this; },
    single() { return Promise.resolve({ data: { id: 'k1', provider: 'custom', last4: 'abcd', base_url: 'x', model: 'y', created_at: 't' }, error: null }); },
  };
  await withFetchStub(async (url, opts) => {
    calls.push([String(url), opts?.headers?.Authorization]);
    return { ok: true, json: async () => ({ data: [{ id: 'my-model', name: 'My Model' }] }) };
  }, () => savePersonalKey(sb, { provider: 'custom', api_key: 'c'.repeat(44), base_url: 'https://api.example.com/v1///', model: 'my-model', user_id: 'u1' }));
  // tes koneksi mengarah ke /models dengan Bearer key
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.example.com/v1/models');
  assert.equal(calls[0][1], 'Bearer ' + 'c'.repeat(44));
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].base_url, 'https://api.example.com/v1');
  assert.equal(inserted[0].model, 'my-model');
  assert.equal(inserted[0].key_name, 'pribadi');
  assert.equal(inserted[0].last4, 'cccc');
  assert.equal(inserted[0].user_id, 'u1');
});

test('savePersonalKey custom: endpoint menjawab error → key TIDAK disimpan', async () => {
  const inserted = [];
  const sb = { from() { return this; }, delete() { return this; }, eq() { return this; }, insert(row) { inserted.push(row); return this; }, select() { return this; }, single() { Promise.resolve({ data: null, error: null }); } };
  await assert.rejects(
    () => withFetchStub(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid api key' } }) }), () => savePersonalKey(sb, { provider: 'custom', api_key: 'c'.repeat(44), base_url: 'https://api.example.com/v1', model: 'm1', user_id: 'u1' })),
    /Tes koneksi gagal.*invalid api key/
  );
  assert.equal(inserted.length, 0);
});

test('savePersonalKey: nama model maksimal 120 karakter (validasi sebelum koneksi)', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'gemini', api_key: 'g'.repeat(40), model: 'm'.repeat(121) }),
    /Nama model maksimal 120 karakter/
  );
});

test('assertSafeBaseUrl: tolak host internal/lokal & protokol aneh', () => {
  for (const bad of ['http://localhost/v1', 'https://127.0.0.1/v1', 'https://10.0.0.5/v1', 'https://192.168.1.2/v1', 'https://172.16.0.1/v1', 'https://169.254.1.1/v1', 'https://[::1]/v1', 'ftp://api.example.com/v1', 'https://db.internal/v1']) {
    assert.throws(() => assertSafeBaseUrl(bad), /Base URL/, bad);
  }
  const ok = assertSafeBaseUrl('https://api.example.com/v1');
  assert.equal(ok.hostname, 'api.example.com');
});

test('fetchProviderModels custom: GET {base}/models dengan Bearer, dipetakan + diurutkan', async () => {
  const calls = [];
  const models = await withFetchStub(async (url, opts) => {
    calls.push([String(url), opts?.headers?.Authorization]);
    return { ok: true, json: async () => ({ data: [{ id: 'b-model', name: 'B' }, { id: 'a-model', name: 'A' }] }) };
  }, () => fetchProviderModels('custom', 'k'.repeat(40), 'https://api.example.com/v1'));
  assert.deepEqual(calls, [['https://api.example.com/v1/models', 'Bearer ' + 'k'.repeat(40)]]);
  assert.equal(models.length, 2);
  assert.ok(models.every((m) => typeof m.id === 'string' && m.recommended === false));
});

test('fetchProviderModels custom: base URL localhost ditolak (anti-SSRF)', async () => {
  await assert.rejects(
    () => fetchProviderModels('custom', 'k'.repeat(40), 'http://localhost:8080/v1'),
    /tidak diizinkan/
  );
});

test('savePersonalKey tanpa user_id ditolak', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'k'.repeat(40), base_url: 'https://a.io/v1', model: 'm1' }),
    /user_id/
  );
});

test('listPersonalKeys memetakan baris ke bentuk aman (tanpa ciphertext) + status kesehatan', async () => {
  const sb = { from() { return this; }, select() { return this; }, order() { return this; }, then(resolve) { resolve({ data: [
    { id: 'k1', provider: 'gemini', last4: 'wxyz', base_url: null, model: null, is_active: true, health_status: 'ok', consecutive_failures: 0, created_at: 't1' },
    { id: 'k2', provider: 'gemini', last4: 'aaaa', base_url: null, model: 'gemini-3.8-flash', is_active: false, health_status: 'failing', consecutive_failures: 5, created_at: 't2' },
  ], error: null }); } };
  const keys = await listPersonalKeys(sb);
  assert.equal(keys.length, 2);
  assert.deepEqual(keys[0], { id: 'k1', provider: 'gemini', last4: 'wxyz', base_url: null, model: null, is_active: true, health_status: 'ok', consecutive_failures: 0, created_at: 't1' });
  assert.equal(keys[1].is_active, false);
  assert.equal(keys[1].health_status, 'failing');
  assert.ok(keys.every((k) => !('ciphertext' in k)));
});

test('listPersonalKeys error DB -> array kosong (anti-leak)', async () => {
  const sb = { from() { return this; }, select() { return this; }, order() { return this; }, then(resolve) { resolve({ data: null, error: new Error('rls') }); } };
  assert.deepEqual(await listPersonalKeys(sb), []);
});

test('savePersonalKey multi-key: cap 5 per provider, key lama TIDAK dihapus', async () => {
  // query count (from #1) menjawab 5 -> penolakan sebelum probe jaringan
  const calls = [];
  const sb = {
    from() { calls.push('from'); return this; },
    select() { return this; },
    eq() { return this; },
    delete() { calls.push('delete'); return this; },
    insert() { calls.push('insert'); return this; },
    single() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) { resolve({ count: 5, error: null }); },
  };
  await assert.rejects(
    () => savePersonalKey(sb, { provider: 'gemini', api_key: 'g'.repeat(40), user_id: 'u1' }),
    /Maksimal 5 key per provider/
  );
  assert.ok(!calls.includes('delete'), 'key lama tidak boleh dihapus');
  assert.ok(!calls.includes('insert'), 'tidak ada insert saat melewati batas');

  // count 4 -> lolos sampai probe gemini (yang stub-nya gagal -> tes koneksi gagal)
  const sb2 = { from() { return this; }, select() { return this; }, eq() { return this; }, insert() { return this; }, single() { return Promise.resolve({ data: null, error: null }); }, then(resolve) { resolve({ count: 4, error: null }); } };
  const deletions = [];
  sb2.delete = () => { deletions.push(1); return this; };
  await withFetchStub(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'bad key' } }) }), async () => {
    await assert.rejects(
      () => savePersonalKey(sb2, { provider: 'custom', api_key: 'c'.repeat(44), base_url: 'https://api.example.com/v1', model: 'm1', user_id: 'u1' }),
      /Tes koneksi gagal/
    );
  });
  assert.equal(deletions.length, 0, 'multi-key: tidak ada delete saat menambah');
});


// ---------- D-147: grup, test, edit/ganti, set default, hapus grup ----------

test('savePersonalKey: label grup opsional (default pribadi), maks 80 karakter', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'gemini', api_key: 'g'.repeat(40), label: 'x'.repeat(81), user_id: 'u1' }),
    /Label grup maksimal 80/
  );
  const inserted = [];
  const sb = { from() { return this; }, select() { return this; }, eq() { return this; }, insert(row) { inserted.push(row); return this; }, single() { return Promise.resolve({ data: {}, error: null }); }, then(r) { r({ count: 0, error: null }); } };
  await withFetchStub(async () => ({ ok: true, json: async () => ({ data: [{ id: 'm' }] }) }),
    () => savePersonalKey(sb, { provider: 'custom', api_key: 'c'.repeat(44), base_url: 'https://api.example.com/v1', model: 'm1', label: 'Kantor', user_id: 'u1' }));
  assert.equal(inserted[0].key_name, 'Kantor');
});

test('setDefaultPersonalKey: demote key lain provider, angkat terpilih jadi prioritas 1', async () => {
  const updates = [];
  const sb = {
    from() { return this; },
    select() { return this; },
    eq() { return this; },
    neq() { return this; },
    maybeSingle() { return Promise.resolve({ data: { id: 'k1', provider: 'gemini' }, error: null }); },
    update(patch) { updates.push(patch); return this; },
    single() { return Promise.resolve({ data: { id: 'k1', provider: 'gemini', key_name: 'pribadi', last4: 'abcd', priority: 1, is_active: true, health_status: 'unknown', consecutive_failures: 0, base_url: null, model: null }, error: null }); },
    then(r) { r({ data: null, error: null }); },
  };
  const out = await setDefaultPersonalKey(sb, 'k1');
  assert.equal(updates.length, 2);
  assert.equal(updates[0].priority, 100);
  assert.equal(updates[1].priority, 1);
  assert.equal(updates[1].is_active, true);
  assert.equal(out.priority, 1);
});

test('deleteGroup menerima provider kustom (member)', async () => {
  const del = [];
  const sb = { from() { return this; }, delete() { del.push(1); return this; }, eq() { return this; }, then(r) { r({ error: null }); } };
  await deleteGroup(sb, { provider: 'custom', key_name: 'kantor' });
  assert.equal(del.length, 1);
  await assert.rejects(() => deleteGroup(sb, { provider: 'aneh', key_name: 'x' }), /wajib valid/);
});

test('probeProviderKey custom: tanpa base URL gagal; dengan base URL GET {base}/models', async () => {
  const noBase = await probeProviderKey('custom', 'k'.repeat(40));
  assert.equal(noBase.ok, false);
  const calls = [];
  await withFetchStub(async (url, opts) => {
    calls.push([String(url), opts?.headers?.Authorization]);
    return { ok: true, status: 200, json: async () => ({ data: [] }) };
  }, async () => {
    const r = await probeProviderKey('custom', 'k'.repeat(40), 'https://api.example.com/v1/');
    assert.equal(r.ok, true);
  });
  assert.deepEqual(calls, [['https://api.example.com/v1/models', 'Bearer ' + 'k'.repeat(40)]]);
});

test('testKey custom: mendekripsi & mengetes via base URL tersimpan', async () => {
  const enc = encryptSecret('t'.repeat(40));
  const sb = {
    from() { return this; },
    select() { return this; },
    eq() { return this; },
    maybeSingle() { return Promise.resolve({ data: { provider: 'custom', base_url: 'https://api.example.com/v1', ciphertext: enc.ciphertext, iv: enc.iv, auth_tag: enc.auth_tag }, error: null }); },
    update() { return this; },
    then(r) { r({ data: null, error: null }); },
  };
  const calls = [];
  await withFetchStub(async (url) => { calls.push(String(url)); return { ok: true, status: 200, json: async () => ({ data: [{ id: 'm' }] }) }; }, async () => {
    const probe = await testKey(sb, 'k1');
    assert.equal(probe.ok, true);
  });
  assert.equal(calls[0], 'https://api.example.com/v1/models');
});
