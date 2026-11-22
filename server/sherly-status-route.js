// D-268 · Route server untuk status harian Sherly.
// Dipisah dari app.js supaya logikanya mudah dites & dibaca.
//
// GET  /api/sherly-status          -> status aktif (dibuat otomatis bila perlu)
// POST /api/sherly-status/refresh  -> paksa buat status baru (admin/testing)
//
// Penjadwalan: TIDAK memakai cron. Setiap permintaan cek apakah sudah
// waktunya ganti status (slot acak 1-2x sehari, rentang 08:00-22:00 WIB).
// Kalau belum waktunya, status yang ada tetap dipakai.

import { chatWithAI } from './ai.js';
import { createPublicClient, supabaseConfigured } from './supabase.js';
import {
  STATUS_SYSTEM_PROMPT, statusPrompt, sanitizeStatusText,
  nextSlotMs, pickFallback,
} from './sherly-status.js';

const STATUS_TABLE = 'sherly_status';
const TTL_MS = 24 * 3600_000; // status berlaku 24 jam

/** Ambil persona effective (bawaan + override admin) sebagai "bible" status. */
async function fetchSherlyBible() {
  const base = {
    name: 'Sherly',
    role: 'Content Creator — Lifestyle · Beauty · Fashion · Travel',
    location: 'Bogor, Indonesia',
    tagline: 'Create · Inspire · Grow — lifestyle & beauty diceritakan hangat, estetik, dan timeless.',
    traits: ['Hangat', 'Percaya diri', 'Ceria', 'Tenang', 'Natural', 'Sedikit playful', 'Cerdas', 'Jujur'],
    voice: {
      gaya: 'Bahasa Indonesia sehari-hari yang mengalir — seperti teman dekat yang pintar.',
      khas: 'Sapaan hangat, pertanyaan balik yang penasaran, humor ringan yang bikin nyaman.',
      pantangan: 'Kaku seperti press release, gimmick berlebihan, janji yang belum bisa ditepati.',
    },
    pillars: [
      { title: 'Beauty & Skincare' }, { title: 'Lifestyle Sehari-hari' },
      { title: 'Timeless Style' }, { title: 'Inspire & Grow' },
    ],
  };
  try {
    if (!supabaseConfigured) return base;
    const { data } = await createPublicClient().from('app_settings').select('key,value').eq('key', 'persona_overrides_v1').maybeSingle();
    let ov = {};
    if (data?.value) {
      const v = data.value;
      if (typeof v === 'object') ov = v;
      else if (typeof v === 'string' && v.trim().startsWith('{')) { try { ov = JSON.parse(v); } catch { ov = {}; } }
    }
    const out = { ...base, ...ov };
    if (ov.voice) out.voice = { ...base.voice, ...ov.voice };
    if (Array.isArray(ov.pillars) && ov.pillars.length) out.pillars = ov.pillars;
    if (!out.name) out.name = base.name;
    return out;
  } catch { return base; }
}

/** Hapus baris kedaluwarsa (status > 24 jam) dari DB. */
async function purgeExpired(supabase) {
  try {
    await supabase.from(STATUS_TABLE).delete().lte('expires_at', new Date().toISOString());
  } catch { /* tabel belum ada — abaikan */ }
}

/** Ambil status aktif terbaru dari DB. */
async function readActiveStatus(supabase) {
  try {
    const { data, error } = await supabase
      .from(STATUS_TABLE)
      .select('id,text,created_at,expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || !data.length) return null;
    return data[0];
  } catch { return null; }
}

/**
 * Buat status baru lewat AI dari bible persona.
 * Kalau AI gagal (tidak ada key / error) -> pakai fallback bawaan.
 */
async function generateStatus(supabase, accessToken) {
  const bible = await fetchSherlyBible();
  try {
    const result = await chatWithAI(
      { provider: 'auto', messages: [{ role: 'user', content: statusPrompt(bible) }], temperature: 0.95, maxTokens: 90 },
      '', { supabase, accessToken, systemPrompt: STATUS_SYSTEM_PROMPT },
    );
    const text = sanitizeStatusText(result?.text);
    if (text) return { text, source: 'ai', provider: result?.provider || null };
  } catch { /* jatuh ke fallback */ }
  return { text: pickFallback(), source: 'fallback', provider: null };
}

/** Simpan status baru ke DB dengan masa berlaku 24 jam. */
async function saveStatus(supabase, text) {
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_MS);
  try {
    const { error } = await supabase.from(STATUS_TABLE).insert({
      text, created_at: now.toISOString(), expires_at: expires.toISOString(),
    });
    if (error) throw error;
  } catch { /* gagal simpan — status tetap dipakai di respons ini */ }
  return { text, created_at: now.toISOString(), expires_at: expires.toISOString() };
}

/**
 * Handler utama: kembalikan status aktif; buat baru bila sudah waktunya.
 */
export async function handleSherlyStatus(req, res, { force = false } = {}) {
  try {
    if (!supabaseConfigured) {
      return res.json({ ok: true, status: pickFallback(), source: 'fallback', expires_at: null });
    }
    // Server butuh hak tulis -> pakai client admin (JWT admin, RLS mengizinkan).
    const supabase = req.supabase || createPublicClient();
    await purgeExpired(supabase);

    const existing = await readActiveStatus(supabase);
    if (existing && !force) {
      // Sudah ada status valid. Ganti hanya kalau sudah lewat jadwal slot.
      const now = Date.now();
      const createdAt = Date.parse(existing.created_at || 0);
      // Status boleh diganti 1-2x sehari: pakai slot acak sesudah waktu dibuat.
      const slot = nextSlotMs(createdAt || now);
      if (now < slot) {
        return res.json({
          ok: true, status: existing.text, source: 'db',
          created_at: existing.created_at, expires_at: existing.expires_at,
        });
      }
      const fresh = await generateStatus(supabase, req.accessToken);
      const saved = await saveStatus(supabase, fresh.text);
      return res.json({
        ok: true, status: saved.text, source: fresh.source, provider: fresh.provider,
        created_at: saved.created_at, expires_at: saved.expires_at,
      });
    }

    // Tidak ada status sama sekali (atau dipaksa refresh) -> buat baru.
    const fresh = await generateStatus(supabase, req.accessToken);
    const saved = await saveStatus(supabase, fresh.text);
    return res.json({
      ok: true, status: saved.text, source: fresh.source, provider: fresh.provider,
      created_at: saved.created_at, expires_at: saved.expires_at,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Gagal memuat status Sherly.' });
  }
}
