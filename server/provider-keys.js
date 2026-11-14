// DB access + live probes for the AI Key Vault. Server-side only — never ship to the frontend.
// RLS scopes every row to the owning admin; ciphertext never leaves this module toward HTTP responses.
import { encryptSecret, decryptSecret, vaultConfigured } from './vault.js';

export const PROVIDERS = ['groq', 'gemini', 'openrouter'];
export const AUTO_ORDER = ['groq', 'gemini', 'openrouter'];
export const AUTO_DISABLE_AFTER = 5;
const PROBE_LABEL = { groq: 'Groq', gemini: 'Google Gemini', openrouter: 'OpenRouter' };

const DEFAULT_MODELS = {
  groq: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openrouter: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
};

// Ordering for "disarankan" badge — most recommended first.
const RECOMMENDED_MODELS = [
  'openai/gpt-oss-120b', 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'gemini-2.5-flash',
  'mistralai/mistral-small-2603', 'mistralai/mistral-small-3.2-24b-instruct',
  'meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-haiku',
];

const envKey = (provider) => ({ gemini: process.env.GEMINI_API_KEY, groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY }[provider] || null);
const envConfig = (provider) => ({ key: envKey(provider), model: DEFAULT_MODELS[provider] });

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

/** Group key rows by (provider, key_name) — one label may hold many keys. */
export function groupKeyRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const meta = toMeta(row);
    const key = `${row.provider}:${row.key_name}`;
    if (!map.has(key)) {
      map.set(key, { key, provider: row.provider, key_name: row.key_name, keys: [] });
    }
    map.get(key).keys.push(meta);
  }
  const groups = [...map.values()].map((g) => {
    const active = g.keys.filter(k => k.is_active);
    const ok = g.keys.filter(k => k.health_status === 'ok');
    const failing = g.keys.filter(k => k.health_status === 'failing');
    let health = 'unknown';
    if (active.length === 0) health = 'disabled';
    else if (ok.length) health = 'ok';
    else if (failing.length) health = 'failing';
    const lastUsed = g.keys.map(k => k.last_used_at).filter(Boolean).sort().pop() || null;
    return {
      ...g,
      total: g.keys.length,
      active_count: active.length,
      ok_count: ok.length,
      failing_count: failing.length,
      priority: Math.min(...g.keys.map(k => k.priority)),
      health_status: health,
      last_used_at: lastUsed,
    };
  });
  groups.sort((a, b) => a.provider.localeCompare(b.provider) || a.priority - b.priority || a.key_name.localeCompare(b.key_name));
  return groups;
}

export async function listKeyRows(supabase) {
  const { data, error } = await supabase
    .from('ai_provider_keys')
    .select('id,provider,key_name,last4,priority,is_active,health_status,consecutive_failures,last_used_at,last_failure_at,last_error,created_at,updated_at')
    .order('provider', { ascending: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return data || [];
}

export async function listKeyGroups(supabase) {
  return groupKeyRows(await listKeyRows(supabase));
}

export async function createKey(supabase, { provider, key_name, api_key, priority, user_id }) {
  if (!PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider harus groq, gemini, atau openrouter.'), { status: 400 });
  const name = String(key_name || '').trim();
  if (!name || name.length > 80) throw Object.assign(new Error('Nama key/label wajib diisi (maks 80 karakter).'), { status: 400 });
  if (!user_id) throw Object.assign(new Error('user_id tidak tersedia untuk insert vault.'), { status: 400 });
  const probe = await probeProviderKey(provider, api_key).catch(e => ({ ok: false, error: e.message }));
  if (!probe.ok) {
    throw Object.assign(new Error(`Tes koneksi gagal — key TIDAK disimpan. ${PROBE_LABEL[provider] || provider} menjawab: ${probe.error || 'tidak diketahui'}`), { status: 400 });
  }
  const enc = encryptSecret(api_key);
  const row = {
    user_id,
    provider,
    key_name: name,
    ciphertext: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.auth_tag,
    last4: enc.last4,
    priority: Number.isFinite(Number(priority)) ? Math.max(1, Math.min(1000, Math.trunc(Number(priority)))) : 100,
    is_active: true,
    health_status: 'ok',
    consecutive_failures: 0,
    last_failure_at: null,
    last_error: null,
  };
  const { data, error } = await supabase.from('ai_provider_keys').insert(row).select().single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw Object.assign(new Error('Label ini sudah dipakai dan migrasi v1.2 (drop unique constraint) belum dijalankan. Jalankan supabase/ai_key_vault_groups_migration.sql.'), { status: 409 });
    }
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return { key: toMeta(data), probe };
}

export async function updateKey(supabase, id, { key_name, priority, is_active }) {
  const patch = {};
  if (key_name !== undefined) {
    const name = String(key_name).trim();
    if (!name || name.length > 80) throw Object.assign(new Error('Nama key/label wajib diisi (maks 80 karakter).'), { status: 400 });
    patch.key_name = name;
  }
  if (priority !== undefined) {
    if (!Number.isFinite(Number(priority))) throw Object.assign(new Error('Prioritas harus angka.'), { status: 400 });
    patch.priority = Math.max(1, Math.min(1000, Math.trunc(Number(priority))));
  }
  if (is_active !== undefined) {
    patch.is_active = Boolean(is_active);
    if (patch.is_active) { patch.consecutive_failures = 0; patch.health_status = 'unknown'; patch.last_error = null; }
    else patch.health_status = 'disabled';
  }
  const { data, error } = await supabase.from('ai_provider_keys').update(patch).eq('id', id).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return toMeta(data);
}

export async function deleteGroup(supabase, { provider, key_name }) {
  if (!PROVIDERS.includes(provider) || typeof key_name !== 'string' || !key_name.trim()) {
    throw Object.assign(new Error('provider & key_name wajib valid.'), { status: 400 });
  }
  const { error } = await supabase.from('ai_provider_keys').delete().eq('provider', provider).eq('key_name', key_name);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return true;
}

export async function rotateKey(supabase, id, api_key) {
  const { data: current, error: getError } = await supabase.from('ai_provider_keys').select('provider').eq('id', id).maybeSingle();
  if (getError || !current) throw Object.assign(new Error('Key tidak ditemukan.'), { status: 404 });
  const probe = await probeProviderKey(current.provider, api_key).catch(e => ({ ok: false, error: e.message }));
  if (!probe.ok) {
    throw Object.assign(new Error(`Tes koneksi gagal — key lama TIDAK diganti. ${PROBE_LABEL[current.provider] || current.provider} menjawab: ${probe.error || 'tidak diketahui'}`), { status: 400 });
  }
  const enc = encryptSecret(api_key);
  const { data, error } = await supabase.from('ai_provider_keys').update({
    ciphertext: enc.ciphertext, iv: enc.iv, auth_tag: enc.auth_tag, last4: enc.last4,
    health_status: 'ok',
    consecutive_failures: 0,
    is_active: true,
    last_failure_at: null,
    last_error: null,
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
    health_status: 'failing',
    ...(disable ? { is_active: false } : {}),
  }).eq('id', keyId);
}

// ---------- Provider model management ----------

/** Effective model for a provider: user's saved preference, else env/code default. */
export async function getProviderModel(supabase, provider) {
  try {
    const { data, error } = await supabase.from('ai_provider_settings').select('model').eq('provider', provider).maybeSingle();
    if (error) return { model: DEFAULT_MODELS[provider], source: 'default' };
    if (data?.model) return { model: data.model, source: 'settings' };
  } catch { /* table may not exist yet */ }
  return { model: DEFAULT_MODELS[provider], source: envKey(provider) || process.env[`${provider.toUpperCase()}_MODEL`] ? 'env/default' : 'default' };
}

export async function getAllProviderModels(supabase) {
  const out = {};
  for (const p of PROVIDERS) out[p] = await getProviderModel(supabase, p);
  return out;
}

/** Persist the admin's chosen model. Update own row first; insert with resolved uid if missing. */
export async function saveProviderModel(supabase, provider, model, accessToken) {
  const clean = String(model || '').trim();
  if (!PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider tidak valid.'), { status: 400 });
  if (!clean || clean.length > 120) throw Object.assign(new Error('Model tidak valid (maks 120 karakter).'), { status: 400 });
  const { data: updated, error: updError } = await supabase.from('ai_provider_settings').update({ model: clean }).eq('provider', provider).select('model');
  if (!updError && updated && updated.length > 0) return { model: clean, source: 'settings' };
  let userId = null;
  try {
    const { data } = await supabase.auth.getUser(accessToken);
    userId = data?.user?.id || null;
  } catch { /* ignore */ }
  if (!userId) return { model: clean, source: 'settings', persisted: false };
  const { error: insError } = await supabase.from('ai_provider_settings').upsert({ user_id: userId, provider, model: clean }, { onConflict: 'user_id,provider' });
  if (insError) throw Object.assign(new Error(insError.message), { status: 400 });
  return { model: clean, source: 'settings', persisted: true };
}

/** True when the provider error indicates the model id is unavailable/retired. */
export function isModelNotFoundError(message) {
  const m = String(message || '');
  return /model_not_found|model_decommissioned|invalid[\s_-]?model/i.test(m)
    || /(model|model id)[^\n]{0,60}(not found|does not exist|decommissioned|unavailable|no longer|not supported|unknown)/i.test(m)
    || /(not found|does not exist|decommissioned|unavailable|no longer|unknown)[^\n]{0,60}model/i.test(m);
}

const markRecommended = (id) => RECOMMENDED_MODELS.includes(id) || RECOMMENDED_MODELS.includes(String(id).split('/').pop());
const rankModel = (a, b) => {
  const ia = RECOMMENDED_MODELS.indexOf(a.id) >= 0 ? RECOMMENDED_MODELS.indexOf(a.id) : (RECOMMENDED_MODELS.indexOf(String(a.id).split('/').pop()) + 100);
  const ib = RECOMMENDED_MODELS.indexOf(b.id) >= 0 ? RECOMMENDED_MODELS.indexOf(b.id) : (RECOMMENDED_MODELS.indexOf(String(b.id).split('/').pop()) + 100);
  const ra = ia >= 100 ? 1000 : ia; const rb = ib >= 100 ? 1000 : ib;
  if (ra !== rb) return ra - rb;
  return String(a.id).localeCompare(String(b.id));
};

/** Live-fetch the model catalogue for a provider. */
export async function fetchProviderModels(provider, apiKey) {
  const controller = AbortSignal.timeout(15000);
  let models = [];
  if (provider === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': apiKey }, signal: controller });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Gemini models error (${res.status})`);
    models = (data?.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: String(m.name || '').replace(/^models\//, ''), display: m.displayName || null }));
  } else {
    const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
    const headers = { Authorization: `Bearer ${apiKey}` };
    if (provider === 'openrouter') { headers['HTTP-Referer'] = 'https://sherlystudio.vercel.app'; headers['X-Title'] = 'SherlyStudio'; }
    const res = await fetch(`${base}/models`, { headers, signal: controller });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `${provider} models error (${res.status})`);
    models = (data?.data || []).map(m => ({ id: m.id, display: m.name || null })).filter(m => m.id);
  }
  const seen = new Set();
  const unique = models.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  unique.forEach(m => { m.recommended = markRecommended(m.id); });
  unique.sort(rankModel);
  return unique;
}

/** Pick a sensible replacement when the configured model disappears. */
export async function pickReplacementModel(provider, apiKey, failedModel) {
  const models = await fetchProviderModels(provider, apiKey);
  const candidates = models.filter(m => m.id !== failedModel);
  const recommended = candidates.find(m => m.recommended);
  return (recommended || candidates[0] || null)?.id || null;
}

/** Minimal live call that costs ~zero tokens. Returns {ok, status?, error?}. */
export async function probeProviderKey(provider, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) return { ok: false, error: 'API key tidak valid (kosong/terlalu pendek).' };
  const { model } = envConfig(provider);
  const controller = AbortSignal.timeout(20000);
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
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
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
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
