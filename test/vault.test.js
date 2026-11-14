import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte hex for tests
const { encryptSecret, decryptSecret, vaultConfigured, vaultSelfTest } = await import('../server/vault.js');

test('vault self test passes with valid key', () => {
  assert.equal(vaultConfigured(), true);
  assert.equal(vaultSelfTest().ok, true);
});

test('encrypt -> decrypt roundtrip', () => {
  const secret = 'sk-test-1234567890abcdef';
  const enc = encryptSecret(secret);
  assert.notEqual(enc.ciphertext, secret);
  assert.equal(enc.last4, 'cdef');
  assert.equal(decryptSecret(enc), secret);
});

test('same plaintext produces different ciphertext (random IV)', () => {
  const a = encryptSecret('same-secret-value-1');
  const b = encryptSecret('same-secret-value-1');
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.notEqual(a.iv, b.iv);
});

test('tampered ciphertext fails to decrypt', () => {
  const enc = encryptSecret('tamper-target-secret');
  const raw = Buffer.from(enc.ciphertext, 'base64');
  raw[0] ^= 0xff;
  assert.throws(() => decryptSecret({ ...enc, ciphertext: raw.toString('base64') }));
});

test('wrong key fails to decrypt', () => {
  const enc = encryptSecret('wrong-key-target-secret');
  process.env.AI_ENCRYPTION_KEY = 'b'.repeat(64);
  assert.throws(() => decryptSecret(enc));
  process.env.AI_ENCRYPTION_KEY = 'a'.repeat(64);
});

test('too-short secrets are rejected', () => {
  assert.throws(() => encryptSecret('short'));
});
