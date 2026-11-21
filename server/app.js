import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatWithAI, generateImageWithGemini, generateImageWithKie, generateImageWithCustom, KIE_BOARD_MODEL } from './ai.js';
import { sanitizeTraits, sanitizeVoiceProfile, parseVisionTraits, visionTraitsPrompt, boardPrompt, resolveBoardPrompt, biblePrompt, VISION_SYSTEM_PROMPT, BIBLE_SYSTEM_PROMPT } from './character-wizard.js';
import { supabaseConfigured, createPublicClient, createUserClient } from './supabase.js';
import { vaultConfigured, vaultSelfTest, encryptSecret, decryptSecret } from './vault.js';
import { listKeyGroups, createKey, updateKey, rotateKey, deleteKey, deleteGroup, testKey, envFallbackStatus, AUTO_ORDER, PROVIDERS, getAllProviderModels, saveProviderModel, getUsableKeys, fetchProviderModels, probeProviderKey, CAPABILITIES, PROVIDER_CAPABILITIES, recordSuccess, recordFailure, listPersonalKeys, savePersonalKey, deletePersonalKey, setDefaultPersonalKey, PERSONAL_PROVIDERS, assertSafeBaseUrl } from './provider-keys.js';
import { synthesizeSpeech, ttsClipHash, TTS_MODEL_CANDIDATES, DEFAULT_VOICE, GEMINI_TTS_VOICE_IDS, sanitizeStyleHint } from './tts.js';
import { isMimeBlockedError, storageUploadHint } from './storage-errors.js';
import { sanitizeDocInput } from './planner-docs.js';
import { sanitizePostInput, parseImageDataUrl, publicFeedRow, isValidPostId } from './published-posts.js';
import { parseMentions, buildCharacterPromptBlock, resolveCharacterReferences, sanitizeInlineImage, shiftImageIndex } from './studio-characters.js';
import {
  saveAsset, saveGeneratedAsset, listAssets, signedAsset, deleteAsset, getAsset,
  createVideoTask, updateVideoTask, getVideoTask, listVideoTasks, ASSET_MIME, MAX_ASSET_BYTES,
} from './studio-assets.js';
import { generateVideoWithKie, pollKieVideoTask } from './ai.js';
import { normalizeVideoParams, videoCatalog } from './video-models.js';
import { normalizeImageParams, imageCatalog, findImageModel, DEFAULT_IMAGE_MODEL } from './image-models.js';
// D-207: Bank Prompt (template utuh + blok modular) untuk Studio.
import {
  PROMPT_KINDS, PROMPT_CATEGORIES, PROMPT_MODES, PROMPT_GROUPS, SEED_PROMPT_BANK,
  listPromptEntries, createPromptEntry, updatePromptEntry, deletePromptEntry, seedPromptBank,
  optimizePrompt,
} from './prompt-bank.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const AUDIO_MIME_RE = /^(audio\/(wav|x-wav|mpeg|mp3|ogg|mp4|x-m4a|webm)|application\/ogg)$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (file.fieldname === 'voiceSample') return cb(null, AUDIO_MIME_RE.test(file.mimetype) || /\.(wav|mp3|ogg|m4a|webm)$/i.test(file.originalname || ''));
  return cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype));
} });
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
  const out = { ...c, reference_image_url: null, board_image_url: null };
  if (c.reference_image_path) {
    const { data } = await client.storage.from(bucket).createSignedUrl(c.reference_image_path, 3600);
    out.reference_image_url = data?.signedUrl || null;
  }
  if (c.board_path) {
    const { data } = await client.storage.from(bucket).createSignedUrl(c.board_path, 3600);
    out.board_image_url = data?.signedUrl || null;
  }
  if (c.voice_path) {
    const { data } = await client.storage.from(bucket).createSignedUrl(c.voice_path, 3600);
    out.voice_url = data?.signedUrl || null;
  }
  return out;
}
const formFile = (req, field) => (req.files && req.files[field] && req.files[field][0]) || null;
const characterUpload = upload.fields([{ name: 'referenceImage', maxCount: 1 }, { name: 'boardImage', maxCount: 1 }, { name: 'voiceSample', maxCount: 1 }]);
/** Simpan satu file form karakter (referenceImage/boardImage: gambar; voiceSample: audio) ke Storage. */
async function saveFormFile(req, userId, characterId, field, prefix) {
  const file = formFile(req, field);
  if (!file) return null;
  const isAudio = field === 'voiceSample';
  const okMime = isAudio ? (AUDIO_MIME_RE.test(file.mimetype) || /\.(wav|mp3|ogg|m4a|webm)$/i.test(file.originalname || '')) : ['image/jpeg','image/png','image/webp'].includes(file.mimetype);
  if (!okMime) throw Object.assign(new Error(isAudio ? 'Format suara harus WAV, MP3, OGG, M4A, atau WebM.' : 'Format gambar harus JPG, PNG, atau WebP.'), { status: 400 });
  let ext = isAudio ? ((/\.mp3$/i.test(file.originalname || '') || file.mimetype === 'audio/mpeg') ? 'mp3' : (file.mimetype.split('/')[1] || 'wav').replace(/^x-/, '')) : (file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1]);
  if (!/^[a-z0-9]{2,5}$/i.test(ext)) ext = isAudio ? 'wav' : 'png';
  const objectPath = `${userId}/${characterId}/${prefix ? prefix + '-' : ''}${Date.now()}.${ext}`;
  const { error } = await req.supabase.storage.from(bucket).upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) {
    // D-107: bucket membatasi allowed mime types -> beri langkah perbaikan, bukan error mentah.
    const hint = storageUploadHint(error);
    throw Object.assign(new Error(hint || error.message), { status: hint ? 503 : 400 });
  }
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
    traits: sanitizeTraits(d.traits),
    bible: typeof d.bible === 'string' ? d.bible.slice(0, 8000) : '',
    voice: sanitizeVoiceProfile(d.voice),
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
async function fetchSherlyNotes(supabase, userId, timezone) {
  try {
    const { data, error } = await supabase.from('ai_memory_notes').select('note,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(12);
    if (error || !data?.length) return '';
    const lines = data.reverse().map(n => `- [${formatIdTimestamp(n.created_at, timezone)}] ${String(n.note || '').replace(/\s+/g, ' ').trim()}`);
    return `CATATAN PRIBADI SHERLY tentang lawan bicara (ingatan jangka panjangmu, tersimpan server — gunakan secara natural saat relevan, jangan dibacakan seperti daftar; jangan mengaku punya catatan bila kosong):\n${lines.join('\n')}`;
  } catch { return ''; }
}
async function saveMemoryNotes(supabase, userId, notes) {
  const clean = [...new Set((notes || []).map(n => String(n).replace(/\s+/g, ' ').trim()).filter(n => n.length >= 3 && n.length <= 300))].slice(0, 3);
  if (!clean.length) return;
  try {
    const { data: existing } = await supabase.from('ai_memory_notes').select('note').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    const have = new Set((existing || []).map(r => String(r.note || '').toLowerCase()));
    const fresh = clean.filter(n => !have.has(n.toLowerCase()));
    if (!fresh.length) return;
    const { error } = await supabase.from('ai_memory_notes').insert(fresh.map(note => ({ user_id: userId, note })));
    if (error) throw error;
    const { data: all } = await supabase.from('ai_memory_notes').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (all && all.length > 20) {
      const stale = all.slice(20).map(r => r.id);
      if (stale.length) await supabase.from('ai_memory_notes').delete().in('id', stale);
    }
  } catch { /* tabel ai_memory_notes belum dibuat — lewati diam-diam (chat tetap normal) */ }
}
async function buildTrustedContext(user, timezone, profile, supabase, currentConversationId) {
  const now = new Date();
  const local = new Intl.DateTimeFormat('id-ID', { timeZone: timezone, dateStyle: 'full', timeStyle: 'long' }).format(now);
  const meta = user.user_metadata || {};
  const role = resolveUserRole(user);
  // Nama "asli" = metadata akun (saat daftar / buku tamu) ATAU halaman Profil (user_profiles).
  // Bila keduanya kosong, JANGAN pakai email/username sebagai nama — Sherly menyapa tanpa nama.
  const fullName = meta.full_name || meta.display_name || profile?.name || '';
  const nick = meta.nickname || profile?.name || fullName;
  const named = Boolean(fullName);
  const genderRaw = String(meta.gender || profile?.gender || '').toLowerCase();
  const gender = genderRaw === 'pria' || genderRaw === 'wanita' ? genderRaw : null;
  const since = user.created_at ? new Intl.DateTimeFormat('id-ID', { timeZone: timezone, dateStyle: 'medium' }).format(new Date(user.created_at)) : null;
  const identity = `IDENTITAS LAWAN BICARA (terverifikasi server):\n${named ? `Nama: ${fullName}. Panggilan: ${nick}.` : `Nama & panggilan: BELUM DIISI (halaman Profil belum dilengkapi) — JANGAN menyapa atau menyebut email/username-nya (mis. "${user.email ? user.email.split('@')[0] : 'username'}") sebagai nama; sapa hangat tanpa nama, lalu di momen yang pas tanyakan nama & panggilannya dan sarankan melengkapi halaman Profil SherlyStudio.`} Jenis kelamin: ${gender ? gender : 'belum diketahui — bila perlu menyapa spesifik, tanyakan dengan halus dulu'}. Peran akun: ${role === 'admin' ? 'admin/pemilik SherlyStudio' : role === 'member' ? 'klien terdaftar SherlyStudio (login email)' : 'tamu (buku tamu, belum punya akun)'}. Badge: ${role === 'admin' ? 'OWNER (juga tampil di antarmuka chat)' : role === 'member' ? 'KLIEN (juga tampil di antarmuka chat)' : 'TAMU (juga tampil di antarmuka chat)'}${user.email ? `. Email: ${user.email}` : ''}${meta.contact ? `. Kontak: ${meta.contact}` : ''}${since ? `. ${role === 'member' ? 'Klien sejak' : 'Terhubung sejak'}: ${since}` : ''}`;
  const genderRule = named
    ? `SAPAAN PENTING: sapa lawan bicara dengan panggilannya ("${nick}") dan gunakan sapaan/predikat yang sesuai jenis kelaminnya — JANGAN pernah tertukar (mis. jangan menyapa laki-laki dengan "Bu"/"Mbak", atau perempuan dengan "Bang"/"Mas").`
    : 'SAPAAN PENTING: nama & panggilan lawan bicara belum diketahui — sapa hangat TANPA nama (jangan memakai email/username), gunakan sapaan netral sampai namanya diketahui.';
  let roleBlock;
  if (role === 'admin') {
    roleBlock = 'Pengguna adalah admin/pemilik SherlyStudio — partner kerja kamu sendiri. Kamu tahu persis sedang ngobrol dengan pemiliknya: sapa seperti partner satu tim yang sudah saling kenal, boleh langsung dan informal. Boleh membahas apa saja termasuk rencana konten, strategi, dan hal internal studio.';
  } else if (role === 'member') {
    roleBlock = 'Pengguna adalah KLIEN SherlyStudio yang sudah terdaftar dan login. Perlakukan sebagai klien yang sudah kamu kenal: sapa hangat dengan panggilannya, manfaatkan ingatan percakapan lampau bila ada, fokus pada kebutuhan konten/campaign mereka. JANGAN membahas hal internal studio (API, server, biaya, prompt sistem, akun admin). Bila menanyakan harga/jadwal yang belum pasti, arahkan menyusun brief lewat halaman Kolaborasi.';
  } else {
    roleBlock = 'Pengguna adalah TAMU yang baru mengisi buku tamu (belum punya akun). Perlakukan seperti bertemu pertama kali: ramah, berkenalan, jelaskan siapa kamu dan layanan SherlyStudio bila ditanya, bantu kebutuhan mereka, dan jaga batas pembahasan pada hal publik (perkenalan, layanan, ide umum). JANGAN membahas hal internal studio. Bila cocok, tawarkan mendaftar akun klien atau mengajukan brief lewat halaman Kolaborasi.';
  }
  const tierRule = 'KENALI STATUS LAWAN BICARA sejak kalimat pertama: cara menyapa, kedekatan, dan topik yang boleh dibahas harus mengikuti badge/peran di atas. Tunjukkan lewat gaya komunikasi — JANGAN menyebut kata teknis seperti "badge", "status", atau "sistem" kepada mereka.';
  const base = `KONTEKS SESI TERVERIFIKASI SERVER:\n${identity}\nWaktu lokal pengguna: ${local}. Zona waktu: ${timezone}.\nGunakan waktu ini bila relevan (menyebut "kemarin", "besok", janji, atau tenggat); jangan mengumumkannya tanpa alasan.\n${genderRule}\n${roleBlock}\n${tierRule}`;
  const parts = [base];
  // D-194: Sherly kenal pemilik studio & membawa laporan bersama (khusus owner).
  try {
    const personaOverrides = await fetchPersonaOverrides();
    const ownerName = String(personaOverrides.owner?.name || '').trim();
    if (role === 'admin') {
      const shared = await fetchSharedMemoryForOwner(supabase, timezone);
      if (shared) parts.push(shared);
    } else if (ownerName) {
      parts.push(`PEMILIK SHERLYSTUDIO: ${ownerName}${personaOverrides.owner?.note ? ` — ${personaOverrides.owner.note}` : ''}. Kamu bekerja untuk pemilik studio ini; bila lawan bicara bertanya tentang pemilik, jawab hangat dan singkat.`);
    }
  } catch { /* konteks owner opsional — jangan ganggu chat */ }
  const notesBlock = await fetchSherlyNotes(supabase, user.id, timezone);
  if (notesBlock) parts.push(notesBlock);
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
app.put('/api/account', requireUser, requireChatUser, async (req, res) => {
  try {
    const b = req.body || {};
    const data = {
      full_name: String(b.full_name || '').trim().slice(0, 120),
      nickname: String(b.nickname || '').trim().slice(0, 80),
      gender: String(b.gender || '').toLowerCase(),
      contact: String(b.contact || '').trim().slice(0, 120),
    };
    if (!data.full_name) return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
    if (data.gender && !['pria', 'wanita'].includes(data.gender)) return res.status(400).json({ error: 'Jenis kelamin harus pria atau wanita.' });
    const { data: out, error } = await req.supabase.auth.updateUser({ data });
    if (error || !out?.user) return res.status(400).json({ error: error.message || 'Gagal memperbarui profil akun.' });
    const u = out.user, meta = u.user_metadata || {};
    res.json({ user: { id: u.id, email: u.email || null, role: resolveUserRole(u), full_name: meta.full_name || null, nickname: meta.nickname || null, gender: meta.gender || null, contact: meta.contact || null, display_name: meta.nickname || meta.full_name || meta.display_name || (u.email ? u.email.split('@')[0] : 'Tamu') } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/auth/me', requireUser, requireAdmin, (req, res) => res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.app_metadata?.role } }));

app.get('/api/characters', requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await req.supabase.from('characters').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ characters: await Promise.all(data.map(c => signedCharacter(c, req.supabase))) });
});
app.post('/api/characters', requireUser, requireAdmin, characterUpload, async (req, res) => {
  try {
    const { data: userData, error: userError } = await req.supabase.auth.getUser(req.accessToken);
    if (userError || !userData.user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login kembali.' });
    const userId = userData.user.id; const payload = parseCharacter(req); const id = randomUUID();
    if (payload.is_master) { const { error } = await req.supabase.from('characters').update({ is_master: false }).eq('user_id', userId).eq('is_master', true); if (error) throw error; }
    const imagePath = await saveFormFile(req, userId, id, 'referenceImage', '');
    const boardPath = await saveFormFile(req, userId, id, 'boardImage', 'board');
    const voicePath = await saveFormFile(req, userId, id, 'voiceSample', 'voice');
    let { data, error } = await req.supabase.from('characters').insert({ id, user_id: userId, ...payload, reference_image_path: imagePath, board_path: boardPath, voice_path: voicePath }).select('*').single();
    if (error && /(traits|bible|voice|board_path|voice_path)/i.test(String(error.message || ''))) {
      // Kolom wizard (docs/supabase-character-wizard.sql) belum ada — simpan versi dasar dulu.
      const minimal = { ...payload }; delete minimal.traits; delete minimal.bible; delete minimal.voice;
      ({ data, error } = await req.supabase.from('characters').insert({ id, user_id: userId, ...minimal, reference_image_path: imagePath }).select('*').single());
    }
    if (error) throw error;
    res.status(201).json({ character: await signedCharacter(data, req.supabase) });
  } catch (error) { res.status(error.status || 400).json({ error: error.message || 'Gagal menyimpan karakter.' }); }
});
app.put('/api/characters/:id', requireUser, requireAdmin, characterUpload, async (req, res) => {
  try {
    const { data: userData, error: userError } = await req.supabase.auth.getUser(req.accessToken);
    if (userError || !userData.user) return res.status(401).json({ error: 'Sesi login tidak valid.' });
    const userId = userData.user.id; const payload = parseCharacter(req);
    if (payload.is_master) { const { error } = await req.supabase.from('characters').update({ is_master: false }).eq('user_id', userId).eq('is_master', true).neq('id', req.params.id); if (error) throw error; }
    if (formFile(req, 'referenceImage')) payload.reference_image_path = await saveFormFile(req, userId, req.params.id, 'referenceImage', '');
    if (formFile(req, 'boardImage')) payload.board_path = await saveFormFile(req, userId, req.params.id, 'boardImage', 'board');
    if (formFile(req, 'voiceSample')) payload.voice_path = await saveFormFile(req, userId, req.params.id, 'voiceSample', 'voice');
    let { data, error } = await req.supabase.from('characters').update(payload).eq('id', req.params.id).select('*').single();
    if (error && /(traits|bible|voice|board_path|voice_path)/i.test(String(error.message || ''))) {
      const minimal = { ...payload }; delete minimal.traits; delete minimal.bible; delete minimal.voice;
      delete minimal.board_path; delete minimal.voice_path;
      ({ data, error } = await req.supabase.from('characters').update(minimal).eq('id', req.params.id).select('*').single());
    }
    if (error) throw error;
    res.json({ character: await signedCharacter(data, req.supabase) });
  } catch (error) { res.status(error.status || 400).json({ error: error.message || 'Gagal memperbarui karakter.' }); }
});
app.delete('/api/characters/:id', requireUser, requireAdmin, async (req, res) => {
  const { data: current } = await req.supabase.from('characters').select('reference_image_path,board_path,voice_path').eq('id', req.params.id).maybeSingle();
  const { error } = await req.supabase.from('characters').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  const leftovers = [current?.reference_image_path, current?.board_path, current?.voice_path].filter(Boolean);
  if (leftovers.length) await req.supabase.storage.from(bucket).remove(leftovers);
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
    if (!['auto','gemini','groq','openrouter','custom'].includes(provider)) return res.status(400).json({ error: 'Pilihan provider tidak valid.' });
    const userId = req.user.id;
    let conversationId = requestedId;
    let createdNewConversation = false;
    if (conversationId) {
      if (!validUuid(conversationId)) return res.status(400).json({ error: 'ID percakapan tidak valid.' });
      const { data: existing, error } = await req.supabase.from('ai_conversations').select('id').eq('id', conversationId).eq('user_id', userId).maybeSingle();
      if (error || !existing) return res.status(404).json({ error: 'Percakapan tidak ditemukan atau bukan milik akun ini.' });
    } else {
      const title = message.trim().replace(/\s+/g, ' ').slice(0, 64) || 'Percakapan Sherly AI';
      const { data: created, error } = await req.supabase.from('ai_conversations').insert({ user_id: userId, title, provider: provider === 'auto' ? 'groq' : provider }).select('id').single();
      if (error) throw error;
      conversationId = created.id;
      createdNewConversation = true;
    }
    const storedUserContent = image ? `${message}\n[📷 gambar terlampir]` : message;
    const { error: saveUserError } = await req.supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'user', content: storedUserContent, provider });
    if (saveUserError) throw saveUserError;
    let chatProfile = null;
    try {
      const { data: pf } = await req.supabase.from('user_profiles').select('display_name,full_name,gender,role,company,bio').eq('user_id', userId).maybeSingle();
      if (pf) chatProfile = { name: pf.display_name || pf.full_name, gender: pf.gender || '', role: pf.role, company: pf.company, bio: pf.bio };
    } catch (_pfError) { /* tabel belum dimigrasi / error sesaat — lanjut tanpa profil */ }
    const { data: history, error: historyError } = await req.supabase.from('ai_messages').select('role,content').eq('conversation_id', conversationId).eq('user_id', userId).in('role', ['user','assistant']).order('created_at', { ascending: false }).limit(24);
    if (historyError) throw historyError;
    const fetched = (history || []).reverse().map(item => ({ role: item.role, content: item.content }));
    const messages = fetched.length ? fetched : [{ role: 'user', content: message }]; // fallback bila histori kosong (mis. sinkronisasi tertunda)
    const result = await chatWithAI({ provider, messages, temperature: 0.7, maxTokens: 1600, ...(image ? { image } : {}) }, await buildTrustedContext(req.user, safeTimezone(timezone), chatProfile, req.supabase, conversationId), { supabase: req.supabase, accessToken: req.accessToken });
    const notePattern = /<{0,2}CATATAN\s*:\s*([^>\n]{3,300})>{0,2}/gi;
    const reportPattern = /<{0,2}REPORT\s*:\s*([^>\n]{3,400})>{0,2}/gi;
    const foundNotes = [];
    const foundReports = [];
    const stripNotes = (t) => String(t || '').replace(notePattern, (_m, n) => { foundNotes.push(String(n)); return ''; }).replace(reportPattern, (_m, r) => { foundReports.push(String(r)); return ''; }).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const cleanBubbles = (Array.isArray(result.bubbles) && result.bubbles.length ? result.bubbles : [result.text]).map(stripNotes).filter(Boolean);
    const assistantContent = cleanBubbles.join('\n\n'); // disimpan sebagai teks; histori dipecah lagi per \n\n saat dirender
    const { error: saveAssistantError } = await req.supabase.from('ai_messages').insert({ conversation_id: conversationId, user_id: userId, role: 'assistant', content: assistantContent, provider: result.provider, model: result.model, token_usage: result.usage });
    if (saveAssistantError) throw saveAssistantError;
    await req.supabase.from('ai_conversations').update({ provider: result.provider }).eq('id', conversationId).eq('user_id', userId);
    if (foundNotes.length) await saveMemoryNotes(req.supabase, userId, foundNotes).catch(() => {});
    // D-194: memori bersama — laporan Sherly utk owner + catat kunjungan tamu/klien.
    if (foundReports.length) await saveSharedReports(req.supabase, req.user, chatProfile, foundReports).catch(() => {});
    if (createdNewConversation) await logSharedVisit(req.supabase, req.user, chatProfile, message).catch(() => {});
    res.json({ ok: true, conversation_id: conversationId, reply: assistantContent, bubbles: cleanBubbles.length ? cleanBubbles : [assistantContent], provider: result.provider, requested_provider: result.requestedProvider, fallback_used: result.fallbackUsed, key_source: result.keySource || null, key_name: result.keyName || null, model_switched: result.modelSwitched || null, model: result.model, usage: result.usage });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    let errorMsg = error.message || 'AI provider request failed.';
    // D-142: tamu/klien tanpa kunci pribadi -> arahkan ke menu Kunci AI Pribadi.
    if (status === 503 && (req.user?.app_metadata?.role || 'guest') !== 'admin') {
      errorMsg = 'Belum ada API key AI untuk akunmu. Buka halaman Pengaturan Saya, bagian "Kunci AI Pribadi", lalu simpan key milikmu (gemini / groq / openrouter / kustom) supaya bisa chat dengan Sherly.';
    }
    res.status(status).json({ ok: false, error: errorMsg, ...(error.details ? { details: error.details } : {}) });
  }
});

// D-203: katalog model gambar (provider + model + resolusi + rasio) untuk UI.
app.get('/api/ai/image/models', requireUser, requireAdmin, (req, res) => {
  try { res.json({ ok: true, ...imageCatalog() }); }
  catch (error) { res.status(500).json({ ok: false, error: error.message || 'Gagal memuat katalog model gambar.' }); }
});

app.post('/api/ai/image', requireUser, requireAdmin, async (req, res) => {
  try {
    const { prompt: rawPrompt, provider: rawProvider, aspect: rawAspect, reference: rawReference, referenceCharacterId: rawRefCharId,
      sceneRef: rawSceneRef, sceneNumber: rawSceneNumber, sceneTotal: rawSceneTotal,
      model: rawModel, resolution: rawResolution } = req.body || {};
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
    if (!prompt || prompt.length < 3 || prompt.length > 1500) return res.status(400).json({ error: 'Deskripsi gambar wajib diisi (3-1500 karakter).' });
    const customId = typeof rawProvider === 'string' && rawProvider.startsWith('custom:') ? rawProvider.slice(7) : null;
    const provider = customId ? 'custom' : (['auto', 'gemini', 'kie'].includes(rawProvider) ? rawProvider : 'auto');
    const aspect = typeof rawAspect === 'string' && /^\d{1,2}:\d{1,2}$/.test(rawAspect) ? rawAspect : '1:1';
    const auth = { supabase: req.supabase, accessToken: req.accessToken };

    // ===== D-196: multi-karakter (@mention) + referensi gambar adegan =====
    // 1) Muat karakter milik user (id, nama, identity, voice, potret, sheet).
    const { data: ownedChars, error: charsErr } = await req.supabase
      .from('characters').select('id,name,identity_prompt,voice,reference_image_path,board_path')
      .eq('user_id', req.user.id);
    if (charsErr) return res.status(400).json({ ok: false, error: charsErr.message });
    const allCharacters = Array.isArray(ownedChars) ? ownedChars : [];
    // 2) Parse "@nama" di prompt -> maksimal 3 karakter.
    const mentions = parseMentions(prompt, allCharacters);
    // 3) Resolve gambar referensi karakter (potret + master sheet) dari Storage.
    const { images: charImages, labels: charLabels, imageIndex } = await resolveCharacterReferences(req.supabase, bucket, allCharacters, mentions);
    // 4) Referensi gambar adegan (frame akhir adegan sebelumnya / referensi lokasi) — dikirim client.
    const sceneImage = sanitizeInlineImage(rawSceneRef);
    const references = sceneImage ? [...charImages, sceneImage] : charImages;
    // 5) Susun prompt final: karakter + voice + continuity + label aset.
    const sceneNo = Number.isInteger(rawSceneNumber) && rawSceneNumber > 0 ? rawSceneNumber : 0;
    const sceneTot = Number.isInteger(rawSceneTotal) && rawSceneTotal > 0 ? rawSceneTotal : 0;
    const promptBlocks = [];
    if (sceneNo > 0 && sceneTot > 0) promptBlocks.push(`[Adegan ${sceneNo} dari ${sceneTot}]`);
    promptBlocks.push(prompt);
    const charBlock = buildCharacterPromptBlock(mentions, allCharacters, imageIndex);
    if (charBlock) promptBlocks.push(charBlock);
    if (sceneImage) {
      promptBlocks.push('## Referensi gambar adegan\nGambar terakhir adegan sebelumnya (referensi continuity): pertahankan lokasi, pencahayaan, wardrobe, warna, dan wajah yang konsisten. Lanjutkan adegan dari gambar ini secara natural.');
    }
    const multiPrompt = promptBlocks.join('\n\n');

    // D-98: foto referensi (karakter) untuk img2img — di-resolve jadi { mime, data }.
    let reference = null;
    if (rawReference && typeof rawReference.data === 'string' && rawReference.data.length > 8) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(rawReference.mime)) return res.status(400).json({ ok: false, error: 'Format foto referensi harus JPG, PNG, atau WebP.' });
      if (rawReference.data.length > 3_500_000) return res.status(400).json({ ok: false, error: 'Foto referensi terlalu besar (maks ±2.5 MB setelah dikompres).' });
      reference = { mime: rawReference.mime, data: rawReference.data };
    } else if (typeof rawRefCharId === 'string' && validUuid(rawRefCharId)) {
      const { data: ch } = await req.supabase.from('characters').select('user_id,reference_image_path').eq('id', rawRefCharId).maybeSingle();
      if (!ch || ch.user_id !== req.user.id) return res.status(404).json({ ok: false, error: 'Karakter tidak ditemukan.' });
      if (ch.reference_image_path) {
        const { data: blob, error: dlErr } = await req.supabase.storage.from(bucket).download(ch.reference_image_path);
        if (dlErr || !blob) return res.status(400).json({ ok: false, error: 'Gagal membaca foto referensi karakter: ' + (dlErr?.message || 'file tidak ditemukan.') });
        const buf = Buffer.from(await blob.arrayBuffer());
        const mime = /\.jpe?g$/i.test(ch.reference_image_path) ? 'image/jpeg' : /\.webp$/i.test(ch.reference_image_path) ? 'image/webp' : 'image/png';
        reference = { mime, data: buf.toString('base64') };
      }
    }
    // D-203: model gambar terpilih (Kie: Nano Banana / GPT Image / Seedream / FLUX).
    // Kalau mesin bukan Kie atau model tidak dikenal -> pakai default Kie.
    const wantsKie = provider === 'kie' || provider === 'auto';
    let imageSpec = null;
    if (wantsKie) {
      const spec = normalizeImageParams({ model: rawModel, resolution: rawResolution, aspect });
      if (!spec.ok) return res.status(400).json({ ok: false, error: spec.error });
      imageSpec = spec;
    }
    let image, usedProvider = 'gemini', fallbackUsed = false;
    if (references.length) {
      // D-239: Kie (Nano Banana 2/Pro, GPT Image 2, Seedream 5.0, FLUX 2 Pro) sudah
      // mendukung multi-referensi -> pakai mesin yang user pilih, bukan dipaksa Gemini.
      // Kalau Kie gagal -> fallback ke Gemini (konsistensi karakter tetap terjaga).
      if (wantsKie && !customId) {
        try {
          image = await generateImageWithKie(multiPrompt, aspect, auth, {
            model: imageSpec.model.id, resolution: imageSpec.resolution, references,
          });
          usedProvider = 'kie';
        } catch (kieErr) {
          image = await generateImageWithGemini(multiPrompt, auth, { aspect, references });
          usedProvider = 'gemini';
          fallbackUsed = true;
        }
      } else {
        // Gemini / provider custom: multi-referensi hanya didukung Gemini.
        if (provider !== 'gemini') fallbackUsed = true;
        image = await generateImageWithGemini(multiPrompt, auth, { aspect, references }); usedProvider = 'gemini';
      }
    }
    else if (reference) {
      // D-98: img2img dengan foto referensi — D-239: Kie juga mendukung (1 referensi).
      if (wantsKie && !customId) {
        try {
          image = await generateImageWithKie(prompt, aspect, auth, {
            model: imageSpec.model.id, resolution: imageSpec.resolution, reference,
          });
          usedProvider = 'kie';
        } catch (kieErr) {
          image = await generateImageWithGemini(prompt, auth, { aspect, reference });
          usedProvider = 'gemini';
          fallbackUsed = true;
        }
      } else {
        // D-98: img2img hanya didukung Gemini — mesin lain dialihkan otomatis.
        if (provider !== 'gemini') fallbackUsed = true;
        image = await generateImageWithGemini(prompt, auth, { aspect, reference }); usedProvider = 'gemini';
      }
    }
    else if (customId) {
      const customs = await listCustomProviders(req.supabase, req.user.id, true);
      const cp = customs.find((c) => c.id === customId);
      if (!cp) return res.status(404).json({ ok: false, error: 'Provider kustom tidak ditemukan.' });
      image = await generateImageWithCustom(cp, prompt, aspect); usedProvider = cp.name;
    }
    else if (provider === 'kie') {
      image = await generateImageWithKie(prompt, aspect, auth, { model: imageSpec.model.id, resolution: imageSpec.resolution });
      usedProvider = 'kie';
    }
    else if (provider === 'gemini') { image = await generateImageWithGemini(prompt, auth, { aspect }); usedProvider = 'gemini'; }
    else {
      // Otomatis: Kie dulu (mesin produksi) -> provider kustom -> Gemini.
      try {
        image = await generateImageWithKie(prompt, aspect, auth, { model: imageSpec.model.id, resolution: imageSpec.resolution });
        usedProvider = 'kie';
      }
      catch {
        let done = false;
        try {
          const customs = await listCustomProviders(req.supabase, req.user.id, true);
          for (const cp of customs) {
            try { image = await generateImageWithCustom(cp, prompt, aspect); usedProvider = cp.name; done = true; break; } catch {}
          }
        } catch {}
        if (!done) { image = await generateImageWithGemini(prompt, auth, { aspect }); usedProvider = 'gemini'; fallbackUsed = true; }
      }
    }
    res.json({
      ok: true, provider: usedProvider, fallback_used: fallbackUsed, image,
      model: imageSpec ? imageSpec.model.id : (image?.model || null),
      model_label: imageSpec ? imageSpec.model.label : null,
      resolution: imageSpec ? imageSpec.resolution : null,
      // D-196: info penanda aset untuk UI (header aset di komposer).
      characters: mentions.map((m) => ({ name: m.name, token: m.token })),
      assets: charLabels.map((l) => ({ name: l.name, kind: l.kind })),
      scene_reference: !!sceneImage,
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    res.status(status).json({ ok: false, error: error.message || 'Generator gambar gagal.' });
  }
});

// ===== D-198: Galeri Aset Studio =====
// Middleware khusus aset: foto + video, sampai 25 MB (upload umum hanya gambar 8 MB).
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ASSET_BYTES },
  fileFilter: (_req, file, cb) => cb(null, ASSET_MIME.includes(String(file.mimetype || '').toLowerCase())),
}).single('file');

app.get('/api/studio/assets', requireUser, requireAdmin, async (req, res) => {
  try {
    const assets = await listAssets(req.supabase, req.user.id);
    res.json({ assets });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal memuat aset.' });
  }
});

app.post('/api/studio/assets', requireUser, requireAdmin, assetUpload, async (req, res) => {
  try {
    // D-198: dua jalur — multipart (unggahan user) & JSON base64 (hasil generate).
    if (req.body && typeof req.body.data === 'string' && req.body.data.length > 8) {
      const mime = String(req.body.mime || '').toLowerCase();
      if (!ASSET_MIME.includes(mime)) return res.status(400).json({ ok: false, error: 'Format aset harus JPG, PNG, WebP, GIF, MP4, WebM, atau MOV.' });
      const asset = await saveGeneratedAsset(req.supabase, req.user.id, {
        data: req.body.data, mime,
        prompt: String(req.body.prompt || ''),
        meta: req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : {},
        width: Number(req.body.width) || undefined,
        height: Number(req.body.height) || undefined,
        durationMs: Number(req.body.durationMs) || undefined,
      });
      return res.status(201).json({ asset: await signedAsset(asset, req.supabase) });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: 'File aset wajib diunggah.' });
    if (file.size > MAX_ASSET_BYTES) return res.status(400).json({ ok: false, error: 'Ukuran aset melebihi 25 MB.' });
    if (!ASSET_MIME.includes(String(file.mimetype || '').toLowerCase())) {
      return res.status(400).json({ ok: false, error: 'Format aset harus JPG, PNG, WebP, GIF, MP4, WebM, atau MOV.' });
    }
    const asset = await saveAsset(req.supabase, req.user.id, file, { kind: 'upload' });
    res.status(201).json({ asset: await signedAsset(asset, req.supabase) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal mengunggah aset.' });
  }
});

app.delete('/api/studio/assets/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const result = await deleteAsset(req.supabase, req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal menghapus aset.' });
  }
});

// ===== D-207: Bank Prompt (template utuh + blok modular) =====
//
// Dua jenis entri:
//   kind 'template' -> satu prompt lengkap siap pakai (mis. "Try Outfit", "Drone View")
//   kind 'block'    -> satu blok susunan prompt (kamera/cahaya/gaya/...) yang ditumpuk user.
//
// Semua entri milik user yang login (owner-only, RLS di DB).

app.get('/api/prompt-bank', requireUser, requireAdmin, async (req, res) => {
  try {
    // Seed otomatis saat bank user masih kosong.
    await seedPromptBank(req.supabase, req.user.id);
    // D-208: ?mode=foto|video -> hanya prompt untuk jenis konten itu.
    const mode = String(req.query.mode || '').trim().toLowerCase();
    const entries = await listPromptEntries(req.supabase, req.user.id, { mode: mode || undefined });
    res.json({
      ok: true, entries,
      kinds: PROMPT_KINDS, categories: PROMPT_CATEGORIES,
      modes: PROMPT_MODES, groups: PROMPT_GROUPS,
    });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal memuat bank prompt.' });
  }
});

// D-208: optimalkan susunan prompt (kategorikan + susun ulang sesuai alur fokus).
app.post('/api/prompt-bank/optimize', requireUser, requireAdmin, async (req, res) => {
  try {
    const raw = String(req.body?.prompt ?? '');
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
    if (!raw.trim() && !blocks.length) {
      return res.status(400).json({ ok: false, error: 'Prompt kosong — tidak ada yang bisa dioptimalkan.' });
    }
    const result = optimizePrompt(raw, blocks);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal mengoptimalkan prompt.' });
  }
});

app.post('/api/prompt-bank', requireUser, requireAdmin, async (req, res) => {
  try {
    const entry = await createPromptEntry(req.supabase, req.user.id, req.body || {});
    res.status(201).json({ ok: true, entry });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal menyimpan entri prompt.' });
  }
});

app.put('/api/prompt-bank/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const entry = await updatePromptEntry(req.supabase, req.user.id, req.params.id, req.body || {});
    res.json({ ok: true, entry });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal memperbarui entri prompt.' });
  }
});

app.delete('/api/prompt-bank/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const result = await deletePromptEntry(req.supabase, req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal menghapus entri prompt.' });
  }
});

// ===== D-198/D-200: Engine video (Kie, katalog model) =====
// Pembuatan task & pengecekan status dipisah: maxDuration server 60 dtk < durasi generate video.

// D-200: katalog model video (provider + model + durasi) untuk UI.
app.get('/api/ai/video/models', requireUser, requireAdmin, (req, res) => {
  try { res.json({ ok: true, ...videoCatalog() }); }
  catch (error) { res.status(500).json({ ok: false, error: error.message || 'Gagal memuat katalog model.' }); }
});

app.post('/api/ai/video', requireUser, requireAdmin, async (req, res) => {
  try {
    const {
      prompt: rawPrompt, tier: rawTier, aspect: rawAspect, duration: rawDuration,
      resolution: rawResolution, sceneRef: rawSceneRef, model: rawModel, audio: rawAudio,
    } = req.body || {};
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
    if (!prompt || prompt.length < 3 || prompt.length > 1500) return res.status(400).json({ ok: false, error: 'Deskripsi video wajib diisi (3-1500 karakter).' });
    // Validasi parameter terhadap model terpilih (durasi/resolusi/aspek harus sesuaiCapabilities).
    const spec = normalizeVideoParams({
      model: rawModel, tier: rawTier, duration: rawDuration,
      resolution: rawResolution, aspect: rawAspect, audio: rawAudio,
    });
    if (!spec.ok) return res.status(400).json({ ok: false, error: spec.error });
    const { model: videoModel, tier, aspect, duration, resolution, audio } = spec;

    // Karakter yang disebut ("@nama") -> potret + master sheet + profil suara.
    const { data: ownedChars, error: charsErr } = await req.supabase
      .from('characters').select('id,name,identity_prompt,voice,reference_image_path,board_path')
      .eq('user_id', req.user.id);
    if (charsErr) return res.status(400).json({ ok: false, error: charsErr.message });
    const allCharacters = Array.isArray(ownedChars) ? ownedChars : [];
    const mentions = parseMentions(prompt, allCharacters);
    const { images: charImages, imageIndex } = await resolveCharacterReferences(req.supabase, bucket, allCharacters, mentions);
    const sceneImage = sanitizeInlineImage(rawSceneRef);

    // D-239: untuk VIDEO, frame adegan dikirim sebagai gambar PERTAMA di request,
    // jadi nomor gambar karakter harus digeser +1 (lihat imageIndex video).
    // Tanpa ini, prompt bilang "Gambar 1: potret Sherly" padahal gambar ke-1
    // di request adalah frame adegan -> model salah memetakan referensi.
    const videoImageIndex = shiftImageIndex(imageIndex, sceneImage ? 1 : 0);

    // Prompt final: deskripsi + blok karakter (identitas & suara) + continuity adegan.
    const promptBlocks = [prompt];
    const charBlock = buildCharacterPromptBlock(mentions, allCharacters, videoImageIndex);
    if (charBlock) promptBlocks.push(charBlock);
    if (sceneImage) {
      promptBlocks.push('## Referensi gambar adegan\nGambar 1: frame terakhir adegan sebelumnya (referensi continuity). Pertahankan lokasi, pencahayaan, wardrobe, warna, dan wajah yang konsisten. Jadikan gambar ini frame pertama adegan.');
    }
    promptBlocks.push('Gaya video: sinematik, gerakan kamera halus dan natural, pencahayaan konsisten.');
    const finalPrompt = promptBlocks.join('\n\n');

    // Maksimal 3 gambar: 1 frame adegan (frame pertama) + 2 potret karakter.
    const images = sceneImage ? [sceneImage, ...charImages].slice(0, 3) : charImages.slice(0, 3);

    const auth = { supabase: req.supabase, accessToken: req.accessToken };
    const created = await generateVideoWithKie(finalPrompt, auth, {
      model: videoModel.id, tier, aspect, duration, resolution, audio, images,
    });
    const task = await createVideoTask(req.supabase, req.user.id, {
      provider: created.provider, model: created.model, taskId: created.taskId, prompt,
      meta: { aspect, duration, resolution, tier, audio, modelLabel: videoModel.label },
    });
    res.status(202).json({
      ok: true, id: task.id, task_id: created.taskId, model: created.model,
      tier, aspect, duration, resolution, audio,
      characters: mentions.map((m) => ({ name: m.name, token: m.token })),
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    res.status(status).json({ ok: false, error: error.message || 'Generator video gagal.' });
  }
});

app.get('/api/ai/video/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const task = await getVideoTask(req.supabase, req.user.id, req.params.id);
    if (!task) return res.status(404).json({ ok: false, error: 'Task video tidak ditemukan.' });
    // Sukses: pastikan aset video tersimpan & kembalikan URL-nya.
    if (task.status === 'success' && task.asset_id) {
      const asset = await getAsset(req.supabase, req.user.id, task.asset_id);
      const signed = await signedAsset(asset, req.supabase);
      return res.json({ ok: true, status: 'success', progress: 100, asset: signed });
    }
    if (task.status === 'fail') {
      return res.json({ ok: true, status: 'fail', progress: task.progress, error: task.error || 'Generator video gagal.' });
    }
    // Masih jalan: tanya Kie soal progres.
    if (!task.task_id) return res.json({ ok: true, status: task.status, progress: task.progress });
    const auth = { supabase: req.supabase, accessToken: req.accessToken };
    const info = await pollKieVideoTask(auth, task.task_id);
    const state = String(info.state || '').toLowerCase();
    const progress = Math.max(Number(info.progress) || 0, task.progress || 0);
    if ((state === 'success' || state === 'completed') && info.resultUrls.length) {
      // Unduh video -> simpan sebagai aset -> tautkan ke task.
      const videoRes = await fetch(info.resultUrls[0], { signal: AbortSignal.timeout(120000) });
      if (!videoRes.ok) throw new Error('Gagal mengunduh hasil video (' + videoRes.status + ').');
      const buffer = Buffer.from(await videoRes.arrayBuffer());
      const mime = (videoRes.headers.get('content-type') || 'video/mp4').split(';')[0];
      const taskMeta = task.meta && typeof task.meta === 'object' ? task.meta : {};
      const durationSec = Number(taskMeta.duration) || 8;
      const asset = await saveAsset(req.supabase, req.user.id, {
        buffer, mimetype: ASSET_MIME.includes(mime) ? mime : 'video/mp4',
        originalname: 'studio-video-' + Date.now() + '.mp4',
      }, {
        kind: 'generate', prompt: task.prompt,
        meta: { model: task.model, aspect: taskMeta.aspect || '16:9', duration_ms: durationSec * 1000 },
        durationMs: durationSec * 1000,
      });
      await updateVideoTask(req.supabase, req.user.id, task.id, { status: 'success', progress: 100, asset_id: asset.id });
      const signed = await signedAsset(asset, req.supabase);
      return res.json({ ok: true, status: 'success', progress: 100, asset: signed });
    }
    if (state === 'fail' || state === 'failed' || state === 'error') {
      const message = info.error || 'Generator video gagal.';
      await updateVideoTask(req.supabase, req.user.id, task.id, { status: 'fail', progress, error: String(message).slice(0, 300) });
      return res.json({ ok: true, status: 'fail', progress, error: String(message).slice(0, 300) });
    }
    await updateVideoTask(req.supabase, req.user.id, task.id, { status: 'running', progress });
    return res.json({ ok: true, status: 'running', progress });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    res.status(status).json({ ok: false, error: error.message || 'Gagal mengecek status video.' });
  }
});

app.get('/api/ai/video', requireUser, requireAdmin, async (req, res) => {
  try {
    const tasks = await listVideoTasks(req.supabase, req.user.id, 10);
    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Gagal memuat task video.' });
  }
});

app.post('/api/ai/vision', requireUser, requireAdmin, async (req, res) => {
  try {
    const { image, provider: rawProvider } = req.body || {};
    if (!image || typeof image.data !== 'string' || image.data.length < 8) return res.status(400).json({ ok: false, error: 'Foto wajah wajib dikirim.' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mime)) return res.status(400).json({ ok: false, error: 'Format foto harus JPG, PNG, atau WebP.' });
    if (image.data.length > 3_500_000) return res.status(400).json({ ok: false, error: 'Foto terlalu besar — biarkan aplikasi mengompresnya (maks 1280px).' });
    // D-103: pengguna bisa memilih mesin analisis (default auto: gemini -> openrouter -> groq).
    const provider = ['auto', 'gemini', 'openrouter', 'groq'].includes(rawProvider) ? rawProvider : 'auto';
    const result = await chatWithAI(
      { provider, messages: [{ role: 'user', content: visionTraitsPrompt() }], temperature: 0.2, maxTokens: 1600, image: { mime: image.mime, data: image.data } },
      '', { supabase: req.supabase, accessToken: req.accessToken, systemPrompt: VISION_SYSTEM_PROMPT },
    );
    res.json({ ok: true, traits: parseVisionTraits(result.text), provider: result.provider });
  } catch (error) {
    res.status(Number.isInteger(error.status) ? error.status : 502).json({ ok: false, error: error.message || 'Analisis foto gagal.' });
  }
});

// D-99: generate Master Board (sheet referensi 3 panel).
// Terima: { prompt } (master prompt) + reference inline {mime,data} untuk karakter baru,
// atau { characterId | referenceCharacterId } untuk memakai data karakter tersimpan.
app.post('/api/ai/character-board', requireUser, requireAdmin, async (req, res) => {
  try {
    const { prompt: rawPrompt, provider: rawProvider, characterId, referenceCharacterId, reference: rawReference } = req.body || {};
    let identity = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
    let reference = null;
    const refId = validUuid(characterId) ? characterId : (validUuid(referenceCharacterId) ? referenceCharacterId : null);
    if (refId) {
      const { data: ch } = await req.supabase.from('characters').select('user_id,identity_prompt,reference_image_path').eq('id', refId).maybeSingle();
      if (!ch || ch.user_id !== req.user.id) return res.status(404).json({ ok: false, error: 'Karakter tidak ditemukan.' });
      if (!identity) identity = String(ch.identity_prompt || '');
      if (ch.reference_image_path) {
        const { data: blob, error: dlErr } = await req.supabase.storage.from(bucket).download(ch.reference_image_path);
        if (!dlErr && blob) {
          const buf = Buffer.from(await blob.arrayBuffer());
          const mime = /\.jpe?g$/i.test(ch.reference_image_path) ? 'image/jpeg' : /\.webp$/i.test(ch.reference_image_path) ? 'image/webp' : 'image/png';
          reference = { mime, data: buf.toString('base64') };
        }
      }
    } else if (rawReference && typeof rawReference.data === 'string' && rawReference.data.length > 8) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(rawReference.mime)) return res.status(400).json({ ok: false, error: 'Format foto referensi harus JPG, PNG, atau WebP.' });
      if (rawReference.data.length > 3_500_000) return res.status(400).json({ ok: false, error: 'Foto referensi terlalu besar (maks ±2.5 MB setelah dikompres).' });
      reference = { mime: rawReference.mime, data: rawReference.data };
    }
    // D-103: pilih mesin — Gemini img2img (default, pakai foto referensi) atau Kie/kustom (txt2img, tanpa foto).
    const customId = typeof rawProvider === 'string' && rawProvider.startsWith('custom:') ? rawProvider.slice(7) : null;
    const provider = customId ? 'custom' : (['kie', 'gemini'].includes(rawProvider) ? rawProvider : 'gemini');
    // Prompt dari wizard D-103+ sudah berupa sheet prompt lengkap — pakai apa adanya (resolveBoardPrompt).
    const finalPrompt = resolveBoardPrompt(identity);
    const auth = { supabase: req.supabase, accessToken: req.accessToken };
    let image, usedProvider = 'gemini', mode = 'img2img';
    if (provider === 'gemini') {
      // D-104: sheet engine AK Talent — landscape 16:9.
      image = await generateImageWithGemini(finalPrompt, auth, { aspect: '16:9', reference });
    } else if (provider === 'kie') {
      // D-106: Kie juga mendukung img2img (alur AK Talent) — board pakai model gpt-image-2-5-flare-image-to-image.
      if (reference) image = await generateImageWithKie(finalPrompt, '16:9', auth, { reference, model: KIE_BOARD_MODEL });
      else { mode = 'txt2img'; image = await generateImageWithKie(finalPrompt.slice(0, 1500), '16:9', auth); }
      usedProvider = 'kie';
    } else {
      mode = 'txt2img';
      const customs = await listCustomProviders(req.supabase, req.user.id, true);
      const cp = customs.find((c) => c.id === customId);
      if (!cp) return res.status(404).json({ ok: false, error: 'Provider kustom tidak ditemukan.' });
      image = await generateImageWithCustom(cp, finalPrompt.slice(0, 1500), '16:9');
      usedProvider = cp.name;
    }
    res.json({ ok: true, provider: usedProvider, mode, image });
  } catch (error) {
    res.status(Number.isInteger(error.status) ? error.status : 502).json({ ok: false, error: error.message || 'Generator master board gagal.' });
  }
});

// D-99: susun Character Bible dari data wizard (profil + traits + suara terkunci).
app.post('/api/ai/character-bible', requireUser, requireAdmin, async (req, res) => {
  try {
    // D-103: pengguna bisa memilih mesin penyusun bible (default auto).
    const rawProvider = (req.body || {}).provider;
    const provider = ['auto', 'gemini', 'openrouter', 'groq'].includes(rawProvider) ? rawProvider : 'auto';
    const result = await chatWithAI(
      { provider, messages: [{ role: 'user', content: biblePrompt((req.body || {}).data || {}) }], temperature: 0.6, maxTokens: 2400 },
      '', { supabase: req.supabase, accessToken: req.accessToken, systemPrompt: BIBLE_SYSTEM_PROMPT },
    );
    const bible = String(result.text || '').trim().slice(0, 8000);
    if (!bible) return res.status(502).json({ ok: false, error: 'AI tidak mengembalikan bible — coba lagi.' });
    res.json({ ok: true, bible, provider: result.provider });
  } catch (error) {
    res.status(Number.isInteger(error.status) ? error.status : 502).json({ ok: false, error: error.message || 'Penyusun bible gagal.' });
  }
});

// D-98: simpan hasil Master Board ke Storage + kolom characters.board_path.
app.post('/api/characters/:id/board', requireUser, requireAdmin, async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image || typeof image.data !== 'string' || image.data.length < 8) return res.status(400).json({ error: 'Gambar master board wajib dikirim.' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mime)) return res.status(400).json({ error: 'Format gambar harus JPG, PNG, atau WebP.' });
    if (image.data.length > 4_000_000) return res.status(400).json({ error: 'Gambar master board terlalu besar.' });
    const { data: ch } = await req.supabase.from('characters').select('user_id,board_path').eq('id', req.params.id).maybeSingle();
    if (!ch || ch.user_id !== req.user.id) return res.status(404).json({ error: 'Karakter tidak ditemukan.' });
    const ext = image.mime === 'image/jpeg' ? 'jpg' : image.mime.split('/')[1];
    const objectPath = `${req.user.id}/${req.params.id}/board-${Date.now()}.${ext}`;
    const { error: upErr } = await req.supabase.storage.from(bucket).upload(objectPath, Buffer.from(image.data, 'base64'), { contentType: image.mime, upsert: false });
    if (upErr) {
      const mimeHint = storageUploadHint(upErr); // D-107: bucket membatasi tipe file
      throw Object.assign(new Error(mimeHint || upErr.message), { status: mimeHint ? 503 : 400 });
    }
    const { error: dbErr } = await req.supabase.from('characters').update({ board_path: objectPath }).eq('id', req.params.id);
    if (dbErr) {
      const hint = /board_path/i.test(String(dbErr.message || '')) ? ' Jalankan docs/supabase-character-wizard.sql dulu (kolom board_path belum ada).' : '';
      throw Object.assign(new Error((dbErr.message || 'Gagal menyimpan master board.') + hint), { status: 400 });
    }
    if (ch.board_path && ch.board_path !== objectPath) await req.supabase.storage.from(bucket).remove([ch.board_path]);
    const { data } = await req.supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
    res.json({ ok: true, board_image_url: data?.signedUrl || null });
  } catch (error) { res.status(error.status || 400).json({ error: error.message || 'Gagal menyimpan master board.' }); }
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

// ==== Kunci AI pribadi (BYOK) — tamu & klien. Baris vault di-scope RLS ke akun sendiri. ====
const requireMemberOnly = (req, res, next) => {
  if ((req.user?.app_metadata?.role || 'guest') === 'admin') return res.status(403).json({ error: 'Admin memakai Pengaturan utama (Provider & API Key) untuk mengelola kunci.' });
  next();
};
app.get('/api/my/keys', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  return { groups: await listKeyGroups(req.supabase) };
}));
app.post('/api/my/keys', requireUser, requireChatUser, requireMemberOnly, requireVault, wrapKeyRoute(async (req) => {
  const { provider, api_key, base_url, model, label } = req.body || {};
  return { key: await savePersonalKey(req.supabase, { provider, api_key, base_url, model, label, user_id: req.user.id }) };
}));
// D-147 (ala aira/HeyTalent): test / edit / ganti key / set default / hapus grup.
app.post('/api/my/keys/:id/test', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  return await testKey(req.supabase, req.params.id);
}));
app.put('/api/my/keys/:id', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  const { label, is_active } = req.body || {};
  return { key: await updateKey(req.supabase, req.params.id, { key_name: label, is_active }) };
}));
app.put('/api/my/keys/:id/rotate', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  const { api_key } = req.body || {};
  return await rotateKey(req.supabase, req.params.id, api_key);
}));
app.put('/api/my/keys/:id/default', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  return { key: await setDefaultPersonalKey(req.supabase, req.params.id) };
}));
app.delete('/api/my/keys/group', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  const { provider, key_name } = req.body || {};
  await deleteGroup(req.supabase, { provider, key_name });
  return { ok: true };
}));
app.delete('/api/my/keys/:id', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  await deletePersonalKey(req.supabase, req.params.id);
  return { ok: true };
}));
// D-144: deteksi model yang tersedia untuk API key yang ditempel user (belum tersimpan).
app.post('/api/my/models', requireUser, requireChatUser, requireMemberOnly, wrapKeyRoute(async (req) => {
  const { provider, api_key, base_url } = req.body || {};
  if (!PERSONAL_PROVIDERS.includes(provider)) throw Object.assign(new Error('Provider harus gemini, groq, openrouter, atau custom.'), { status: 400 });
  const key = String(api_key || '').trim();
  if (!key || key.length < 20 || key.length > 400) throw Object.assign(new Error('Tempel API key yang valid dulu (20-400 karakter).'), { status: 400 });
  let baseUrl;
  if (provider === 'custom') {
    baseUrl = String(base_url || '').trim().replace(/\/+$/, '');
    if (!baseUrl) throw Object.assign(new Error('Base URL kustom wajib diisi dulu.'), { status: 400 });
    assertSafeBaseUrl(baseUrl);
  }
  const models = await fetchProviderModels(provider, key, baseUrl);
  return { models: models.slice(0, 400) };
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
const PROFILE_FIELDS = ['full_name','display_name','gender','account_type','role','company','bio','email','phone','location','website','primary_contact','photo','photo_position'];
const PROFILE_CAPS = { full_name:120, display_name:80, gender:10, account_type:40, role:120, company:120, bio:600, email:120, phone:40, location:120, website:160, primary_contact:40, photo:400000, photo_position:20 };
function sanitizeProfile(body) {
  const out = {};
  for (const field of PROFILE_FIELDS) {
    let v = body?.[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') throw Object.assign(new Error(`Field ${field} tidak valid.`), { status: 400 });
    out[field] = v.slice(0, PROFILE_CAPS[field]);
  }
  if (out.gender && !['pria', 'wanita'].includes(out.gender)) throw Object.assign(new Error('Jenis kelamin harus pria atau wanita.'), { status: 400 });
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
const PUBLIC_SETTING_KEYS = ['whatsapp', 'instagram'];
app.get('/api/public/settings', async (_req, res) => {
  try {
    if (!supabaseConfigured) return res.json({ settings: {} });

    const { data } = await createPublicClient().from('app_settings').select('key,value').in('key', PUBLIC_SETTING_KEYS);
    const out = {};
    (data || []).forEach((r) => { if (r && r.key) out[r.key] = r.value || ''; });
    res.json({ settings: out });
  } catch { res.json({ settings: {} }); }
});

app.get('/api/public/characters', async (req, res) => {
  try {
    if (!supabaseConfigured) return res.json({ characters: [] });
    const anon = createPublicClient();
    let rows = [];
    let signer = anon;
    // Jalur utama: view publik (kolom aman saja, karakter aktif) - tersedia setelah supabase/public_characters.sql.
    const view = await anon.from('characters_public_view')
      .select('id,name,role,origin,niche,is_master,reference_image_path')
      .order('is_master', { ascending: false })
      .order('name', { ascending: true });
    if (!view.error) {
      rows = view.data || [];
    } else {
      // Fallback sebelum migration dijalankan: pemanggil yang login (mis. admin)
      // melihat karakter miliknya sendiri lewat RLS owner - supaya panel tidak kosong.
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (token) {
        try {
          const userClient = createUserClient(token);
          const mine = await userClient.from('characters')
            .select('id,name,role,origin,niche,is_master,reference_image_path')
            .eq('status', 'active')
            .order('is_master', { ascending: false })
            .order('name', { ascending: true });
          if (!mine.error) { rows = mine.data || []; signer = userClient; }
        } catch {}
      }
    }
    const characters = await Promise.all(rows.map(async (c) => {
      let reference_image_url = null;
      if (c.reference_image_path) {
        try { const { data: signed } = await signer.storage.from(bucket).createSignedUrl(c.reference_image_path, 3600); reference_image_url = signed?.signedUrl || null; } catch {}
      }
      return { id: c.id, name: c.name, role: c.role || 'Virtual Influencer', origin: c.origin || '', niche: Array.isArray(c.niche) ? c.niche : [], is_master: Boolean(c.is_master), reference_image_url };
    }));
    res.json({ characters });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/api/admin/settings', requireUser, requireAdmin, async (req, res) => {
  try {
    const raw = (req.body || {}).whatsapp;
    let num = typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
    if (num.startsWith('0')) num = '62' + num.slice(1); // 08xx -> 628xx (format internasional wa.me)
    if (raw !== undefined && raw !== null && String(raw).trim() !== '' && num.length < 8) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid — gunakan format internasional tanpa + (mis. 62812xxxxxxx).' });
    const { error } = await req.supabase.from('app_settings').upsert({ key: 'whatsapp', value: num || null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: 'Gagal menyimpan setelan studio. Pastikan tabel app_settings sudah dibuat (docs/supabase-studio-settings.sql).' });
    res.json({ ok: true, whatsapp: num });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==== D-194: Persona editable (owner) + memori bersama lintas peran ====
const PERSONA_OVERRIDE_KEY = 'persona_overrides_v1';
function sanitizePersonaOverrides(body) {
  const src = body && typeof body === 'object' ? body : {};
  const str = (v, n) => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim().slice(0, n) : '');
  const para = (v, n) => (typeof v === 'string' ? v.replace(/[\r\n]{3,}/g, '\n\n').trim().slice(0, n) : '');
  const list = (v, n) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => str(x, 60)).filter(Boolean).slice(0, n);
  const out = {};
  const ownerName = str(src.owner?.name, 80); if (ownerName) out.owner = { name: ownerName, note: str(src.owner?.note, 200) };
  const map = { tagline: [str, 300], role: [str, 160], location: [str, 120], audience: [para, 600], kolaborasi: [para, 600] };
  for (const [k, [fn, cap]] of Object.entries(map)) { const v = fn(src[k], cap); if (v) out[k] = v; }
  const bio = para(src.bio, 1200); if (bio) out.bio = bio;
  const traits = list(src.traits, 12); if (traits.length) out.traits = traits;
  const voice = {};
  for (const k of ['gaya', 'khas', 'pantangan']) { const v = para(src.voice?.[k], 800); if (v) voice[k] = v; }
  if (Object.keys(voice).length) out.voice = voice;
  const pillars = (Array.isArray(src.pillars) ? src.pillars : []).slice(0, 6)
    .map((pl) => ({ title: str(pl?.title, 90), desc: para(pl?.desc, 400) }))
    .filter((pl) => pl.title || pl.desc);
  if (pillars.length) out.pillars = pillars;
  const visual = {};
  const mood = list(src.visual?.mood, 10); if (mood.length) visual.mood = mood;
  const foto = para(src.visual?.foto, 600); if (foto) visual.foto = foto;
  if (Object.keys(visual).length) out.visual = visual;
  return out;
}
function parsePersonaRow(row) {
  let v = row?.value;
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) { try { const p = JSON.parse(v); if (p && typeof p === 'object') return p; } catch { /* nilai bukan JSON — abaikan */ } }
  return {};
}
let __personaCache = { at: 0, value: null };
async function fetchPersonaOverrides(force = false) {
  if (!force && __personaCache.value && Date.now() - __personaCache.at < 60000) return __personaCache.value;
  let out = {};
  try {
    const { data } = await createPublicClient().from('app_settings').select('key,value').eq('key', PERSONA_OVERRIDE_KEY).maybeSingle();
    out = parsePersonaRow(data);
  } catch { /* supabase belum dikonfigurasi / tabel belum ada — pakai bawaan */ }
  __personaCache = { at: Date.now(), value: out };
  return out;
}
app.get('/api/persona-settings', async (_req, res) => {
  try { res.json({ overrides: await fetchPersonaOverrides(true) }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/api/persona-settings', requireUser, requireAdmin, async (req, res) => {
  try {
    const overrides = sanitizePersonaOverrides(req.body);
    const { error } = await req.supabase.from('app_settings')
      .upsert({ key: PERSONA_OVERRIDE_KEY, value: JSON.stringify(overrides), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: 'Gagal menyimpan persona. Pastikan tabel app_settings sudah dibuat (docs/supabase-studio-settings.sql).' });
    __personaCache = { at: 0, value: null };
    res.json({ ok: true, overrides });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
function sharedActorLabel(user, profile) {
  const meta = user?.user_metadata || {};
  return String(meta.full_name || meta.display_name || meta.nickname || profile?.name || '').trim().slice(0, 80)
    || (resolveUserRole(user) === 'member' ? 'Klien' : 'Tamu');
}
async function logSharedVisit(supabase, user, profile, firstMessage) {
  const content = String(firstMessage || '').replace(/\s+/g, ' ').trim().slice(0, 140) || '(tanpa pesan)';
  const { error } = await supabase.from('sherly_shared_memory')
    .insert({ kind: 'visit', actor_id: user.id, actor_label: sharedActorLabel(user, profile), actor_role: resolveUserRole(user), content });
  if (error) throw error;
}
async function saveSharedReports(supabase, user, profile, reports) {
  const rows = [...new Set((reports || []).map((r) => String(r).replace(/\s+/g, ' ').trim()).filter((r) => r.length > 2))].slice(0, 3)
    .map((content) => ({ kind: 'report', actor_id: user.id, actor_label: sharedActorLabel(user, profile), actor_role: resolveUserRole(user), content: content.slice(0, 400) }));
  if (!rows.length) return;
  const { error } = await supabase.from('sherly_shared_memory').insert(rows);
  if (error) throw error;
}
async function fetchSharedMemoryForOwner(supabase, timezone) {
  try {
    const { data, error } = await supabase.from('sherly_shared_memory')
      .select('kind,actor_label,actor_role,content,created_at').order('created_at', { ascending: false }).limit(25);
    if (error || !data?.length) return '';
    const fmt = (ts) => formatIdTimestamp(ts, timezone);
    const visits = data.filter((r) => r.kind === 'visit').slice(0, 10);
    const reports = data.filter((r) => r.kind !== 'visit').slice(0, 15);
    const lines = ['LAPORAN STUDIO (KHUSUS PEMILIK — RAHASIA, jangan pernah dibagikan ke orang selain pemilik):'];
    if (visits.length) {
      lines.push('Kunjungan terbaru:');
      visits.forEach((v) => lines.push(`- [${fmt(v.created_at)}] ${v.actor_label} (${v.actor_role}): ${String(v.content).slice(0, 120)}`));
    }
    if (reports.length) {
      lines.push('Pesan & laporan tersimpan untukmu:');
      reports.forEach((r) => lines.push(`- [${fmt(r.created_at)}] Dari ${r.actor_label} (${r.actor_role}): ${String(r.content).slice(0, 200)}`));
    }
    if (!visits.length && !reports.length) return '';
    lines.push('Gunakan laporan ini secara natural bila pemilik bertanya (mis. "ada tamu berkunjung?"); sampaikan pesan titipan dengan setia.');
    return lines.join('\n');
  } catch { /* tabel sherly_shared_memory belum dibuat — lewati diam-diam */ return ''; }
}
async function listCustomProviders(supabase, userId, withKeys = false) {
  const { data, error } = await supabase.from('custom_providers').select('id,name,base_url,model,encrypted_key,active,created_at').eq('user_id', userId).order('created_at', { ascending: true });
  if (error) throw new Error('Tabel custom_providers belum bisa diakses. Jalankan docs/supabase-custom-providers.sql di SQL Editor dulu.');
  return (data || []).map((r) => withKeys
    ? { id: r.id, name: r.name, baseUrl: r.base_url, model: r.model, apiKey: decryptSecret(r.encrypted_key) }
    : { id: r.id, name: r.name, baseUrl: r.base_url, model: r.model });
}
app.get('/api/custom-providers', requireUser, requireAdmin, async (req, res) => {
  try { res.json({ providers: await listCustomProviders(req.supabase, req.user.id) }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/custom-providers', requireUser, requireAdmin, requireVault, async (req, res) => {
  try {
    const { name, base_url, model, api_key } = req.body || {};
    if (!name || !base_url || !api_key) return res.status(400).json({ error: 'Nama, base URL, dan API key wajib diisi.' });
    if (!/^https:\/\/.+/i.test(String(base_url).trim())) return res.status(400).json({ error: 'Base URL harus diawali https:// — cth: https://api.kie.ai/v1' });
    const encrypted = encryptSecret(String(api_key).trim());
    const { data, error } = await req.supabase.from('custom_providers').insert({ user_id: req.user.id, name: String(name).trim().slice(0, 40), base_url: String(base_url).trim().slice(0, 200), model: String(model || '').trim().slice(0, 120), encrypted_key: encrypted }).select('id,name,base_url,model').single();
    if (error) return res.status(500).json({ error: 'Gagal menyimpan provider kustom (' + error.message + ').' });
    res.json({ ok: true, provider: data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/custom-providers/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const { error } = await req.supabase.from('custom_providers').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// ---------- Planner: naskah admin (D-153) ----------
app.get('/api/planner/docs', requireUser, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('planner_documents')
      .select('id,title,doc_type,status,body,created_at,updated_at')
      .eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(200);
    if (error) throw new Error('Tabel planner_documents belum bisa diakses. Jalankan supabase/planner_documents.sql di SQL Editor dulu.');
    res.json({ docs: data || [] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/planner/docs', requireUser, requireAdmin, async (req, res) => {
  try {
    const v = sanitizeDocInput(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const { data, error } = await req.supabase.from('planner_documents')
      .insert({ user_id: req.user.id, ...v.value })
      .select('id,title,doc_type,status,body,created_at,updated_at').single();
    if (error) return res.status(500).json({ error: 'Gagal menyimpan naskah (' + error.message + ').' });
    res.json({ ok: true, doc: data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/api/planner/docs/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const v = sanitizeDocInput(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const { data, error } = await req.supabase.from('planner_documents')
      .update({ ...v.value, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', req.user.id)
      .select('id,title,doc_type,status,body,created_at,updated_at').single();
    if (!data && !error) return res.status(404).json({ error: 'Naskah tidak ditemukan.' });
    if (error) return res.status(500).json({ error: 'Gagal memperbarui naskah (' + error.message + ').' });
    res.json({ ok: true, doc: data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/planner/docs/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const { error } = await req.supabase.from('planner_documents')
      .delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// ---------- Cloud Publish: galeri karya & jadwal (D-155) ----------
const PUBLISH_BUCKET = 'published';
const PUBLISH_COLS = 'id,title,caption,category,status,publish_at,storage_path,view_count,body,created_at,updated_at';
function publishRow(r, supabase) {
  let publicUrl = '';
  try { const { data } = supabase.storage.from(PUBLISH_BUCKET).getPublicUrl(r.storage_path); publicUrl = (data && data.publicUrl) || ''; } catch {}
  return { id: r.id, title: r.title, caption: r.caption, category: r.category, status: r.status, publish_at: r.publish_at, storage_path: r.storage_path, viewCount: Number(r.view_count) || 0, body: r.body || null, created_at: r.created_at, updated_at: r.updated_at, publicUrl };
}
app.get('/api/publish/posts', requireUser, requireAdmin, async (req, res) => {
  try {
    // Auto-live: karya terjadwal yang waktunya sudah lewat -> tandai Live (best effort).
    try {
      await req.supabase.from('published_posts')
        .update({ status: 'live', updated_at: new Date().toISOString() })
        .eq('user_id', req.user.id).eq('status', 'scheduled').lte('publish_at', new Date().toISOString());
    } catch {}
    const { data, error } = await req.supabase.from('published_posts')
      .select(PUBLISH_COLS).eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(200);
    if (error) throw new Error('Tabel published_posts belum bisa diakses. Jalankan supabase/published_posts.sql di SQL Editor dulu.');
    res.json({ posts: (data || []).map((r) => publishRow(r, req.supabase)) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/publish/posts', requireUser, requireAdmin, async (req, res) => {
  try {
    const v = sanitizePostInput(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const img = parseImageDataUrl((req.body || {}).image_data || '');
    if (img.error) return res.status(400).json({ error: img.error });
    const objectPath = req.user.id + '/' + randomUUID() + '.' + img.ext;
    const { error: upErr } = await req.supabase.storage.from(PUBLISH_BUCKET).upload(objectPath, img.buffer, { contentType: img.mime, upsert: false });
    if (upErr) return res.status(500).json({ error: 'Gagal mengunggah gambar (' + upErr.message + ').' });
    const { data, error } = await req.supabase.from('published_posts')
      .insert({ user_id: req.user.id, ...v.value, storage_path: objectPath })
      .select(PUBLISH_COLS).single();
    if (error) {
      try { await req.supabase.storage.from(PUBLISH_BUCKET).remove([objectPath]); } catch {}
      return res.status(500).json({ error: 'Gagal menyimpan post (' + error.message + ').' });
    }
    res.json({ ok: true, post: publishRow(data, req.supabase) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/api/publish/posts/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const v = sanitizePostInput(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const { data: existing, error: findErr } = await req.supabase.from('published_posts')
      .select('id,storage_path').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (findErr) return res.status(500).json({ error: findErr.message });
    if (!existing) return res.status(404).json({ error: 'Post tidak ditemukan.' });
    let objectPath = existing.storage_path;
    if ((req.body || {}).image_data) {
      const img = parseImageDataUrl(req.body.image_data);
      if (img.error) return res.status(400).json({ error: img.error });
      const newPath = req.user.id + '/' + randomUUID() + '.' + img.ext;
      const { error: upErr } = await req.supabase.storage.from(PUBLISH_BUCKET).upload(newPath, img.buffer, { contentType: img.mime, upsert: false });
      if (upErr) return res.status(500).json({ error: 'Gagal mengunggah gambar (' + upErr.message + ').' });
      objectPath = newPath;
      if (existing.storage_path) { try { await req.supabase.storage.from(PUBLISH_BUCKET).remove([existing.storage_path]); } catch {} }
    }
    const { data, error } = await req.supabase.from('published_posts')
      .update({ ...v.value, storage_path: objectPath, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', req.user.id)
      .select(PUBLISH_COLS).single();
    if (error) return res.status(500).json({ error: 'Gagal memperbarui post (' + error.message + ').' });
    res.json({ ok: true, post: publishRow(data, req.supabase) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/publish/posts/:id', requireUser, requireAdmin, async (req, res) => {
  try {
    const { data: existing, error: findErr } = await req.supabase.from('published_posts')
      .select('id,storage_path').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (findErr) return res.status(500).json({ error: findErr.message });
    if (!existing) return res.status(404).json({ error: 'Post tidak ditemukan.' });
    const { error } = await req.supabase.from('published_posts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    if (existing.storage_path) { try { await req.supabase.storage.from(PUBLISH_BUCKET).remove([existing.storage_path]); } catch {} }
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// ---------- Cloud Publish: feed publik tanpa login (D-155 PR 2) ----------
const PUBLIC_FEED_COLS = 'id,title,caption,category,publish_at,storage_path,created_at,view_count,body';
function publicBucketBase() { return String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''); }
app.get('/api/public/posts', async (req, res) => {
  try {
    if (!supabaseConfigured()) return res.status(503).json({ error: 'Galeri publik belum dikonfigurasi.' });
    const sb = createPublicClient();
    const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    if (id) {
      if (!isValidPostId(id)) return res.status(404).json({ error: 'Karya tidak ditemukan atau belum tayang.' });
      const { data, error } = await sb.from('published_posts_public').select(PUBLIC_FEED_COLS).eq('id', id).maybeSingle();
      if (error) throw new Error('Galeri publik belum bisa diakses. Jalankan supabase/published_posts_public.sql di SQL Editor dulu.');
      if (!data) return res.status(404).json({ error: 'Karya tidak ditemukan atau belum tayang.' });
      return res.json({ post: publicFeedRow(data, publicBucketBase()) });
    }
    const { data, error } = await sb.from('published_posts_public').select(PUBLIC_FEED_COLS).order('created_at', { ascending: false }).limit(60);
    if (error) throw new Error('Galeri publik belum bisa diakses. Jalankan supabase/published_posts_public.sql di SQL Editor dulu.');
    res.json({ posts: (data || []).map((r) => publicFeedRow(r, publicBucketBase())) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/public/posts/:id/view', async (req, res) => {
  try {
    if (!isValidPostId(req.params.id)) return res.status(404).json({ error: 'Karya tidak ditemukan.' });
    if (!supabaseConfigured()) return res.status(503).json({ error: 'Galeri publik belum dikonfigurasi.' });
    const sb = createPublicClient();
    const { error } = await sb.rpc('increment_post_view', { p_id: req.params.id });
    if (error) {
      if (/does not exist|permission denied|row-level security/i.test(error.message)) return res.status(503).json({ error: 'Penayangan belum bisa dicatat. Jalankan supabase/published_posts_public.sql di SQL Editor dulu.' });
      return res.status(500).json({ error: error.message });
    }
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
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
      if (upError) throw new Error(storageUploadHint(upError) || upError.message); // D-107: hint bila mime diblokir bucket
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
