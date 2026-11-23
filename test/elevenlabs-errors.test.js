/**
 * D-281 — Test pesan error ElevenLabs + probe bertahap.
 *
 * Konteks: user melaporkan "✗ Key DITOLAK. elevenlabs menjawab:
 * elevenlabs error (401)" padahal key-nya baru dibuat. Pesan generik itu
 * tidak membantu — informasi sebenarnya ada di `detail.code` ElevenLabs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseElevenlabsError, elevenlabsErrorMessage,
} from '../server/elevenlabs-errors.js';

// ===== parseElevenlabsError =====

test('D-281: parse error object ElevenLabs', () => {
  const parsed = parseElevenlabsError({
    detail: {
      type: 'authentication_error',
      code: 'missing_permissions',
      message: 'The API key you used is missing the permission text_to_speech to execute this operation.',
      status: 'missing_permissions',
    },
  });
  assert.equal(parsed.code, 'missing_permissions');
  assert.equal(parsed.type, 'authentication_error');
  assert.match(parsed.message, /missing the permission/);
});

test('D-281: parse error array ElevenLabs', () => {
  const parsed = parseElevenlabsError({detail: [{code: 'invalid_api_key', message: 'Invalid API key'}]});
  assert.equal(parsed.code, 'invalid_api_key');
  assert.equal(parsed.message, 'Invalid API key');
});

test('D-281: parse error string ElevenLabs', () => {
  const parsed = parseElevenlabsError({detail: 'Something went wrong'});
  assert.equal(parsed.message, 'Something went wrong');
});

test('D-281: parse payload kosong tidak error', () => {
  const parsed = parseElevenlabsError({});
  assert.equal(parsed.code, '');
  assert.equal(parsed.message, '');
});

// ===== elevenlabsErrorMessage =====

test('D-281: missing_permissions → jelaskan cara fix permission key', () => {
  const msg = elevenlabsErrorMessage(401, {
    detail: {code: 'missing_permissions', message: 'missing the permission text_to_speech'},
  });
  assert.match(msg, /permission/i);
  assert.match(msg, /Restrict Key/i, 'harus menyebut Restrict Key');
  assert.match(msg, /Text to Speech/i, 'harus menyebut permission yang harus dinyalakan');
  assert.match(msg, /Voices/i);
  assert.match(msg, /Edit/i, 'harus memberi langkah konkret');
});

test('D-281: invalid_api_key_prefix → jelaskan bedanya API Key vs API Key ID', () => {
  const msg = elevenlabsErrorMessage(400, {
    detail: {code: 'invalid_api_key_prefix', message: "API key must start with 'sk_'."},
  });
  assert.match(msg, /sk_/, 'harus menyebut prefix sk_');
  assert.match(msg, /API Key ID/i, 'harus membedakan API Key ID vs API Key');
});

test('D-281: free_tier_usage_disabled → jelaskan soal data center/VPN', () => {
  const msg = elevenlabsErrorMessage(401, {
    detail: {code: 'free_tier_usage_disabled', message: 'Free Tier usage disabled.'},
  });
  assert.match(msg, /data-center|VPN/i);
  assert.match(msg, /Vercel/i, 'harus menyebut Vercel sebagai penyebab di Sherly');
  assert.match(msg, /TTSForFree|prepaid/i, 'harus memberi alternatif');
});

test('D-281: paid_plan_required → jelaskan Voice Library tidak boleh dipakai free', () => {
  const msg = elevenlabsErrorMessage(402, {
    detail: {code: 'paid_plan_required', message: 'Free users cannot use library voices via the API.'},
  });
  assert.match(msg, /Voice Library/i);
  assert.match(msg, /premade/i, 'harus menawarkan voice premade');
});

test('D-281: quota_exceeded → sebut kuota bulanan', () => {
  const msg = elevenlabsErrorMessage(401, {
    detail: {code: 'quota_exceeded', message: 'This request exceeds your quota.'},
  });
  assert.match(msg, /10\.000 karakter/i);
});

test('D-281: invalid_api_key → jelaskan checklist', () => {
  const msg = elevenlabsErrorMessage(401, {
    detail: {code: 'invalid_api_key', message: 'Invalid API key'},
  });
  assert.match(msg, /ditolak/i);
  assert.match(msg, /spasi|newline/i);
});

test('D-281: 401 tanpa code → tetap dapat checklist yang berguna', () => {
  const msg = elevenlabsErrorMessage(401, {});
  assert.match(msg, /401/);
  assert.match(msg, /sk_/, 'harus tetap menyebut prefix sk_');
  assert.match(msg, /permission/i, 'harus tetap menyebut permission');
});

test('D-281: 403 → menyebut permission + whitelist IP', () => {
  const msg = elevenlabsErrorMessage(403, {detail: {message: 'Forbidden'}});
  assert.match(msg, /403/);
  assert.match(msg, /whitelist|IP/i);
});

test('D-281: status tak dikenal → tetap informatif', () => {
  const msg = elevenlabsErrorMessage(500, {detail: {message: 'Internal error'}});
  assert.match(msg, /ElevenLabs error \(500\)/);
  assert.match(msg, /Internal error/);
});

// ===== Probe bertahap di server/provider-keys.js =====

test('D-281: probe ElevenLabs mencoba subscription lalu voices', async () => {
  const {readFileSync} = await import('node:fs');
  const pk = readFileSync(new URL('../server/provider-keys.js', import.meta.url), 'utf8');
  assert.ok(
    /api\.elevenlabs\.io\/v1\/user\/subscription/.test(pk),
    'probe harus mencoba endpoint subscription (permission user_read)',
  );
  assert.ok(
    /api\.elevenlabs\.io\/v1\/voices/.test(pk),
    'probe harus mencoba endpoint voices',
  );
  // Probe tidak boleh hardcode "elevenlabs error (401)" lagi.
  assert.ok(
    !/elevenlabs error \(\$\{res\.status\}\)/.test(pk),
    'pesan generik "elevenlabs error (401)" harus hilang',
  );
  assert.ok(
    /elevenlabsErrorMessage\(/.test(pk),
    'probe harus memakai elevenlabsErrorMessage',
  );
});

test('D-281: adapter synthesize ElevenLabs juga pakai pesan actionable', async () => {
  const {readFileSync} = await import('node:fs');
  const tp = readFileSync(new URL('../server/tts-providers.js', import.meta.url), 'utf8');
  assert.ok(/elevenlabsErrorMessage\(/.test(tp), 'adapter harus memakai elevenlabsErrorMessage');
  assert.ok(
    !/ElevenLabs error \(\$\{res\.status\}\)/.test(tp),
    'pesan generik di adapter harus hilang',
  );
});

// ===== Panduan UI =====

test('D-281: form key punya panduan langkah demi langkah ElevenLabs', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(/id="keyGuideElevenlabs"/.test(html), 'wadah panduan ElevenLabs harus ada');
  // Panduan wajib menyebut permission yang harus dinyalakan.
  assert.match(html, /Text to Speech<\/strong>/i, 'harus menyebut Text to Speech');
  assert.match(html, /Voices<\/strong>/i, 'harus menyebut Voices');
  assert.match(html, /User<\/strong>/i, 'harus menyebut User');
  // Permission harus ditulis lengkap sebagai "Text to Speech: Access" dsb.
  assert.match(html, /Text to Speech[\s\S]{0,60}?Access/i, 'harus menyebut Text to Speech: Access');
  assert.match(html, /Voices[\s\S]{0,60}?Read/i, 'harus menyebut Voices: Read');
  assert.match(html, /User[\s\S]{0,60}?Read/i, 'harus menyebut User: Read');
  // Harusktegas soal key ID vs API key penuh.
  assert.match(html, /sk_/, 'harus menyebut prefix sk_');
  assert.match(html, /API Key ID/, 'harus membedakan API Key ID');
});

test('D-281: panduan ElevenLabs hanya tampil saat provider dipilih', async () => {
  const {readFileSync} = await import('node:fs');
  const client = readFileSync(new URL('../public/ai-providers.js', import.meta.url), 'utf8');
  assert.match(client, /keyGuideElevenlabs/, 'client harus(search) elemen panduan');
  assert.match(
    client, /elGuide\.hidden = p !== 'elevenlabs'/,
    'panduan hanya tampil saat provider = elevenlabs',
  );
});

test('D-281: hint ElevenLabs di semua tempat menyebut permission key', async () => {
  const {readFileSync} = await import('node:fs');
  for (const f of ['../server/provider-keys.js', '../server/tts-providers.js', '../public/ai-providers.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    // Hint ElevenLabs bisa satu baris (client) atau multi-line (server metadata).
    const block = /elevenlabs:\s*\{[\s\S]*?hint:\s*'([^']*)'/.exec(src);
    assert.ok(block, `hint elevenlabs tidak ditemukan di ${f}`);
    const hint = block[1];
    assert.match(hint, /Text to Speech: Access/, `${f} harus menyebut permission key`);
    assert.match(hint, /sk_/, `${f} harus menyebut prefix sk_`);
  }
});
