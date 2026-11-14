// Backend-only AES-256-GCM vault for AI provider API keys.
// Ciphertext/iv/authTag are stored in the database; AI_ENCRYPTION_KEY lives only in env.
import crypto from 'node:crypto';

const HEX_32 = /^[0-9a-f]{64}$/i;

/** Resolve the 256-bit vault key from AI_ENCRYPTION_KEY (hex, base64, or passphrase). */
export function vaultKeyFromEnv() {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string' || raw.trim().length < 16) return null;
  const value = raw.trim();
  if (HEX_32.test(value)) return Buffer.from(value, 'hex');
  try {
    const b64 = Buffer.from(value, 'base64');
    if (b64.length === 32) return b64;
  } catch { /* fall through to passphrase KDF */ }
  // Passphrase fallback: derive a stable 256-bit key. Prefer hex/base64 in production.
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export const vaultConfigured = () => Boolean(vaultKeyFromEnv());

/** Encrypt a plaintext API key. Returns base64 parts safe for text columns. */
export function encryptSecret(plaintext) {
  const key = vaultKeyFromEnv();
  if (!key) throw Object.assign(new Error('AI_ENCRYPTION_KEY belum dikonfigurasi di environment.'), { status: 503 });
  if (typeof plaintext !== 'string' || plaintext.trim().length < 8) {
    throw Object.assign(new Error('API key terlalu pendek (minimal 8 karakter).'), { status: 400 });
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext.trim(), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
    last4: plaintext.trim().slice(-4),
  };
}

/** Decrypt a stored secret. Throws with a generic message on any failure (never leaks detail). */
export function decryptSecret({ ciphertext, iv, auth_tag: authTag }) {
  const key = vaultKeyFromEnv();
  if (!key) throw Object.assign(new Error('AI_ENCRYPTION_KEY belum dikonfigurasi di environment.'), { status: 503 });
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw Object.assign(new Error('Gagal mendekripsi API key. Periksa AI_ENCRYPTION_KEY atau data key.'), { status: 500 });
  }
}

/** Startup self-check: encrypt -> decrypt roundtrip. */
export function vaultSelfTest() {
  if (!vaultConfigured()) return { configured: false, ok: false };
  try {
    const probe = encryptSecret('vault-self-test-probe');
    const back = decryptSecret(probe);
    return { configured: true, ok: back === 'vault-self-test-probe' };
  } catch (error) {
    return { configured: true, ok: false, error: error.message };
  }
}
