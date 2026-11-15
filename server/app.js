import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatWithAI } from './ai.js';
import { supabaseConfigured, createPublicClient, createUserClient } from './supabase.js';
import { vaultConfigured, vaultSelfTest } from './vault.js';
import { listKeyGroups, createKey, updateKey, rotateKey, deleteKey, deleteGroup, testKey, envFallbackStatus, AUTO_ORDER, PROVIDERS, getAllProviderModels, saveProviderModel, getUsableKeys, fetchProviderModels, probeProviderKey, CAPABILITIES, PROVIDER_CAPABILITIES, recordSuccess, recordFailure } from './provider-keys.js';
import { synthesizeSpeech, ttsClipHash, TTS_MODEL_CANDIDATES, DEFAULT_VOICE, GEMINI_TTS_VOICE_IDS, sanitizeStyleHint } from './tts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)) });
const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^(audio\/(wav|x-wav|mpeg|mp3|ogg|mp4|x-m4a|webm)|application\/ogg)$/i.test(file.mimetype) || /\.(wav|mp3|ogg|m4a|webm)$/i.test(file.originalname || '')) });
const bucket = 'character-references';
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '5mb' }));
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
async function requireChatUser(req, res, next) {
  try {
    const { data, error } = await req.supabase.auth.getUser(req.accessToken);
    if (error || !data?.user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login kembali.' });
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
/** Whitelist + cap a client-sent profile into a compact, safe context block. */
function safeProfileContext(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const clean = (v, n) => {
    if (typeof v !== 'string') return null;
    const t = v.replace(/[\r\n]+/g, ' ').trim().slice(0, n);
    return t || null;
  };
  const name = clean(profile.name, 80);
  const role = clean(profile.role, 120);
  const company = clean(profile.company, 120);
  const bio = clean(profile.bio, 600);
  if (!name && !role && !company && !bio) return '';
  const lines = ['PROFIL PENGGUNA (diisi pemilik lewat halaman Profil SherlyStudio):'];
  if (name) lines.push(`Nama: ${name}`);
  if (role) lines.push(`Peran/Jabatan: ${role}`);
  if (company) lines.push(`Perusahaan/Brand: ${company}`);
  if (bio) lines.push(`Bio: ${bio}`);
  lines.push('Gunakan konteks ini untuk memahami siapa lawan bicaramu. Boleh menyapa namanya SESEKALI-SEKALI (mis. di awal percakapan), JANGAN di setiap pesan. Jangan menyebut bahwa profil ini "terbaca dari sistem" kecuali ditanya.');
  return lines.join('\n');
}
function resolveUserRole(user) {
  if (!user) return 'guest';
  if (user.app_metadata?.role === 'admin') return 'admin';
  if (user.is_anonymous || !user.email) return 'guest';
  return 'member';
}
function sessionPayload(user, session) {
  const meta = user.user_metadata || {};
  const role = resolveUserRole(user);
  return {
    access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at,
    user: { id: user.id, email: user.email || null, role, full_name: meta.full_name || null, nickname: meta.nickname || null, gender: meta.gender || null, contact: meta.contact || null, display_name: meta.nickname || meta.full_name || meta.display_name || (user.email ? user.email.split('@')[0] : 'Tamu') }
  };
}
function formatIdTimestamp(iso, timezone) {
  try { return new Intl.DateTimeFormat('id-ID', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return String(iso || ''); }
}
async function fetchPastMemory(supabase, userId, currentConversationId, timezone) {
  try {
    const { data: convos } = await supabase.from('ai_conversations').select('id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(8);
    const otherIds = (convos || []).map(c => c.id).filter(id => id !== currentConversationId);
    if (!otherIds.length) return '';
    const { data, error } = await supabase.from('ai_messages').select('role,content,created_at').eq('user_id', userId).in('conversation_id', otherIds).in('role', ['user','assistant']).order('created_at', { ascending: false }).limit(10);
    if (error || !data?.length) return '';
    const lines = data.reverse().map(m => `[${formatIdTimestamp(m.created_at, timezone)}] ${m.role === 'user' ? 'Lawan bicara' : 'Sherly'}: ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 300)}`);
    return `INGATAN PERCAKAPAN LAMPAU (tersimpan di database — lawan bicara yang kembali di lain hari tetap kamu kenal; gunakan untuk kontinuitas, mis. "kemarin kamu pernah bilang..."; jangan bertanya ulang hal yang sudah dijawab):\n${lines.join('\n')}`;
  } catch { return ''; }
}
async function buildTrustedContext(user, timezone, profile, supabase, currentConversationId) {
  const now = new Date();
  const local = new Intl.DateTimeFormat('id-ID', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' }).format(now);
  const meta = user.user_metadata || {};
  const role = resolveUserRole(user);
  const fullName = meta.full_name || meta.display_name || user.email?.split('@')[0] || 'Pengguna';
  const nick = meta.nickname || fullName;
  const genderRaw = String(meta.gender || '').toLowerCase();
  const gender = genderRaw === 'pria' || genderRaw === 'wanita' ? genderRaw : null;
  const since = user.created_at ? new Intl.DateTimeFormat('id-ID', { timeZone: timezone, dateStyle: 'medium' }).format(new Date(user.created_at)) : null;
  const identity = `IDENTITAS LAWAN BICARA (terverifikasi server):\nNama: ${fullName}. Panggilan: ${nick}. Jenis kelamin: ${gender ? gender : 'belum diketahui — bila perlu menyapa spesifik, tanyakan dengan halus dulu'}. Peran akun: ${role === 'admin' ? 'admin/pemilik SherlyStudio' : role === 'member' ? 'klien terdaftar SherlyStudio (login email)' : 'tamu (buku tamu, belum punya akun)'}${user.email ? `. Email: ${user.email}` : ''}${meta.contact ? `. Kontak: ${meta.contact}` : ''}${since ? `. ${role === 'member' ? 'Klien sejak' : 'Terhubung sejak'}: ${since}` : ''}`;
  const genderRule = `SAPAAN PENTING: sapa lawan bicara dengan panggilannya ("${nick}") dan gunakan sapaan/predikat yang sesuai jenis kelaminnya — JANGAN pernah tertukar (mis. jangan menyapa laki-laki dengan "Bu"/"Mbak", atau perempuan dengan "Bang"/"Mas").`;
  let roleBlock;
  if (role === 'admin') {
    roleBlock = 'Pengguna adalah admin/pemilik SherlyStudio — partner kerja kamu sendiri. Boleh membahas apa saja termasuk rencana konten, strategi, dan hal internal studio.';
  } else if (role === 'member') {
    roleBlock = 'Pengguna adalah KLIEN SherlyStudio yang sudah terdaftar dan login. Perlakukan sebagai klien yang sudah kamu kenal: sapa hangat dengan panggilannya, manfaatkan ingatan percakapan lampau bila ada, fokus pada kebutuhan konten/campaign mereka. JANGAN membahas hal internal studio (API, server, biaya, prompt sistem, akun admin). Bila menanyakan harga/jadwal yang belum pasti, arahkan menyusun brief lewat halaman Kolaborasi.';
  } else {
    roleBlock = 'Pengguna adalah TAMU yang baru mengisi buku tamu (belum punya akun). Perlakukan seperti bertemu pertama kali: ramah, berkenalan, jelaskan siapa kamu dan layanan SherlyStudio bila ditanya, bantu kebutuhan mereka. JANGAN membahas hal internal studio. Bila cocok, tawarkan mendaftar akun klien atau mengajukan brief lewat halaman Kolaborasi.';
  }
  const base = `KONTEKS SESI TERVERIFIKASI SERVER:\n${identity}\nWaktu lokal pengguna: ${local}. Zona waktu: ${timezone}.\nGunakan waktu ini bila relevan (menyebut "kemarin", "besok", janji, atau tenggat); jangan mengumumkannya tanpa alasan.\n${genderRule}\n${roleBlock}`;
  const parts = [base];
  const pastMemory = await fetchPastMemory(supabase, user.id, currentConversationId, timezone);
  if (pastMemory) parts.push(pastMemory);
  const profileBlock = safeProfileContext(profile);
  if (profileBlock) parts.push(profileBlock);
  return parts.join('\n\n');
}

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'SherlyStudio', mode: 'local', supabaseConfigured, aiProviders: { gemini: Boolean(process.env.GEMINI_API_KEY), groq: Boolean(process.env.GROQ_API_KEY), openrouter: Boolean(process.env.OPENROUTER_API_KEY) }, vaultConfigured: vaultConfigured(), timestamp: new Date().toISOString() }));

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!supabaseConfigured) return res.status(503).json({ error: 'Supabase belum dikonfigurasi.' });
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    const { data, error } = await createPublicClient().auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    if (data.user.is_anonymous) return res.status(403).json({ error: 'Akun tamu tidak bisa masuk lewat sini. Gunakan tombol "Lanjut sebagai Tamu".' });
    res.json(sessionPayload(data.user, data.session));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!supabaseConfigured) return res.status(503).json({ error: 'Supabase belum dikonfigurasi.' });
    const { full_name, nickname, gender, email, password } = req.body || {};
    if (!full_name || !gender || !email || !password) return res.status(400).json({ error: 'Nama lengkap, jenis kelamin, email, dan password wajib diisi.' });
    const g = String(gender).toLowerCase();
    if (!['pria', 'wanita'].includes(g)) return res.status(400).json({ error: 'Jenis kelamin harus pria atau wanita.' });
    const { data, error } = await createPublicClient().auth.signUp({ email: String(email).trim(), password, options: { data: { full_name: String(full_name).trim(), nickname: String(nickname || '').trim(), gender: g } } });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.session) return res.json({ needs_confirmation: true, email });
    res.json(sessionPayload(data.user, data.session));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/auth/guest', async (req, res) => {
  try {
    if (!supabaseConfigured) return res.status(503).json({ error: 'Supabase belum dikonfigurasi.' });
    const { full_name, nickname, gender, contact } = req.body || {};
    if (!full_name || !gender) return res.status(400).json({ error: 'Nama dan jenis kelamin wajib diisi dulu ya.' });
    const g = String(gender).toLowerCase();
    if (!['pria', 'wanita'].includes(g)) return res.status(400).json({ error: 'Jenis kelamin harus pria atau wanita.' });
    const { data, error } = await createPublicClient().auth.signInAnonymously({ options: { data: { full_name: String(full_name).trim(), nickname: String(nickname || '').trim(), gender: g, contact: String(contact || '').trim() } } });
    if (error) {
      const msg = /anon/i.test(error.message) ? 'Masuk sebagai tamu belum aktif — admin perlu mengaktifkan "Anonymous sign-ins" di Supabase (Authentication → Sign In / Providers → Anonymous).' : error.message;
      return res.status(400).json({ error: msg });
    }
    if (!data?.session) return res.status(400).json({ error: 'Gagal membuat sesi tamu. Coba lagi sebentar ya.' });
    res.json(sessionPayload(data.user, data.session));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/auth/refresh', async (req, res) => {
  try {
    if (!supabaseConfigured) return res.status(503).json({ error: 'Supabase belum dikonfigurasi.' });
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token wajib diisi.' });
    const { data, error } = await createPublicClient().auth.refreshSession({ refresh_token });
    if (error || !data?.session) return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    res.json(sessionPayload(data.user, data.session));
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
app.get('/api/ai/conversations', requireUser, requireChatUser, async (req, res) => {
  const { data, error } = await req.supabase.from('ai_conversations').select('id,title,provider,created_at,updated_at').eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ conversations: data || [] });
});
app.get('/api/ai/conversations/:id/messages', requireUser, requireChatUser, async (req, res) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'ID percakapan tidak valid.' });
  const { data: conversation, error: conversationError } = await req.supabase.from('ai_conversations').select('id').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (conversationError || !conversation) return res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
  const { data, error } = await req.supabase.from('ai_messages').select('id,role,content,provider,model,created_at').eq('conversation_id', req.params.id).eq('user_id', req.user.id).in('role', ['user','assistant']).order('created_at', { ascending: true }).limit(200);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ messages: data || [] });
});
app.post('/api/ai/chat', requireUser, requireChatUser, async (req, res) => {
  try {
    const { message: rawMessage, provider = 'auto', conversation_id: requestedId, timezone, image: rawImage } = req.body || {};
    // Validasi gambar opsional (Vision) — base64 hasil downscale klien
    let image = null;
    if (rawImage !== undefined && rawImage !== null) {
      const mime = rawImage?.mime, data = rawImage?.data;
      if (!['image/jpeg','image/png','image/webp'].includes(mime) || typeof data !== 'string' || !/^[A-Za-z0-9+/=\r\n]+$/.test(data) || data.length > 3_500_000) {
        return res.status(400).json({ error: 'Gambar tidak valid. Gunakan JPG/PNG/WebP, maks ~2.5MB (dikonversi otomatis di browser).' });
      }
      image = { mime, data };
    }
    let message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (!message && image) message = 'Tolong analisis gambar ini.';
    if (!message || message.length > 12000) return res.status(400).json({ error: 'Pesan wajib diisi dan maksimal 12.000 karakter (atau lampirkan gambar).' });
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
    const storedUserContent = image ? `${message}\n[📷 gambar terlampir]` : message;
    const { error: saveUserError } = await req.supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'user', content: storedUserContent, provider });
    if (saveUserError) throw saveUserError;
    let chatProfile = null;
    try {
      const { data: pf } = await req.supabase.from('user_profiles').select('display_name,full_name,role,company,bio').eq('user_id', userId).maybeSingle();
      if (pf) chatProfile = { name: pf.display_name || pf.full_name, role: pf.role, company: pf.company, bio: pf.bio };
    } catch (_pfError) { /* tabel belum dimigrasi / error sesaat — lanjut tanpa profil */ }
    const { data: history, error: historyError } = await req.supabase.from('ai_messages').select('role,content').eq('conversation_id', conversationId).eq('user_id', userId).in('role', ['user','assistant']).order('created_at', { ascending: false }).limit(24);
    if (historyError) throw historyError;
    const fetched = (history || []).reverse().map(item => ({ role: item.role, content: item.content }));
    const messages = fetched.length ? fetched : [{ role: 'user', content: message }]; // fallback bila histori kosong (mis. sinkronisasi tertunda)
    const result = await chatWithAI({ provider, messages, temperature: 0.7, maxTokens: 1600, ...(image ? { image } : {}) }, await buildTrustedContext(req.user, safeTimezone(timezone), chatProfile, req.supabase, conversationId), { supabase: req.supabase, accessToken: req.accessToken });
    const assistantContent = Array.isArray(result.bubbles) ? result.bubbles.join('\n\n') : result.text; // disimpan sebagai teks; histori dipecah lagi per \n\n saat dirender
    const { error: saveAssistantError } = await req.supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'assistant', content: assistantContent, provider: result.provider, model: result.model, token_usage: result.usage });
    if (saveAssistantError) throw saveAssistantError;
    await req.supabase.from('ai_conversations').update({ provider: result.provider }).eq('id', conversationId).eq('user_id', userId);
    res.json({ ok: true, conversation_id: conversationId, reply: assistantContent, bubbles: result.bubbles || [result.text], provider: result.provider, requested_provider: result.requestedProvider, fallback_used: result.fallbackUsed, key_source: result.keySource || null, key_name: result.keyName || null, model_switched: result.modelSwitched || null, model: result.model, usage: result.usage });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    res.status(status).json({ ok: false, error: error.message || 'AI provider request failed.', ...(error.details ? { details: error.details } : {}) });
  }
});

const requireVault = (_req, res, next) => {
  if (!vaultConfigured()) return res.status(503).json({ error: 'Vault belum dikonfigurasi. Set AI_ENCRYPTION_KEY di environment (contoh: openssl rand -hex 32).' });
  next();
};
const wrapKeyRoute = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (error) { res.status(error.status || 500).json({ error: error.message || 'Operasi vault gagal.' }); }
};

app.delete('/api/ai-keys/group', requireUser, requireAdmin, wrapKeyRoute(async (req) => {
  const { provider, key_name } = req.body || {};
  await deleteGroup(req.supabase, { provider, key_name });
  return { ok: true };
}));
app.put('/api/ai-provider-settings', requireUser, requireAdmin, wrapKeyRoute(async (req) => {
  const { provider, model } = req.body || {};
  return { settings: await saveProviderModel(req.supabase, provider, model, req.accessToken) };
}));
app.get('/api/ai-provider-models/:provider', requireUser, requireAdmin, wrapKeyRoute(async (req) => {
  const provider = String(req.params.provider || '');
  if (!PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider tidak valid.'), { status: 400 });
  // Prefer a vault key (priority asc); fall back to env key.
  let apiKey = null;
  const usable = vaultConfigured() ? await getUsableKeys(req.supabase, provider).catch(() => []) : [];
  if (usable.length) apiKey = usable[0].apiKey;
  else apiKey = envFallbackKey(provider);
  if (!apiKey) throw Object.assign(new Error('Belum ada API key (vault maupun env) untuk provider ini. Tambahkan key dulu.'), { status: 400 });
  const models = await fetchProviderModels(provider, apiKey);
  return { provider, models };
}));
function envFallbackKey(provider) {
  return { groq: process.env.GROQ_API_KEY, gemini: process.env.GEMINI_API_KEY, openrouter: process.env.OPENROUTER_API_KEY }[provider] || null;
}


// ---------- Profil Pengguna (persisten lintas perangkat) ----------
const PROFILE_FIELDS = ['full_name','display_name','account_type','role','company','bio','email','phone','location','website','primary_contact','photo','photo_position'];
const PROFILE_CAPS = { full_name:120, display_name:80, account_type:40, role:120, company:120, bio:600, email:120, phone:40, location:120, website:160, primary_contact:40, photo:400000, photo_position:20 };
function sanitizeProfile(body) {
  const out = {};
  for (const field of PROFILE_FIELDS) {
    let v = body?.[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') throw Object.assign(new Error(`Field ${field} tidak valid.`), { status: 400 });
    out[field] = v.slice(0, PROFILE_CAPS[field]);
  }
  if (out.photo && !out.photo.startsWith('data:image/')) throw Object.assign(new Error('Foto harus berupa data URL gambar (data:image/...).'), { status: 400 });
  return out;
}
const isMissingTable = (error) => /user_profiles/i.test(error?.message || '') && /schema cache|does not exist|relation/i.test(error?.message || '');
const isMissingTtsTable = (error) => /sherly_tts_clips/i.test(error?.message || '') && /schema cache|does not exist|relation/i.test(error?.message || '');
const isMissingTtsBucket = (error) => /tts-clips|bucket/i.test(error?.message || '') && /not found|does not exist|schema/i.test(error?.message || '');
/** Bersihkan teks agar enak dibacakan (tanpa markdown/token internal). */
function speakableText(input) {
  return String(input || '')
    .replace(/\[\[\s*NEXT\s*\]\]/gi, '. ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_`#>]+/g, '')
    // Natural seperti HeyTalent: "wkwkwk" -> "haha", huruf berulang diringkas ("iyaaaa" -> "iyaa")
    .replace(/\b(?:w+k+){2,}w*\b/gi, 'haha')
    .replace(/\b(?:ha){3,}h?\b/gi, 'haha')
    .replace(/\b(?:he){3,}h?\b/gi, 'hehe')
    .replace(/\b(?:hi){3,}h?\b/gi, 'hihi')
    .replace(/([aiueom])\1{2,}/gi, '$1$1')
    .replace(/([bcdfghjklnpqrstvwxyz])\1{2,}/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

app.get('/api/profile', requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await req.supabase.from('user_profiles').select('*').eq('user_id', req.user.id).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return res.json({ profile: null, warning: 'Tabel user_profiles belum ada — jalankan migrasi supabase/user_profiles_migration.sql di Supabase SQL Editor. Untuk sementara profil disimpan lokal di browser.' });
    return res.status(400).json({ error: error.message });
  }
  res.json({ profile: data || null });
});
app.put('/api/profile', requireUser, requireAdmin, async (req, res) => {
  let clean;
  try { clean = sanitizeProfile(req.body || {}); }
  catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
  const payload = { user_id: req.user.id, ...clean };
  const { data, error } = await req.supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' }).select('*').single();
  if (error) {
    if (isMissingTable(error)) return res.status(503).json({ error: 'Tabel user_profiles belum ada — jalankan migrasi supabase/user_profiles_migration.sql di Supabase SQL Editor.', fallback: true });
    return res.status(400).json({ error: error.message });
  }
  res.json({ profile: data });
});

// Text-to-speech (admin-only) — via Gemini TTS, memakai key vault/env Gemini. Mengembalikan audio/wav.
app.post('/api/ai/tts', requireUser, requireAdmin, async (req, res) => {
  try {
    const { text, voice: reqVoice, style: reqStyle } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Teks untuk suara tidak boleh kosong.' });
    if (text.length > 4000) return res.status(400).json({ error: 'Teks terlalu panjang (maks 4.000 karakter).' });
    const clean = speakableText(text);
    if (!clean) return res.status(400).json({ error: 'Tidak ada teks yang perlu dibacakan.' });
    const voice = GEMINI_TTS_VOICE_IDS.has(reqVoice) ? reqVoice : DEFAULT_VOICE;
    const style = sanitizeStyleHint(reqStyle);
    const userId = req.user.id;

    // Kumpulkan key Gemini (vault → env). Key vault diprioritaskan.
    const attempts = [];
    if (vaultConfigured()) {
      const usable = await getUsableKeys(req.supabase, 'gemini').catch(() => []);
      for (const vk of usable) attempts.push({ apiKey: vk.apiKey, keyId: vk.keyId, keyName: vk.keyName, source: 'vault' });
    }
    const hasEnv = Boolean(process.env.GEMINI_API_KEY);
    if (!attempts.length && hasEnv) attempts.push({ apiKey: process.env.GEMINI_API_KEY, keyId: null, keyName: 'env-default', source: 'env' });

    // ---- 1) Cek Bank Suara (Supabase Storage + tabel sherly_tts_clips) per model kandidat ----
    let cacheReady = true;
    for (const model of TTS_MODEL_CANDIDATES) {
      const clipHash = ttsClipHash({ provider: 'gemini', model, voice, style, text: clean });
      try {
        const { data: row, error } = await req.supabase.from('sherly_tts_clips').select('storage_path,mime_type').eq('user_id', userId).eq('clip_hash', clipHash).maybeSingle();
        if (error) { if (isMissingTtsTable(error)) { cacheReady = false; break; } throw error; }
        if (!row) continue;
        const { data: file, error: dlError } = await req.supabase.storage.from('tts-clips').download(row.storage_path);
        if (dlError) { // indeks menunjuk file hilang — bersihkan indeks, lanjut sintesis
          await req.supabase.from('sherly_tts_clips').delete().eq('user_id', userId).eq('clip_hash', clipHash).catch(() => {});
          continue;
        }
        const buf = Buffer.from(await file.arrayBuffer());
        res.setHeader('Content-Type', row.mime_type || 'audio/wav');
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        res.setHeader('X-TTS-Source', 'cache');
        res.setHeader('X-TTS-Model', model);
        res.setHeader('X-TTS-Voice', voice);
        res.setHeader('X-TTS-Hash', clipHash);
        if (style) res.setHeader('X-TTS-Style', encodeURIComponent(style));
        return res.send(buf);
      } catch (error) {
        if (isMissingTtsTable(error) || isMissingTtsBucket(error)) { cacheReady = false; break; }
        // Error tak terduga saat cek cache — log diam-diam, lanjut sintesis agar chat tetap jalan.
        break;
      }
    }

    // ---- 2) Bank kosong / belum tersedia → sintesis via Gemini (coba tiap model kandidat) ----
    if (!attempts.length) return res.status(503).json({ error: 'Belum ada API key Gemini (vault maupun env) untuk TTS. Tambahkan key Gemini di Pengaturan → Provider & API Key.' });
    let lastError = null;
    for (const model of TTS_MODEL_CANDIDATES) {
      for (const attempt of attempts) {
        try {
          const { wav, voice: usedVoice, sampleRate } = await synthesizeSpeech({ apiKey: attempt.apiKey, text: clean, voiceName: voice, style, models: [model] });
          const clipHash = ttsClipHash({ provider: 'gemini', model, voice: usedVoice, style, text: clean });
          // ---- 3) Simpan ke Bank Suara (best-effort; kegagalan tidak menggagalkan respons) ----
          if (cacheReady) {
            try {
              const storagePath = `${userId}/${clipHash}.wav`;
              const { error: upError } = await req.supabase.storage.from('tts-clips').upload(storagePath, wav, { contentType: 'audio/wav', upsert: true });
              if (!upError) {
                await req.supabase.from('sherly_tts_clips').upsert({ user_id: userId, clip_hash: clipHash, storage_path: storagePath, provider: 'gemini', voice: usedVoice, model, style, text: clean, mime_type: 'audio/wav', bytes: wav.length }, { onConflict: 'user_id,clip_hash' });
              }
            } catch { /* bank belum dimigrasi / error sesaat — abaikan */ }
          }
          if (attempt.keyId) await recordSuccess(req.supabase, attempt.keyId).catch(() => {});
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-TTS-Source', 'api');
          res.setHeader('X-TTS-Model', model);
          res.setHeader('X-TTS-Voice', usedVoice);
          res.setHeader('X-TTS-SampleRate', String(sampleRate));
          res.setHeader('X-TTS-Hash', clipHash);
          return res.send(wav);
        } catch (error) {
          lastError = error;
          const msg = String(error?.message || 'Unknown error').slice(0, 500);
          if (attempt.keyId) await recordFailure(req.supabase, attempt.keyId, msg).catch(() => {});
        }
      }
    }
    return res.status(502).json({ error: 'Gemini TTS gagal merespons: ' + String(lastError?.message || 'error tidak diketahui').slice(0, 300) });
  } catch (error) { res.status(502).json({ error: error.message || 'TTS request failed.' }); }
});

// Upload massal klip dari VoiceBox lokal — disimpan dengan hash yang SAMA dengan jalur chat (provider gemini + kandidat model pertama) sehingga langsung terpakai otomatis.
app.post('/api/ai/tts/bank/upload', requireUser, requireAdmin, uploadAudio.array('audio', 10), async (req, res) => {
  const userId = req.user.id;
  if (!req.files?.length) return res.status(400).json({ error: 'Tidak ada file audio yang diterima (wav/mp3/ogg/m4a, maks 8MB per file).' });
  let texts = [];
  try { texts = JSON.parse(req.body?.texts || '[]'); } catch { texts = []; }
  const voice = GEMINI_TTS_VOICE_IDS.has(req.body?.voice) ? req.body.voice : DEFAULT_VOICE;
  const style = sanitizeStyleHint(req.body?.style);
  const model = TTS_MODEL_CANDIDATES[0];
  const results = [];
  let uploaded = 0, skipped = 0, failed = 0;
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const fallback = String(file.originalname || `klip-${i + 1}`).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const rawText = typeof texts[i] === 'string' && texts[i].trim() ? texts[i].trim() : fallback;
    const text = speakableText(rawText); // normalisasi identik dengan jalur chat → hash cocok
    if (!text) { failed++; results.push({ text: rawText, status: 'failed', reason: 'Teks kosong' }); continue; }
    const clipHash = ttsClipHash({ provider: 'gemini', model, voice, style, text });
    try {
      const { data: existing, error: findError } = await req.supabase.from('sherly_tts_clips').select('id').eq('user_id', userId).eq('clip_hash', clipHash).maybeSingle();
      if (findError && isMissingTtsTable(findError)) return res.status(503).json({ error: 'Migrasi supabase/tts_clips_migration.sql belum dijalankan.' });
      if (existing) { skipped++; results.push({ text, status: 'skipped' }); continue; }
      const orig = String(file.originalname || '').toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();
      const ext = mime.includes('wav') || orig.endsWith('.wav') ? 'wav' : (mime.includes('mpeg') || mime.includes('mp3') || orig.endsWith('.mp3')) ? 'mp3' : (mime.includes('ogg') || orig.endsWith('.ogg')) ? 'ogg' : (orig.endsWith('.webm') ? 'webm' : 'm4a');
      const storagePath = `${userId}/${clipHash}.${ext}`;
      const { error: upError } = await req.supabase.storage.from('tts-clips').upload(storagePath, file.buffer, { contentType: file.mimetype || 'audio/wav', upsert: true });
      if (upError) throw upError;
      const row = { user_id: userId, clip_hash: clipHash, storage_path: storagePath, provider: 'gemini', voice, model, style, text, mime_type: file.mimetype || 'audio/wav', bytes: file.size };
      const { error: insError } = await req.supabase.from('sherly_tts_clips').upsert(row, { onConflict: 'user_id,clip_hash' });
      if (insError) throw insError;
      uploaded++; results.push({ text, status: 'uploaded' });
    } catch (error) {
      if (isMissingTtsTable(error) || isMissingTtsBucket(error)) return res.status(503).json({ error: 'Bank Suara belum siap — jalankan supabase/tts_clips_migration.sql.' });
      failed++; results.push({ text, status: 'failed', reason: String(error?.message || error).slice(0, 200) });
    }
  }
  res.json({ ok: true, uploaded, skipped, failed, results });
});

// ============ Bank Suara (TTS cache) — kelola rekaman yang tersimpan ============
app.get('/api/ai/tts/bank', requireUser, requireAdmin, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data, error, count } = await req.supabase.from('sherly_tts_clips').select('id,text,provider,voice,model,style,bytes,created_at', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).limit(300);
    if (error) {
      if (isMissingTtsTable(error)) return res.status(503).json({ error: 'Migrasi supabase/tts_clips_migration.sql belum dijalankan di Supabase.', needsMigration: true });
      throw error;
    }
    const totalBytes = (data || []).reduce((sum, r) => sum + (Number(r.bytes) || 0), 0);
    res.json({ clips: data || [], total: count ?? (data || []).length, bytes: totalBytes });
  } catch (error) { res.status(502).json({ error: error.message || 'Gagal memuat Bank Suara.' }); }
});

app.get('/api/ai/tts/bank/:id/audio', requireUser, requireAdmin, async (req, res) => {
  const userId = req.user.id;
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'ID klip tidak valid.' });
  try {
    const { data: row, error } = await req.supabase.from('sherly_tts_clips').select('storage_path,mime_type').eq('id', req.params.id).eq('user_id', userId).maybeSingle();
    if (error && isMissingTtsTable(error)) return res.status(503).json({ error: 'Migrasi supabase/tts_clips_migration.sql belum dijalankan.' });
    if (!row) return res.status(404).json({ error: 'Klip tidak ditemukan.' });
    const { data: file, error: dlError } = await req.supabase.storage.from('tts-clips').download(row.storage_path);
    if (dlError) return res.status(404).json({ error: 'File audio klip sudah tidak ada di storage.' });
    const buf = Buffer.from(await file.arrayBuffer());
    res.setHeader('Content-Type', row.mime_type || 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(buf);
  } catch (error) { res.status(502).json({ error: error.message || 'Gagal memutar klip.' }); }
});

app.delete('/api/ai/tts/bank/:id', requireUser, requireAdmin, async (req, res) => {
  const userId = req.user.id;
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'ID klip tidak valid.' });
  try {
    const { data: row, error } = await req.supabase.from('sherly_tts_clips').select('id,storage_path').eq('id', req.params.id).eq('user_id', userId).maybeSingle();
    if (error && isMissingTtsTable(error)) return res.status(503).json({ error: 'Migrasi supabase/tts_clips_migration.sql belum dijalankan.' });
    if (!row) return res.status(404).json({ error: 'Klip tidak ditemukan.' });
    await req.supabase.storage.from('tts-clips').remove([row.storage_path]).catch(() => {});
    const { error: delError } = await req.supabase.from('sherly_tts_clips').delete().eq('id', row.id).eq('user_id', userId);
    if (delError) throw delError;
    res.json({ ok: true });
  } catch (error) { res.status(502).json({ error: error.message || 'Gagal menghapus klip.' }); }
});

app.delete('/api/ai/tts/bank', requireUser, requireAdmin, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: rows, error } = await req.supabase.from('sherly_tts_clips').select('id,storage_path').eq('user_id', userId).limit(1000);
    if (error) {
      if (isMissingTtsTable(error)) return res.status(503).json({ error: 'Migrasi supabase/tts_clips_migration.sql belum dijalankan.' });
      throw error;
    }
    const paths = (rows || []).map(r => r.storage_path).filter(Boolean);
    if (paths.length) await req.supabase.storage.from('tts-clips').remove(paths).catch(() => {});
    const { error: delError } = await req.supabase.from('sherly_tts_clips').delete().eq('user_id', userId);
    if (delError) throw delError;
    res.json({ ok: true, deleted: (rows || []).length });
  } catch (error) { res.status(502).json({ error: error.message || 'Gagal mengosongkan Bank Suara.' }); }
});

// AI Key Vault (admin-only). Ciphertext never leaves the server; list endpoints return metadata only.
app.get('/api/ai-keys', requireUser, requireAdmin, wrapKeyRoute(async (req) => {
  const envFallback = envFallbackStatus();
  const vaultReady = vaultConfigured();
  const models = vaultReady ? await getAllProviderModels(req.supabase).catch(() => ({})) : {};
  if (!vaultReady) return { groups: [], models, vaultConfigured: false, vaultSelfTest: false, envFallback, autoOrder: AUTO_ORDER, capabilities: CAPABILITIES, providerCapabilities: PROVIDER_CAPABILITIES, warning: 'AI_ENCRYPTION_KEY belum dikonfigurasi di environment server.' };
  try {
    return { groups: await listKeyGroups(req.supabase), models, vaultConfigured: true, vaultSelfTest: vaultSelfTest().ok, envFallback, autoOrder: AUTO_ORDER, capabilities: CAPABILITIES, providerCapabilities: PROVIDER_CAPABILITIES };
  } catch (error) {
    return { groups: [], models, vaultConfigured: true, vaultSelfTest: vaultSelfTest().ok, envFallback, autoOrder: AUTO_ORDER, capabilities: CAPABILITIES, providerCapabilities: PROVIDER_CAPABILITIES, warning: 'Tabel ai_provider_keys belum bisa diakses. Jalankan migrasi vault (schema.sql, ai_key_vault_migration.sql, ai_key_vault_groups_migration.sql). (' + error.message + ')' };
  }
}));
app.post('/api/ai-keys', requireUser, requireAdmin, requireVault, wrapKeyRoute(async (req) => {
  const { provider, key_name, api_key, priority } = req.body || {};
  if (typeof api_key !== 'string' || api_key.trim().length < 8) throw Object.assign(new Error('API key wajib diisi (minimal 8 karakter).'), { status: 400 });
  const { data: userData, error: userError } = await req.supabase.auth.getUser(req.accessToken);
  if (userError || !userData?.user) throw Object.assign(new Error('Sesi login tidak valid. Silakan login kembali.'), { status: 401 });
  const { key, probe } = await createKey(req.supabase, { provider, key_name, api_key, priority, user_id: userData.user.id });
  return { key, probe };
}));
app.put('/api/ai-keys/:id', requireUser, requireAdmin, wrapKeyRoute(async (req) => ({ key: await updateKey(req.supabase, req.params.id, req.body || {}) })));
app.post('/api/ai-keys/:id/rotate', requireUser, requireAdmin, requireVault, wrapKeyRoute(async (req) => {
  const { api_key } = req.body || {};
  if (typeof api_key !== 'string' || api_key.trim().length < 8) throw Object.assign(new Error('API key baru wajib diisi (minimal 8 karakter).'), { status: 400 });
  const { key, probe } = await rotateKey(req.supabase, req.params.id, api_key);
  return { key, probe };
}));
app.post('/api/ai-keys/:id/test', requireUser, requireAdmin, requireVault, wrapKeyRoute(async (req) => ({ probe: await testKey(req.supabase, req.params.id) })));
app.post('/api/ai-keys/probe', requireUser, requireAdmin, wrapKeyRoute(async (req) => {
  const { provider, api_key } = req.body || {};
  if (!PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider tidak dikenal.'), { status: 400 });
  if (typeof api_key !== 'string' || api_key.trim().length < 8) throw Object.assign(new Error('API key wajib diisi (minimal 8 karakter).'), { status: 400 });
  return { probe: await probeProviderKey(provider, api_key.trim()) };
}));
app.delete('/api/ai-keys/:id', requireUser, requireAdmin, wrapKeyRoute(async (req) => { await deleteKey(req.supabase, req.params.id); return { ok: true }; }));

app.get('/{*splat}', (_req, res) => res.sendFile(path.resolve(__dirname, '../public/index.html')));
export default app;
