// DB access + live probes for the AI Key Vault. Server-side only — never ship to the frontend.
// RLS scopes every row to the owning admin; ciphertext never leaves this module toward HTTP responses.
import { encryptSecret, decryptSecret, vaultConfigured } from './vault.js';

export const PROVIDERS = ['groq', 'gemini', 'openrouter'];
export const AUTO_ORDER = ['groq', 'gemini', 'openrouter'];
export const AUTO_DISABLE_AFTER = 5;

const envConfig = (provider) => ({
  groq: { key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b' },
  gemini: { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
  openrouter: { key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini' },
}[provider]);

/** Shape of a safe, client-facing key record (no ciphertext/iv/tag). */
export function toMeta(row) {
  return {
    id: row.id,
    provider: row.provider,
    key_name: row.key_name,
    last4: row.last4,
    priority: row.priority,
    is_active: row.is_active,
    health_status: row.health_status,
    consecutive_failures: row.consecutive_failures ?? 0,
    last_used_at: row.last_used_at ?? null,
    last_failure_at: row.last_failure_at ?? null,
    last_error: row.last_error ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listKeyMeta(supabase) {
  const { data, error } = await supabase
    .from('ai_provider_keys')
    .select('id,provider,key_name,last4,priority,is_active,health_status,consecutive_failures,last_used_at,last_failure_at,last_error,created_at,updated_at')
    .order('provider', { ascending: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return (data || []).map(toMeta);
}

export async function createKey(supabase, { provider, key_name, api_key, priority }) {
  if (!PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider harus groq, gemini, atau openrouter.'), { status: 400 });
  const name = String(key_name || '').trim();
  if (!name || name.length > 80) throw Object.assign(new Error('Nama key wajib diisi (maks 80 karakter).'), { status: 400 });
  const probe = await probeProviderKey(provider, api_key).catch(e => ({ ok: false, error: e.message }));
  const enc = encryptSecret(api_key);
  const row = {
    provider,
    key_name: name,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.auth_tag,
    last4: enc.last4,
    priority: Number.isFinite(Number(priority)) ? Math.max(1, Math.min(1000, Math.trunc(Number(priority)))) : 100,
    is_active: true,
    health_status: probe.ok ? 'ok' : 'failing',
    consecutive_failures: probe.ok ? 0 : 1,
    last_failure_at: probe.ok ? null : new Date().toISOString(),
    last_error: probe.ok ? null : (probe.error || 'Probe gagal').slice(0, 500),
  };
  const { data, error } = await supabase.from('ai_provider_keys').insert(row).select().single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw Object.assign(new Error('Nama key sudah dipakai untuk provider ini.'), { status: 409 });
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return { key: toMeta(data), probe };
}

export async function updateKey(supabase, id, { key_name, priority, is_active }) {
  const patch = {};
  if (key_name !== undefined) {
    const name = String(key_name).trim();
    if (!name || name.length > 80) throw Object.assign(new Error('Nama key wajib diisi (maks 80 karakter).'), { status: 400 });
    patch.key_name = name;
  }
  if (priority !== undefined) {
    if (!Number.isFinite(Number(priority))) throw Object.assign(new Error('Prioritas harus angka.'), { status: 400 });
    patch.priority = Math.max(1, Math.min(1000, Math.trunc(Number(priority))));
  }
  if (is_active !== undefined) {
    patch.is_active = Boolean(is_active);
    // Manual (re)enable resets the failure bookkeeping so the key gets a fresh start.
    if (patch.is_active) { patch.consecutive_failures = 0; patch.health_status = 'unknown'; patch.last_error = null; }
    else patch.health_status = 'disabled';
  }
  const { data, error } = await supabase.from('ai_provider_keys').update(patch).eq('id', id).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return toMeta(data);
}

export async function rotateKey(supabase, id, api_key) {
  const { data: current, error: getError } = await supabase.from('ai_provider_keys').select('provider').eq('id', id).maybeSingle();
  if (getError || !current) throw Object.assign(new Error('Key tidak ditemukan.'), { status: 404 });
  const probe = await probeProviderKey(current.provider, api_key).catch(e => ({ ok: false, error: e.message }));
  const enc = encryptSecret(api_key);
  const { data, error } = await supabase.from('ai_provider_keys').update({
    ciphertext: enc.ciphertext, iv: enc.iv, auth_tag: enc.auth_tag, last4: enc.last4,
    health_status: probe.ok ? 'ok' : 'failing',
    consecutive_failures: probe.ok ? 0 : 1,
    is_active: true,
    last_failure_at: probe.ok ? null : new Date().toISOString(),
    last_error: probe.ok ? null : (probe.error || 'Probe gagal').slice(0, 500),
  }).eq('id', id).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return { key: toMeta(data), probe };
}

export async function deleteKey(supabase, id) {
  const { error } = await supabase.from('ai_provider_keys').delete().eq('id', id);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return true;
}

/** Fetch + decrypt active keys for one provider, ordered by priority (lower first). Server-side only. */
export async function getUsableKeys(supabase, provider) {
  if (!vaultConfigured()) return [];
  const { data, error } = await supabase
    .from('ai_provider_keys')
    .select('id,key_name,ciphertext,iv,auth_tag,priority')
    .eq('provider', provider)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return [];
  const usable = [];
  for (const row of data || []) {
    try {
      usable.push({ keyId: row.id, keyName: row.key_name, apiKey: decryptSecret(row) });
    } catch (decryptError) {
      // Decrypt failure counts as a failure so the offending row eventually auto-disables.
      await recordFailure(supabase, row.id, decryptError.message);
    }
  }
  return usable;
}

export async function recordSuccess(supabase, keyId) {
  if (!keyId) return;
  await supabase.from('ai_provider_keys').update({
    consecutive_failures: 0, health_status: 'ok', last_used_at: new Date().toISOString(), last_error: null,
  }).eq('id', keyId);
}

export async function recordFailure(supabase, keyId, errorMessage) {
  if (!keyId) return;
  const { data } = await supabase.from('ai_provider_keys').select('consecutive_failures').eq('id', keyId).maybeSingle();
  const next = (data?.consecutive_failures ?? 0) + 1;
  const disable = next >= AUTO_DISABLE_AFTER;
  await supabase.from('ai_provider_keys').update({
    consecutive_failures: next,
    last_failure_at: new Date().toISOString(),
    last_error: String(errorMessage || 'Unknown error').slice(0, 500),
    ...(disable ? { is_active: false, health_status: 'failing' } : { health_status: 'failing' }),
  }).eq('id', keyId);
}

/** Minimal live call that costs ~zero tokens. Returns {ok, status?, error?}. */
export async function probeProviderKey(provider, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) return { ok: false, error: 'API key tidak valid (kosong/terlalu pendek).' };
  const cfg = envConfig(provider);
  const controller = AbortSignal.timeout(20000);
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } }),
        signal: controller,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, status: res.status };
      return { ok: false, status: res.status, error: data?.error?.message || `Gemini error (${res.status})` };
    }
    const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json',
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://sherlystudio.vercel.app', 'X-Title': 'SherlyStudio' } : {}),
      },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: controller,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: data?.error?.message || `${provider} error (${res.status})` };
  } catch (error) {
    return { ok: false, error: error.name === 'TimeoutError' ? 'Probe timeout (20s).' : error.message };
  }
}

export async function testKey(supabase, id) {
  const { data, error } = await supabase.from('ai_provider_keys').select('provider,ciphertext,iv,auth_tag').eq('id', id).maybeSingle();
  if (error || !data) throw Object.assign(new Error('Key tidak ditemukan.'), { status: 404 });
  let apiKey;
  try { apiKey = decryptSecret(data); }
  catch (decryptError) {
    await recordFailure(supabase, id, decryptError.message);
    return { ok: false, error: decryptError.message };
  }
  const probe = await probeProviderKey(data.provider, apiKey);
  if (probe.ok) await recordSuccess(supabase, id);
  else await recordFailure(supabase, id, probe.error);
  return probe;
}

export function envFallbackStatus() {
  return {
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  };
}
