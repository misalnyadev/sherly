// D-268 · Status harian Sherly — dibuat otomatis AI, berlaku 24 jam,
// lalu dihapus otomatis dari DB.
//
// Yang diuji (logika murni, tanpa jaringan):
//   - sanitasi teks status (buang tag, label "Status:", potong 160 char)
//   - jadwal acak 1-2x sehari di rentang 08:00-22:00 (WIB)
//   - fallback status kalau AI gagal
//   - route: pakai status valid dari DB, buat baru saat perlu, purge expired
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STATUS_FALLBACKS, STATUS_SYSTEM_PROMPT, sanitizeStatusText,
  nextSlotMs, pickFallback, statusPrompt,
} from '../server/sherly-status.js';

const appJs = readFileSync('server/app.js', 'utf8');
const routeJs = readFileSync('server/sherly-status-route.js', 'utf8');
const clientJs = readFileSync('public/chat-module.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');
const sql = readFileSync('docs/supabase-sherly-status.sql', 'utf8');

test('D-268: sanitasi teks status membuang tag, label, dan memotong panjang', () => {
  assert.equal(sanitizeStatusText('<b>Lagi ngopi</b>'), 'Lagi ngopi');
  assert.equal(sanitizeStatusText('Status: Lagi edit foto'), 'Lagi edit foto');
  assert.equal(sanitizeStatusText('   Lagi   cari   angle   '), 'Lagi cari angle');
  assert.equal(sanitizeStatusText(''), '');
  assert.equal(sanitizeStatusText(null), '');
  // Terlalu panjang -> dipotong 160 char.
  const long = 'a'.repeat(300);
  assert.equal(sanitizeStatusText(long).length, 160);
});

test('D-268: jadwal acak 1-2x sehari di rentang 08:00-22:00 WIB', () => {
  const HOUR = 3600_000;
  const now = Date.UTC(2026, 0, 15, 3, 0, 0); // 03:00 UTC = 10:00 WIB
  const wibHour = (ms) => (new Date(ms + 7 * HOUR).getUTCHours());
  // 20 slot acak: semua harus di rentang 08:00-22:00 WIB dan di masa depan.
  for (let i = 0; i < 20; i += 1) {
    const slot = nextSlotMs(now, () => i / 20);
    const h = wibHour(slot);
    assert.ok(h >= 8 && h < 22, `slot di luar rentang 08:00-22:00 WIB: ${h}`);
    assert.ok(slot > now, 'slot harus di masa depan');
  }
  // Jarak minimal antar slot — dicek DALAM satu jadwal (slot yang sama).
  // Slot berikutnya dari jadwal yang sama harus >= 3 jam setelah slot pertama.
  const rand = () => 0.5; // rand tetap -> jadwal deterministik
  const first = nextSlotMs(now, rand);
  const second = nextSlotMs(first, rand);
  assert.ok(second - first >= 3 * HOUR,
    `jarak antar slot dalam satu jadwal ${((second - first) / HOUR).toFixed(1)} jam (< 3 jam)`);
  // Kalau semua slot sudah lewat -> tetap mengembalikan waktu masa depan.
  const far = nextSlotMs(Date.now() + 400 * 24 * HOUR);
  assert.ok(far > Date.now() + 400 * 24 * HOUR);
});

test('D-268: fallback status tersedia dan acak', () => {
  assert.ok(Array.isArray(STATUS_FALLBACKS) && STATUS_FALLBACKS.length >= 5);
  for (const s of STATUS_FALLBACKS) {
    assert.ok(typeof s === 'string' && s.trim().length > 5, `fallback tidak valid: ${s}`);
    assert.ok(s.length <= 160, 'fallback kepanjangan');
  }
  // Dua pemanggilan berbeda -> bisa beda (acak), tapi selalu dari daftar.
  const a = pickFallback();
  const b = pickFallback();
  assert.ok(STATUS_FALLBACKS.includes(a) && STATUS_FALLBACKS.includes(b));
  // Fallback harus memakai huruf latin normal (tidak ada karakter aneh).
  for (const s of STATUS_FALLBACKS) assert.ok(/^[\x20-\x7E\u00C0-\u024F·—]+$/.test(s), `fallback ada karakter aneh: ${s}`);
});

test('D-268: prompt status membawa bible persona & aturan tanpa emoji', () => {
  const bible = {
    name: 'Sherly', role: 'Content Creator', location: 'Bogor',
    traits: ['Hangat', 'Ceria'], voice: { gaya: 'Santai', khas: 'Hangat', pantangan: 'Kaku' },
    pillars: [{ title: 'Beauty & Skincare' }],
  };
  const p = statusPrompt(bible);
  assert.ok(p.includes('Sherly'), 'prompt harus pakai nama persona');
  assert.ok(p.includes('Bogor'), 'prompt harus pakai lokasi');
  assert.ok(p.includes('Hangat'), 'prompt harus pakai sifat persona');
  assert.ok(p.includes('Beauty & Skincare'), 'prompt harus pakai pilar konten');
  assert.ok(p.includes('WIB'), 'prompt harus tahu zona waktu');
  assert.ok(/JANGAN.*emoji/i.test(p), 'prompt harus melarang emoji');
  assert.ok(/HANYA/.test(p), 'prompt harus minta jawaban singkat saja');
  // System prompt: persona tetap manusia & nada santai.
  assert.ok(STATUS_SYSTEM_PROMPT.includes('Sherly'));
  assert.ok(/tanpa emoji/i.test(STATUS_SYSTEM_PROMPT));
});

test('D-268: route server terdaftar &Endpoint publik + refresh admin', () => {
  assert.ok(appJs.includes("app.get('/api/sherly-status'"), 'route GET /api/sherly-status harus ada');
  assert.ok(appJs.includes("app.post('/api/sherly-status/refresh'"), 'route refresh harus ada');
  assert.ok(appJs.includes('handleSherlyStatus'), 'handler harus di-import');
  // Refresh wajib butuh admin (bukan publik).
  const refreshIdx = appJs.indexOf("app.post('/api/sherly-status/refresh'");
  const refreshLine = appJs.slice(refreshIdx, appJs.indexOf('\n', refreshIdx));
  assert.ok(refreshLine.includes('requireAdmin'), 'refresh harus dibatasi admin');
  // GET harus publik (tanpa requireUser) — tamu pun boleh lihat status.
  const getIdx = appJs.indexOf("app.get('/api/sherly-status'");
  const getLine = appJs.slice(getIdx, appJs.indexOf('\n', getIdx));
  assert.ok(!getLine.includes('requireUser'), 'GET status harus publik');
});

test('D-268: route memakai status valid dari DB sebelum membuat yang baru', () => {
  assert.ok(routeJs.includes('readActiveStatus'), 'harus cek status aktif di DB');
  assert.ok(routeJs.includes('.gt(\'expires_at\''), 'harus hanya ambil status yang belum expired');
  assert.ok(routeJs.includes('purgeExpired'), 'harus bersihkan status kedaluwarsa');
  assert.ok(routeJs.includes('delete().lte(\'expires_at\''), 'purge harus hapus yang expires_at <= now');
  // TTL 24 jam.
  assert.ok(routeJs.includes('24 * 3600_000'), 'TTL status harus 24 jam');
  // Kalau status masih ada & belum waktunya ganti -> pakai yang ada.
  assert.ok(routeJs.includes('if (existing && !force)'), 'status valid harus dipakai lagi');
  assert.ok(routeJs.includes('now < slot'), 'hanya ganti kalau sudah lewat jadwal');
});

test('D-268: status baru disimpan dengan masa berlaku 24 jam', () => {
  assert.ok(routeJs.includes('expires_at: expires.toISOString()'), 'harus simpan expires_at');
  assert.ok(routeJs.includes('created_at: now.toISOString()'), 'harus simpan created_at');
  // Generate lewat AI, fallback kalau gagal.
  assert.ok(routeJs.includes('chatWithAI'), 'status harus dibuat lewat AI');
  assert.ok(routeJs.includes("provider: 'auto'"), 'AI harus pakai auto (provider terbaik)');
  assert.ok(routeJs.includes('pickFallback'), 'harus ada fallback kalau AI gagal');
  assert.ok(routeJs.includes('temperature: 0.95'), 'temperature tinggi biar status varyatif');
});

test('D-268: skema DB — tabel sherly_status + RLS + expires 24 jam', () => {
  assert.ok(sql.includes('create table if not exists public.sherly_status'), 'tabel sherly_status harus ada');
  assert.ok(sql.includes("expires_at timestamptz not null default now() + interval '24 hours'"),
    'default expires_at harus now() + 24 jam');
  assert.ok(sql.includes('enable row level security'), 'RLS harus aktif');
  // Baca publik (tamu boleh), tulis hanya admin.
  assert.ok(sql.includes('"sherly status public read"'), 'policy baca publik harus ada');
  assert.ok(sql.includes('"sherly status admin write"'), 'policy tulis admin harus ada');
  assert.ok(sql.includes("->> 'role') = 'admin'"), 'tulis harus cek role admin');
  // Fungsi cleanup.
  assert.ok(sql.includes('cleanup_sherly_status'), 'fungsi cleanup harus ada');
  assert.ok(sql.includes('delete from public.sherly_status where expires_at <= now()'),
    'cleanup harus hapus status kedaluwarsa');
});

test('D-268: client menampilkan status di header chat & panel Beranda', () => {
  assert.ok(clientJs.includes('id="ssStatusText"'), 'header chat harus punya elemen status');
  assert.ok(clientJs.includes("fetch('/api/sherly-status'"), 'client harus ambil status dari API');
  assert.ok(clientJs.includes('loadSherlyStatus'), 'fungsi pemuat status harus ada');
  // Dipanggil saat chat dibuka & saat halaman load.
  assert.ok(/function openChat\(\)[^}]*loadSherlyStatus\(\)/s.test(clientJs), 'status harus diambil saat chat dibuka');
  assert.ok(clientJs.includes("addEventListener('DOMContentLoaded'"), 'status harus diambil saat halaman load');
  // Panel Beranda ikut menampilkan status yang sama.
  assert.ok(html.includes('id="homeSherlyStatus"'), 'panel Beranda harus punya elemen status');
  assert.ok(clientJs.includes('homeSherlyStatus'), 'client harus mengisi panel Beranda');
});
