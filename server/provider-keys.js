// DB access + live probes for the AI Key Vault. Server-side only — never ship to the frontend.
// RLS scopes every row to the owning admin; ciphertext never leaves this module toward HTTP responses.
import { encryptSecret, decryptSecret, vaultConfigured } from './vault.js';

export const PROVIDERS = ['groq', 'gemini', 'openrouter', 'kie'];
export const AUTO_ORDER = ['groq', 'gemini', 'openrouter', 'custom'];
// Provider yang boleh dipakai tamu/klien untuk kunci pribadi (BYOK).
export const PERSONAL_PROVIDERS = ['gemini', 'groq', 'openrouter', 'custom'];
// D-146: multi key per provider per akun (fallback otomatis antar key saat chat).
export const MAX_PERSONAL_KEYS_PER_PROVIDER = 5;
export const AUTO_DISABLE_AFTER = 5;

// ---------- Capability taxonomy (API key categories) ----------
// Keys are stored PER PROVIDER — capabilities describe what that provider can power.
// Studio categories have no provider yet: kie.ai is the planned candidate for
// text-to-image / image-to-image / text-to-video / image-to-video.
export const CAPABILITIES = [
  { id: 'chat',       label: 'Teks & Logika',            short: 'Teks',   badge: '💬', description: 'Chat, reasoning, copywriting & analisis — otak utama Sherly.' },
  { id: 'vision',     label: 'Vision / Analisis Gambar', short: 'Vision', badge: '👁️', description: 'Memahami isi gambar & referensi visual (QC, upload, dll).' },
  { id: 'tts',        label: 'Text-to-Speech',           short: 'TTS',    badge: '🔊', description: 'Mengubah teks menjadi voiceover.' },
  { id: 'image_gen',  label: 'Text-to-Image',            short: 'T2I',    badge: '🖼️', description: 'Studio: generate gambar dari prompt (mis. kie.ai).' },
  { id: 'image_edit', label: 'Image-to-Image',           short: 'I2I',    badge: '✏️', description: 'Studio: restyle/edit gambar dengan prompt (mis. kie.ai).' },
  { id: 'video_gen',  label: 'Text-to-Video',            short: 'T2V',    badge: '🎬', description: 'Studio: generate video dari prompt (mis. kie.ai).' },
  { id: 'video_edit', label: 'Image-to-Video',           short: 'I2V',    badge: '🎞️', description: 'Studio: animasi/clip dari gambar (mis. kie.ai).' },
];
export const CAPABILITY_IDS = CAPABILITIES.map(c => c.id);
export const PROVIDER_CAPABILITIES = {
  groq: ['chat', 'vision'],
  gemini: ['chat', 'vision', 'tts'],
  openrouter: ['chat', 'vision'],
  kie: ['image_gen', 'image_edit', 'video_gen', 'video_edit'],
};
const PROBE_LABEL = { groq: 'Groq', gemini: 'Google Gemini', openrouter: 'OpenRouter', kie: 'Kie AI' };

// Catatan 2026-11: Google menjawab bahwa gemini-2.5-flash “is no longer available to new users” (lihat error API live).
const DEFAULT_MODELS = {
  groq: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  gemini: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  openrouter: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
};

// Ordering for "disarankan" badge — most recommended first.
const RECOMMENDED_MODELS = [
  'openai/gpt-oss-120b', 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'gemini-3.8-flash', 'google/gemini-3.8-flash',
  'openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'gemini-2.5-flash',
  'mistralai/mistral-small-2603', 'mistralai/mistral-small-3.2-24b-instruct',
  'meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-haiku',
];

const envKey = (provider) => ({ gemini: process.env.GEMINI_API_KEY, groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY }[provider] || null);

/** Shape of a safe, client-facing key record (no ciphertext/iv/tag). */
export function toMeta(row) {
  return {
    id: row.id,
    provider: row.provider,
    key_name: row.key_name,
    base_url: row.base_url || null,
    model: row.model || null,
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
    .select('id,provider,key_name,last4,priority,is_active,health_status,consecutive_failures,last_used_at,last_failure_at,last_error,created_at,updated_at,base_url,model')
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
  if (!PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider harus groq, gemini, openrouter, atau kie.'), { status: 400 });
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
  if (![...PROVIDERS, ...PERSONAL_PROVIDERS].includes(provider) || typeof key_name !== 'string' || !key_name.trim()) {
    throw Object.assign(new Error('provider & key_name wajib valid.'), { status: 400 });
  }
  const { error } = await supabase.from('ai_provider_keys').delete().eq('provider', provider).eq('key_name', key_name);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return true;
}

export async function rotateKey(supabase, id, api_key) {
  const { data: current, error: getError } = await supabase.from('ai_provider_keys').select('provider,base_url').eq('id', id).maybeSingle();
  if (getError || !current) throw Object.assign(new Error('Key tidak ditemukan.'), { status: 404 });
  const probe = await probeProviderKey(current.provider, api_key, current.base_url).catch(e => ({ ok: false, error: e.message }));
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
  let { data, error } = await supabase
    .from('ai_provider_keys')
    .select('id,key_name,ciphertext,iv,auth_tag,priority,base_url,model')
    .eq('provider', provider)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (error && /base_url|"model"|column/i.test(error.message || '')) {
    // D-142: migrasi kolom kustom belum dijalankan — ulang tanpa kolom baru agar key lama tetap hidup.
    ({ data, error } = await supabase
      .from('ai_provider_keys')
      .select('id,key_name,ciphertext,iv,auth_tag,priority')
      .eq('provider', provider)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }));
  }
  if (error) return [];
  const usable = [];
  for (const row of data || []) {
    try {
      usable.push({ keyId: row.id, keyName: row.key_name, apiKey: decryptSecret(row), baseUrl: row.base_url || null, customModel: row.model || null });
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

/** Validasi base URL kustom (anti-SSRF dasar): wajib http(s) & bukan host internal/lokal. */
export function assertSafeBaseUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw Object.assign(new Error('Base URL kustom tidak valid.'), { status: 400 }); }
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Base URL kustom wajib diawali http:// atau https://.'), { status: 400 });
  const host = (u.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  const internal = host === 'localhost' || host === '::1' || host === '0.0.0.0'
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)
    || /^f[cd][0-9a-f]{2}:/.test(host) || host.endsWith('.local') || host.endsWith('.internal');
  if (internal) throw Object.assign(new Error('Base URL ke alamat internal/lokal tidak diizinkan.'), { status: 400 });
  return u;
}

/** Live-fetch the model catalogue for a provider. */
export async function fetchProviderModels(provider, apiKey, baseUrl) {
  const controller = AbortSignal.timeout(15000);
  let models = [];
  if (provider === 'kie') throw new Error('Daftar model Kie belum tersedia — model gambar Kie diatur lewat KIE_IMAGE_MODEL (opsional).');
  if (provider === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': apiKey }, signal: controller });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Gemini models error (${res.status})`);
    models = (data?.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => ({ id: String(m.name || '').replace(/^models\//, ''), display: m.displayName || null }));
  } else {
    let base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
    if (provider === 'custom') base = assertSafeBaseUrl(String(baseUrl || '').trim().replace(/\/+$/, '')).href.replace(/\/+$/, '');
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

/** Connection test that needs NO specific model: lists models with the key (≈zero tokens).
 *  A key that is valid passes even if a particular model (e.g. gemini-2.5-flash) is retired. */
export async function probeProviderKey(provider, apiKey, baseUrl) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) return { ok: false, error: 'API key tidak valid (kosong/terlalu pendek).' };
  const controller = AbortSignal.timeout(20000);
  const key = apiKey.trim();
  if (provider === 'kie') {
    // Kie belum punya endpoint listing gratis yang diketahui — validasi format saja; kunci teruji sungguhan saat generate pertama.
    return { ok: true, status: 0, note: 'Validasi format saja — kunci Kie teruji saat generate pertama di Studio.' };
  }
  try {
    let res;
    if (provider === 'gemini') {
      res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': key },
        signal: controller,
      });
    } else {
      let base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
      if (provider === 'custom') {
        if (!baseUrl) return { ok: false, error: 'Base URL kustom tidak tersimpan pada key ini.' };
        base = assertSafeBaseUrl(String(baseUrl).trim().replace(/\/+$/, '')).href.replace(/\/+$/, '');
      }
      res = await fetch(`${base}/models`, {
        headers: {
          Authorization: `Bearer ${key}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://sherlystudio.vercel.app', 'X-Title': 'SherlyStudio' } : {}),
        },
        signal: controller,
      });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status };
    const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : null) || `${provider} error (${res.status})`;
    return { ok: false, status: res.status, error: msg };
  } catch (error) {
    return { ok: false, error: error.name === 'TimeoutError' ? 'Probe timeout (20s).' : error.message };
  }
}

export async function testKey(supabase, id) {
  const { data, error } = await supabase.from('ai_provider_keys').select('provider,base_url,ciphertext,iv,auth_tag').eq('id', id).maybeSingle();
  if (error || !data) throw Object.assign(new Error('Key tidak ditemukan.'), { status: 404 });
  let apiKey;
  try { apiKey = decryptSecret(data); }
  catch (decryptError) {
    await recordFailure(supabase, id, decryptError.message);
    return { ok: false, error: decryptError.message };
  }
  const probe = await probeProviderKey(data.provider, apiKey, data.base_url);
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


// ---------- Kunci AI pribadi (BYOK tamu & klien) ----------
// Satu kunci per provider per akun; baris di-scope RLS ke pemilik (user_id = auth.uid()).
export async function listPersonalKeys(supabase) {
  const { data, error } = await supabase.from('ai_provider_keys')
    .select('id,provider,last4,base_url,model,is_active,health_status,consecutive_failures,created_at')
    .order('provider', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map((r) => ({ id: r.id, provider: r.provider, last4: r.last4, base_url: r.base_url || null, model: r.model || null, is_active: r.is_active !== false, health_status: r.health_status || 'unknown', consecutive_failures: r.consecutive_failures ?? 0, created_at: r.created_at }));
}

export async function savePersonalKey(supabase, { provider, api_key, base_url, model, label, user_id }) {
  if (!PERSONAL_PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider harus gemini, groq, openrouter, atau custom.'), { status: 400 });
  const key = String(api_key || '').trim();
  if (!key || key.length < 20 || key.length > 400) throw Object.assign(new Error('API key tidak valid (panjang 20-400 karakter).'), { status: 400 });
  const labelChoice = String(label || '').trim() || 'pribadi';
  if (labelChoice.length > 80) throw Object.assign(new Error('Label grup maksimal 80 karakter.'), { status: 400 });
  const modelChoice = String(model || '').trim();
  if (modelChoice.length > 120) throw Object.assign(new Error('Nama model maksimal 120 karakter.'), { status: 400 });
  let baseUrl = null;
  if (provider === 'custom') {
    baseUrl = String(base_url || '').trim().replace(/\/+$/, '');
    if (!baseUrl) throw Object.assign(new Error('Base URL kustom wajib diisi.'), { status: 400 });
    assertSafeBaseUrl(baseUrl);
    if (!modelChoice) throw Object.assign(new Error('Model wajib diisi untuk provider kustom (maks 120 karakter).'), { status: 400 });
  }
  if (!user_id) throw Object.assign(new Error('user_id tidak tersedia untuk insert vault.'), { status: 400 });
  // D-146: multi key — tambah baru, jangan hapus yang lama; batasi per provider.
  const { count, error: countError } = await supabase.from('ai_provider_keys')
    .select('id', { count: 'exact', head: true }).eq('provider', provider);
  if (!countError && (count || 0) >= MAX_PERSONAL_KEYS_PER_PROVIDER) {
    throw Object.assign(new Error(`Maksimal ${MAX_PERSONAL_KEYS_PER_PROVIDER} key per provider untuk satu akun — hapus salah satu dulu kalau ingin menambah yang baru.`), { status: 400 });
  }
  if (provider === 'custom') {
    // Tes koneksi kustom = daftar model harus bisa diambil dengan key ini (GET /models).
    try { await fetchProviderModels('custom', key, baseUrl); }
    catch (e) { throw Object.assign(new Error(`Tes koneksi gagal — key TIDAK disimpan. Endpoint kustom menjawab: ${e.message}`), { status: 400 }); }
  } else {
    const probe = await probeProviderKey(provider, key).catch((e) => ({ ok: false, error: e.message }));
    if (!probe.ok) throw Object.assign(new Error(`Tes koneksi gagal — key TIDAK disimpan. ${PROBE_LABEL[provider] || provider} menjawab: ${probe.error || 'tidak diketahui'}`), { status: 400 });
  }
  const enc = encryptSecret(key);
  const row = {
    user_id, provider, key_name: labelChoice,
    ciphertext: enc.ciphertext, iv: enc.iv, auth_tag: enc.auth_tag, last4: enc.last4,
    priority: 100, is_active: true,
    health_status: 'ok',
    consecutive_failures: 0, last_failure_at: null, last_error: null,
    base_url: baseUrl, model: modelChoice || null,
  };
  const { data, error } = await supabase.from('ai_provider_keys').insert(row).select('id,provider,last4,base_url,model,is_active,health_status,created_at').single();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return data;
}

// D-147: tandai satu key sebagai default provider-nya (prioritas 1, diaktifkan kembali).
export async function setDefaultPersonalKey(supabase, id) {
  const { data: current, error } = await supabase.from('ai_provider_keys').select('id,provider').eq('id', id).maybeSingle();
  if (error || !current) throw Object.assign(new Error('Key tidak ditemukan.'), { status: 404 });
  // turunkan semua key provider ini milik akun (RLS owner), lalu angkat key terpilih.
  await supabase.from('ai_provider_keys').update({ priority: 100 }).eq('provider', current.provider).neq('id', id);
  const { data, error: updError } = await supabase.from('ai_provider_keys')
    .update({ priority: 1, is_active: true, consecutive_failures: 0, health_status: 'unknown', last_error: null })
    .eq('id', id).select().single();
  if (updError) throw Object.assign(new Error(updError.message), { status: 400 });
  return toMeta(data);
}

export async function deletePersonalKey(supabase, id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{10,}$/i.test(id)) throw Object.assign(new Error('ID kunci tidak valid.'), { status: 400 });
  const { error } = await supabase.from('ai_provider_keys').delete().eq('id', id);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
}
