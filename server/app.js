import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatWithAI } from './ai.js';
import { supabaseConfigured, createPublicClient, createUserClient } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)) });
const bucket = 'character-references';
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

function requireUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  try { req.supabase = createUserClient(token); req.accessToken = token; next(); }
  catch (error) { return res.status(503).json({ error: error.message }); }
}
async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await req.supabase.auth.getUser(req.accessToken);
    if (error || !data?.user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login kembali.' });
    if (data.user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Fitur ini hanya tersedia untuk admin SherlyStudio.' });
    req.user = data.user;
    next();
  } catch { return res.status(401).json({ error: 'Tidak dapat memverifikasi sesi login.' }); }
}
async function signedCharacter(c, client) {
  if (!c.reference_image_path) return { ...c, reference_image_url: null };
  const { data } = await client.storage.from(bucket).createSignedUrl(c.reference_image_path, 3600);
  return { ...c, reference_image_url: data?.signedUrl || null };
}
async function saveReferenceImage(req, userId, characterId) {
  if (!req.file) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype)) throw Object.assign(new Error('Format foto harus JPG, PNG, atau WebP.'), { status: 400 });
  const ext = req.file.mimetype === 'image/jpeg' ? 'jpg' : req.file.mimetype.split('/')[1];
  const objectPath = `${userId}/${characterId}/${Date.now()}.${ext}`;
  const { error } = await req.supabase.storage.from(bucket).upload(objectPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return objectPath;
}
function parseCharacter(req) {
  let d;
  try { d = JSON.parse(req.body.data || '{}'); } catch { throw Object.assign(new Error('Data karakter tidak valid.'), { status: 400 }); }
  if (!d.name?.trim() || !d.identity_prompt?.trim()) throw Object.assign(new Error('Nama dan master identity prompt wajib diisi.'), { status: 400 });
  return {
    name: d.name.trim(), role: d.role || 'Virtual Influencer', niche: Array.isArray(d.niche) ? d.niche : [],
    identity_prompt: d.identity_prompt, is_master: Boolean(d.is_master), status: 'active',
    age: Number(d.age) || 24, origin: d.origin || 'Indonesia', language: d.language || 'Bahasa Indonesia',
    platforms: Array.isArray(d.platforms) ? d.platforms : [], appearance: d.appearance || '', personality: d.personality || '',
  };
}
function validUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function safeTimezone(value) {
  if (typeof value !== 'string' || value.length > 80) return 'Asia/Jakarta';
  try { new Intl.DateTimeFormat('id-ID', { timeZone: value }); return value; }
  catch { return 'Asia/Jakarta'; }
}
function buildTrustedContext(user, timezone) {
  const now = new Date();
  const local = new Intl.DateTimeFormat('id-ID', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' }).format(now);
  const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin';
  return `KONTEKS SESI TERVERIFIKASI SERVER:\nPengguna adalah admin/pemilik SherlyStudio. Nama panggilan akun: ${displayName}.\nWaktu lokal pengguna: ${local}. Zona waktu: ${timezone}.\nGunakan waktu ini bila relevan; jangan mengumumkannya tanpa alasan. Semua pesan percakapan berasal dari sesi admin yang telah diverifikasi.`;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'SherlyStudio', mode: 'local', supabaseConfigured, aiProviders: { gemini: Boolean(process.env.GEMINI_API_KEY), groq: Boolean(process.env.GROQ_API_KEY), openrouter: Boolean(process.env.OPENROUTER_API_KEY) }, timestamp: new Date().toISOString() }));

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!supabaseConfigured) return res.status(503).json({ error: 'Supabase belum dikonfigurasi.' });
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    const { data, error } = await createPublicClient().auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    if (data.user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Akun ini belum memiliki akses admin SherlyStudio.' });
    res.json({ access_token: data.session.access_token, expires_at: data.session.expires_at, user: { id: data.user.id, email: data.user.email, role: data.user.app_metadata?.role || 'user' } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/auth/me', requireUser, requireAdmin, (req, res) => res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.app_metadata?.role } }));

app.get('/api/characters', requireUser, async (req, res) => {
  const { data, error } = await req.supabase.from('characters').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ characters: await Promise.all(data.map(c => signedCharacter(c, req.supabase))) });
});
app.post('/api/characters', requireUser, upload.single('referenceImage'), async (req, res) => {
  try {
    const { data: userData, error: userError } = await req.supabase.auth.getUser(req.accessToken);
    if (userError || !userData.user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login kembali.' });
    const userId = userData.user.id; const payload = parseCharacter(req); const id = randomUUID();
    if (payload.is_master) { const { error } = await req.supabase.from('characters').update({ is_master: false }).eq('user_id', userId).eq('is_master', true); if (error) throw error; }
    const imagePath = await saveReferenceImage(req, userId, id);
    const { data, error } = await req.supabase.from('characters').insert({ id, user_id: userId, ...payload, reference_image_path: imagePath }).select('*').single();
    if (error) throw error;
    res.status(201).json({ character: await signedCharacter(data, req.supabase) });
  } catch (error) { res.status(error.status || 400).json({ error: error.message || 'Gagal menyimpan karakter.' }); }
});
app.put('/api/characters/:id', requireUser, upload.single('referenceImage'), async (req, res) => {
  try {
    const { data: userData, error: userError } = await req.supabase.auth.getUser(req.accessToken);
    if (userError || !userData.user) return res.status(401).json({ error: 'Sesi login tidak valid.' });
    const userId = userData.user.id; const payload = parseCharacter(req);
    if (payload.is_master) { const { error } = await req.supabase.from('characters').update({ is_master: false }).eq('user_id', userId).eq('is_master', true).neq('id', req.params.id); if (error) throw error; }
    if (req.file) payload.reference_image_path = await saveReferenceImage(req, userId, req.params.id);
    const { data, error } = await req.supabase.from('characters').update(payload).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json({ character: await signedCharacter(data, req.supabase) });
  } catch (error) { res.status(error.status || 400).json({ error: error.message || 'Gagal memperbarui karakter.' }); }
});
app.delete('/api/characters/:id', requireUser, async (req, res) => {
  const { data: current } = await req.supabase.from('characters').select('reference_image_path').eq('id', req.params.id).maybeSingle();
  const { error } = await req.supabase.from('characters').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  if (current?.reference_image_path) await req.supabase.storage.from(bucket).remove([current.reference_image_path]);
  res.json({ ok: true });
});

// Admin-only AI chat v1. Guest access will be added together with Guestbook identity.
app.get('/api/ai/conversations', requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await req.supabase.from('ai_conversations').select('id,title,provider,created_at,updated_at').eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ conversations: data || [] });
});
app.get('/api/ai/conversations/:id/messages', requireUser, requireAdmin, async (req, res) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'ID percakapan tidak valid.' });
  const { data: conversation, error: conversationError } = await req.supabase.from('ai_conversations').select('id').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (conversationError || !conversation) return res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
  const { data, error } = await req.supabase.from('ai_messages').select('id,role,content,provider,model,created_at').eq('conversation_id', req.params.id).eq('user_id', req.user.id).in('role', ['user','assistant']).order('created_at', { ascending: true }).limit(200);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ messages: data || [] });
});
app.post('/api/ai/chat', requireUser, requireAdmin, async (req, res) => {
  try {
    const { message, provider = 'auto', conversation_id: requestedId, timezone } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 12000) return res.status(400).json({ error: 'Pesan wajib diisi dan maksimal 12.000 karakter.' });
    if (!['auto','gemini','groq','openrouter'].includes(provider)) return res.status(400).json({ error: 'Pilihan provider tidak valid.' });
    const userId = req.user.id;
    let conversationId = requestedId;
    if (conversationId) {
      if (!validUuid(conversationId)) return res.status(400).json({ error: 'ID percakapan tidak valid.' });
      const { data: existing, error } = await req.supabase.from('ai_conversations').select('id').eq('id', conversationId).eq('user_id', userId).maybeSingle();
      if (error || !existing) return res.status(404).json({ error: 'Percakapan tidak ditemukan atau bukan milik akun ini.' });
    } else {
      const title = message.trim().replace(/\s+/g, ' ').slice(0, 64) || 'Percakapan Sherly AI';
      const { data: created, error } = await req.supabase.from('ai_conversations').insert({ user_id: userId, title, provider: provider === 'auto' ? 'groq' : provider }).select('id').single();
      if (error) throw error;
      conversationId = created.id;
    }
    const { error: saveUserError } = await req.supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'user', content: message.trim(), provider });
    if (saveUserError) throw saveUserError;
    const { data: history, error: historyError } = await req.supabase.from('ai_messages').select('role,content').eq('conversation_id', conversationId).eq('user_id', userId).in('role', ['user','assistant']).order('created_at', { ascending: false }).limit(24);
    if (historyError) throw historyError;
    const messages = (history || []).reverse().map(item => ({ role: item.role, content: item.content }));
    const result = await chatWithAI({ provider, messages, temperature: 0.7, maxTokens: 1200 }, buildTrustedContext(req.user, safeTimezone(timezone)));
    const { error: saveAssistantError } = await req.supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'assistant', content: result.text, provider: result.provider, model: result.model, token_usage: result.usage });
    if (saveAssistantError) throw saveAssistantError;
    await req.supabase.from('ai_conversations').update({ provider: result.provider }).eq('id', conversationId).eq('user_id', userId);
    res.json({ ok: true, conversation_id: conversationId, reply: result.text, provider: result.provider, requested_provider: result.requestedProvider, fallback_used: result.fallbackUsed, model: result.model, usage: result.usage });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    res.status(status).json({ ok: false, error: error.message || 'AI provider request failed.', ...(error.details ? { details: error.details } : {}) });
  }
});

app.get('/{*splat}', (_req, res) => res.sendFile(path.resolve(__dirname, '../public/index.html')));
export default app;
