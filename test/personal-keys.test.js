// D-142: tes regresi kunci AI pribadi (BYOK tamu & klien).
// Validasi savePersonalKey + mapping listPersonalKeys — tanpa jaringan
// (provider standar di-skip; hanya jalur error & custom yang dites di sini).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_ENCRYPTION_KEY = 'b'.repeat(64); // 32-byte hex for tests
const { savePersonalKey, listPersonalKeys, PERSONAL_PROVIDERS } = await import('../server/provider-keys.js');

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

test('savePersonalKey custom: simpan sukses, trailing slash base URL dipangkas', async () => {
  const inserted = [];
  const sb = {
    from() { return this; },
    delete() { return this; },
    eq() { return this; },
    insert(row) { inserted.push(row); return this; },
    select() { return this; },
    single() { return Promise.resolve({ data: { id: 'k1', provider: 'custom', last4: 'abcd', base_url: 'x', model: 'y', created_at: 't' }, error: null }); },
  };
  const out = await savePersonalKey(sb, { provider: 'custom', api_key: 'c'.repeat(44), base_url: 'https://api.example.com/v1///', model: 'my-model', user_id: 'u1' });
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].base_url, 'https://api.example.com/v1');
  assert.equal(inserted[0].model, 'my-model');
  assert.equal(inserted[0].key_name, 'pribadi');
  assert.equal(inserted[0].last4, 'cccc');
  assert.equal(inserted[0].user_id, 'u1');
  assert.equal(out.provider, 'custom');
});

test('savePersonalKey tanpa user_id ditolak', async () => {
  await assert.rejects(
    () => savePersonalKey(fakeSupabase(), { provider: 'custom', api_key: 'k'.repeat(40), base_url: 'https://a.io/v1', model: 'm1' }),
    /user_id/
  );
});

test('listPersonalKeys memetakan baris ke bentuk aman (tanpa ciphertext)', async () => {
  const sb = { from() { return this; }, select() { return this; }, order() { return Promise.resolve({ data: [{ id: 'k1', provider: 'gemini', last4: 'wxyz', base_url: null, model: null, created_at: 't1' }], error: null }); } };
  const keys = await listPersonalKeys(sb);
  assert.equal(keys.length, 1);
  assert.deepEqual(keys[0], { id: 'k1', provider: 'gemini', last4: 'wxyz', base_url: null, model: null, created_at: 't1' });
  assert.ok(!('ciphertext' in keys[0]));
});

test('listPersonalKeys error DB -> array kosong (anti-leak)', async () => {
  const sb = { from() { return this; }, select() { return this; }, order() { return Promise.resolve({ data: null, error: new Error('rls') }); } };
  assert.deepEqual(await listPersonalKeys(sb), []);
});
